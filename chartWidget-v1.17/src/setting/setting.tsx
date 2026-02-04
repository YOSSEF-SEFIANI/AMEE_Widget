/** @jsx jsx */
/** @jsxFrag React.Fragment */
import {
  React,
  jsx,
  Immutable,
  type UseDataSource,
  defaultMessages as jimuCoreMessages,
  type ImmutableObject,
  getAppStore,
  DataSourceTypes,
  hooks,
  type DataSourceJson,
  AppMode,
  dataSourceUtils,
} from "jimu-core";
import { builderActions, type AllWidgetSettingProps } from "jimu-for-builder";
import { defaultMessages as jimUiMessages } from "jimu-ui";
import { Switch, NumericInput, TextInput, Select, Option } from "jimu-ui";
import {
  SettingRow,
  SettingSection,
} from "jimu-ui/advanced/setting-components";
import { DataSourceSelector } from "jimu-ui/advanced/data-source-selector";
import type {
  ChartComponentOptions,
  ChartMessages,
  ChartTools,
  IMConfig,
  IWebChart,
} from "../config";
import { ChartSettings } from "./settings";
import defaultMessages from "./translations/default";
import { getSeriesType } from "jimu-ui/advanced/chart";
import OutputSourceManager from "./data-source";
import { getDefaultTools, isGaugeChart } from "../utils/default";
import { DefaultOptions } from "../constants";

const SupportImageryLayer = false;

const ImageryTypes = [
  DataSourceTypes.OrientedImageryLayer,
  DataSourceTypes.ImageryLayer,
];

const SUPPORTED_TYPES = Immutable(
  [
    DataSourceTypes.FeatureLayer,
    DataSourceTypes.SceneLayer,
    DataSourceTypes.BuildingComponentSubLayer,
    DataSourceTypes.SubtypeSublayer,
  ].concat(SupportImageryLayer ? ImageryTypes : []),
);

const getDefaultToolsOption = (seriesType?: string) => {
  const isGauge = isGaugeChart(seriesType);
  return isGauge ? { cursorEnable: false } : { cursorEnable: true };
};

type SettingProps = AllWidgetSettingProps<IMConfig>;

const Setting = (props: SettingProps): React.ReactElement => {
  const {
    id,
    useDataSources: propUseDataSources,
    outputDataSources: propOutputDataSources,
    onSettingChange,
    label,
  } = props;

  // ✅ Fix ExB bug: props.config peut être undefined au premier rendu
  const propConfig = props.config || ({} as IMConfig);

  const translate = hooks.useTranslation(
    defaultMessages,
    jimUiMessages,
    jimuCoreMessages,
  );

  const {
    template = "",
    webChart,
    tools: propTools,
    options = DefaultOptions,
  } = propConfig;
  const seriesType = getSeriesType(webChart?.series as any) ?? "barSeries";
  const outputDataSourceId = propOutputDataSources?.[0] ?? "";
  const outputDataSourceLabel = translate("outputStatistics", { name: label });
  const tools = propTools ?? getDefaultTools(seriesType);
  const messages = propConfig.messages;

  const handleUseDataSourceChange = (useDataSources: UseDataSource[]): void => {
    const dataSourceId = propUseDataSources?.[0]?.dataSourceId;
    const newDataSourceId = useDataSources?.[0]?.dataSourceId;
    let config = propConfig;
    // Si la source de données change, réinitialiser la config du chart
    if (dataSourceId !== newDataSourceId) {
      config = propConfig
        .without("webChart")
        .without("tools")
        .without("template");
    }
    if (outputDataSourceId) {
      let outputDataSourceJson =
        getAppStore().getState().appStateInBuilder.appConfig.dataSources[
          outputDataSourceId
        ];
      outputDataSourceJson = outputDataSourceJson.set(
        "originDataSources",
        useDataSources,
      );
      onSettingChange({ id, useDataSources, config }, [
        outputDataSourceJson.asMutable({ deep: true }),
      ]);
    } else {
      onSettingChange({ id, useDataSources, config });
    }
  };

  const handleOutputCreate = (dataSourceJson: DataSourceJson) => {
    onSettingChange({ id }, [dataSourceJson]);
  };

  const handleFieldsChange = (fields: string[]) => {
    const useDataSources = Immutable.setIn(
      propUseDataSources,
      ["0", "fields"],
      fields,
    ).asMutable({ deep: true });
    onSettingChange({ id, useDataSources });
  };

  const handleTemplateChange = (
    templateId: string,
    webChart: ImmutableObject<IWebChart>,
  ): void => {
    const seriesType = getSeriesType(webChart.series as any);
    const config = propConfig
      .set("template", templateId)
      .set("webChart", webChart)
      .set("tools", getDefaultToolsOption(seriesType));
    onSettingChange({ id, config });
  };

  //Update output ds label when the label of widget changes
  React.useEffect(() => {
    const outputDataSource =
      getAppStore().getState().appStateInBuilder.appConfig?.dataSources?.[
        outputDataSourceId
      ];
    if (outputDataSource && outputDataSource.label !== outputDataSourceLabel) {
      onSettingChange({ id }, [
        { id: outputDataSourceId, label: outputDataSourceLabel },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outputDataSourceLabel]);

  React.useEffect(() => {
    const isExpressMode =
      getAppStore().getState().appStateInBuilder?.appRuntimeInfo.appMode ===
      AppMode.Express;
    if (isExpressMode) {
      getAppStore().dispatch(
        builderActions.changeMessageActionSettingOpenState(id, false),
      );
    }
  }, [id]);

  const handleWebChartChange = (webChart: ImmutableObject<IWebChart>): void => {
    const config = propConfig.set("webChart", webChart);
    onSettingChange({ id, config });
  };

  const handleToolsChange = (tools: ImmutableObject<ChartTools>): void => {
    onSettingChange({ id, config: propConfig.set("tools", tools) });
  };

  const handleOptionsChange = (
    options: ImmutableObject<ChartComponentOptions>,
  ): void => {
    onSettingChange({ id, config: propConfig.set("options", options) });
  };

  const handleMessagesChange = (
    messages: ImmutableObject<ChartMessages>,
  ): void => {
    let config = propConfig;
    if (messages) {
      config = propConfig.set("messages", messages);
    } else {
      config = propConfig.without("messages");
    }
    onSettingChange({ id, config });
  };

  // ============================================================================
  // GESTION DU TITRE DYNAMIQUE
  // ============================================================================
  const dynamicTitleConfig =
    propConfig.dynamicTitleConfig ||
    Immutable({
      enabled: true,
      showFilters: true,
      maxFilters: 2,
      filterSeparator: ", ",
      useShortAliases: true,
      titleFormat: "narratif",
    });

  const handleDynamicTitleChange = (field: string, value: any) => {
    const newConfig = Immutable.setIn(
      propConfig,
      ["dynamicTitleConfig", field],
      value,
    );
    onSettingChange({ id, config: newConfig });
  };

  return (
    <div className="widget-setting-chart jimu-widget-setting">
      <div className="w-100 h-100">
        <div className="w-100">
          <SettingSection className="d-flex flex-column pb-0">
            <SettingRow label={translate("data")} flow="wrap" level={1}>
              <DataSourceSelector
                isMultiple={false}
                aria-describedby="chart-blank-msg"
                mustUseDataSource
                types={SUPPORTED_TYPES}
                useDataSources={propUseDataSources}
                onChange={handleUseDataSourceChange}
                widgetId={id}
              />
            </SettingRow>
          </SettingSection>
        </div>

        {/* ======================================================================
            SECTION TITRE DYNAMIQUE
        ====================================================================== */}
        <SettingSection
          title={translate("dynamicTitle", "Titre Dynamique")}
          className="pt-3"
        >
          <div
            style={{
              padding: "12px",
              backgroundColor: "#f0f7ff",
              borderRadius: "4px",
              marginBottom: "12px",
            }}
          >
            <p style={{ margin: "0 0 8px 0", fontSize: "12px", color: "#666" }}>
              {translate(
                "dynamicTitleDescription",
                "Génère automatiquement des titres basés sur les filtres appliqués",
              )}
            </p>
          </div>

          <SettingRow>
            <div className="d-flex justify-content-between w-100 align-items-center">
              <label
                className="w-75"
                style={{ fontSize: "13px", fontWeight: 500 }}
              >
                {translate("enableDynamicTitle", "Activer")}
              </label>
              <Switch
                checked={Boolean(dynamicTitleConfig.enabled ?? true)}
                onChange={(evt) => {
                  handleDynamicTitleChange("enabled", evt.target.checked);
                }}
              />
            </div>
          </SettingRow>

          {dynamicTitleConfig.enabled && (
            <>
              <SettingRow>
                <div className="d-flex justify-content-between w-100 align-items-center">
                  <label
                    className="w-75"
                    style={{ fontSize: "13px", fontWeight: 500 }}
                  >
                    {translate("showFiltersInTitle", "Afficher les filtres")}
                  </label>
                  <Switch
                    checked={Boolean(dynamicTitleConfig.showFilters ?? true)}
                    onChange={(evt: React.FormEvent<HTMLInputElement>) => {
                      handleDynamicTitleChange(
                        "showFilters",
                        (evt.target as HTMLInputElement).checked,
                      );
                    }}
                  />
                </div>
              </SettingRow>
              {dynamicTitleConfig.showFilters && (
                <>
                  <SettingRow flow="wrap">
                    <label
                      className="w-100"
                      style={{
                        fontSize: "13px",
                        fontWeight: 500,
                        marginBottom: "6px",
                        display: "block",
                      }}
                    >
                      {translate("titleFormat", "Format du titre")}
                    </label>
                    <Select
                      style={{ width: "100%", fontSize: "13px" }}
                      value={String(
                        dynamicTitleConfig.titleFormat || "narratif",
                      )}
                      onChange={(evt: React.FormEvent<HTMLSelectElement>) => {
                        handleDynamicTitleChange(
                          "titleFormat",
                          (evt.target as HTMLSelectElement).value,
                        );
                      }}
                    >
                      <Option value="simple">
                        {translate("formatSimple", "Simple")}
                      </Option>
                      <Option value="descriptif">
                        {translate("formatDescriptif", "Descriptif")}
                      </Option>
                      <Option value="complet">
                        {translate("formatComplet", "Complet")}
                      </Option>
                      <Option value="narratif">
                        {translate("formatNarratif", "Narratif")}
                      </Option>
                    </Select>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#666",
                        marginTop: "4px",
                        fontStyle: "italic",
                      }}
                    >
                      {dynamicTitleConfig.titleFormat === "simple" &&
                        "Ex: Total (Type: Value)"}
                      {dynamicTitleConfig.titleFormat === "descriptif" &&
                        "Ex: Répartition par Type, et par Année"}
                      {dynamicTitleConfig.titleFormat === "complet" &&
                        "Ex: Répartition par Type (Type: Value)"}
                      {dynamicTitleConfig.titleFormat === "narratif" &&
                        "Ex: Répartition par Type au niveau Value"}
                    </div>
                  </SettingRow>

                  <SettingRow flow="wrap">
                    <label
                      className="w-100"
                      style={{
                        fontSize: "13px",
                        fontWeight: 500,
                        marginBottom: "6px",
                        display: "block",
                      }}
                    >
                      {translate("maxFilters", "Filtres affichés (max)")}
                    </label>
                    <NumericInput
                      style={{ width: "100%" }}
                      value={Number(dynamicTitleConfig.maxFilters ?? 2)}
                      min={1}
                      max={5}
                      onChange={(value: number | undefined) => {
                        handleDynamicTitleChange("maxFilters", value || 2);
                      }}
                      showHandlers
                    />
                  </SettingRow>

                  <SettingRow flow="wrap">
                    <label
                      className="w-100"
                      style={{
                        fontSize: "13px",
                        fontWeight: 500,
                        marginBottom: "6px",
                        display: "block",
                      }}
                    >
                      {translate("filterSeparator", "Séparateur")}
                    </label>
                    <TextInput
                      style={{ width: "100%", fontSize: "13px" }}
                      value={String(dynamicTitleConfig.filterSeparator ?? ", ")}
                      onChange={(evt: React.FormEvent<HTMLInputElement>) => {
                        handleDynamicTitleChange(
                          "filterSeparator",
                          (evt.target as HTMLInputElement).value,
                        );
                      }}
                      placeholder="Ex: , ou / ou -"
                    />
                  </SettingRow>

                  <SettingRow>
                    <div className="d-flex justify-content-between w-100 align-items-center">
                      <label
                        className="w-75"
                        style={{ fontSize: "13px", fontWeight: 500 }}
                      >
                        {translate("useShortAliases", "Alias courts")}
                      </label>
                      <Switch
                        checked={Boolean(
                          dynamicTitleConfig.useShortAliases ?? true,
                        )}
                        onChange={(evt: React.FormEvent<HTMLInputElement>) => {
                          handleDynamicTitleChange(
                            "useShortAliases",
                            (evt.target as HTMLInputElement).checked,
                          );
                        }}
                      />
                    </div>
                  </SettingRow>
                </>
              )}
            </>
          )}
        </SettingSection>

        <ChartSettings
          widgetId={id}
          type={seriesType}
          template={template}
          onTemplateChange={handleTemplateChange}
          useDataSources={propUseDataSources}
          tools={tools}
          options={options}
          messages={messages}
          webChart={webChart}
          onToolsChange={handleToolsChange}
          onMessagesChange={handleMessagesChange}
          onWebChartChange={handleWebChartChange}
          onOptionsChange={handleOptionsChange}
        />
        {!!propUseDataSources?.length && (
          <OutputSourceManager
            widgetId={id}
            dataSourceId={outputDataSourceId}
            originalUseDataSource={propUseDataSources?.[0]}
            onCreate={handleOutputCreate}
            onFieldsChange={handleFieldsChange}
          />
        )}
      </div>
    </div>
  );
};

export default Setting;
