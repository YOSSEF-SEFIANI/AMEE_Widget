/** @jsx jsx */
import {
  React,
  jsx,
  css,
  polished,
  Immutable,
  type ImmutableArray,
  classNames,
  hooks,
} from "jimu-core";
import {
  Navbar,
  Nav,
  NavLink,
  NavItem,
  Loading,
  LoadingType,
  defaultMessages as jimuUiDefaultMessage,
} from "jimu-ui";
import { type JimuMapView, MapViewManager } from "jimu-arcgis";
import {
  type IMConfig,
  type IMPrintTemplateProperties,
  type PrintTemplateProperties,
  Views,
  type MapView,
  type IMPrintResultList,
  type PrintResultList,
  PrintResultState,
  type PrintResultListItemType,
  type OutputDataSourceWarningOption,
  type ChartPrintOptions,
} from "../../../config";
import TemplateSetting from "./template-setting";
import Result from "./result";
import defaultMessage from "../../translations/default";
import { print } from "../../utils/print-service";
import {
  getNewResultItemTitle,
  getNewResultId,
  getPreviewLayerId,
  initTemplateProperties,
} from "../../utils/utils";
import {
  getIndexByTemplateId,
  checkIsTemplateExist,
  mergeTemplateSetting,
} from "../../../utils/utils";
import UtilityErrorRemind from "../utility-remind";
// Import du service d'impression de diagrammes
import {
  createChartPrintElement,
  addChartToTemplate,
  printChartOnly,
} from "../../utils";
const { useState, useRef, useEffect } = React;

interface Props {
  id: string;
  showUtilityErrorRemind: boolean;
  locale: string;
  config: IMConfig;
  jimuMapView: JimuMapView;
  useMapWidgetIds: ImmutableArray<string>;
  templateList: ImmutableArray<PrintTemplateProperties>;
  outputDataSourceWarning: OutputDataSourceWarningOption;
  handleSelectedTemplateIndexChange: (index: number) => void;
  toggleUtilityErrorRemind: (isShow?: boolean) => void;
  // Props pour l'impression de diagrammes
  availableChartWidgets?: Array<{ id: string; label: string }>;
  chartPrintOptions?: ChartPrintOptions;
}

const STYLE = css`
  .classic-setting-con {
    height: 0;
  }
  .nav-bar-con {
    height: ${polished.rem(40)};
    border: none !important;
    border-bottom: 1px solid var(--ref-palette-neutral-300) !important;
    padding: 0;
    .navbar-nav button.nav-link:not(.active),
    .navbar-nav button.nav-link:hover:not(.active) {
      color: var(--ref-palette-neutral-1100);
    }
    .loading-con {
      min-width: 16px;
      height: 16px;
      margin-top: -1px;
    }
    .jimu-nav-link-wrapper .jimu-badge-wrapper {
      & {
        display: block;
      }
      .badge-dot {
        top: ${polished.rem(4)};
        right: ${polished.rem(4)};
      }
    }
  }
`;

const Classic = (props: Props) => {
  const nls = hooks.useTranslation(defaultMessage, jimuUiDefaultMessage);
  const printResultListRef = useRef([] as PrintResultList);
  const oldPrintResultListRef = useRef([] as PrintResultList);
  const preDefaultValueSelectedTemplate = useRef(
    null as IMPrintTemplateProperties,
  );

  const {
    config,
    jimuMapView,
    templateList,
    id,
    locale,
    useMapWidgetIds,
    outputDataSourceWarning,
    showUtilityErrorRemind,
    handleSelectedTemplateIndexChange,
    toggleUtilityErrorRemind,
    availableChartWidgets,
    chartPrintOptions,
  } = props;
  const [views, setViews] = useState(Views.PrintTemplate);
  const [printResultList, setPrintResultList] = useState(
    Immutable([]) as IMPrintResultList,
  );
  const [selectedTemplate, setSelectedTemplate] = useState(
    null as IMPrintTemplateProperties,
  );

  useEffect(() => {
    setSelectedTemplateByIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (
      selectedTemplate &&
      checkIsTemplateExist(templateList, selectedTemplate?.templateId)
    ) {
      const index = getIndexByTemplateId(
        templateList?.asMutable({ deep: true }),
        selectedTemplate?.templateId,
      );
      const templateInConfig = getNewTemplateWithCommonSetting(
        templateList?.[index],
      )?.asMutable({ deep: true });
      getNewSelectedTempWhenConfigChange(templateInConfig);
      preDefaultValueSelectedTemplate.current = Immutable(templateInConfig);
    }
    if (
      !selectedTemplate ||
      !checkIsTemplateExist(templateList, selectedTemplate?.templateId)
    ) {
      setSelectedTemplateByIndex(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateList, config]);

  const getNewSelectedTempWhenConfigChange = (
    templateInConfig: PrintTemplateProperties,
  ) => {
    let currentSelectedTemplate = selectedTemplate?.asMutable({ deep: true });
    for (const key in currentSelectedTemplate) {
      if (key.includes("enable")) {
        delete currentSelectedTemplate[key];
      }
    }

    //Reset diff item
    const diffKeys = getKeyChangedSettingItem(
      templateInConfig,
      preDefaultValueSelectedTemplate.current?.asMutable({ deep: true }),
    );
    if (diffKeys.length > 0) {
      diffKeys.forEach((keys) => {
        const diffValue = getValueFromPath(templateInConfig, keys);
        currentSelectedTemplate = Immutable(currentSelectedTemplate)
          .setIn(keys.split("."), diffValue)
          .asMutable({ deep: true });
      });
    }

    currentSelectedTemplate.customTextElementEnableList =
      templateInConfig?.customTextElementEnableList;
    currentSelectedTemplate.selectedFormatList =
      templateInConfig?.selectedFormatList;
    const newSelectedTemplate = Immutable({
      ...templateInConfig,
      ...currentSelectedTemplate,
    });
    handleSelectedTemplateChange(newSelectedTemplate);
  };

  /**
   * The return value is in the form of ['a.0.c', 'a.b.c']
   */
  const getKeyChangedSettingItem = (json1, json2): string[] => {
    const changedKeys = [];

    const checkChanges = (obj1, obj2, currentKey) => {
      for (const key in obj1) {
        const value1 = obj1[key];
        const value2 = obj2?.[key];
        const newKey = currentKey ? `${currentKey}.${key}` : key;
        const valueNotNull = value1 !== null && value2 !== null;
        if (
          typeof value1 === "object" &&
          typeof value2 === "object" &&
          valueNotNull
        ) {
          checkChanges(value1, value2, newKey);
        } else if (value1 !== value2) {
          changedKeys.push(newKey);
        }
      }
    };

    checkChanges(json1, json2, "");

    return changedKeys;
  };

  /**
   *path is in the form of 'a.0.c'
   */
  const getValueFromPath = (obj: any, path: string) => {
    const keys = path.split(".");
    let value = obj;
    for (const key of keys) {
      value = value?.[key];
    }
    return value;
  };

  const setSelectedTemplateByIndex = (index: number) => {
    if (templateList?.length === 0) return false;
    const template = getNewTemplateWithCommonSetting(templateList?.[index]);
    preDefaultValueSelectedTemplate.current = template;
    handleSelectedTemplateIndexChange(index);
    handleSelectedTemplateChange(template);
  };

  const getNewTemplateWithCommonSetting = (
    template: IMPrintTemplateProperties,
  ): IMPrintTemplateProperties => {
    if (!template) return null;
    if (template?.overrideCommonSetting) {
      template = mergeTemplateSetting(
        Immutable(config?.commonSetting),
        Immutable(template),
      );
    } else {
      template = mergeTemplateSetting(
        Immutable(template),
        Immutable(config?.commonSetting),
      );
    }
    return template;
  };

  const handleSelectedTemplateChange = (
    template: IMPrintTemplateProperties,
  ) => {
    setSelectedTemplate(template);
  };

  const toggleNav = (views: Views) => {
    setViews(views);
    if (views === Views.PrintResult) {
      oldPrintResultListRef.current = Immutable(
        printResultListRef.current,
      ).asMutable();
    }
  };

  const togglePreviewLayer = (visible: boolean) => {
    // Vérifier que jimuMapView existe avant d'accéder à ses propriétés
    if (!jimuMapView) {
      console.warn("togglePreviewLayer: jimuMapView is null");
      return;
    }
    const layerId = getPreviewLayerId(id, jimuMapView.id);
    const graphicsLayer = jimuMapView.view.map.findLayerById(layerId);
    if (graphicsLayer) {
      graphicsLayer.visible = visible;
    }
  };

  //Confirm print - soit carte, soit chart (pas les deux)
  const confirmPrint = async (
    printTemplateProperties: IMPrintTemplateProperties,
  ) => {
    const hasMap = !!jimuMapView;
    const hasChartConfig =
      chartPrintOptions?.includeChartInPrint &&
      chartPrintOptions?.chartWidgetId;

    // Vérifier qu'on a au moins une source d'impression
    if (!hasMap && !hasChartConfig) {
      console.error(
        "confirmPrint: Cannot print - no map and no chart configured.",
      );
      return;
    }

    const resultItem = {
      resultId: getNewResultId(Immutable(printResultListRef.current)),
      url: null,
      title: getNewResultItemTitle(
        printTemplateProperties?.layoutOptions?.titleText,
        Immutable(printResultListRef.current),
      ),
      state: PrintResultState.Loading,
    };
    const newPrintResultList = printResultListRef.current;
    const isSupportReport =
      config?.supportCustomReport || config?.supportReport;
    newPrintResultList.push(resultItem);
    printResultListRef.current = newPrintResultList;
    setPrintResultList(Immutable(newPrintResultList));
    togglePreviewLayer(false);

    // PRIORITÉ AU CHART: Si un chart est configuré, imprimer UNIQUEMENT le chart
    if (hasChartConfig) {
      try {
        const mutableChartOptions =
          typeof chartPrintOptions?.asMutable === "function"
            ? chartPrintOptions.asMutable({ deep: true })
            : chartPrintOptions;

        const chartElement = await createChartPrintElement(
          chartPrintOptions.chartWidgetId,
          mutableChartOptions,
        );
        if (chartElement) {
          await printChartOnly(chartElement, resultItem.title);
          setNewPrintResultList(resultItem, PrintResultState.Success);
        } else {
          console.error("Chart element could not be captured");
          setNewPrintResultList(resultItem, PrintResultState.Error);
        }
      } catch (error) {
        console.error("Error printing chart:", error);
        setNewPrintResultList(resultItem, PrintResultState.Error);
      }
      return;
    }

    // SINON: Comportement normal avec carte uniquement
    const initTemplatePropertiesParams = {
      printTemplateProperties: selectedTemplate,
      mapView: jimuMapView,
      locale: locale,
      utility: config.useUtility,
      useMapWidgetIds: useMapWidgetIds,
      widgetId: id,
      isSupportReport: isSupportReport,
    };
    let newPrintTemplateProperties = await initTemplateProperties(
      initTemplatePropertiesParams,
    );

    if (!newPrintTemplateProperties) {
      setNewPrintResultList(resultItem, PrintResultState.Error);
      return;
    }

    // NOTE: Pas d'intégration chart+carte - c'est soit l'un soit l'autre

    let newJimuMapView;
    if (isSupportReport) {
      newJimuMapView = MapViewManager.getInstance().getJimuMapViewById(
        jimuMapView.id,
      );
    }
    const mapView = newJimuMapView || jimuMapView;

    print({
      useUtility: config?.useUtility,
      mapView: mapView?.view as MapView,
      printTemplateProperties: newPrintTemplateProperties,
      toggleUtilityErrorRemind: toggleUtilityErrorRemind,
      jimuMapView: jimuMapView,
      useMapWidgetIds: useMapWidgetIds,
      widgetId: id,
      isSupportReport: isSupportReport,
      reportOptions: selectedTemplate?.reportOptions,
      elementOverrides: selectedTemplate?.layoutOptions?.elementOverrides,
    }).then(
      (printResult) => {
        togglePreviewLayer(true);
        setNewPrintResultList(
          resultItem,
          PrintResultState.Success,
          printResult?.url,
        );
      },
      (printError) => {
        togglePreviewLayer(true);
        setNewPrintResultList(resultItem, PrintResultState.Error);
      },
    );
  };

  //Update result list
  const setNewPrintResultList = (
    newPrintResultItem: PrintResultListItemType,
    state: PrintResultState,
    url?: string,
  ) => {
    url && (newPrintResultItem.url = url);
    newPrintResultItem.state = state;

    let newResultItemIndex;
    const newPrintResultList = printResultListRef.current;
    newPrintResultList.forEach((item, index) => {
      if (item.resultId === newPrintResultItem.resultId) {
        newResultItemIndex = index;
      }
    });

    if (newResultItemIndex || newResultItemIndex === 0) {
      newPrintResultList.splice(newResultItemIndex, 1, newPrintResultItem);
      setPrintResultList(Immutable(newPrintResultList));
      printResultListRef.current = newPrintResultList;
    }
  };

  //Delete app item
  const deleteResultItem = (index) => {
    const newPrintResultList = printResultListRef.current;
    newPrintResultList.splice(index, 1);
    setPrintResultList(Immutable(newPrintResultList));
    printResultListRef.current = Immutable(newPrintResultList)?.asMutable({
      deep: true,
    });
    oldPrintResultListRef.current = Immutable(newPrintResultList)?.asMutable({
      deep: true,
    });
  };

  const checkIsShowLoading = (): boolean => {
    return (
      printResultListRef?.current?.filter(
        (item) => item.state === PrintResultState.Loading,
      )?.length > 0
    );
  };

  const renderNavbar = () => {
    const showLoading = checkIsShowLoading() && views === Views.PrintTemplate;
    const resultLength = printResultListRef?.current?.length;
    const resultNumberInText =
      !showLoading && resultLength > 0 ? `(${resultLength})` : "";
    return (
      <Navbar className="nav-bar-con w-100" border={false} light>
        <Nav
          className="w-100 h-100"
          underline
          navbar
          justified={true}
          fill={true}
        >
          <NavItem
            title={nls("printTemplate")}
            onClick={() => {
              toggleNav(Views.PrintTemplate);
            }}
            className="link-con"
          >
            <NavLink tag="button" active={views === Views.PrintTemplate}>
              {nls("printTemplate")}
            </NavLink>
          </NavItem>
          <NavItem
            title={nls("printResult")}
            onClick={() => {
              toggleNav(Views.PrintResult);
            }}
          >
            <NavLink
              className="align-middle"
              tag="button"
              active={views === Views.PrintResult}
            >
              <div className="d-inline-block">
                {nls("resultsNumber", { number: resultNumberInText })}
              </div>
              {showLoading && (
                <div className="loading-con position-relative ml-1 d-inline-block align-middle">
                  <Loading width={16} height={16} type={LoadingType.Donut} />
                </div>
              )}
            </NavLink>
          </NavItem>
        </Nav>
      </Navbar>
    );
  };

  return (
    <div className="w-100 h-100 d-flex flex-column" css={STYLE}>
      {renderNavbar()}
      <div className="flex-grow-1 w-100 classic-setting-con overflow-hidden">
        <div
          className={classNames("w-100 h-100", {
            "sr-only": views !== Views.PrintTemplate,
          })}
        >
          <TemplateSetting
            id={id}
            config={config}
            jimuMapView={jimuMapView}
            selectedTemplate={selectedTemplate}
            templateList={templateList}
            outputDataSourceWarning={outputDataSourceWarning}
            confirmPrint={confirmPrint}
            views={views}
            handleSelectedTemplateChange={handleSelectedTemplateChange}
            setSelectedTemplateByIndex={setSelectedTemplateByIndex}
          />
          {showUtilityErrorRemind && (
            <UtilityErrorRemind
              utilityId={config?.useUtility?.utilityId}
              toggleUtilityErrorRemind={toggleUtilityErrorRemind}
            />
          )}
        </div>
        {views === Views.PrintResult && (
          <Result
            config={config}
            printResultList={printResultList}
            deleteResultItem={deleteResultItem}
          />
        )}
      </div>
    </div>
  );
};

export default Classic;
