/**
 * Chart Types
 *
 * Types et interfaces pour le service d'impression de diagrammes.
 *
 * @module chart/types
 * @version 1.0.0
 */

/**
 * Position du diagramme dans le PDF
 */
export enum ChartPosition {
  TOP = "TOP",
  BOTTOM = "BOTTOM",
  LEFT = "LEFT",
  RIGHT = "RIGHT",
  OVERLAY = "OVERLAY",
}

/**
 * Options de taille pour le diagramme
 */
export interface ChartSize {
  width: number;
  height: number;
}

/**
 * Options d'impression du diagramme
 */
export interface ChartPrintOptions {
  chartWidgetId: string;
  includeChartInPrint: boolean;
  chartPosition: ChartPosition;
  chartSize: ChartSize;
  chartTitle?: string;
  chartBackground?: string;
  preserveChartRatio?: boolean;
  scaleToFit?: boolean;
}

/**
 * Résultat de la capture du diagramme
 */
export interface ChartCaptureResult {
  success: boolean;
  dataUrl?: string;
  width?: number;
  height?: number;
  error?: string;
}

/**
 * Élément de diagramme pour l'impression
 */
export interface ChartPrintElement {
  type: "chart";
  content: string;
  position: ChartPosition;
  size: ChartSize;
  title?: string;
}

/**
 * Information sur un widget Chart disponible
 */
export interface ChartWidgetInfo {
  id: string;
  label: string;
}

/**
 * Configuration par défaut pour l'impression de diagramme
 */
export const DEFAULT_CHART_PRINT_OPTIONS: Partial<ChartPrintOptions> = {
  includeChartInPrint: false,
  chartPosition: ChartPosition.BOTTOM,
  chartSize: {
    width: 10000,
    height: 10000,
  },
  preserveChartRatio: true,
  scaleToFit: true,
};
