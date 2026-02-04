/** @jsx jsx */
import {
  React,
  jsx,
  css,
  polished,
  LayoutType,
  ReactRedux,
  type IMState,
  hooks,
  type ImmutableObject,
  type UtilitiesJson,
} from "jimu-core";
import { type JimuMapView, JimuMapViewComponent } from "jimu-arcgis";
import {
  type AllWidgetSettingProps,
  getAppConfigAction,
  builderAppSync,
} from "jimu-for-builder";
import {
  Icon,
  Button,
  Alert,
  CollapsablePanel,
  defaultMessages as jimuUiDefaultMessage,
} from "jimu-ui";
import {
  MapWidgetSelector,
  SettingSection,
  SettingRow,
} from "jimu-ui/advanced/setting-components";
import {
  type IMConfig,
  ModeType,
  type IMPrintTemplateProperties,
  type ChartPrintOptions,
  ChartPosition,
} from "../config";
import defaultMessage from "./translations/default";
import { isDefined } from "../utils/utils";
import TemplateSetting from "./component/template-setting/template-setting";
import CommonTemplateSetting from "./component/template-common-setting";
import PreviewStyle from "./component/print-preview-style";
import UtilityPlaceholder from "./component/utility-placeholder";
import ChartWidgetSelector from "./component/chart-widget-selector";
const { useEffect, useRef } = React;

const CLASSIC_DEFAULT_SIZE = {
  width: "360px",
  height: "460px",
};

const COMPACT_DEFAULT_SIZE = {
  width: "40px",
  height: "40px",
};

const COMPACT_DEFAULT_SIZE_IN_CONTROLLER = {
  width: "295px",
  height: "107px",
};

interface ExtraProps {
  id: string;
}

type SettingProps = AllWidgetSettingProps<IMConfig> & ExtraProps;

const Setting = (props: SettingProps) => {
  const {
    config,
    id,
    portalUrl,
    onSettingChange,
    useMapWidgetIds,
    controllerWidgetId,
  } = props;
  const nls = hooks.useTranslation(defaultMessage, jimuUiDefaultMessage);

  const serviceErrorMessageTimeoutRef = useRef(null);

  const layoutInfo = ReactRedux.useSelector(
    (state: IMState) => state?.appStateInBuilder?.widgetsState[id]?.layoutInfo,
  );
  const appConfig = ReactRedux.useSelector(
    (state: IMState) => state.appStateInBuilder.appConfig,
  );

  // Fallback: Détection automatique du premier widget Map si aucun n'est configuré
  const fallbackMapWidgetId = React.useMemo((): string | null => {
    const widgets = appConfig?.widgets;
    if (!widgets) return null;
    try {
      const widgetsObj =
        typeof widgets.asMutable === "function"
          ? widgets.asMutable({ deep: true })
          : widgets;
      for (const [widgetId, widgetJson] of Object.entries(widgetsObj)) {
        const uri = String((widgetJson as any)?.uri || "").toLowerCase();
        if (
          uri.includes("widgets/arcgis/map") ||
          (uri.includes("arcgis") && uri.includes("/map"))
        ) {
          return widgetId;
        }
      }
    } catch (e) {
      console.error("Erreur lors de la détection du widget Map:", e);
    }
    return null;
  }, [appConfig?.widgets]);

  // Utiliser le fallback si useMapWidgetIds est vide
  const resolvedUseMapWidgetIds = React.useMemo((): string[] => {
    if (useMapWidgetIds?.length > 0) return useMapWidgetIds as string[];
    if (fallbackMapWidgetId) {
      return [fallbackMapWidgetId];
    }
    return [];
  }, [useMapWidgetIds, fallbackMapWidgetId]);

  const [jimuMapView, setJimuMapView] = React.useState(null as JimuMapView);
  const [openRemind, setOpenRemind] = React.useState(false);
  const [isOpenCollapsablePanel, setIsOpenCollapsablePanel] =
    React.useState(false);
  const [isOpenChartPanel, setIsOpenChartPanel] = React.useState(false);
  const [showLoading, setShowLoading] = React.useState(false);

  const STYLE = css`
    & .custom-setting-collapse > div.collapse-header {
      padding-left: 0 !important;
      padding-right: 0 !important;
    }
    .no-utility-setting {
      border-bottom: none;
    }
    .select-mode-con {
      & > div {
        flex: 1;
      }
      button {
        height: ${polished.rem(80)};
        background: var(--ref-palette-neutral-300);
        border: 2px solid transparent;
        &:not(:disabled):not(.disabled).active {
          border-color: var(--sys-color-primary-main);
          background: var(--ref-palette-neutral-300);
        }
      }
      img {
        width: 100%;
        height: 100%;
        margin: 0 auto;
      }
    }
    .remind-con {
      top: ${polished.rem(90)};
    }
    .text-wrap {
      overflow: hidden;
      white-space: pre-wrap;
    }
    .setting-collapse {
      & {
        margin-bottom: ${polished.rem(8)};
      }
      .collapse-header {
        line-height: 2.2;
      }
      .handle {
        height: ${polished.rem(32)};
        background: var(--ref-palette-neutral-500);
        padding-left: ${polished.rem(8)};
        padding-right: ${polished.rem(8)};
      }
    }
  `;
  const utilitiesInConfig = ReactRedux.useSelector((state: IMState) => {
    return state.appStateInBuilder.appConfig.utilities;
  });

  useEffect(() => {
    deleteUseUtilityWhenUseUtilityNotExist(utilitiesInConfig);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [utilitiesInConfig]);

  useEffect(() => {
    initDefaultBorder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const deleteUseUtilityWhenUseUtilityNotExist = hooks.useEventCallback(
    (utilitiesInConfig: ImmutableObject<UtilitiesJson>) => {
      const useUtilityId = config?.useUtility?.utilityId;
      if (!useUtilityId) return;
      const isExist = Object.keys(utilitiesInConfig || {})?.includes(
        useUtilityId,
      );
      if (!isExist) {
        handlePropertyChange("useUtility", null);
      }
    },
  );

  const initDefaultBorder = () => {
    const style = appConfig?.widgets?.[id]?.style;
    if (!config?.hasInitBorder && !style?.border) {
      const appConfigAction = getAppConfigAction();
      const defaultBorder = {
        color: "var(--ref-palette-neutral-700)",
        type: "solid",
        width: "1px",
      };
      let newStyle;
      if (style) {
        newStyle = style.set("border", defaultBorder);
      } else {
        newStyle = {
          border: defaultBorder,
        };
      }
      const newConfig = config?.set("hasInitBorder", true);
      appConfigAction
        .editWidgetProperty(id, "style", newStyle)
        .editWidgetProperty(id, "config", newConfig)
        .editWidgetProperty(id, "offPanel", false)
        .exec();
    }
  };

  const handlePropertyChange = hooks.useEventCallback(
    (key: string, value: any) => {
      if (config?.[key] === value) return false;
      const newConfig = config.setIn([key], value);
      onSettingChange({
        id: id,
        config: newConfig,
      });
    },
  );

  const handleMapWidgetChange = hooks.useEventCallback(
    (useMapWidgetIds: string[]): void => {
      onSettingChange({
        id: id,
        useMapWidgetIds: useMapWidgetIds,
      });
    },
  );

  // NOTE: L'auto-sélection du widget Map a été supprimée pour permettre
  // à l'utilisateur de choisir "Aucun" et n'imprimer que des diagrammes.
  // Le fallback est géré côté runtime uniquement si nécessaire.

  const handleChartPrintOptionsChange = hooks.useEventCallback(
    (chartPrintOptions: ChartPrintOptions): void => {
      handlePropertyChange("chartPrintOptions", chartPrintOptions);
    },
  );

  const handleUseChartWidgetIdsChange = hooks.useEventCallback(
    (useChartWidgetIds: string[]): void => {
      handlePropertyChange("useChartWidgetIds", useChartWidgetIds);
    },
  );

  const toggleRemindPopper = (open: boolean = false) => {
    setOpenRemind(open);
    if (open) {
      clearTimeout(serviceErrorMessageTimeoutRef.current);
      serviceErrorMessageTimeoutRef.current = setTimeout(() => {
        setOpenRemind(false);
      }, 5000);
    }
  };

  const handleActiveViewChange = (newJimuMapView: JimuMapView): void => {
    if (!isDefined(newJimuMapView) || newJimuMapView.view.type === "3d") {
      setJimuMapView(null);
    } else if (newJimuMapView?.id !== jimuMapView?.id) {
      setJimuMapView(newJimuMapView);
    }
  };

  const handleModeTypeChange = hooks.useEventCallback((modeType: ModeType) => {
    const newConfig = config.setIn(["modeType"], modeType);
    //Edit default size of print layout when change mode type
    const appConfigAction = getAppConfigAction();
    let printSize = CLASSIC_DEFAULT_SIZE;
    if (modeType === ModeType.Compact) {
      printSize = controllerWidgetId
        ? COMPACT_DEFAULT_SIZE_IN_CONTROLLER
        : COMPACT_DEFAULT_SIZE;
    }
    const layoutType = getLayoutType();
    const offPanel = modeType === ModeType.Compact;
    if (layoutType === LayoutType.FixedLayout) {
      const { layoutId, layoutItemId } = layoutInfo;
      const layout = appConfig.layouts[layoutId];
      const layoutItem = layout?.content?.[layoutItemId];
      const bbox = layoutItem.bbox
        .set("width", printSize.width)
        .set("height", printSize.height);
      appConfigAction
        .editLayoutItemProperty(layoutInfo, "bbox", bbox)
        .editWidgetProperty(id, "config", newConfig)
        .editWidgetProperty(id, "offPanel", offPanel)
        .exec();
    } else {
      appConfigAction
        .editWidgetProperty(id, "config", newConfig)
        .editWidgetProperty(id, "offPanel", offPanel)
        .exec();
    }
  });

  const handleTemplatePropertyChange = hooks.useEventCallback(
    (templateProperty: IMPrintTemplateProperties) => {
      const newConfig = config.set("commonSetting", templateProperty);
      onSettingChange({
        id: id,
        config: newConfig,
      });
    },
  );

  //Get layout type
  const getLayoutType = (): LayoutType => {
    const layoutId = layoutInfo?.layoutId;
    const layoutType = appConfig?.layouts?.[layoutId]?.type;
    return layoutType;
  };

  const toggleOpenCollapsablePanel = () => {
    setIsOpenCollapsablePanel(!isOpenCollapsablePanel);
  };

  const toggleLoading = (isShowLoading: boolean) => {
    builderAppSync.publishChangeWidgetStatePropToApp({
      widgetId: id,
      propKey: "loadingPrintService",
      value: isShowLoading,
    });
    setShowLoading(isShowLoading);
  };

  const renderModeSetting = () => {
    return (
      <SettingSection className="map-selector-section">
        <SettingRow
          flow="wrap"
          label={nls("printMode")}
          role="group"
          aria-label={nls("printMode")}
        >
          <div className="d-flex w-100 select-mode-con">
            <div className="flex-grow-1 text-truncate">
              <Button
                variant="text"
                className="w-100"
                disableHoverEffect={true}
                disableRipple={true}
                title={nls("printClassic")}
                active={config?.modeType === ModeType.Classic}
                onClick={() => {
                  handleModeTypeChange(ModeType.Classic);
                }}
              >
                <Icon autoFlip icon={require("./assets/Classic.svg")} />
              </Button>
              <div
                className="mt-2 w-100 text-center text-truncate"
                title={nls("printClassic")}
              >
                {nls("printClassic")}
              </div>
            </div>

            <div className="flex-grow-1 ml-2 text-truncate">
              <Button
                variant="text"
                className="w-100"
                disableHoverEffect={true}
                disableRipple={true}
                active={config?.modeType === ModeType.Compact}
                title={nls("printCompact")}
                onClick={() => {
                  handleModeTypeChange(ModeType.Compact);
                }}
              >
                <Icon autoFlip icon={require("./assets/Compact.svg")} />
              </Button>
              <div
                className="mt-2 text-center text-truncate"
                title={nls("printCompact")}
              >
                {nls("printCompact")}
              </div>
            </div>
          </div>
        </SettingRow>
      </SettingSection>
    );
  };

  return (
    <div className="widget-setting-search jimu-widget-search" css={STYLE}>
      {/* Print source select */}
      <SettingSection
        className="map-selector-section"
        role="group"
        aria-label={nls("printSource")}
      >
        <SettingRow
          flow="wrap"
          label={nls("selectMap")}
          role="group"
          aria-label={nls("selectMap")}
        >
          <MapWidgetSelector
            autoSelect
            onSelect={handleMapWidgetChange}
            aria-label={nls("selectMap")}
            useMapWidgetIds={useMapWidgetIds}
          />
        </SettingRow>
        {/* Afficher un message si le fallback est utilisé */}
        {(!useMapWidgetIds || useMapWidgetIds.length === 0) &&
          fallbackMapWidgetId && (
            <SettingRow>
              <div
                style={{
                  color: "var(--sys-color-warning-main)",
                  fontSize: "12px",
                }}
              >
                ⚠️ Carte auto-détectée: {fallbackMapWidgetId}
              </div>
            </SettingRow>
          )}
        <div className="fly-map">
          <div>
            <JimuMapViewComponent
              useMapWidgetId={resolvedUseMapWidgetIds?.[0]}
              onActiveViewChange={handleActiveViewChange}
            />
          </div>
        </div>
      </SettingSection>

      {/* Chart widget selector */}
      <SettingSection
        className="chart-selector-section"
        role="group"
        aria-label={nls("chartSettings")}
      >
        <CollapsablePanel
          label={nls("chartSettings")}
          isOpen={isOpenChartPanel}
          onRequestOpen={() => setIsOpenChartPanel(true)}
          onRequestClose={() => setIsOpenChartPanel(false)}
          aria-label={nls("chartSettings")}
          className="custom-setting-collapse"
        >
          <ChartWidgetSelector
            chartPrintOptions={config?.chartPrintOptions}
            useChartWidgetIds={config?.useChartWidgetIds}
            onChartPrintOptionsChange={handleChartPrintOptionsChange}
            onUseChartWidgetIdsChange={handleUseChartWidgetIdsChange}
          />
        </CollapsablePanel>
      </SettingSection>

      {/* Print mode setting */}
      {renderModeSetting()}

      <div className="w-100 position-absolute remind-con">
        <Alert
          withIcon
          form="basic"
          type="warning"
          open={openRemind}
          closable={true}
          className="w-100"
          text={nls("serviceIsNotAvailable")}
          onClose={() => {
            toggleRemindPopper(false);
          }}
        />
      </div>

      {/* Print template list */}
      <TemplateSetting
        id={id}
        config={config}
        portalUrl={portalUrl}
        handlePropertyChange={handlePropertyChange}
        onSettingChange={onSettingChange}
        jimuMapView={jimuMapView}
        toggleRemindPopper={toggleRemindPopper}
        showLoading={showLoading}
        toggleLoading={toggleLoading}
        className={!config?.useUtility && !showLoading && "no-utility-setting"}
      />

      {/* Print template common setting */}
      {config?.useUtility && (
        <SettingSection role="group" aria-label={nls("templateCommonSettings")}>
          <CollapsablePanel
            label={nls("templateCommonSettings")}
            isOpen={isOpenCollapsablePanel}
            onRequestOpen={toggleOpenCollapsablePanel}
            onRequestClose={toggleOpenCollapsablePanel}
            aria-label={nls("templateCommonSettings")}
            className="custom-setting-collapse"
          >
            <CommonTemplateSetting
              id={id}
              printTemplateProperties={config?.commonSetting}
              handleTemplatePropertyChange={handleTemplatePropertyChange}
              modeType={config?.modeType}
              jimuMapView={jimuMapView}
            />
          </CollapsablePanel>
        </SettingSection>
      )}

      {/* Print preview style setting */}
      {config?.useUtility && (
        <PreviewStyle
          config={config}
          handlePropertyChange={handlePropertyChange}
        />
      )}

      {!config?.useUtility && !showLoading && <UtilityPlaceholder />}
    </div>
  );
};

export default Setting;
