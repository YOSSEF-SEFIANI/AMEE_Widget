import { React, type AllWidgetProps } from "jimu-core";
import { versionManager } from "../version-manager";
import { DefaultOptions } from "../constants";
import { ChartRuntimeStateProvider } from "./state";
import type { IMConfig } from "../config";
import { getChartOrSeriesType } from "../utils/common";
import { getDefaultTools, getDefaultSecondaryAxis } from "../utils/default";
import Chart from "./chart";
import { Paper } from "jimu-ui";
import { applyPaletteToSeries } from "../utils/color-utils";

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

    const chart = config.webChart;
    let series = chart.series;

    // 1. Application de la palette personnalisée si activée
    if (colorSettings?.useCustomPalette && colorSettings?.palette?.colors) {
      const colors = colorSettings.palette.colors.asMutable
        ? colorSettings.palette.colors.asMutable()
        : [...(colorSettings.palette.colors as any)];
      series = applyPaletteToSeries(series as any, colors) as any;
    } else if (chart.customColors && chart.customColors.length > 0) {
      // 2. Utiliser customColors de webChart si défini
      const colors = chart.customColors.asMutable
        ? chart.customColors.asMutable()
        : [...(chart.customColors as any)];
      series = applyPaletteToSeries(series as any, colors) as any;
    }

    // 3. Application des couleurs basées sur valeurs (heatmap)
    // Note: Cette fonctionnalité est désactivée car elle nécessite des valeurs numériques par série
    // if (colorSettings?.useValueBasedColors && colorSettings?.colorThresholds) {
    //   const thresholdsArray = colorSettings.colorThresholds.asMutable ? colorSettings.colorThresholds.asMutable({ deep: true }) : [...colorSettings.colorThresholds as any]
    //   const values = thresholdsArray.map((t: any) => t.value);
    //   series = applyValueBasedColors(series as any, values) as any;
    // }

    // 4. Application des couleurs par série individuelle
    if (colorSettings?.seriesColors) {
      series = series.map((serie) => {
        const serieId = serie.id || serie.name;
        const customColor = colorSettings.seriesColors[serieId as string];
        if (customColor) {
          return serie.setIn(["fillSymbol", "color"], customColor);
        }
        return serie;
      }) as any;
    }

    // Mise à jour du chart avec les séries colorées
    let updatedChart = chart.set("series", series);

    // ===== GESTION DE LA DOUBLE ÉCHELLE (Dual Y-Axis) =====
    // Utilise la propriété officielle ArcGIS Charts: 'assignToSecondValueAxis'
    // Référence: @arcgis/charts-spec - WebChartBarChartSeries, WebChartLineChartSeries
    const dualAxisConfig = chart.dualAxisConfig;

    if (dualAxisConfig?.enabled && updatedChart.axes?.length >= 2) {
      // Convertir ImmutableArray en array mutable
      const seriesIndexesArray: number[] = dualAxisConfig.seriesIndexes
        ? dualAxisConfig.seriesIndexes.asMutable
          ? dualAxisConfig.seriesIndexes.asMutable()
          : [...(dualAxisConfig.seriesIndexes as any)]
        : [];

      // Marquer les séries pour le deuxième axe avec 'assignToSecondValueAxis'
      const seriesWithAxis = updatedChart.series.map((serie, index) => {
        const isSecondary = seriesIndexesArray.includes(index);
        if (isSecondary) {
          // Propriété officielle ArcGIS Charts API pour l'axe secondaire
          return serie.set("assignToSecondValueAxis", true);
        }
        return serie.set("assignToSecondValueAxis", false);
      }) as any;
      updatedChart = updatedChart.set("series", seriesWithAxis);

      // Créer et ajouter le troisième axe Y (axes[2]) si pas déjà présent
      // ArcGIS Charts utilise automatiquement axes[2] quand assignToSecondValueAxis est true
      if (updatedChart.axes.length === 2) {
        const secondaryAxis =
          dualAxisConfig.secondaryAxis || getDefaultSecondaryAxis();
        const axesArray = updatedChart.axes.asMutable({ deep: true });
        axesArray.push(secondaryAxis);
        updatedChart = updatedChart.set("axes", axesArray as any);
      }
    }

    return updatedChart;
  }, [config?.webChart, colorSettings]);

  // TODO: Remplacer setFilterValue par la logique réelle de réception du filtre (callback, props, etc.)

  return (
    <Paper variant="outlined" shape="none" className="jimu-widget widget-chart">
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
