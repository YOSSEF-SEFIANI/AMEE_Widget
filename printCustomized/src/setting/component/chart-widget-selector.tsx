/** @jsx jsx */
/**
 * Composant de sélection de widget Chart pour l'impression
 * Permet de sélectionner un widget Chart à inclure dans l'impression PDF
 */
import { React, jsx, css, hooks, ReactRedux, type IMState } from "jimu-core";
import { Select, Option, Label, Switch } from "jimu-ui";
import { SettingRow } from "jimu-ui/advanced/setting-components";
import { type ChartPrintOptions, ChartPosition } from "../../config";
import defaultMessage from "../translations/default";

const { useState, useEffect } = React;

interface ChartWidgetInfo {
  id: string;
  label: string;
}

interface Props {
  chartPrintOptions?: ChartPrintOptions;
  useChartWidgetIds?: string[];
  onChartPrintOptionsChange: (options: ChartPrintOptions) => void;
  onUseChartWidgetIdsChange: (ids: string[]) => void;
}

const STYLE = css`
  .chart-selector-container {
    margin-top: 8px;
  }
  .chart-option-row {
    margin-top: 8px;
  }
  .chart-switch-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 8px;
  }
`;

/**
 * Le panneau Setting ne reçoit pas la liste des widgets dans ses props.
 * Il faut lire les widgets depuis le store Redux.
 */
function normalizeWidgets(widgets: any): Record<string, any> | null {
  if (!widgets) return null;
  // In ExB, widgets can be ImmutableObject; expose a mutable clone if available.
  if (typeof widgets?.asMutable === "function") {
    return widgets.asMutable({ deep: true });
  }
  return widgets;
}

const ChartWidgetSelector = (props: Props) => {
  // Normaliser les props avec des valeurs par défaut et convertir ImmutableObject si nécessaire
  const rawChartPrintOptions = props.chartPrintOptions;
  const chartPrintOptions = React.useMemo(() => {
    if (!rawChartPrintOptions) {
      return {
        includeChartInPrint: false,
        chartPosition: ChartPosition.BOTTOM,
        chartSize: { width: 400, height: 300 },
        chartWidgetId: "",
      };
    }
    // Convertir ImmutableObject en objet mutable si nécessaire
    if (typeof (rawChartPrintOptions as any)?.asMutable === "function") {
      return (rawChartPrintOptions as any).asMutable({ deep: true });
    }
    return rawChartPrintOptions;
  }, [rawChartPrintOptions]);

  const rawUseChartWidgetIds = props.useChartWidgetIds;
  const useChartWidgetIds = React.useMemo(() => {
    if (!rawUseChartWidgetIds) return [];
    // Convertir ImmutableArray si nécessaire
    if (typeof (rawUseChartWidgetIds as any)?.asMutable === "function") {
      return (rawUseChartWidgetIds as any).asMutable({ deep: true });
    }
    return rawUseChartWidgetIds;
  }, [rawUseChartWidgetIds]);

  const { onChartPrintOptionsChange, onUseChartWidgetIdsChange } = props;

  const nls = hooks.useTranslation(defaultMessage);

  const widgetsFromStore = ReactRedux.useSelector((state: IMState) => {
    // Builder context
    const widgetsInBuilder = (state as any)?.appStateInBuilder?.appConfig
      ?.widgets;
    // Runtime/preview fallback
    const widgetsInRuntime = (state as any)?.appConfig?.widgets;
    return widgetsInBuilder || widgetsInRuntime;
  });

  const availableCharts = React.useMemo<ChartWidgetInfo[]>(() => {
    const widgets = normalizeWidgets(widgetsFromStore);
    if (!widgets) return [];

    const chartWidgets: ChartWidgetInfo[] = [];
    Object.keys(widgets).forEach((widgetId) => {
      const widget = widgets[widgetId];
      const uri = String(widget?.uri || "").toLowerCase();
      // Tolerance: chart widgets can have different uri patterns depending on ExB version/build.
      if (uri.includes("chart")) {
        chartWidgets.push({
          id: widgetId,
          label: widget?.label || `Chart (${widgetId})`,
        });
      }
    });

    return chartWidgets;
  }, [widgetsFromStore]);

  const [selectedChartId, setSelectedChartId] = useState<string>(
    chartPrintOptions.chartWidgetId || "",
  );
  const [includeChart, setIncludeChart] = useState<boolean>(
    chartPrintOptions.includeChartInPrint || false,
  );
  const [chartPosition, setChartPosition] = useState<ChartPosition>(
    chartPrintOptions.chartPosition || ChartPosition.BOTTOM,
  );

  useEffect(() => {
    // Synchroniser l'état local avec les props
    setSelectedChartId(chartPrintOptions.chartWidgetId || "");
    setIncludeChart(chartPrintOptions.includeChartInPrint || false);
    setChartPosition(chartPrintOptions.chartPosition || ChartPosition.BOTTOM);
  }, [chartPrintOptions]);

  // Note: La synchronisation de useChartWidgetIds est gérée directement dans handleChartSelect et handleIncludeChartChange
  // Pas besoin d'un useEffect séparé qui causerait une boucle infinie

  const handleChartSelect = (evt: React.ChangeEvent<HTMLSelectElement>) => {
    const chartId = evt.target.value;
    setSelectedChartId(chartId);

    // Mettre à jour useChartWidgetIds
    if (chartId) {
      onUseChartWidgetIdsChange([chartId]);
    } else {
      onUseChartWidgetIdsChange([]);
    }

    // Mettre à jour les options d'impression
    const newOptions: ChartPrintOptions = {
      ...chartPrintOptions,
      chartWidgetId: chartId,
      includeChartInPrint: includeChart,
      chartPosition: chartPosition,
      chartSize: chartPrintOptions.chartSize || { width: 400, height: 300 },
    };
    onChartPrintOptionsChange(newOptions);
  };

  const handleIncludeChartChange = (
    evt: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const checked = evt.target.checked;
    setIncludeChart(checked);

    // Mettre à jour useChartWidgetIds basé sur l'état "includeChart"
    if (checked && selectedChartId) {
      onUseChartWidgetIdsChange([selectedChartId]);
    } else {
      onUseChartWidgetIdsChange([]);
    }

    const newOptions: ChartPrintOptions = {
      ...chartPrintOptions,
      chartWidgetId: selectedChartId,
      includeChartInPrint: checked,
      chartPosition: chartPosition,
      chartSize: chartPrintOptions.chartSize || { width: 400, height: 300 },
    };
    onChartPrintOptionsChange(newOptions);
  };

  const handlePositionChange = (evt: React.ChangeEvent<HTMLSelectElement>) => {
    const position = evt.target.value as ChartPosition;
    setChartPosition(position);

    // S'assurer que useChartWidgetIds est à jour
    if (includeChart && selectedChartId) {
      onUseChartWidgetIdsChange([selectedChartId]);
    }

    const newOptions: ChartPrintOptions = {
      ...chartPrintOptions,
      chartWidgetId: selectedChartId,
      includeChartInPrint: includeChart,
      chartPosition: position,
      chartSize: chartPrintOptions.chartSize || { width: 400, height: 300 },
    };
    onChartPrintOptionsChange(newOptions);
  };

  return (
    <div css={STYLE} className="chart-selector-container">
      {/* Sélection du widget Chart */}
      <SettingRow
        flow="wrap"
        label={nls("selectChart")}
        role="group"
        aria-label={nls("selectChart")}
      >
        <Select
          value={selectedChartId}
          onChange={handleChartSelect}
          size="sm"
          aria-label={nls("selectChart")}
        >
          <Option value="">{nls("none")}</Option>
          {availableCharts.map((chart: ChartWidgetInfo) => (
            <Option key={chart.id} value={chart.id}>
              {chart.label}
            </Option>
          ))}
        </Select>
      </SettingRow>

      {/* Option pour inclure le chart dans l'impression */}
      {selectedChartId && (
        <div className="chart-option-row">
          <div className="chart-switch-row">
            <Label>{nls("includeChartInPrint")}</Label>
            <Switch
              checked={includeChart}
              onChange={handleIncludeChartChange}
              aria-label={nls("includeChartInPrint")}
            />
          </div>
        </div>
      )}

      {/* Position du chart dans le PDF */}
      {selectedChartId && includeChart && (
        <SettingRow
          flow="wrap"
          label={nls("chartPosition")}
          className="chart-option-row"
        >
          <Select
            value={chartPosition}
            onChange={handlePositionChange}
            size="sm"
            aria-label={nls("chartPosition")}
          >
            <Option value={ChartPosition.TOP}>{nls("positionTop")}</Option>
            <Option value={ChartPosition.BOTTOM}>
              {nls("positionBottom")}
            </Option>
            <Option value={ChartPosition.LEFT}>{nls("positionLeft")}</Option>
            <Option value={ChartPosition.RIGHT}>{nls("positionRight")}</Option>
          </Select>
        </SettingRow>
      )}

      {/* Message si aucun chart disponible */}
      {availableCharts.length === 0 && (
        <div className="text-muted mt-2">{nls("noChartWidgetAvailable")}</div>
      )}
    </div>
  );
};

export default ChartWidgetSelector;
