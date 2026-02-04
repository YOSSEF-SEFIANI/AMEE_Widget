/** @jsx jsx */
import {
  React,
  jsx,
  css,
  type AllWidgetProps,
  appActions,
  type IMState,
  ReactRedux,
  type ImmutableArray,
  classNames,
  hooks,
  Immutable,
} from "jimu-core";
import {
  WidgetPlaceholder,
  defaultMessages as jimuiDefaultMessage,
} from "jimu-ui";
import {
  JimuMapViewComponent,
  type JimuMapView,
  type JimuMapViewGroup,
} from "jimu-arcgis";
import {
  type IMConfig,
  ModeType,
  type PrintTemplateProperties,
  type OutputDataSourceWarningOption,
} from "../config";
import widgetPrintOutlined from "jimu-icons/svg/outlined/brand/widget-print.svg";
import defaultMessage from "./translations/default";
import Classic from "./component/classic";
import CompactPrint from "./component/compact";
import {
  checkIsCustomTemplate,
  checkIsTemplateAvailable,
  getErrorRemindText,
} from "../utils/utils";
import { versionManager } from "../version-manager";
import OutputDataSourceListProps from "./component/output-datasource-list";
// Import du service d'impression de diagrammes
import {
  listAvailableChartWidgets,
  isChartWidgetAvailable,
  type ChartCaptureResult,
} from "./utils/chart";
const { useState, useRef, useEffect } = React;
type PrintProps = AllWidgetProps<IMConfig>;

const Widget = (props: PrintProps) => {
  const {
    id,
    config,
    dispatch,
    useMapWidgetIds,
    layoutId,
    layoutItemId,
    locale,
    controllerWidgetId,
  } = props;
  const nls = hooks.useTranslation(defaultMessage, jimuiDefaultMessage);

  // When the widget isn't configured with a map in Builder settings,
  // try to fall back to the first Map widget found in runtime appConfig.
  const appConfigWidgets = ReactRedux.useSelector((state: IMState) => {
    // Try runtime first, then builder context
    return (
      state?.appConfig?.widgets ||
      (state as any)?.appStateInBuilder?.appConfig?.widgets
    );
  }) as any;

  const fallbackMapWidgetId = React.useMemo((): string | null => {
    if (!appConfigWidgets) return null;
    try {
      // Normaliser pour gérer Immutable
      const widgetsObj =
        typeof appConfigWidgets?.asMutable === "function"
          ? appConfigWidgets.asMutable({ deep: true })
          : appConfigWidgets;

      for (const [widgetId, widgetJson] of Object.entries(widgetsObj)) {
        const uri = String((widgetJson as any)?.uri || "").toLowerCase();
        // Typical Map widget uri: widgets/arcgis/map/ or widgets/arcgis/arcgis-map/
        if (
          uri.includes("widgets/arcgis/map") ||
          uri.includes("widgets/arcgis/arcgis-map")
        ) {
          return widgetId;
        }
        // Extra tolerance for custom builds / different uri casing
        if (
          uri.includes("arcgis") &&
          (uri.includes("/map") || uri.includes("-map") || uri.includes("map/"))
        ) {
          return widgetId;
        }
      }
    } catch (e) {
      console.error("Erreur lors de la recherche du widget Map:", e);
    }
    return null;
  }, [appConfigWidgets]);

  const resolvedUseMapWidgetIds = React.useMemo((): ImmutableArray<string> => {
    const userSelectedNone =
      Array.isArray(useMapWidgetIds) && useMapWidgetIds.length === 0;

    console.log("DEBUG resolvedUseMapWidgetIds:", {
      useMapWidgetIds,
      fallbackMapWidgetId,
      userSelectedNone,
    });

    if (useMapWidgetIds?.length > 0) {
      return useMapWidgetIds;
    }

    // Respecter le choix explicite "Aucun" => ne pas appliquer le fallback
    if (userSelectedNone) {
      return Immutable([]) as any;
    }

    if (fallbackMapWidgetId) {
      return Immutable([fallbackMapWidgetId]) as any;
    }
    return (useMapWidgetIds || Immutable([])) as any;
  }, [useMapWidgetIds, fallbackMapWidgetId]);

  const selectionIsSelf = ReactRedux.useSelector((state: IMState) => {
    const selection = state?.appRuntimeInfo?.selection;
    const selectionIsSelf = !!(
      selection &&
      selection.layoutId === layoutId &&
      selection.layoutItemId === layoutItemId
    );
    return selectionIsSelf;
  });
  const loadingPrintService = ReactRedux.useSelector(
    (state: IMState) => state.widgetsState?.[id]?.loadingPrintService,
  );

  const isSetLayoutRef = useRef(false);
  const showUtilityErrorRemindTimeoutRef = useRef(null);

  const [jimuMapView, setJimuMapView] = useState(null as JimuMapView);
  const [errorTip, setErrorTip] = useState(nls("printPlaceholder"));
  const [templateList, setTemplateList] = useState(
    null as ImmutableArray<PrintTemplateProperties>,
  );
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState(0);
  const [outputDataSourceWarning, setOutputDataSourceWarning] = useState(
    null as any as OutputDataSourceWarningOption,
  );
  const [showPlaceholder, setShowPlaceholder] = useState(false);
  const [showUtilityErrorRemind, setUtilityErrorRemind] = useState(false);

  // État pour les widgets Chart disponibles
  const [availableChartWidgets, setAvailableChartWidgets] = useState<
    Array<{ id: string; label: string }>
  >([]);
  const [chartPrintResult, setChartPrintResult] =
    useState<ChartCaptureResult | null>(null);

  // Convertir chartPrintOptions ImmutableObject en objet mutable pour éviter les erreurs React #185
  const mutableChartPrintOptions = React.useMemo(() => {
    const options = config?.chartPrintOptions;
    if (!options) return undefined;
    if (typeof (options as any)?.asMutable === "function") {
      return (options as any).asMutable({ deep: true });
    }
    return options;
  }, [config?.chartPrintOptions]);

  const STYLE = css`
    .jimu-widget-placeholder {
      border: none;
    }
    &.surface-1 {
      border: none !important;
    }
    .checkbox-con:hover {
      color: var(--ref-palette-neutral-1100);
    }
  `;
  useEffect(() => {
    setListLayoutInWidgetState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionIsSelf]);

  useEffect(() => {
    getTemplateList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  useEffect(() => {
    checkShowPlaceholder(jimuMapView, templateList, config);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateList, config, jimuMapView]);

  useEffect(() => {
    loadingPrintService && setTemplateList(null);
  }, [loadingPrintService]);

  // Effet pour charger les widgets Chart disponibles
  useEffect(() => {
    const chartWidgets = listAvailableChartWidgets();
    setAvailableChartWidgets(chartWidgets);

    // Vérifier si les charts configurés sont disponibles
    if (config?.useChartWidgetIds?.length > 0) {
      config.useChartWidgetIds.forEach((chartId: string) => {
        if (!isChartWidgetAvailable(chartId)) {
          console.warn(`Widget Chart configuré non disponible: ${chartId}`);
        }
      });
    }
  }, [config?.useChartWidgetIds]);

  const getTemplateList = () => {
    const isCustomTemplate = checkIsCustomTemplate(
      config?.printServiceType,
      config?.printTemplateType,
    );
    let template = isCustomTemplate
      ? config?.printCustomTemplate
      : config?.printOrgTemplate;
    if (config?.supportCustomReport || config?.supportReport) {
      template = template?.filter((templateItem: any) => {
        const isTemplateAvailable = checkIsTemplateAvailable(
          templateItem?.asMutable({ deep: true }),
          config,
        );
        return isTemplateAvailable;
      });
    }
    setTemplateList(template);
  };

  const setListLayoutInWidgetState = () => {
    if (
      layoutId &&
      id &&
      layoutItemId &&
      !isSetLayoutRef.current &&
      selectionIsSelf
    ) {
      dispatch(
        appActions.widgetStatePropChange(id, "layoutInfo", {
          layoutId,
          layoutItemId,
        }),
      );
      isSetLayoutRef.current = true;
    }
  };

  const handleSelectedTemplateIndexChange = (index: number) => {
    setSelectedTemplateIndex(index);
  };

  const handleActiveViewChange = (jimuMapView: JimuMapView): void => {
    console.log("DEBUG handleActiveViewChange called:", jimuMapView);
    // Async errors
    if (!jimuMapView) {
      setErrorTip(nls("chooseMapTip"));
      setJimuMapView(null);
      return; // skip null
    }

    if (jimuMapView.view.type !== "2d") {
      console.log("DEBUG: View is not 2D, type:", jimuMapView.view.type);
      setErrorTip(nls("chooseMapTip"));
      setJimuMapView(null);
      return; // skip 2D
    }

    if (!resolvedUseMapWidgetIds || resolvedUseMapWidgetIds?.length === 0) {
      setErrorTip(nls("printPlaceholder"));
    }

    console.log("DEBUG: Setting jimuMapView to:", jimuMapView);
    setJimuMapView(jimuMapView); // 2d
  };

  const handleViewGroupCreate = (viewGroup: JimuMapViewGroup): void => {
    // setViewGroup(viewGroup)
  };

  // Render placeholder
  const renderWidgetPlaceholder = (): React.ReactElement => {
    return (
      <WidgetPlaceholder
        icon={widgetPrintOutlined}
        widgetId={id}
        message={getErrorTip()}
      />
    );
  };

  const getErrorTip = (): string => {
    let errMsg = errorTip;
    if (jimuMapView && !config?.useUtility) {
      errMsg = "";
    }
    return errMsg;
  };

  const toggleUtilityErrorRemind = (isShow = false) => {
    setUtilityErrorRemind(isShow);
    if (isShow) {
      clearTimeout(showUtilityErrorRemindTimeoutRef.current);
      showUtilityErrorRemindTimeoutRef.current = setTimeout(() => {
        setUtilityErrorRemind(false);
      }, 5000);
    }
  };

  // Render map content
  const renderMapContent = () => {
    return (
      <JimuMapViewComponent
        useMapWidgetId={resolvedUseMapWidgetIds?.[0]}
        onActiveViewChange={handleActiveViewChange}
        onViewGroupCreate={handleViewGroupCreate}
      />
    );
  };

  const checkShowPlaceholder = hooks.useEventCallback(
    (
      jimuMapView?: JimuMapView,
      templateList?: ImmutableArray<PrintTemplateProperties>,
      config?: IMConfig,
    ) => {
      const { supportCustomReport, supportReport } = config;
      let showPlaceholder = false;
      // Vérifier si des diagrammes sont configurés pour l'impression
      const hasChartConfig =
        config?.chartPrintOptions?.includeChartInPrint &&
        config?.chartPrintOptions?.chartWidgetId;

      // Si on a un chart configuré, on peut afficher le widget même sans carte
      if (hasChartConfig) {
        setShowPlaceholder(false);
        return;
      }

      // Si pas de carte ET pas de diagrammes configurés, afficher placeholder
      if (!jimuMapView && !hasChartConfig) {
        if (!config?.useUtility) {
          showPlaceholder = true;
          setShowPlaceholder(showPlaceholder);
          return;
        }
      }

      // Si pas de service d'impression configuré et pas de chart
      if (!config?.useUtility && !hasChartConfig) {
        showPlaceholder = true;
        setShowPlaceholder(showPlaceholder);
        return;
      }

      if (supportReport || supportCustomReport) {
        let noTemplateAvailable = true;
        templateList?.forEach((templateItem: any) => {
          const isTemplateAvailable = checkIsTemplateAvailable(
            templateItem?.asMutable({ deep: true }),
            config,
          );
          if (isTemplateAvailable) {
            noTemplateAvailable = false;
          }
        });
        if (noTemplateAvailable) {
          const remindText = getErrorRemindText(
            templateList?.[0]?.asMutable({ deep: true }),
            config,
            nls,
          );
          errorTip && setErrorTip(remindText);
          showPlaceholder = true;
        }
      }

      if (!templateList || templateList?.length === 0 || loadingPrintService) {
        showPlaceholder = true;
        setErrorTip(null);
      }

      setShowPlaceholder(showPlaceholder);
    },
  );

  const handleWarningLabelChange = (option: OutputDataSourceWarningOption) => {
    setOutputDataSourceWarning(option);
  };

  return (
    <div
      className={classNames("w-100 h-100", {
        "surface-1": config?.modeType === ModeType.Classic,
      })}
      css={STYLE}
    >
      <div className="map">
        <div>{renderMapContent()}</div>
      </div>

      {config?.modeType === ModeType.Classic && (
        <div className="w-100 h-100">
          {!showPlaceholder && (
            <Classic
              outputDataSourceWarning={outputDataSourceWarning}
              handleSelectedTemplateIndexChange={
                handleSelectedTemplateIndexChange
              }
              useMapWidgetIds={resolvedUseMapWidgetIds}
              id={id}
              locale={locale}
              config={config}
              jimuMapView={jimuMapView}
              templateList={templateList}
              showUtilityErrorRemind={showUtilityErrorRemind}
              toggleUtilityErrorRemind={toggleUtilityErrorRemind}
              // Props pour l'impression de diagrammes
              availableChartWidgets={availableChartWidgets}
              chartPrintOptions={mutableChartPrintOptions}
            />
          )}
          {showPlaceholder && renderWidgetPlaceholder()}
        </div>
      )}

      {config?.modeType === ModeType.Compact && (
        <div className="w-100 h-100">
          <CompactPrint
            showPlaceholder={showPlaceholder}
            outputDataSourceWarning={outputDataSourceWarning}
            useMapWidgetIds={resolvedUseMapWidgetIds}
            id={id}
            config={config}
            locale={locale}
            jimuMapView={jimuMapView}
            templateList={templateList}
            controllerWidgetId={controllerWidgetId}
            errorTip={getErrorTip()}
            showUtilityErrorRemind={showUtilityErrorRemind}
            toggleUtilityErrorRemind={toggleUtilityErrorRemind}
            // Props pour l'impression de diagrammes
            availableChartWidgets={availableChartWidgets}
            chartPrintOptions={mutableChartPrintOptions}
          />
        </div>
      )}

      {(config?.supportReport || config?.supportCustomReport) && (
        <OutputDataSourceListProps
          id={id}
          reportOptions={templateList?.[selectedTemplateIndex]?.reportOptions}
          handleWarningLabelChange={handleWarningLabelChange}
        />
      )}
    </div>
  );
};
Widget.versionManager = versionManager;
export default Widget;
