/**
 * Chart Print Service - Module Principal
 *
 * Ce module fournit les fonctionnalités d'impression de diagrammes (Charts).
 * Le principe consiste à fournir l'identifiant du widget Chart au widget Print,
 * puis à générer un PDF personnalisé pour le widget sélectionné.
 *
 * @module chart
 * @version 1.0.0
 *
 * STRUCTURE MODULAIRE:
 * - types.ts: Types et interfaces
 * - cache.ts: Gestion du cache et optimisations
 * - widget-utils.ts: Utilitaires pour les widgets Chart
 * - capture.ts: Service de capture d'images
 * - print.ts: Service d'impression PDF
 *
 * FONCTIONS EXPORTÉES:
 * - listAvailableChartWidgets(): Liste tous les widgets Chart
 * - isChartWidgetAvailable(id): Vérifie si un widget existe
 * - getChartWidgetInfo(id): Récupère les infos d'un widget
 * - getChartElement(id): Récupère l'élément DOM d'un widget
 * - captureChartAsImage(id, options): Capture un chart en image
 * - createChartPrintElement(id, options): Crée un élément d'impression
 * - addChartToTemplate(props, element): Ajoute un chart au template
 * - printChartOnly(element, title, format): Imprime un chart seul
 *
 * EXEMPLE D'UTILISATION:
 *   import {
 *     listAvailableChartWidgets,
 *     createChartPrintElement,
 *     printChartOnly
 *   } from './utils/chart';
 *
 *   const charts = listAvailableChartWidgets();
 *   if (charts.length > 0) {
 *     const element = await createChartPrintElement(charts[0].id, options);
 *     if (element) {
 *       await printChartOnly(element, 'Mon Graphique', 'pdf');
 *     }
 *   }
 */

// Types et interfaces
export {
  ChartPosition,
  type ChartSize,
  type ChartPrintOptions,
  type ChartCaptureResult,
  type ChartPrintElement,
  type ChartWidgetInfo,
  DEFAULT_CHART_PRINT_OPTIONS,
} from "./types";

// Cache utilities (exports internes si besoin)
export { clearAllCaches } from "./cache";

// Widget utilities
export {
  isChartWidgetAvailable,
  getChartWidgetInfo,
  getChartElement,
  listAvailableChartWidgets,
} from "./widget-utils";

// Capture service
export { captureChartAsImage } from "./capture";

// Print service
export {
  createChartPrintElement,
  addChartToTemplate,
  printChartOnly,
} from "./print";
