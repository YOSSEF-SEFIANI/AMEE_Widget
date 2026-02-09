/** @jsx jsx */
import {
  React,
  jsx,
  css,
  polished,
  type ImmutableArray,
  Immutable,
  classNames,
  ReactRedux,
  type IMState,
  hooks,
} from "jimu-core";
import {
  Button,
  Popper,
  Select,
  Option,
  Icon,
  SVG,
  defaultMessages as jimuUiDefaultMessage,
  type ShiftOptions,
  type FlipOptions,
} from "jimu-ui";
import { type JimuMapView, MapViewManager } from "jimu-arcgis";
import {
  type IMConfig,
  type PrintTemplateProperties,
  type IMPrintTemplateProperties,
  type IMPrintResultListItemType,
  PrintResultState,
  type MapView,
  type OutputDataSourceWarningOption,
  type ChartPrintOptions,
} from "../../../config";
import defaultMessage from "../../translations/default";
import { WidgetPrintOutlined } from "jimu-icons/outlined/brand/widget-print";
import { CloseOutlined } from "jimu-icons/outlined/editor/close";
import { print } from "../../utils/print-service";
import {
  checkIsTemplateExist,
  getIndexByTemplateId,
  mergeTemplateSetting,
} from "../../../utils/utils";
import SettingRow from "../setting-row";
import PrintResult from "./result";
import PreviewExtent from "../preview-extents";
import { getPreviewLayerId, initTemplateProperties } from "../../utils/utils";
import DsRemind from "../ds-remind";
import UtilityErrorRemind from "../utility-remind";
// Import du service d'impression de diagrammes
import {
  createChartPrintElement,
  addChartToTemplate,
  printChartOnly,
} from "../../utils";
const { useState, useRef, useEffect } = React;
const { useSelector } = ReactRedux;

interface Props {
  id: string;
  locale: string;
  errorTip: string;
  showPlaceholder: boolean;
  useMapWidgetIds: ImmutableArray<string>;
  config: IMConfig;
  jimuMapView: JimuMapView;
  templateList: ImmutableArray<PrintTemplateProperties>;
  outputDataSourceWarning: OutputDataSourceWarningOption;
  showUtilityErrorRemind: boolean;
  controllerWidgetId: string;
  toggleUtilityErrorRemind: (isShow?: boolean) => void;
  // Props pour l'impression de diagrammes
  availableChartWidgets?: Array<{ id: string; label: string }>;
  chartPrintOptions?: ChartPrintOptions;
}

const CompactPrint = (props: Props) => {
  const {
    config,
    templateList,
    jimuMapView,
    errorTip,
    id,
    locale,
    useMapWidgetIds,
    outputDataSourceWarning,
    showPlaceholder,
    showUtilityErrorRemind,
    controllerWidgetId,
    toggleUtilityErrorRemind,
    availableChartWidgets,
    chartPrintOptions,
  } = props;
  const nls = hooks.useTranslation(defaultMessage, jimuUiDefaultMessage);
  const printButtonRef = useRef<HTMLButtonElement>(null);
  const widgetJson = useSelector(
    (state: IMState) => state?.appConfig?.widgets?.[id],
  );
  const STYLE = css`
    .compact-con {
      padding: 0;
      border: none !important;
      box-shadow: none !important;
      outline: none !important;
      background: transparent !important;
      &:hover,
      &:focus,
      &:active {
        border: none !important;
        box-shadow: none !important;
        outline: none !important;
      }
      svg {
        margin: 0 auto;
      }
      .compact-icon {
        color: ${(widgetJson?.icon as any)?.properties?.color};
      }
    }
    .off-panel-con {
      min-height: 32px;
      min-width: 32px;
      border: none !important;
      box-shadow: none !important;
      &:hover,
      &:focus,
      &:active {
        border: none !important;
        box-shadow: none !important;
      }
    }
    .operate-con-width-controller-widget {
      min-width: 295px;
      padding: 12px;
      .close-con button {
        padding: 0;
        svg {
          margin: 0 auto;
        }
      }
    }
  `;

  const POPPER_STYLE = css`
    & {
      padding: ${polished.rem(12)};
      width: ${polished.rem(320)};
    }
    .select-con {
      min-height: ${polished.rem(107)};
    }
    .result-con {
      min-height: ${polished.rem(107)};
    }
    .close-con button {
      padding: 0;
      svg {
        margin: 0 auto;
      }
    }
    .result-list-con button {
      padding: 0;
    }
    .compact-preview-con {
      width: 0;
    }
  `;

  const shiftOptions: ShiftOptions = {
    crossAxis: true,
  };

  const flipOptions: FlipOptions = {
    fallbackPlacements: ["left-start", "left-end"],
  };

  const [openPopper, setOpenPopper] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [printResult, setPrintResult] = useState(
    null as IMPrintResultListItemType,
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
      !selectedTemplate ||
      !checkIsTemplateExist(templateList, selectedTemplate?.templateId)
    ) {
      setSelectedTemplateByIndex(0);
    }
    if (
      selectedTemplate &&
      checkIsTemplateExist(templateList, selectedTemplate?.templateId)
    ) {
      const index = getIndexByTemplateId(
        templateList?.asMutable({ deep: true }),
        selectedTemplate?.templateId,
      );
      setSelectedTemplateByIndex(index);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateList, config]);

  const setSelectedTemplateByIndex = (index: number) => {
    if (templateList?.length === 0) return false;
    let template = templateList?.[index];
    if (template?.overrideCommonSetting) {
      template = mergeTemplateSetting(config?.commonSetting, template);
    } else {
      template = mergeTemplateSetting(template, config?.commonSetting);
    }
    setSelectedTemplate(template);
  };

  const togglePopper = (e, type?: any) => {
    if (type === "clickOutside") {
      setOpenPopper(false);
    } else {
      setOpenPopper(!openPopper);
    }
  };

  const toggleResultPanel = () => {
    setShowResult(!showResult);
  };

  const handleTemplateChange = (e) => {
    const templateId = e?.target?.value;
    const index = getIndexByTemplateId(
      templateList?.asMutable({ deep: true }),
      templateId,
    );
    setSelectedTemplateByIndex(index);
  };

  const restPrint = () => {
    setPrintResult(null);
    setShowResult(false);
  };

  const togglePreviewLayer = (visible: boolean) => {
    // Vérifier que jimuMapView existe avant d'accéder à ses propriétés
    if (!jimuMapView) {
      return;
    }
    const layerId = getPreviewLayerId(id, jimuMapView.id);
    const graphicsLayer = jimuMapView.view.map.findLayerById(layerId);
    if (graphicsLayer) {
      graphicsLayer.visible = visible;
    }
  };

  const confirmPrint = async () => {
    // Vérifier si on peut imprimer: soit une carte, soit un chart configuré (PAS les deux)
    const hasMap = !!jimuMapView;
    const hasChartConfig =
      chartPrintOptions?.includeChartInPrint &&
      chartPrintOptions?.chartWidgetId;

    if (!hasMap && !hasChartConfig) {
      const printResult = {
        resultId: selectedTemplate?.templateId,
        url: null,
        title: selectedTemplate?.layoutOptions?.titleText || "Print Error",
        state: PrintResultState.Error,
      };
      setPrintResult(Immutable(printResult));
      toggleResultPanel();
      return;
    }

    const printResult = {
      resultId: selectedTemplate?.templateId,
      url: null,
      title:
        selectedTemplate?.layoutOptions?.titleText ||
        (hasChartConfig ? "Chart Print" : "Map Print"),
      state: PrintResultState.Loading,
    };
    const isSupportReport =
      config?.supportCustomReport || config?.supportReport;
    setPrintResult(Immutable(printResult));
    toggleResultPanel();
    togglePreviewLayer(false);

    // PRIORITÉ AU CHART: Si un chart est configuré, imprimer UNIQUEMENT le chart
    if (hasChartConfig) {
      try {
        const mutableChartOptions =
          typeof (chartPrintOptions as any)?.asMutable === "function"
            ? (chartPrintOptions as any).asMutable({ deep: true })
            : chartPrintOptions;

        const chartElement = await createChartPrintElement(
          chartPrintOptions.chartWidgetId,
          mutableChartOptions,
        );
        if (chartElement) {
          // Créer un PDF simple avec juste le chart
          await printChartOnly(chartElement, printResult.title);
          printResult.state = PrintResultState.Success;
          setPrintResult(Immutable(printResult));
        } else {
          printResult.state = PrintResultState.Error;
          setPrintResult(Immutable(printResult));
        }
      } catch (error) {
        printResult.state = PrintResultState.Error;
        setPrintResult(Immutable(printResult));
      }
      return;
    }

    // SINON: Comportement normal avec carte uniquement (pas de chart)
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
      printResult.state = PrintResultState.Error;
      setPrintResult(Immutable(printResult));
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
      (res) => {
        printResult.url = res?.url;
        printResult.state = PrintResultState.Success;
        togglePreviewLayer(true);
        setPrintResult(Immutable(printResult));
      },
      (printError) => {
        togglePreviewLayer(true);
        printResult.state = PrintResultState.Error;
        setPrintResult(Immutable(printResult));
      },
    );
  };

  const renderTemplateSelect = () => {
    return (
      <div className="d-flex flex-column">
        <SettingRow flowWrap className="flex-grow-1" label={nls("template")}>
          <Select
            value={selectedTemplate?.templateId || ""}
            onChange={handleTemplateChange}
            size="sm"
            className="scalebar-unit"
            aria-label={nls("template")}
          >
            {templateList?.map((template, index) => {
              return (
                <Option
                  key={template.templateId}
                  value={template.templateId}
                  title={template.label}
                >
                  {template.label}
                </Option>
              );
            })}
          </Select>
        </SettingRow>
        <DsRemind
          supportCustomReport={config?.supportCustomReport}
          supportReport={config?.supportReport}
          outputDataSourceWarning={outputDataSourceWarning}
        />
        <div className="print-button-con d-flex align-items-center mt-2">
          {config?.enablePreview && (
            <PreviewExtent
              className="flex-grow-1 compact-preview-con"
              id={id}
              config={config}
              jimuMapView={jimuMapView}
              scale={selectedTemplate?.outScale}
              selectedTemplate={selectedTemplate}
              scalebarUnit={selectedTemplate?.layoutOptions?.scalebarUnit}
              printExtentType={selectedTemplate?.printExtentType}
            />
          )}
          <Button
            className="print-button text-truncate ml-1"
            type="primary"
            onClick={() => {
              confirmPrint();
            }}
            title={nls("_widgetLabel")}
          >
            {nls("_widgetLabel")}
          </Button>
        </div>
      </div>
    );
  };

  const renderPrintIcon = () => {
    const icon = widgetJson?.icon;
    if (!icon) {
      return <WidgetPrintOutlined />;
    }
    if (typeof icon === "string") {
      return <SVG src={icon} />;
    } else {
      return <Icon className="compact-icon" icon={icon?.svg} />;
    }
  };

  const renderPrintOperateElement = () => {
    return (
      <div
        className={classNames("w-100 h-100", {
          "operate-con-width-controller-widget": controllerWidgetId,
        })}
      >
        {!showPlaceholder && (
          <div className="d-flex flex-column w-100 h-100">
            {!controllerWidgetId && (
              <div className="text-right close-con">
                <Button
                  className="print-button"
                  type="tertiary"
                  title={nls("closeTour")}
                  onClick={togglePopper}
                >
                  <CloseOutlined />
                </Button>
              </div>
            )}
            <div className="flex-grow-1">
              <div
                className={classNames("w-100 h-100 select-con", {
                  "sr-only": showResult,
                })}
              >
                {renderTemplateSelect()}
              </div>
              {showResult && (
                <PrintResult
                  printResult={printResult}
                  restPrint={restPrint}
                  useUtility={config?.useUtility}
                />
              )}
            </div>
          </div>
        )}
        {showPlaceholder && <div>{errorTip}</div>}
        {showUtilityErrorRemind && (
          <UtilityErrorRemind
            utilityId={config?.useUtility?.utilityId}
            toggleUtilityErrorRemind={toggleUtilityErrorRemind}
          />
        )}
      </div>
    );
  };

  return (
    <div className="w-100 h-100" css={STYLE}>
      {controllerWidgetId && (
        <div className="w-100 h-100">{renderPrintOperateElement()}</div>
      )}
      {!controllerWidgetId && (
        <div className="w-100 h-100">
          <Button
            className={classNames("w-100 h-100 compact-con", {
              "off-panel-con": widgetJson?.offPanel,
            })}
            type="tertiary"
            ref={printButtonRef}
            title={nls("_widgetLabel")}
            onClick={togglePopper}
          >
            {renderPrintIcon()}
          </Button>
          <Popper
            open={openPopper}
            placement="bottom"
            reference={printButtonRef}
            shiftOptions={shiftOptions}
            flipOptions={flipOptions}
            arrowOptions
            toggle={togglePopper}
            trapFocus={false}
            autoFocus={false}
            css={POPPER_STYLE}
          >
            {renderPrintOperateElement()}
          </Popper>
        </div>
      )}
    </div>
  );
};

export default CompactPrint;
