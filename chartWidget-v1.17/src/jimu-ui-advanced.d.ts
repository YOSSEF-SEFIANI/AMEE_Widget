/**
 * Type declarations for jimu-ui/advanced modules
 * Ces modules sont fournis par ArcGIS Experience Builder au runtime
 */

declare module "jimu-ui/advanced/setting-components" {
  import { type React } from "jimu-core";

  export interface SettingSectionProps {
    title?: string;
    className?: string;
    children?: React.ReactNode;
  }

  export interface SettingRowProps {
    label?: string;
    flow?: "wrap" | "no-wrap";
    level?: number;
    className?: string;
    children?: React.ReactNode;
  }

  export const SettingSection: React.ComponentType<SettingSectionProps>;
  export const SettingRow: React.ComponentType<SettingRowProps>;
  export const MapWidgetSelector: React.ComponentType<any>;
}

declare module "jimu-ui/advanced/data-source-selector" {
  import { type React, type UseDataSource, DataSourceTypes } from "jimu-core";

  export interface DataSourceSelectorProps {
    types?: DataSourceTypes[];
    useDataSources?: UseDataSource[];
    onChange?: (useDataSources: UseDataSource[]) => void;
    widgetId?: string;
    mustUseDataSource?: boolean;
    isMultiple?: boolean;
    fromRootDsIds?: string[];
    fromDsIds?: string[];
    hideTypeDropdown?: boolean;
    disableRemove?: boolean;
    disableDataView?: boolean;
    enableToSelectOutputDsFromSelf?: boolean;
    closeDataSourceListOnChange?: boolean;
    buttonLabel?: string;
    widgetName?: string;
  }

  export const DataSourceSelector: React.ComponentType<DataSourceSelectorProps>;
}

declare module "jimu-ui/advanced/chart" {
  export function getSeriesType(series: any): string | undefined;
}
