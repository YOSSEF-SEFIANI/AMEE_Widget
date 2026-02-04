import { React, type AllWidgetProps, Immutable } from "jimu-core";
import { versionManager } from "../version-manager";
import { DefaultOptions } from "../constants";
import { ChartRuntimeStateProvider } from "./state";
import type { IMConfig } from "../config";
import { getChartOrSeriesType } from "../utils/common";
import { getDefaultTools } from "../utils/default";
import Chart from "./chart";
import { Paper } from "jimu-ui";
import {
  applyPaletteToSeries,
  applyValueBasedColors,
  COLOR_PALETTES,
} from "../utils/color-utils";

const Widget = (props: AllWidgetProps<IMConfig>): React.ReactElement => {
  const {
    outputDataSources,
    useDataSources,
    config,
    id,
    enableDataAction,
    onInitDragHandler,
  } = props;

  const seriesType = getChartOrSeriesType(config?.webChart?.series);
  const tools = config?.tools ?? getDefaultTools(seriesType);
  const options = config?.options ?? DefaultOptions;
  const messages = config?.messages;
  const defaultTemplateType = config?._templateType;
  const colorSettings = config?.colorSettings;
  const dynamicTitleConfig = config?.dynamicTitleConfig;

  // ============================================================================
  // APPLICATION DES COULEURS PERSONNALISÉES (Pattern ExB avec useMemo)
  // ============================================================================
  const webChart = React.useMemo(() => {
    if (!config?.webChart) return null;

    let chart = config.webChart;
    let series = chart.series;

    // 1. Application de la palette personnalisée si activée
    if (colorSettings?.useCustomPalette && colorSettings?.palette?.colors) {
      series = applyPaletteToSeries(
        series,
        colorSettings.palette.colors,
      ) as any;
    } else if (chart.customColors && chart.customColors.length > 0) {
      // 2. Utiliser customColors de webChart si défini
      series = applyPaletteToSeries(series, chart.customColors) as any;
    }

    // 3. Application des couleurs basées sur valeurs (heatmap)
    if (colorSettings?.useValueBasedColors && colorSettings?.colorThresholds) {
      const thresholds = colorSettings.colorThresholds.map((t) => ({
        threshold: t.value,
        color: t.color,
      }));
      series = applyValueBasedColors(series, thresholds) as any;
    }

    // 4. Application des couleurs par série individuelle
    if (colorSettings?.seriesColors) {
      series = series.map((serie) => {
        const serieId = serie.id || serie.name;
        const customColor = colorSettings.seriesColors[serieId];
        if (customColor) {
          return Immutable.setIn(serie, ["fillSymbol", "color"], customColor);
        }
        return serie;
      }) as any;
    }

    // Mise à jour du chart avec les séries colorées
    return chart.set("series", series);
  }, [config?.webChart, colorSettings]);

  // TODO: Remplacer setFilterValue par la logique réelle de réception du filtre (callback, props, etc.)

  return (
    <Paper
      variant="flat"
      shape="none"
      transparent={true}
      className="jimu-widget widget-chart"
    >
      <ChartRuntimeStateProvider>
        <Chart
          widgetId={id}
          tools={tools}
          messages={messages}
          options={options}
          webChart={webChart}
          useDataSource={useDataSources?.[0]}
          enableDataAction={enableDataAction}
          onInitDragHandler={onInitDragHandler}
          defaultTemplateType={defaultTemplateType}
          outputDataSourceId={outputDataSources?.[0]}
          dynamicTitleConfig={dynamicTitleConfig}
        />
      </ChartRuntimeStateProvider>
    </Paper>
  );
};

Widget.versionManager = versionManager;

export default Widget;
