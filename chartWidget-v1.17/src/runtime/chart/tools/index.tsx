import {
  React,
  classNames,
  ReactRedux,
  getAppStore,
  hooks,
  MessageManager,
  DataRecordsSelectionChangeMessage,
  type ImmutableObject,
  type DataRecordSet,
  type IMState,
  type DataSource,
  type DataRecord,
  type QueriableDataSource,
} from "jimu-core";
import {
  DataActionList,
  DataActionListStyle,
  defaultMessages,
  Button,
  Popper,
  Tooltip,
} from "jimu-ui";
import type { ChartTools } from "../../../config";
import type { RangeCursorModeValue } from "./range-cursor-mode";
import { useChartRuntimeState } from "../../state";
import { SelectionZoom } from "./selection-zoom";
import type { ChartTypes } from "jimu-ui/advanced/chart";
import { styled } from "jimu-theme";
import { EditOutlined } from "jimu-icons/outlined/editor/edit";
import SeriesColorCustomizer from "./series-color-customizer";
import type { ImmutableArray } from "jimu-core";

interface ToolsProps {
  type: ChartTypes;
  widgetId: string;
  className?: string;
  tools?: ImmutableObject<ChartTools>;
  enableDataAction?: boolean;
  onSeriesColorsChange?: (seriesColors: { [serieId: string]: string }) => void;
  currentSeriesColors?: { [serieId: string]: string };
  webChartSeries?: ImmutableArray<any>;
  chartRecords?: DataRecord[];
  categoryField?: string;
}

const Root = styled("div")(({ theme }) => {
  return {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    color: "#212121", // ExB 1.17 compatible
    ".tool-dividing-line": {
      height: "16px",
      width: "1px",
      backgroundColor: "#BDBDBD", // ExB 1.17 compatible
    },
  };
});

const getDataSourceFields = (dataSource: DataSource) => {
  return dataSource ? Object.keys(dataSource.getSchema().fields) : [];
};

const Tools = (props: ToolsProps): React.ReactElement => {
  const {
    type = "barSeries",
    className,
    widgetId,
    tools,
    enableDataAction,
    onSeriesColorsChange,
    currentSeriesColors,
    webChartSeries,
    chartRecords,
    categoryField,
  } = props;

  const translate = hooks.useTranslation(defaultMessages);
  const widgetLabel =
    getAppStore().getState().appConfig.widgets?.[widgetId]?.label ?? "Chart";
  const dataActionLabel = translate("outputStatistics", { name: widgetLabel });
  const { outputDataSource, chart, records, dataSource } = useChartRuntimeState();
  const cursorEnable = tools?.cursorEnable ?? true;

  const dividerVisible =
    (cursorEnable || !!onSeriesColorsChange) && enableDataAction;

  const selectedIds = ReactRedux.useSelector(
    (state: IMState) =>
      state?.dataSourcesInfo[outputDataSource?.id]?.selectedIds,
  );

  // ===== Récupérer les records depuis la DataSource principale si nécessaire =====
  const [sourceRecords, setSourceRecords] = React.useState<DataRecord[]>([]);
  
  React.useEffect(() => {
    // Si on a déjà des records du chart, pas besoin de requêter
    if (records && records.length > 0) {
      setSourceRecords([]);
      return;
    }
    
    // Si pas de dataSource principale, on ne peut rien faire
    if (!dataSource) {
      return;
    }
    
    // Récupérer les records depuis la source principale
    const fetchRecords = async () => {
      try {
        const ds = dataSource as QueriableDataSource;
        if (ds && typeof ds.query === 'function') {
          const result = await ds.query({
            returnGeometry: false,
            pageSize: ds.getMaxRecordCount?.() || 1000,
          });
          if (result?.records && result.records.length > 0) {
            setSourceRecords(result.records);
          }
        } else {
          // Essayer getRecords pour les DataSources non-queriables
          const existingRecords = dataSource.getRecords?.();
          if (existingRecords && existingRecords.length > 0) {
            setSourceRecords(existingRecords);
          }
        }
      } catch (error) {
        console.warn("⚠️ [Tools] Could not fetch records from dataSource:", error);
      }
    };
    
    fetchRecords();
  }, [dataSource, records]);

  // ===== DEBUG: Analyse des DataActions =====

  const actionDataSets: DataRecordSet[] = React.useMemo(() => {
    const selectedRecords = outputDataSource?.getSelectedRecords();
    const dsRecords = outputDataSource?.getRecords();
    const outputFields = getDataSourceFields(outputDataSource);
    const mainFields = getDataSourceFields(dataSource);
    
    // Priorité: records du state > chartRecords props > sourceRecords (fetched) > dsRecords
    const stateRecords = records || chartRecords;
    const allRecords = stateRecords?.length > 0 
      ? stateRecords 
      : (sourceRecords?.length > 0 ? sourceRecords : dsRecords);
    
    // Si pas de records sélectionnés, utiliser tous les records
    const recordsToUse = selectedRecords?.length > 0 ? selectedRecords : allRecords;
    
    // Déterminer quelle dataSource utiliser pour les DataActions
    // Si on utilise des records fetchés depuis la main dataSource, on doit utiliser cette dataSource
    const useMainDataSource = sourceRecords?.length > 0 && (!stateRecords || stateRecords.length === 0);
    const dataSourceForActions = useMainDataSource && dataSource ? dataSource : outputDataSource;
    const fieldsForActions = useMainDataSource ? mainFields : outputFields;
    
    if (!dataSourceForActions) {
      console.log("⚠️ [Tools] No dataSource available - returning empty array");
      return [];
    }
    
    if (!recordsToUse || recordsToUse.length === 0) {
      console.log("⚠️ [Tools] No records available - DataActions will show 'No action available'");
    } else {
      console.log("✅ [Tools] Records available for DataActions:", recordsToUse.length);
    }
    
    const result: DataRecordSet[] = [
      {
        name: dataActionLabel,
        type: selectedRecords?.length > 0 ? "selected" : "loaded",
        dataSource: dataSourceForActions,
        records: recordsToUse || [],
        fields: fieldsForActions,
      },
    ];
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataActionLabel, outputDataSource, dataSource, selectedIds, records, chartRecords, sourceRecords]);

  const handleRangeModeChange = (mode: RangeCursorModeValue) => {
    if (!chart) return;
    if (mode === "selection") {
      chart.actionMode = "multiSelectionWithCtrlKey";
    } else if (mode === "zoom") {
      chart.actionMode = "zoom";
    }
  };

  const handleClearSelection = () => {
    if (!chart) return;
    const dataSourceId = outputDataSource?.id;
    const selectionItems = chart.selectionData?.selectionItems;
    //For issue #27738, when clicking a chart slice to filter data via a message action, the chart loses its selected state and can no longer send messages.
    //To address this, a new behavior is added: when no chart slice is selected, clicking "Clear selection" will send an empty records selection change message.
    if (!selectionItems?.length && dataSourceId) {
      MessageManager.getInstance().publishMessage(
        new DataRecordsSelectionChangeMessage(widgetId, [], [dataSourceId]),
      );
    }
    chart.clearSelection();
  };

  React.useEffect(() => {
    if (!chart) return;
    if (cursorEnable) {
      chart.actionMode = "multiSelectionWithCtrlKey";
    } else {
      chart.actionMode = "none";
    }
  }, [cursorEnable, chart]);

  const [openColorPicker, setOpenColorPicker] = React.useState(false);
  const colorPickerRef = React.useRef<HTMLButtonElement>(null);

  // Get series from webChart configuration (not from chart instance)
  const series = React.useMemo(() => {
    if (!webChartSeries) {
      return [];
    }
    // Convert to array if it's an Immutable object
    const seriesArray = Array.isArray(webChartSeries)
      ? webChartSeries
      : webChartSeries.toArray
        ? webChartSeries.toArray()
        : [];
    return seriesArray;
  }, [webChartSeries]);

  const handleSeriesColorsChange = (seriesColors: {
    [serieId: string]: string;
  }) => {
    onSeriesColorsChange?.(seriesColors);
  };

  return (
    <Root
      className={classNames("chart-tool-bar px-2 pt-2", className)}
      role="group"
      aria-label={translate("tools")}
    >
      {cursorEnable && (
        <SelectionZoom
          type={type}
          className="mr-1"
          onModeChange={handleRangeModeChange}
          onClearSelection={handleClearSelection}
        />
      )}

      {onSeriesColorsChange && (
        <>
          <Tooltip title="Personnaliser les couleurs">
            <Button
              ref={colorPickerRef}
              size="sm"
              icon
              type="tertiary"
              onClick={() => {
                setOpenColorPicker(!openColorPicker);
              }}
            >
              <EditOutlined />
            </Button>
          </Tooltip>
          <Popper
            open={openColorPicker}
            reference={colorPickerRef.current}
            placement="bottom-start"
            toggle={() => {
              setOpenColorPicker(!openColorPicker);
            }}
          >
            <SeriesColorCustomizer
              series={series}
              chartType={type}
              chartRecords={records || chartRecords}
              categoryField={categoryField}
              onSeriesColorsChange={handleSeriesColorsChange}
              currentSeriesColors={currentSeriesColors}
            />
          </Popper>
        </>
      )}

      {dividerVisible && <span className="tool-dividing-line mx-1"></span>}

      {enableDataAction && (
        <DataActionList
          widgetId={widgetId}
          buttonType="tertiary"
          listStyle={DataActionListStyle.Dropdown}
          dataSets={actionDataSets}
        />
      )}
    </Root>
  );
};

export default Tools;
