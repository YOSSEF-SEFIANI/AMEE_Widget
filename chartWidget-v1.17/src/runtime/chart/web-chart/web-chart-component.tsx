import {
  React,
  hooks,
  appActions,
  getAppStore,
  dataSourceUtils,
  type ImmutableObject,
  type QueriableDataSource,
  type WidgetInitDragCallback,
  type FeatureLayerDataSource,
  type FeatureLayerQueryParams,
} from "jimu-core";
import {
  type HTMLArcgisChartElement,
  type WebChart,
  getSeriesType,
  type WebChartDataFilters,
  type SupportedLayer,
  Chart,
  type ArcgisChartCustomEvent,
  type DataProcessCompletePayload,
  type AxesMinMaxChangePayload,
} from "jimu-ui/advanced/chart";
import {
  useSelection,
  normalizeSeries,
  getMinSafeValue,
  getDataItemsWithMixedValue,
  getDataItemsFromChartPayloadData,
  createRecordsFromChartData,
  normalizeAxes,
  getChartLimits,
  isSplitByNoAggregationChart,
} from "./utils";
import {
  ChartLimits,
  GaugeMaxValueField,
  GaugeMinValueField,
  WebChartCurrentVersion,
} from "../../../constants";
import { useChartRuntimeDispatch, useChartRuntimeState } from "../../state";
import type { ChartComponentOptions, IWebChart } from "../../../config";

interface WebChartComponentProps {
  className?: string;
  widgetId: string;
  layer: SupportedLayer;
  webChart: ImmutableObject<IWebChart>;
  options?: ChartComponentOptions;
  onInitDragHandler: WidgetInitDragCallback;
}

const background = [0, 0, 0, 0] as any;

function WebChartComponent(props: WebChartComponentProps): React.ReactElement {
  const {
    className,
    widgetId,
    webChart: propWebChart,
    layer,
    options,
    onInitDragHandler,
  } = props;

  const chartRef = React.useRef<HTMLArcgisChartElement>(null);

  // Détection du type de graphique
  const type = getSeriesType(propWebChart?.series as any);
  const isPieChart = type === "pieSeries";

  const isSplitByNoAggregation = isSplitByNoAggregationChart(
    propWebChart?.dataSource?.query,
  );

  // On récupère les couleurs de l'UI
  const uiCustomColors = propWebChart?.customColors;
  const hasUiColors = uiCustomColors && (uiCustomColors as any).length > 0;

  // ⚡ [FIX] On force colorMatch à false pour les Pie Charts pour débloquer la palette
  const colorMatchAllowed =
    !isPieChart &&
    propWebChart.colorMatch &&
    (propWebChart?.series?.length === 1 ||
      !!propWebChart?.series?.[0]?.query?.where);

  const id = widgetId + "-" + (propWebChart?.id ?? "chart");
  const dispatch = useChartRuntimeDispatch();
  const { outputDataSource, dataSource, queryVersion, records } =
    useChartRuntimeState();
  const recordsRef = hooks.useLatest(records);

  const minimumRef = React.useRef<number>(null);
  const maximumRef = React.useRef<number>(null);

  const queryParams: FeatureLayerQueryParams = React.useMemo(() => {
    const queryParams =
      (dataSource as QueriableDataSource)?.getCurrentQueryParams() ?? {};
    const pageSize = (dataSource as QueriableDataSource)?.getMaxRecordCount();
    queryParams.pageSize = pageSize;
    return queryParams;
  }, [dataSource, queryVersion]);

  const timeZone = React.useMemo(() => {
    let timeZone = (dataSource as FeatureLayerDataSource)?.getTimezone();
    if (timeZone) {
      timeZone = dataSourceUtils.getTimezoneAPIFromRuntime(timeZone);
    }
    return timeZone;
  }, [dataSource]);

  const { where, geometry, gdbVersion, time, distance, units, pageSize } =
    queryParams;

  const num = getMinSafeValue(
    pageSize,
    propWebChart.dataSource?.query?.pageSize,
  );
  const chartLimits = React.useMemo(
    () => getChartLimits(propWebChart?.series, ChartLimits, num),
    [num, propWebChart?.series],
  );

  // ===========================================================================
  // ⚡ [FIX CRITIQUE] NETTOYAGE DES COULEURS
  // ===========================================================================
  const webMapWebChart = React.useMemo(() => {
    let query = propWebChart.dataSource?.query;
    if (query) {
      query = query.set("pageSize", num);
    }

    // Sauvegarder les propriétés assignToSecondValueAxis avant normalisation
    // C'est la propriété officielle ArcGIS Charts pour le double axe Y
    const secondAxisMap = new Map<number, boolean>();
    propWebChart.series?.forEach((serie, index) => {
      if (serie.assignToSecondValueAxis !== undefined) {
        secondAxisMap.set(index, serie.assignToSecondValueAxis as boolean);
      }
    });

    // 1. Normalisation standard
    let series = normalizeSeries(propWebChart.series, query);

    // Restaurer les propriétés assignToSecondValueAxis après normalisation
    if (secondAxisMap.size > 0 && series) {
      series = series.map((serie, index) => {
        const assignToSecond = secondAxisMap.get(index);
        if (assignToSecond !== undefined) {
          return serie.set("assignToSecondValueAxis", assignToSecond);
        }
        return serie;
      }) as any;
    }

    // 2. INTERCEPTION : Si c'est un Pie Chart, on supprime la couleur unique
    if (isPieChart && series && series.length > 0) {
      series = series.map((s) => {
        return s.without("fillSymbol");
      });
    }

    // Normaliser les 2 premiers axes (X et Y primaire)
    let axes = normalizeAxes(propWebChart.series, propWebChart.axes, query);

    // ===== CALCUL MIN/MAX POUR L'AXE Y PRIMAIRE (séries NON assignées à l'axe secondaire) =====
    if (
      secondAxisMap.size > 0 &&
      recordsRef.current &&
      recordsRef.current.length > 0
    ) {
      let primaryMin = Infinity;
      let primaryMax = -Infinity;

      // Trouver les champs Y des séries sur l'axe primaire
      series?.forEach((s, index) => {
        if (!secondAxisMap.get(index)) {
          const yField = s.y;
          if (yField) {
            // Parcourir les records pour trouver min/max de ce champ
            recordsRef.current.forEach((record: any) => {
              const data = record.getData ? record.getData() : record;
              const value = data[yField];
              if (typeof value === "number" && !isNaN(value)) {
                if (value < primaryMin) primaryMin = value;
                if (value > primaryMax) primaryMax = value;
              }
            });
          }
        }
      });

      // Appliquer les min/max calculés à l'axe Y primaire (axes[1])
      if (
        primaryMin !== Infinity &&
        primaryMax !== -Infinity &&
        axes &&
        (axes as any).length >= 2
      ) {
        const range = primaryMax - primaryMin;
        const margin = range * 0.1; // 10% de marge
        const calculatedMin = Math.floor(primaryMin - margin);
        const calculatedMax = Math.ceil(primaryMax + margin);

        // Mettre à jour l'axe Y primaire (axes[1])
        const axesArray: any[] = axes?.asMutable
          ? axes.asMutable({ deep: true })
          : axes
            ? [...(axes as any)]
            : [];

        if (axesArray[1]) {
          axesArray[1] = {
            ...axesArray[1],
            minimum: calculatedMin,
            maximum: calculatedMax,
          };
          axes = axesArray as any;
        }
      }
    }

    // ===== DUAL AXIS : Préserver le troisième axe (Y secondaire) =====
    const propAxesArray = propWebChart.axes?.asMutable
      ? propWebChart.axes.asMutable({ deep: true })
      : propWebChart.axes
        ? [...(propWebChart.axes as any)]
        : [];

    if (propAxesArray && propAxesArray.length === 3) {
      // Le 3ème axe existe (double échelle), on le préserve
      let thirdAxis = propAxesArray[2];
      const currentAxesLength = axes?.length || 0;

      // ===== CALCUL MIN/MAX POUR L'AXE SECONDAIRE =====
      if (
        secondAxisMap.size > 0 &&
        recordsRef.current &&
        recordsRef.current.length > 0
      ) {
        const firstRecord = recordsRef.current[0];
        const firstData = firstRecord?.getData
          ? firstRecord.getData()
          : firstRecord;

        let secondaryMin = Infinity;
        let secondaryMax = -Infinity;

        // Trouver les champs Y des séries sur l'axe secondaire
        series?.forEach((s, index) => {
          if (secondAxisMap.get(index)) {
            const yField = s.y;
            const seriesName = s.name;

            // Parcourir les records pour trouver min/max de ce champ
            recordsRef.current.forEach((record: any) => {
              const data = record.getData ? record.getData() : record;

              // Essayer plusieurs façons d'accéder aux données
              let value = data[yField];

              // Si pas trouvé, essayer avec le nom de la série comme clé
              if (value === undefined && seriesName) {
                value = data[seriesName];
              }

              // Si toujours pas trouvé, chercher une clé qui contient le yField
              if (value === undefined) {
                const matchingKey = Object.keys(data).find(
                  (k) => k.includes(yField) || k.includes(seriesName),
                );
                if (matchingKey) {
                  value = data[matchingKey];
                }
              }

              if (typeof value === "number" && !isNaN(value)) {
                if (value < secondaryMin) secondaryMin = value;
                if (value > secondaryMax) secondaryMax = value;
              }
            });
          }
        });

        // Appliquer les min/max calculés avec une marge de 5%
        if (secondaryMin !== Infinity && secondaryMax !== -Infinity) {
          const range = secondaryMax - secondaryMin;
          const margin = range * 0.05; // 5% de marge

          let calculatedMin = secondaryMin - margin;
          if (secondaryMin >= 0 && calculatedMin < 0) {
            calculatedMin = 0;
          }
          const magnitude = Math.pow(
            10,
            Math.floor(Math.log10(Math.abs(secondaryMin) || 1)),
          );
          calculatedMin = Math.floor(calculatedMin / magnitude) * magnitude;

          const calculatedMax =
            Math.ceil((secondaryMax + margin) / magnitude) * magnitude;

          // Mettre à jour le 3ème axe avec les min/max calculés
          thirdAxis = {
            ...thirdAxis,
            minimum: calculatedMin,
            maximum: calculatedMax,
          };
        }
      }

      // Ajouter le 3ème axe SEULEMENT si normalizeAxes n'en a retourné que 2
      if (thirdAxis && currentAxesLength === 2) {
        const axesArray: any[] = axes?.asMutable
          ? axes.asMutable({ deep: true })
          : axes
            ? [...(axes as any)]
            : [];
        axesArray.push(thirdAxis);
        axes = axesArray as any;
      }
    }

    // 3. Construction de l'objet final

    let finalChart = propWebChart
      .set("version", WebChartCurrentVersion)
      .without("dataSource")
      .set("series", series) // Série nettoyée sans fillSymbol
      .set("axes", axes)
      .set("id", id)
      .set("background", background);

    // 4. Application de la palette UI
    if (hasUiColors) {
      // On applique les couleurs choisies
      finalChart = finalChart.set("customColors", uiCustomColors);
      // On force la désactivation de colorMatch (sinon conflit)
      finalChart = finalChart.set("colorMatch", false);
    }

    return finalChart as unknown as ImmutableObject<WebChart>;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, propWebChart, num, isPieChart, hasUiColors, uiCustomColors, records]);

  // ===========================================================================

  const runtimeDataFilters = React.useMemo(() => {
    const runtimeDataFilters: WebChartDataFilters = {};
    if (where) {
      runtimeDataFilters.where = where;
    }
    if (geometry) {
      runtimeDataFilters.geometry = geometry as any;
      if (distance && units) {
        runtimeDataFilters.distance = distance;
        runtimeDataFilters.units = units as any;
      }
    }
    if (time) {
      runtimeDataFilters.timeExtent = time as [number, number];
    }
    if (gdbVersion) {
      runtimeDataFilters.gdbVersion = gdbVersion;
    }
    return Object.keys(runtimeDataFilters).length
      ? runtimeDataFilters
      : undefined;
  }, [where, geometry, distance, units, time, gdbVersion]);

  hooks.useEffectOnce(() => {
    onInitDragHandler?.(null, null, () => {
      if (!chartRef.current) return;
      chartRef.current.refresh({ updateData: false, resetAxesBounds: false });
    });
  });

  const handleCreated = React.useCallback(
    (chart: HTMLArcgisChartElement) => {
      chartRef.current = chart;
      dispatch({ type: "SET_CHART", value: chart });
    },
    [dispatch],
  );

  const handleDataProcessComplete = hooks.useEventCallback(
    (e: ArcgisChartCustomEvent<DataProcessCompletePayload>) => {
      
      const dataItems = getDataItemsFromChartPayloadData(
        type,
        e.detail.chartData,
      );
     
      const records = createRecordsFromChartData(
        dataItems,
        outputDataSource,
        isSplitByNoAggregation,
      );
      
      minimumRef.current = undefined;
      maximumRef.current = undefined;
      dispatch({ type: "SET_RECORDS", value: records });
      dispatch({ type: "SET_RENDER_STATE", value: "success" });
    },
  );

  const handleAxesMinMaxChange = hooks.useEventCallback(
    (e: ArcgisChartCustomEvent<AxesMinMaxChangePayload>) => {
      if (type !== "gaugeSeries" || !recordsRef.current || !e.detail.bounds[0])
        return;

      const { minimum, maximum } = e.detail.bounds[0];
      if (minimum === minimumRef.current && maximum === maximumRef.current)
        return;
      minimumRef.current = minimum;
      maximumRef.current = maximum;

      const mixedValue = {
        [GaugeMinValueField]: minimum,
        [GaugeMaxValueField]: maximum,
      };
      let dataItems = recordsRef.current.map((record) => record.getData());
      dataItems = getDataItemsWithMixedValue(dataItems, mixedValue);
      const records = createRecordsFromChartData(
        dataItems,
        outputDataSource,
        false,
      );
      dispatch({ type: "SET_RECORDS", value: records });
    },
  );

  const handleDataProcessError = hooks.useEventCallback((e) => {
    dispatch({ type: "SET_RECORDS", value: undefined });
    dispatch({ type: "SET_RENDER_STATE", value: "error" });
  });

  hooks.useUpdateEffect(() => {
    if (!chartRef.current || !layer) return;
    chartRef.current.refresh({ updateData: true, resetAxesBounds: false });
  }, [layer, gdbVersion]);

  const [selectionData, handleSelectionChange] = useSelection(
    widgetId,
    outputDataSource,
    propWebChart.series,
  );

  const handleChartsSeriesColorChange = React.useCallback(
    (evt) => {
      if (window.jimuConfig.isInBuilder) {
        if (colorMatchAllowed) {
          const colorMatchApplied = evt.detail.colorMatchApplied;
          getAppStore().dispatch(
            appActions.widgetStatePropChange(
              widgetId,
              "colorMatchingApplied",
              colorMatchApplied,
            ),
          );
        } else {
          getAppStore().dispatch(
            appActions.widgetStatePropChange(
              widgetId,
              "colorMatchingApplied",
              undefined,
            ),
          );
        }
      }
    },
    [widgetId, colorMatchAllowed],
  );

  const handleArcgisBadDataWarningRaise = React.useCallback(
    (evt) => {
      if (evt.detail?.keyword === "emptyDataSet") {
        dispatch({ type: "SET_RECORDS", value: undefined });
        dispatch({ type: "SET_RENDER_STATE", value: "warning" });
      }
    },
    [dispatch],
  );

  // Debug: Log when component renders
  // React.useEffect(() => {
  //   console.log("🔄 [WebChart] Component RENDER");
  //   console.log("  - layer:", layer ? "present" : "missing");
  //   console.log("  - webMapWebChart:", webMapWebChart ? "present" : "missing");
  //   console.log("  - outputDataSource:", outputDataSource?.id || "missing");
  //   console.log("  - handleDataProcessComplete:", typeof handleDataProcessComplete);
  // }, [layer, webMapWebChart, outputDataSource, handleDataProcessComplete]);

  return (
    <Chart
      {...options}
      ref={handleCreated}
      timeZone={timeZone}
      allowUsingObjectIdStat={true}
      className={className}
      config={webMapWebChart}
      runtimeDataFilters={runtimeDataFilters}
      layer={layer}
      chartLimits={chartLimits}
      selectionData={selectionData}
      onarcgisSelectionComplete={handleSelectionChange}
      onarcgisDataProcessComplete={handleDataProcessComplete}
      onarcgisDataProcessError={handleDataProcessError}
      onarcgisAxesMinMaxChange={handleAxesMinMaxChange}
      onarcgisSeriesColorChange={handleChartsSeriesColorChange}
      onarcgisBadDataWarningRaise={handleArcgisBadDataWarningRaise}
    />
  );
}

export default WebChartComponent;
