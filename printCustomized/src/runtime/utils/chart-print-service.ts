/**
 * Chart Print Service
 *
 * Ce module fournit les fonctionnalités d'impression de diagrammes (Charts).
 * Le principe consiste à fournir l'identifiant du widget Chart au widget Print,
 * puis à générer un PDF personnalisé pour le widget sélectionné.
 *
 * @module chart-print-service
 * @optimized Performance improvements applied:
 *   - DOM element caching
 *   - Optimized canvas search with early termination
 *   - Capture result caching with TTL
 *   - Reduced html2canvas overhead
 *   - Lazy loading and debouncing
 *   - PDF generation with jsPDF
 *   - Non-blocking UI operations via yieldToMain()
 *   - Chunked legend rendering to prevent UI freeze
 *   - Progress callbacks for real-time UI feedback
 *   - Configurable timeout for long operations
 *
 * @version 2.2.0
 *
 * FONCTIONS PRINCIPALES:
 *
 * 1. Extraction des données:
 *    - extractChartDataComplete(chartWidgetId) - Méthode recommandée, essaie plusieurs stratégies
 *    - extractChartData(chartWidgetId) - Via DataSourceManager
 *    - extractChartDataFromDOM(chartWidgetId) - Via parsing du DOM
 *    - debugChartWidget(chartWidgetId) - Pour diagnostiquer les problèmes
 *
 * 2. Génération PDF PROFESSIONNEL (style carte ArcGIS):
 *    ★ generateProfessionalChartPdf(id, options) - PDF style carte avec titre, graphique, légende complète
 *    ★ generateAndDownloadProfessionalChartPdf(id, options, filename) - Génère et télécharge
 *
 *    Options disponibles:
 *      - title: Titre du document
 *      - subtitle: Sous-titre
 *      - showDate: Afficher la date (défaut: true)
 *      - showLegend: Afficher la légende (défaut: true)
 *      - legendColumns: Nombre de colonnes pour la légende (défaut: 4)
 *      - author: Auteur
 *      - organization: Organisation
 *      - orientation: 'portrait' | 'landscape' (défaut: landscape)
 *      - format: 'a4' | 'a3' | 'a2' | 'a1' | 'letter' | 'legal' | 'tabloid'
 *      - onProgress: Callback de progression (stage, progress, message)
 *      - timeout: Timeout en ms (défaut: 30000)
 *      - margin: Marge du document en mm (défaut: 10)
 *      - forceRefresh: Forcer une nouvelle capture sans cache
 *
 * 3. Autres fonctions PDF:
 *    - generateChartPdfWithFullLegend(id, options) - PDF avec légende complète recréée
 *    - generateCompleteChartPdf(id, options, includeTable) - PDF avec image + tableau de données
 *    - generateChartDataPdf(id, title) - PDF avec données tabulaires uniquement
 *    - generateChartPdf(id, options) - PDF simple (capture d'écran)
 *    - generateMultiChartPdf(chartIds, options) - PDF multi-charts
 *
 * 4. Téléchargement:
 *    - downloadPdf(blob, filename) - Télécharge un PDF
 *
 * EXEMPLE D'UTILISATION (avec progression UI non-bloquante):
 *    generateAndDownloadProfessionalChartPdf('widget_chart_1', {
 *      title: 'Analyse des données 2024',
 *      subtitle: 'Répartition par année',
 *      author: 'AMEE',
 *      organization: 'Ministère',
 *      legendColumns: 3,
 *      orientation: 'landscape',
 *      format: 'a3',
 *      onProgress: (stage, progress, message) => {
 *        console.log(`[${stage}] ${progress}% - ${message}`);
 *        // Mettre à jour l'UI avec la progression
 *      },
 *      timeout: 60000
 *    }, 'rapport-chart');
 */

import { getAppStore, DataSourceManager } from "jimu-core";
import type { FeatureLayerDataSource, DataSource, DataRecord } from "jimu-core";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

// ============== PERFORMANCE OPTIMIZATIONS ==============

// Configuration pour activer/désactiver les logs (activé pour débug)
// Changer à: const DEBUG_MODE = process.env.NODE_ENV === 'development'; en production
const DEBUG_MODE = true; // DEBUG: Activé temporairement
const log = DEBUG_MODE
  ? console.log.bind(console, "[ChartPrintService]")
  : () => {};
const logWarn = DEBUG_MODE
  ? console.warn.bind(console, "[ChartPrintService]")
  : () => {};

// Cache pour les éléments DOM des charts (évite les recherches répétées)
const chartElementCache = new Map<
  string,
  { element: HTMLElement; timestamp: number }
>();
const ELEMENT_CACHE_TTL = 30000; // 30 secondes

// Cache pour les captures de charts (évite les recaptures fréquentes)
const captureCache = new Map<
  string,
  { result: ChartCaptureResult; timestamp: number }
>();
const CAPTURE_CACHE_TTL = 5000; // 5 secondes

// Pool de canvas réutilisables pour éviter les allocations répétées
const canvasPool: HTMLCanvasElement[] = [];
const MAX_POOL_SIZE = 3;

/**
 * Obtient un canvas du pool ou en crée un nouveau
 */
function getPooledCanvas(width: number, height: number): HTMLCanvasElement {
  let canvas = canvasPool.pop();
  if (!canvas) {
    canvas = document.createElement("canvas");
  }
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/**
 * Retourne un canvas au pool pour réutilisation
 */
function returnCanvasToPool(canvas: HTMLCanvasElement): void {
  if (canvasPool.length < MAX_POOL_SIZE) {
    // Nettoyer le canvas avant de le remettre dans le pool
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    canvasPool.push(canvas);
  }
}

/**
 * Nettoie les entrées expirées des caches
 */
function cleanExpiredCache(): void {
  const now = Date.now();

  chartElementCache.forEach((value, key) => {
    if (now - value.timestamp > ELEMENT_CACHE_TTL) {
      chartElementCache.delete(key);
    }
  });

  captureCache.forEach((value, key) => {
    if (now - value.timestamp > CAPTURE_CACHE_TTL) {
      captureCache.delete(key);
    }
  });
}

// Nettoyage périodique du cache (toutes les 60 secondes)
setInterval(cleanExpiredCache, 60000);

/**
 * Invalide le cache pour un widget spécifique
 */
export function invalidateChartCache(chartWidgetId: string): void {
  chartElementCache.delete(chartWidgetId);
  captureCache.delete(chartWidgetId);
}

/**
 * Trouve récursivement tous les canvas dans un élément, y compris dans les shadow DOMs
 * @optimized Utilise un TreeWalker pour une traversée plus efficace
 */
function findAllCanvases(element: Element): HTMLCanvasElement[] {
  const canvases: HTMLCanvasElement[] = [];

  // Utiliser une approche itérative avec une pile pour éviter la récursion profonde
  const stack: Element[] = [element];

  while (stack.length > 0) {
    const current = stack.pop()!;

    // Chercher les canvas directs dans l'élément courant
    if (current.tagName === "CANVAS") {
      canvases.push(current as HTMLCanvasElement);
    }

    // Ajouter les enfants directs qui sont des canvas
    const directCanvases = current.querySelectorAll(":scope > canvas");
    for (let i = 0; i < directCanvases.length; i++) {
      canvases.push(directCanvases[i] as HTMLCanvasElement);
    }

    // Parcourir les enfants pour les shadow DOMs
    const children = current.children;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.shadowRoot) {
        stack.push(child.shadowRoot as unknown as Element);
      }
      // Ajouter les enfants avec des sous-éléments potentiels
      if (child.children.length > 0 || child.shadowRoot) {
        stack.push(child);
      }
    }
  }

  // Dédupliquer les canvas trouvés (compatible ES5)
  const uniqueCanvases: HTMLCanvasElement[] = [];
  const seen = new Set<HTMLCanvasElement>();
  for (let i = 0; i < canvases.length; i++) {
    if (!seen.has(canvases[i])) {
      seen.add(canvases[i]);
      uniqueCanvases.push(canvases[i]);
    }
  }
  return uniqueCanvases;
}

/**
 * Trouve le plus grand canvas dans un élément
 * @optimized Arrêt anticipé si un canvas suffisamment grand est trouvé
 */
function findLargestCanvas(element: Element): HTMLCanvasElement | null {
  const allCanvases = findAllCanvases(element);
  log(`Nombre total de canvas trouvés: ${allCanvases.length}`);

  let largestCanvas: HTMLCanvasElement | null = null;
  let maxArea = 0;

  // Seuil pour arrêt anticipé (canvas assez grand pour l'impression)
  const SUFFICIENT_AREA = 200000; // ~450x450 pixels

  for (const canvas of allCanvases) {
    const area = canvas.width * canvas.height;

    if (area > maxArea) {
      maxArea = area;
      largestCanvas = canvas;

      // Arrêt anticipé si on trouve un canvas suffisamment grand
      if (area >= SUFFICIENT_AREA) {
        log(`Canvas suffisant trouvé: ${canvas.width}x${canvas.height}`);
        break;
      }
    }
  }

  return largestCanvas;
}

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

/**
 * Vérifie si un widget Chart existe dans l'application
 * @param chartWidgetId - ID du widget Chart
 * @returns boolean
 */
export function isChartWidgetAvailable(chartWidgetId: string): boolean {
  if (!chartWidgetId) return false;

  const widgets = getAppStore().getState().appConfig?.widgets;
  if (!widgets) return false;

  const widget = widgets[chartWidgetId];
  return widget && widget.uri?.includes("chart");
}

/**
 * Récupère les informations du widget Chart
 * @param chartWidgetId - ID du widget Chart
 * @returns Configuration du widget ou null
 */
export function getChartWidgetInfo(chartWidgetId: string): any | null {
  if (!chartWidgetId) return null;

  const widgets = getAppStore().getState().appConfig?.widgets;
  if (!widgets) return null;

  return widgets[chartWidgetId] || null;
}

/**
 * Fonction de débogage pour afficher toutes les informations disponibles sur un widget Chart
 * Utile pour diagnostiquer les problèmes d'extraction de données
 * @param chartWidgetId - ID du widget Chart
 */
export function debugChartWidget(chartWidgetId: string): void {
  console.group(`[ChartPrintService] Debug Widget: ${chartWidgetId}`);

  // 1. Info du widget
  const widgetInfo = getChartWidgetInfo(chartWidgetId);
  if (widgetInfo) {
    console.log("Widget Config:", {
      id: widgetInfo.id,
      label: widgetInfo.label,
      uri: widgetInfo.uri,
      useDataSources: widgetInfo.useDataSources,
      outputDataSources: widgetInfo.outputDataSources,
    });
    console.log("WebChart Config:", widgetInfo.config?.webChart);
  } else {
    console.log("Widget non trouvé dans appConfig");
  }

  // 2. Toutes les DataSources disponibles
  const dsManager = DataSourceManager.getInstance();
  const allDataSources = dsManager.getAllDataSources();
  console.log("Toutes les DataSources:", Object.keys(allDataSources));

  // 3. Détails sur les DataSources du widget
  if (widgetInfo?.useDataSources) {
    widgetInfo.useDataSources.forEach((uds: any, i: number) => {
      const ds = dsManager.getDataSource(uds?.dataSourceId);
      console.log(`useDataSource[${i}]:`, {
        id: uds?.dataSourceId,
        exists: !!ds,
        type: ds?.type,
        status: (ds as any)?.getStatus?.(),
        recordCount: ds?.getRecords?.()?.length || 0,
      });
    });
  }

  if (widgetInfo?.outputDataSources) {
    widgetInfo.outputDataSources.forEach((outputDsId: string, i: number) => {
      const ds = dsManager.getDataSource(outputDsId);
      console.log(`outputDataSource[${i}]:`, {
        id: outputDsId,
        exists: !!ds,
        type: ds?.type,
        status: (ds as any)?.getStatus?.(),
        sourceRecords: (ds as any)?.getSourceRecords?.()?.length || 0,
        records: ds?.getRecords?.()?.length || 0,
      });

      // Afficher un sample des données si disponible
      const records =
        (ds as any)?.getSourceRecords?.() || ds?.getRecords?.() || [];
      if (records.length > 0) {
        console.log("Sample data (first record):", records[0]?.getData?.());
      }
    });
  }

  // 4. Élément DOM
  const element = getChartElement(chartWidgetId);
  console.log("Élément DOM trouvé:", !!element, element?.tagName);

  // 5. WidgetState (si disponible)
  const state = getAppStore().getState();
  const widgetState = state.widgetsState?.[chartWidgetId];
  console.log("Widget State:", widgetState);

  console.groupEnd();
}

/**
 * Données extraites du Chart
 */
export interface ChartDataRecord {
  category: string | number;
  value: number;
  label?: string;
  color?: string;
}

/**
 * Résultat de l'extraction des données du Chart
 */
export interface ChartDataExtractionResult {
  success: boolean;
  data?: ChartDataRecord[];
  chartTitle?: string;
  chartType?: string;
  categoryField?: string;
  valueField?: string;
  totalRecords?: number;
  error?: string;
}

/**
 * Extrait les données complètes du widget Chart (pas juste ce qui est visible)
 * Utilise l'outputDataSource du Chart qui contient les données agrégées
 * @param chartWidgetId - ID du widget Chart
 * @returns Promise<ChartDataExtractionResult>
 */
export async function extractChartData(
  chartWidgetId: string,
): Promise<ChartDataExtractionResult> {
  try {
    const widgetInfo = getChartWidgetInfo(chartWidgetId);

    if (!widgetInfo) {
      return {
        success: false,
        error: `Widget Chart non trouvé: ${chartWidgetId}`,
      };
    }

    const config = widgetInfo.config;
    const useDataSources = widgetInfo.useDataSources;
    const outputDataSources = widgetInfo.outputDataSources;

    log("Widget Info:", {
      id: chartWidgetId,
      useDataSources: useDataSources?.map((ds: any) => ds?.dataSourceId),
      outputDataSources: outputDataSources,
      config: config?.webChart ? "webChart présent" : "pas de webChart",
    });

    // Extraire la configuration du chart
    const chartConfig = config?.webChart || config;
    const series = chartConfig?.series?.[0];
    const categoryField =
      series?.x || series?.categoryField || chartConfig?.categoryField;
    const valueField =
      series?.y ||
      series?.numericField ||
      series?.valueField ||
      chartConfig?.valueField;
    const chartTitle = chartConfig?.title || widgetInfo.label || "";
    const chartType = chartConfig?.type || series?.type || "unknown";

    log("Configuration Chart:", {
      categoryField,
      valueField,
      chartTitle,
      chartType,
      series,
    });

    const dsManager = DataSourceManager.getInstance();
    let allRecords: DataRecord[] = [];
    let dataSource: DataSource | null = null;

    // STRATÉGIE 1: Utiliser l'outputDataSource du Chart (contient les données agrégées)
    if (outputDataSources && outputDataSources.length > 0) {
      const outputDsId = outputDataSources[0];
      log(`Tentative avec outputDataSource: ${outputDsId}`);

      const outputDs = dsManager.getDataSource(outputDsId);
      if (outputDs) {
        dataSource = outputDs;
        // L'outputDataSource contient les records via getSourceRecords()
        try {
          const sourceRecords = (outputDs as any).getSourceRecords?.() || [];
          if (sourceRecords.length > 0) {
            allRecords = sourceRecords;
            log(
              `Records via outputDataSource.getSourceRecords: ${allRecords.length}`,
            );
          }
        } catch (e) {
          log("getSourceRecords a échoué sur outputDataSource");
        }

        // Fallback: essayer getRecords
        if (allRecords.length === 0) {
          try {
            allRecords = outputDs.getRecords?.() || [];
            log(
              `Records via outputDataSource.getRecords: ${allRecords.length}`,
            );
          } catch (e) {
            log("getRecords a échoué sur outputDataSource");
          }
        }
      } else {
        log(`outputDataSource non trouvée: ${outputDsId}`);
      }
    }

    // STRATÉGIE 2: Fallback sur useDataSources (source de données brute)
    if (
      allRecords.length === 0 &&
      useDataSources &&
      useDataSources.length > 0
    ) {
      const dataSourceId = useDataSources[0]?.dataSourceId;
      log(`Fallback sur useDataSource: ${dataSourceId}`);

      const ds = dsManager.getDataSource(
        dataSourceId,
      ) as FeatureLayerDataSource;

      if (ds) {
        dataSource = ds;
        try {
          // Query pour récupérer tous les enregistrements
          const queryResult = await ds.query({
            where: "1=1",
            returnGeometry: false,
            outFields: ["*"],
            pageSize: 10000,
          });

          allRecords = queryResult?.records || [];
          log(`Records via query useDataSource: ${allRecords.length}`);
        } catch (queryError) {
          log("Query a échoué, utilisation de getRecords...");

          try {
            allRecords = ds.getRecords() || [];
            log(`Records via getRecords: ${allRecords.length}`);
          } catch (e) {
            const sourceRecords = (ds as any).getSourceRecords?.() || [];
            allRecords = sourceRecords;
            log(`Records via getSourceRecords: ${allRecords.length}`);
          }
        }
      }
    }

    // STRATÉGIE 3: Extraire les données depuis la configuration de la série
    if (allRecords.length === 0 && series?.dataLabels?.content) {
      log("Tentative d'extraction depuis series.dataLabels");
      // Certains charts stockent les données directement dans la configuration
    }

    if (!allRecords || allRecords.length === 0) {
      // Log les infos disponibles pour débug
      const allDataSources = dsManager.getAllDataSources();
      log("Toutes les DataSources disponibles:", Object.keys(allDataSources));

      return {
        success: false,
        error: `Aucun enregistrement trouvé. OutputDS: ${outputDataSources?.[0] || "none"}, UseDS: ${useDataSources?.[0]?.dataSourceId || "none"}`,
      };
    }

    // Transformer les enregistrements en données de chart
    const chartData: ChartDataRecord[] = [];
    const aggregatedData = new Map<string | number, number>();

    // Détecter automatiquement les champs si non spécifiés
    let actualCategoryField = categoryField;
    let actualValueField = valueField;

    if (allRecords.length > 0) {
      const sampleData = allRecords[0].getData();
      const sampleFields = Object.keys(sampleData);
      log("Champs disponibles dans les records:", sampleFields);

      // Si les champs ne sont pas trouvés, essayer de les détecter
      if (!actualCategoryField || !sampleFields.includes(actualCategoryField)) {
        // Chercher un champ qui ressemble à une catégorie (année, nom, etc.)
        actualCategoryField =
          sampleFields.find((f) =>
            /year|annee|date|category|categorie|name|nom|label/i.test(f),
          ) || sampleFields[0];
        log(`Champ catégorie auto-détecté: ${actualCategoryField}`);
      }

      if (!actualValueField || !sampleFields.includes(actualValueField)) {
        // Chercher un champ numérique
        actualValueField =
          sampleFields.find((f) => {
            const val = sampleData[f];
            return typeof val === "number" || !isNaN(parseFloat(val));
          }) || sampleFields[1];
        log(`Champ valeur auto-détecté: ${actualValueField}`);
      }
    }

    for (const record of allRecords) {
      const data = record.getData();
      const category = data[actualCategoryField];
      const value = parseFloat(data[actualValueField]) || 0;

      if (category !== undefined && category !== null) {
        // Agréger les valeurs par catégorie
        const existingValue = aggregatedData.get(category) || 0;
        aggregatedData.set(category, existingValue + value);
      }
    }

    // Convertir la Map en tableau
    aggregatedData.forEach((value, category) => {
      chartData.push({
        category,
        value,
        label: String(category),
      });
    });

    // Trier par catégorie (utile pour les années)
    chartData.sort((a, b) => {
      if (typeof a.category === "number" && typeof b.category === "number") {
        return a.category - b.category;
      }
      return String(a.category).localeCompare(String(b.category));
    });

    log(
      `Données du chart extraites: ${chartData.length} catégories`,
      chartData,
    );

    return {
      success: true,
      data: chartData,
      chartTitle,
      chartType,
      categoryField: actualCategoryField,
      valueField: actualValueField,
      totalRecords: allRecords.length,
    };
  } catch (error) {
    logWarn("Erreur lors de l'extraction des données du chart:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erreur inconnue",
    };
  }
}

/**
 * Extrait les données du chart depuis le DOM (fallback quand DataSource ne fonctionne pas)
 * Parse les éléments de la légende, les tooltips, et les labels du graphique
 * @param chartWidgetId - ID du widget Chart
 * @returns ChartDataExtractionResult
 */
export function extractChartDataFromDOM(
  chartWidgetId: string,
): ChartDataExtractionResult {
  try {
    const chartElement = getChartElement(chartWidgetId);
    if (!chartElement) {
      return {
        success: false,
        error: `Élément Chart non trouvé dans le DOM: ${chartWidgetId}`,
      };
    }

    const chartData: ChartDataRecord[] = [];
    const widgetInfo = getChartWidgetInfo(chartWidgetId);
    const chartTitle =
      widgetInfo?.config?.webChart?.title || widgetInfo?.label || "";
    const chartType =
      widgetInfo?.config?.webChart?.series?.[0]?.type || "unknown";

    // Méthode 1: Parser les items de la légende
    const legendItems = chartElement.querySelectorAll(
      '[class*="legend"] [class*="item"], [class*="legend-item"], .esri-legend-layer-cell',
    );
    log(`Éléments de légende trouvés: ${legendItems.length}`);

    legendItems.forEach((item: Element) => {
      // Extraire le texte du label
      const labelEl = item.querySelector(
        '[class*="label"], [class*="text"], span',
      );
      const label =
        labelEl?.textContent?.trim() || item.textContent?.trim() || "";

      // Extraire la couleur (du symbole coloré)
      let color = "#5A9BD5";
      const colorEl = item.querySelector(
        '[class*="symbol"], [class*="swatch"], [class*="color"]',
      ) as HTMLElement;
      if (colorEl) {
        const bg = window.getComputedStyle(colorEl).backgroundColor;
        if (bg && bg !== "rgba(0, 0, 0, 0)") {
          color = bg;
        }
      }

      // Extraire la valeur si disponible
      const valueEl = item.querySelector('[class*="value"]');
      const valueText = valueEl?.textContent?.trim() || "";
      const value = parseFloat(valueText.replace(/[^0-9.-]/g, "")) || 0;

      if (label) {
        chartData.push({
          category: label,
          value: value,
          label: label,
          color: color,
        });
      }
    });

    // Méthode 2: Parser depuis le Shadow DOM de arcgis-charts
    if (chartData.length === 0) {
      const arcgisChart = chartElement.querySelector(
        'arcgis-charts-pie-chart, arcgis-charts-bar-chart, arcgis-charts-line-chart, [class*="arcgis-chart"]',
      );
      if (arcgisChart?.shadowRoot) {
        const shadowLegend = arcgisChart.shadowRoot.querySelectorAll(
          '[class*="legend"] [class*="item"]',
        );
        log(`Éléments de légende dans Shadow DOM: ${shadowLegend.length}`);

        shadowLegend.forEach((item: Element, index: number) => {
          const text = item.textContent?.trim() || "";
          if (text) {
            chartData.push({
              category: text,
              value: 0, // Valeur inconnue
              label: text,
              color: CHART_COLORS[index % CHART_COLORS.length],
            });
          }
        });
      }
    }

    // Méthode 3: Parser depuis les data attributes ou aria-labels
    if (chartData.length === 0) {
      const dataElements = chartElement.querySelectorAll(
        "[data-category], [data-label], [aria-label]",
      );
      dataElements.forEach((el: Element, index: number) => {
        const category =
          el.getAttribute("data-category") ||
          el.getAttribute("data-label") ||
          el.getAttribute("aria-label") ||
          "";
        const value = parseFloat(el.getAttribute("data-value") || "0");

        if (category) {
          chartData.push({
            category,
            value,
            label: category,
            color: CHART_COLORS[index % CHART_COLORS.length],
          });
        }
      });
    }

    // Méthode 4: Extraire depuis la config du widget si disponible
    if (chartData.length === 0 && widgetInfo?.config?.webChart?.series) {
      const series = widgetInfo.config.webChart.series[0];
      if (series?.dataLabels) {
        log(
          "Tentative d'extraction depuis series.dataLabels",
          series.dataLabels,
        );
      }
    }

    if (chartData.length === 0) {
      return {
        success: false,
        error: "Impossible d'extraire les données depuis le DOM",
      };
    }

    log(`Données extraites depuis DOM: ${chartData.length} items`, chartData);

    return {
      success: true,
      data: chartData,
      chartTitle,
      chartType,
      totalRecords: chartData.length,
    };
  } catch (error) {
    logWarn("Erreur lors de l'extraction des données depuis le DOM:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erreur inconnue",
    };
  }
}

/**
 * Fonction combinée qui essaie plusieurs méthodes pour extraire les données
 * @param chartWidgetId - ID du widget Chart
 * @returns Promise<ChartDataExtractionResult>
 */
export async function extractChartDataComplete(
  chartWidgetId: string,
): Promise<ChartDataExtractionResult> {
  log(`=== Extraction complète des données du chart: ${chartWidgetId} ===`);

  // Essai 1: Via DataSourceManager (méthode préférée)
  let result = await extractChartData(chartWidgetId);
  if (result.success && result.data && result.data.length > 0) {
    log("Succès: données extraites via DataSourceManager");
    return result;
  }
  log("DataSourceManager a échoué:", result.error);

  // Essai 2: Via le DOM
  result = extractChartDataFromDOM(chartWidgetId);
  if (result.success && result.data && result.data.length > 0) {
    log("Succès: données extraites via DOM");
    return result;
  }
  log("DOM extraction a échoué:", result.error);

  // Essai 3: Créer des données factices basées sur le type de chart
  const widgetInfo = getChartWidgetInfo(chartWidgetId);
  if (widgetInfo) {
    const chartConfig = widgetInfo.config?.webChart;
    log("Config du chart disponible:", chartConfig);

    // Retourner un message d'erreur plus détaillé
    return {
      success: false,
      error: `Impossible d'extraire les données. OutputDS: ${widgetInfo.outputDataSources?.[0] || "aucun"}, UseDS: ${widgetInfo.useDataSources?.[0]?.dataSourceId || "aucun"}. Vérifiez que le chart est correctement initialisé et que les données sont chargées.`,
    };
  }

  return {
    success: false,
    error: "Widget Chart non trouvé ou non configuré",
  };
}

// Palette de couleurs pour recréer la légende (correspond aux couleurs ArcGIS par défaut)
const CHART_COLORS = [
  "#5A9BD5", // Bleu
  "#70AD47", // Vert
  "#ED7D31", // Orange
  "#FFC000", // Jaune
  "#44546A", // Bleu foncé
  "#9E480E", // Marron
  "#997300", // Or foncé
  "#636363", // Gris
  "#264478", // Bleu marine
  "#43682B", // Vert foncé
  "#FF6B6B", // Rouge clair
  "#4ECDC4", // Turquoise
  "#A855F7", // Violet
  "#EC4899", // Rose
  "#14B8A6", // Teal
  "#F97316", // Orange vif
];

// ============== PDF FORMAT CONFIGURATIONS ==============

/**
 * Configuration des formats de page PDF supportés
 * Dimensions en millimètres (mm)
 */
export const PDF_FORMAT_CONFIG = {
  a4: { width: 210, height: 297, name: "A4" },
  a3: { width: 297, height: 420, name: "A3" },
  a2: { width: 420, height: 594, name: "A2" },
  a1: { width: 594, height: 841, name: "A1" },
  letter: { width: 215.9, height: 279.4, name: "Letter" },
  legal: { width: 215.9, height: 355.6, name: "Legal" },
  tabloid: { width: 279.4, height: 431.8, name: "Tabloid" },
} as const;

export type PdfFormatType = keyof typeof PDF_FORMAT_CONFIG;

/**
 * Permet à l'UI de se mettre à jour (évite le blocage)
 * Utilise requestAnimationFrame + setTimeout pour une meilleure réactivité
 */
function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame !== "undefined") {
      requestAnimationFrame(() => {
        setTimeout(resolve, 0);
      });
    } else {
      setTimeout(resolve, 0);
    }
  });
}

/**
 * Exécute une tâche lourde en morceaux pour éviter le blocage de l'UI
 * @param task - Fonction à exécuter
 * @param chunkSize - Nombre d'itérations avant de céder le contrôle
 */
async function executeInChunks<T>(
  items: T[],
  processor: (item: T, index: number) => void,
  chunkSize: number = 10,
): Promise<void> {
  for (let i = 0; i < items.length; i++) {
    processor(items[i], i);
    if ((i + 1) % chunkSize === 0) {
      await yieldToMain();
    }
  }
}

/**
 * Callback de progression pour l'UI
 */
export interface PdfProgressCallback {
  (stage: string, progress: number, message?: string): void;
}

/**
 * Options pour le PDF professionnel style carte
 */
export interface ProfessionalPdfOptions {
  title?: string;
  subtitle?: string;
  showDate?: boolean;
  showLegend?: boolean;
  legendTitle?: string;
  author?: string;
  organization?: string;
  orientation?: "portrait" | "landscape";
  format?: PdfFormatType; // Formats étendus: a4, a3, a2, a1, letter, legal, tabloid
  legendColumns?: number; // Nombre de colonnes pour la légende
  legendPosition?: "bottom" | "right"; // Position de la légende
  borderColor?: string;
  headerColor?: string;
  footerText?: string;
  /** Callback de progression pour l'UI */
  onProgress?: PdfProgressCallback;
  /** Qualité de l'image (0.1 à 1.0, défaut: 0.92) */
  imageQuality?: number;
  /** Timeout en ms pour les opérations (défaut: 30000) */
  timeout?: number;
  /** Marge du document en mm (défaut: 10) */
  margin?: number;
  /** Désactiver le cache pour forcer une nouvelle capture */
  forceRefresh?: boolean;
}

/**
 * Génère un PDF professionnel du chart, style carte ArcGIS
 * Avec titre, graphique centré, légende complète en bas, date et métadonnées
 *
 * @optimized Version optimisée pour éviter le blocage de l'UI:
 *   - Utilisation de yieldToMain() pour céder le contrôle au navigateur
 *   - Traitement de la légende par morceaux (chunks)
 *   - Callback de progression pour l'UI
 *   - Timeout configurable
 *   - Support des formats PDF étendus
 *
 * @param chartWidgetId - ID du widget Chart
 * @param options - Options de mise en page
 * @returns Promise<Blob | null>
 */
export async function generateProfessionalChartPdf(
  chartWidgetId: string,
  options: ProfessionalPdfOptions = {},
): Promise<Blob | null> {
  // AbortController pour annulation potentielle
  const abortController = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    const {
      title,
      subtitle,
      showDate = true,
      showLegend = true,
      legendTitle = "Légende",
      author = "",
      organization = "",
      orientation = "landscape",
      format = "a4",
      legendColumns = 4,
      legendPosition = "bottom",
      borderColor = "#333333",
      headerColor = "#1a1a2e",
      footerText = "",
      onProgress,
      imageQuality = 0.92,
      timeout = 30000,
      margin = 10,
      forceRefresh = false,
    } = options;

    // Configurer le timeout global
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        abortController.abort();
        reject(new Error(`Timeout: génération PDF dépassé ${timeout}ms`));
      }, timeout);
    });

    // Fonction helper pour notifier la progression
    const notifyProgress = async (
      stage: string,
      progress: number,
      message?: string,
    ) => {
      if (onProgress) {
        onProgress(stage, progress, message);
      }
      // Céder le contrôle au navigateur pour permettre la mise à jour de l'UI
      await yieldToMain();
    };

    // Valider et normaliser le format du PDF
    const pdfFormat = PDF_FORMAT_CONFIG[format] ? format : "a4";
    log(`Format PDF sélectionné: ${pdfFormat}`);

    // === ÉTAPE 1: Notification de démarrage ===
    await notifyProgress("init", 0, "Initialisation de la génération PDF...");

    // === ÉTAPE 2: Capturer l'image du chart (opération la plus lourde) ===
    await notifyProgress("capture", 10, "Capture du diagramme en cours...");

    const capturePromise = captureChartAsImage(
      chartWidgetId,
      {
        chartWidgetId: chartWidgetId,
        includeChartInPrint: true,
        chartPosition: ChartPosition.BOTTOM,
        chartSize: { width: 1200, height: 800 },
        chartBackground: "#ffffff",
        preserveChartRatio: true,
        scaleToFit: true,
      },
      forceRefresh,
    );

    // Race entre la capture et le timeout
    const captureResult = await Promise.race([capturePromise, timeoutPromise]);

    await notifyProgress("capture", 30, "Capture terminée");

    // === ÉTAPE 3: Extraire les données pour la légende (parallélisé) ===
    await notifyProgress("data", 35, "Extraction des données...");

    const [dataResult, widgetInfo] = await Promise.all([
      extractChartDataComplete(chartWidgetId),
      Promise.resolve(getChartWidgetInfo(chartWidgetId)),
    ]);

    const chartTitle =
      title || dataResult.chartTitle || widgetInfo?.label || "Diagramme";

    await notifyProgress("pdf", 45, "Création du document PDF...");

    // === ÉTAPE 4: Créer le PDF avec format validé ===
    const pdf = new jsPDF({
      orientation: orientation,
      unit: "mm",
      format: pdfFormat,
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const contentWidth = pageWidth - margin * 2;

    // === BORDURE DU DOCUMENT ===
    pdf.setDrawColor(borderColor);
    pdf.setLineWidth(0.5);
    pdf.rect(
      margin - 2,
      margin - 2,
      pageWidth - margin * 2 + 4,
      pageHeight - margin * 2 + 4,
    );

    let currentY = margin;

    // === TITRE ===
    const titleRgb = hexToRgb(headerColor);
    pdf.setTextColor(titleRgb.r, titleRgb.g, titleRgb.b);
    pdf.setFontSize(18);
    pdf.setFont("helvetica", "bold");
    pdf.text(chartTitle, pageWidth / 2, currentY + 8, { align: "center" });
    currentY += 12;

    // Sous-titre si présent
    if (subtitle) {
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "normal");
      pdf.text(subtitle, pageWidth / 2, currentY + 4, { align: "center" });
      currentY += 8;
    }

    // Ligne de séparation sous le titre
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.3);
    pdf.line(margin, currentY + 2, pageWidth - margin, currentY + 2);
    currentY += 6;

    // === ZONE DU GRAPHIQUE ===
    // Calculer l'espace disponible pour le graphique
    const legendHeight = showLegend && dataResult.success ? 35 : 0;
    const footerHeight = 15;
    const availableHeight =
      pageHeight - currentY - legendHeight - footerHeight - margin;

    await notifyProgress("image", 50, "Traitement de l'image...");

    // Récupérer l'URL de données de l'image capturée
    const imageData = captureResult.dataUrl;

    if (captureResult.success && imageData) {
      // Calculer les dimensions pour centrer l'image de manière non-bloquante
      const img = new Image();

      // Chargement non-bloquant de l'image avec timeout réduit
      const imageLoadPromise = new Promise<{ width: number; height: number }>(
        (resolve) => {
          const loadTimeout = setTimeout(() => {
            // Utiliser des dimensions par défaut en cas de timeout
            resolve({
              width: captureResult.width || 800,
              height: captureResult.height || 600,
            });
          }, 500); // Timeout court car l'image est déjà en base64

          img.onload = () => {
            clearTimeout(loadTimeout);
            resolve({ width: img.width || 800, height: img.height || 600 });
          };

          img.onerror = () => {
            clearTimeout(loadTimeout);
            resolve({
              width: captureResult.width || 800,
              height: captureResult.height || 600,
            });
          };

          img.src = imageData;
        },
      );

      // Céder le contrôle pendant le chargement
      await yieldToMain();
      const imgDimensions = await imageLoadPromise;

      const imgAspectRatio = imgDimensions.width / imgDimensions.height || 1.5;
      let imgWidth = contentWidth * 0.9;
      let imgHeight = imgWidth / imgAspectRatio;

      // Ajuster si l'image est trop haute
      if (imgHeight > availableHeight) {
        imgHeight = availableHeight;
        imgWidth = imgHeight * imgAspectRatio;
      }

      // Centrer l'image
      const imgX = (pageWidth - imgWidth) / 2;
      const imgY = currentY + (availableHeight - imgHeight) / 2;

      await notifyProgress("image", 60, "Ajout de l'image au PDF...");

      // Ajouter l'image (sans bordure)
      pdf.addImage(imageData, "PNG", imgX, imgY, imgWidth, imgHeight);

      currentY += availableHeight;
    } else {
      // Si pas d'image, afficher un message
      pdf.setFontSize(12);
      pdf.setTextColor(150, 150, 150);
      pdf.text(
        "Graphique non disponible",
        pageWidth / 2,
        currentY + availableHeight / 2,
        { align: "center" },
      );
      currentY += availableHeight;
    }

    await yieldToMain(); // Céder le contrôle avant le traitement de la légende

    // === LÉGENDE (traitement par morceaux pour éviter le blocage) ===
    if (
      showLegend &&
      dataResult.success &&
      dataResult.data &&
      dataResult.data.length > 0
    ) {
      await notifyProgress("legend", 70, "Génération de la légende...");

      currentY += 5;

      // Ligne de séparation avant la légende
      pdf.setDrawColor(200, 200, 200);
      pdf.setLineWidth(0.3);
      pdf.line(margin, currentY, pageWidth - margin, currentY);
      currentY += 4;

      // Dessiner les items de la légende en colonnes
      const legendData = dataResult.data;
      const itemsPerColumn = Math.ceil(legendData.length / legendColumns);
      const columnWidth = contentWidth / legendColumns;
      const symbolSize = 3;
      const rowHeight = 5;

      pdf.setFontSize(7);
      pdf.setFont("helvetica", "normal");

      // Traitement de la légende par morceaux (chunks) pour éviter le blocage
      const LEGEND_CHUNK_SIZE = 15; // Traiter 15 items avant de céder le contrôle

      for (let i = 0; i < legendData.length; i++) {
        const item = legendData[i];
        const columnIndex = Math.floor(i / itemsPerColumn);
        const rowIndex = i % itemsPerColumn;

        const itemX = margin + columnIndex * columnWidth;
        const itemY = currentY + rowIndex * rowHeight;

        // Couleur du symbole
        const color = item.color || CHART_COLORS[i % CHART_COLORS.length];
        const rgb = hexToRgb(color);
        pdf.setFillColor(rgb.r, rgb.g, rgb.b);

        // Dessiner le symbole (carré)
        pdf.rect(itemX, itemY, symbolSize, symbolSize, "F");

        // Bordure du symbole
        pdf.setDrawColor(100, 100, 100);
        pdf.setLineWidth(0.1);
        pdf.rect(itemX, itemY, symbolSize, symbolSize, "S");

        // Texte du label
        pdf.setTextColor(40, 40, 40);
        const labelText = `${item.label}${item.value ? ` (${item.value.toLocaleString()})` : ""}`;
        const maxTextWidth = columnWidth - symbolSize - 4;
        const truncatedText =
          pdf.getTextWidth(labelText) > maxTextWidth
            ? labelText.substring(
                0,
                Math.floor(
                  (labelText.length * maxTextWidth) /
                    pdf.getTextWidth(labelText),
                ),
              ) + "..."
            : labelText;
        pdf.text(
          truncatedText,
          itemX + symbolSize + 2,
          itemY + symbolSize - 0.5,
        );

        // Céder le contrôle au navigateur tous les LEGEND_CHUNK_SIZE items
        if ((i + 1) % LEGEND_CHUNK_SIZE === 0 && i < legendData.length - 1) {
          await yieldToMain();
        }
      }

      const legendRowsCount = Math.min(itemsPerColumn, legendData.length);
      currentY += legendRowsCount * rowHeight + 3;
    }

    await notifyProgress("footer", 85, "Finalisation du document...");

    // === PIED DE PAGE ===
    const footerY = pageHeight - margin - 3;

    // Ligne de séparation
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.3);
    pdf.line(margin, footerY - 5, pageWidth - margin, footerY - 5);

    pdf.setFontSize(7);
    pdf.setTextColor(100, 100, 100);
    pdf.setFont("helvetica", "normal");

    // Date à gauche
    if (showDate) {
      const now = new Date();
      const dateStr =
        now.toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }) +
        " " +
        now.toLocaleTimeString("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
        });
      pdf.text(dateStr, margin, footerY);
    }

    // Auteur/Organisation au centre
    if (author || organization) {
      const authorText = [author, organization].filter(Boolean).join(" - ");
      pdf.text(authorText, pageWidth / 2, footerY, { align: "center" });
    }

    // Texte personnalisé ou copyright à droite
    const rightText = footerText || "Généré par ArcGIS Experience Builder";
    pdf.text(rightText, pageWidth - margin, footerY, { align: "right" });

    // Nettoyer le timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    await notifyProgress("complete", 100, "PDF généré avec succès!");

    // Générer le blob
    return pdf.output("blob");
  } catch (error) {
    // Nettoyer le timeout en cas d'erreur
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    const errorMessage =
      error instanceof Error ? error.message : "Erreur inconnue";
    logWarn("Erreur lors de la génération du PDF professionnel:", errorMessage);

    // Notifier l'erreur si callback disponible
    if (options.onProgress) {
      options.onProgress("error", -1, errorMessage);
    }

    return null;
  }
}

/**
 * Génère et télécharge un PDF professionnel du chart
 * @param chartWidgetId - ID du widget Chart
 * @param options - Options de mise en page
 * @param filename - Nom du fichier
 */
export async function generateAndDownloadProfessionalChartPdf(
  chartWidgetId: string,
  options: ProfessionalPdfOptions = {},
  filename: string = "chart-export",
): Promise<boolean> {
  try {
    // Notifier le début du téléchargement
    if (options.onProgress) {
      options.onProgress("download", 0, "Préparation du téléchargement...");
    }

    const blob = await generateProfessionalChartPdf(chartWidgetId, options);

    if (blob) {
      // Céder le contrôle avant le téléchargement
      await yieldToMain();

      downloadPdf(blob, filename);

      if (options.onProgress) {
        options.onProgress("download", 100, "Téléchargement terminé!");
      }
      return true;
    }

    if (options.onProgress) {
      options.onProgress("error", -1, "Échec de la génération du PDF");
    }
    return false;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Erreur inconnue";
    logWarn("Erreur lors du téléchargement:", errorMessage);

    if (options.onProgress) {
      options.onProgress("error", -1, errorMessage);
    }
    return false;
  }
}

/**
 * Convertit une couleur hex en RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}

/**
 * Génère un PDF avec le diagramme ET une légende complète recréée
 * Cette fonction résout le problème de la légende tronquée à l'écran
 * @param chartWidgetId - ID du widget Chart
 * @param options - Options d'impression
 * @returns Promise<Blob | null>
 */
export async function generateChartPdfWithFullLegend(
  chartWidgetId: string,
  options: ChartPrintOptions,
): Promise<Blob | null> {
  try {
    // Extraire les données complètes du chart (essaie plusieurs méthodes)
    const dataResult = await extractChartDataComplete(chartWidgetId);

    if (
      !dataResult.success ||
      !dataResult.data ||
      dataResult.data.length === 0
    ) {
      logWarn(
        "Impossible d'extraire les données pour la légende:",
        dataResult.error,
      );
      // Fallback sur la capture simple
      return generateChartPdf(chartWidgetId, options);
    }

    // Essayer de capturer uniquement le graphique (sans la légende tronquée)
    // Si ça échoue, utiliser la capture standard
    let captureResult = await captureChartGraphicOnly(chartWidgetId, options);
    if (!captureResult.success) {
      captureResult = await captureChartAsImage(chartWidgetId, options);
    }

    const pdf = new jsPDF({
      orientation: "landscape", // Paysage pour avoir de la place pour la légende
      unit: "mm",
      format: "a4",
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    let currentY = margin;

    // Titre principal
    const title = options.chartTitle || dataResult.chartTitle || "Diagramme";
    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(0, 0, 0);
    pdf.text(title, pageWidth / 2, currentY, { align: "center" });
    currentY += 10;

    // Zone pour le graphique (côté gauche)
    const chartAreaWidth = pageWidth * 0.55;
    const legendAreaX = margin + chartAreaWidth + 5;
    const legendAreaWidth = pageWidth - legendAreaX - margin;

    // Image du chart
    if (captureResult.success && captureResult.dataUrl) {
      const imgWidth = captureResult.width || 400;
      const imgHeight = captureResult.height || 300;
      const maxImgWidth = chartAreaWidth - 10;
      const maxImgHeight = pageHeight - currentY - 30;

      const ratio = Math.min(maxImgWidth / imgWidth, maxImgHeight / imgHeight);
      const scaledWidth = imgWidth * ratio;
      const scaledHeight = imgHeight * ratio;

      const chartX = margin + (chartAreaWidth - scaledWidth) / 2;

      pdf.addImage(
        captureResult.dataUrl,
        "PNG",
        chartX,
        currentY,
        scaledWidth,
        scaledHeight,
        undefined,
        "FAST",
      );
    }

    // === LÉGENDE COMPLÈTE (côté droit) ===
    const legendStartY = currentY + 5;
    let legendY = legendStartY;
    const legendItemHeight = 8;
    const colorBoxSize = 5;

    // Titre de la légende
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(0, 0, 0);
    pdf.text("Légende", legendAreaX, legendY);
    legendY += 8;

    // Calculer le total pour les pourcentages
    const total = dataResult.data.reduce((sum, row) => sum + row.value, 0);

    // Dessiner chaque élément de la légende
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");

    for (let i = 0; i < dataResult.data.length; i++) {
      const item = dataResult.data[i];
      const color = CHART_COLORS[i % CHART_COLORS.length];
      const rgb = hexToRgb(color);

      // Vérifier si on dépasse la page
      if (legendY > pageHeight - 20) {
        // Créer une nouvelle colonne ou une nouvelle page
        pdf.addPage();
        legendY = margin + 10;
      }

      // Carré de couleur
      pdf.setFillColor(rgb.r, rgb.g, rgb.b);
      pdf.rect(legendAreaX, legendY - 3.5, colorBoxSize, colorBoxSize, "F");

      // Texte avec catégorie et valeur
      pdf.setTextColor(0, 0, 0);
      const percentage =
        total > 0 ? ((item.value / total) * 100).toFixed(1) : "0";
      const legendText = `${item.category} (${formatNumber(item.value)} - ${percentage}%)`;

      // Tronquer si trop long
      const maxTextWidth = legendAreaWidth - colorBoxSize - 5;
      let displayText = legendText;
      while (
        pdf.getTextWidth(displayText) > maxTextWidth &&
        displayText.length > 10
      ) {
        displayText = displayText.substring(0, displayText.length - 4) + "...";
      }

      pdf.text(displayText, legendAreaX + colorBoxSize + 3, legendY);

      legendY += legendItemHeight;
    }

    // Ligne de total
    legendY += 3;
    pdf.setDrawColor(100, 100, 100);
    pdf.line(legendAreaX, legendY, legendAreaX + legendAreaWidth, legendY);
    legendY += 5;

    pdf.setFont("helvetica", "bold");
    pdf.text(`Total: ${formatNumber(total)}`, legendAreaX, legendY);

    // Pied de page
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(128, 128, 128);
    pdf.text(
      `Généré le: ${new Date().toLocaleString()} | ${dataResult.data.length} catégories`,
      pageWidth / 2,
      pageHeight - 5,
      { align: "center" },
    );

    return pdf.output("blob");
  } catch (error) {
    logWarn("Erreur lors de la génération du PDF avec légende:", error);
    return null;
  }
}

/**
 * Génère et télécharge un PDF avec légende complète
 */
export async function generateAndDownloadChartPdfWithFullLegend(
  chartWidgetId: string,
  options: ChartPrintOptions,
  filename?: string,
): Promise<boolean> {
  try {
    const pdfBlob = await generateChartPdfWithFullLegend(
      chartWidgetId,
      options,
    );

    if (!pdfBlob) {
      return false;
    }

    const chartInfo = getChartWidgetInfo(chartWidgetId);
    const defaultFilename =
      chartInfo?.label || options.chartTitle || "chart-legende-complete";

    downloadPdf(pdfBlob, filename || defaultFilename);
    return true;
  } catch (error) {
    logWarn("Erreur lors du téléchargement du PDF avec légende:", error);
    return false;
  }
}

/**
 * Génère un PDF complet avec l'image du chart ET les données tabulaires
 * @param chartWidgetId - ID du widget Chart
 * @param options - Options d'impression
 * @param includeDataTable - Inclure le tableau de données
 * @returns Promise<Blob | null>
 */
export async function generateCompleteChartPdf(
  chartWidgetId: string,
  options: ChartPrintOptions,
  includeDataTable: boolean = true,
): Promise<Blob | null> {
  try {
    // Capturer l'image du chart
    const captureResult = await captureChartAsImage(chartWidgetId, options);

    // Extraire les données complètes (essaie plusieurs méthodes)
    const dataResult = await extractChartDataComplete(chartWidgetId);

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    let currentY = margin;

    // === PAGE 1: Image du Chart ===

    // Titre principal
    const title = options.chartTitle || dataResult.chartTitle || "Diagramme";
    pdf.setFontSize(18);
    pdf.setFont("helvetica", "bold");
    pdf.text(title, pageWidth / 2, currentY, { align: "center" });
    currentY += 12;

    // Sous-titre avec informations
    if (dataResult.success && dataResult.totalRecords) {
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(100, 100, 100);
      pdf.text(
        `Total: ${dataResult.totalRecords} enregistrements | ${dataResult.data?.length || 0} catégories`,
        pageWidth / 2,
        currentY,
        { align: "center" },
      );
      currentY += 10;
    }

    // Image du chart
    if (captureResult.success && captureResult.dataUrl) {
      const imgWidth = captureResult.width || 400;
      const imgHeight = captureResult.height || 300;
      const maxImgWidth = pageWidth - 2 * margin;
      const maxImgHeight = 120; // Limiter la hauteur pour laisser de la place aux données

      const ratio = Math.min(maxImgWidth / imgWidth, maxImgHeight / imgHeight);
      const scaledWidth = imgWidth * ratio;
      const scaledHeight = imgHeight * ratio;
      const x = (pageWidth - scaledWidth) / 2;

      pdf.addImage(
        captureResult.dataUrl,
        "PNG",
        x,
        currentY,
        scaledWidth,
        scaledHeight,
        undefined,
        "FAST",
      );
      currentY += scaledHeight + 10;
    }

    // === TABLEAU DE DONNÉES ===
    if (
      includeDataTable &&
      dataResult.success &&
      dataResult.data &&
      dataResult.data.length > 0
    ) {
      // Ligne de séparation
      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, currentY, pageWidth - margin, currentY);
      currentY += 8;

      // Titre du tableau
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(0, 0, 0);
      pdf.text("Données complètes", margin, currentY);
      currentY += 8;

      // En-têtes du tableau
      const colWidth1 = (pageWidth - 2 * margin) * 0.6;
      const colWidth2 = (pageWidth - 2 * margin) * 0.4;

      pdf.setFillColor(240, 240, 240);
      pdf.rect(margin, currentY - 4, pageWidth - 2 * margin, 8, "F");

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      pdf.text(dataResult.categoryField || "Catégorie", margin + 2, currentY);
      pdf.text(
        dataResult.valueField || "Valeur",
        margin + colWidth1 + 2,
        currentY,
      );
      currentY += 8;

      // Lignes de données
      pdf.setFont("helvetica", "normal");
      let rowIndex = 0;

      for (const row of dataResult.data) {
        // Nouvelle page si nécessaire
        if (currentY > pageHeight - 20) {
          pdf.addPage();
          currentY = margin;

          // Répéter les en-têtes sur la nouvelle page
          pdf.setFillColor(240, 240, 240);
          pdf.rect(margin, currentY - 4, pageWidth - 2 * margin, 8, "F");
          pdf.setFont("helvetica", "bold");
          pdf.text(
            dataResult.categoryField || "Catégorie",
            margin + 2,
            currentY,
          );
          pdf.text(
            dataResult.valueField || "Valeur",
            margin + colWidth1 + 2,
            currentY,
          );
          currentY += 8;
          pdf.setFont("helvetica", "normal");
        }

        // Alternance de couleur de fond
        if (rowIndex % 2 === 1) {
          pdf.setFillColor(250, 250, 250);
          pdf.rect(margin, currentY - 4, pageWidth - 2 * margin, 6, "F");
        }

        // Données
        pdf.setTextColor(0, 0, 0);
        pdf.text(String(row.category), margin + 2, currentY);
        pdf.text(formatNumber(row.value), margin + colWidth1 + 2, currentY);

        currentY += 6;
        rowIndex++;
      }

      // Total
      currentY += 4;
      pdf.setDrawColor(100, 100, 100);
      pdf.line(margin, currentY - 2, pageWidth - margin, currentY - 2);

      const total = dataResult.data.reduce((sum, row) => sum + row.value, 0);
      pdf.setFont("helvetica", "bold");
      pdf.text("TOTAL", margin + 2, currentY + 4);
      pdf.text(formatNumber(total), margin + colWidth1 + 2, currentY + 4);
    }

    // Pied de page sur toutes les pages
    const totalPages = pdf.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(128, 128, 128);
      pdf.text(
        `Généré le: ${new Date().toLocaleString()} | Page ${i}/${totalPages}`,
        pageWidth / 2,
        pageHeight - 5,
        { align: "center" },
      );
    }

    return pdf.output("blob");
  } catch (error) {
    logWarn("Erreur lors de la génération du PDF complet:", error);
    return null;
  }
}

/**
 * Formate un nombre pour l'affichage
 */
function formatNumber(value: number): string {
  if (Number.isInteger(value)) {
    return value.toLocaleString();
  }
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Capture uniquement le graphique (sans la légende) si possible
 * Utile pour les pie charts où la légende est séparée
 * @param chartWidgetId - ID du widget Chart
 * @param options - Options de capture
 * @returns Promise<ChartCaptureResult>
 */
export async function captureChartGraphicOnly(
  chartWidgetId: string,
  options?: Partial<ChartPrintOptions>,
): Promise<ChartCaptureResult> {
  try {
    const chartElement = getChartElement(chartWidgetId);
    if (!chartElement) {
      return {
        success: false,
        error: `Élément DOM du Chart non trouvé: ${chartWidgetId}`,
      };
    }

    // Chercher le conteneur du graphique (sans la légende)
    // ArcGIS Chart utilise différentes structures
    const selectors = [
      ".arcgis-charts-chartview",
      ".chart-view",
      ".chart-graphic",
      'svg[class*="chart"]',
      ".jimu-chart canvas",
      "canvas",
    ];

    let graphicElement: HTMLElement | null = null;

    for (const selector of selectors) {
      const element = chartElement.querySelector(selector) as HTMLElement;
      if (element) {
        const rect = element.getBoundingClientRect();
        // Vérifier que l'élément a une taille raisonnable
        if (rect.width > 100 && rect.height > 100) {
          graphicElement = element;
          log("Élément graphique trouvé:", selector);
          break;
        }
      }
    }

    // Si on ne trouve pas d'élément spécifique, utiliser la capture standard
    if (!graphicElement) {
      log("Élément graphique non trouvé, utilisation de la capture standard");
      return captureChartAsImage(chartWidgetId, options);
    }

    // Capturer l'élément graphique
    const containerRect = graphicElement.getBoundingClientRect();
    const actualWidth = Math.round(containerRect.width) || 400;
    const actualHeight = Math.round(containerRect.height) || 300;

    try {
      const canvas = await html2canvas(graphicElement, {
        backgroundColor: options?.chartBackground || "#FFFFFF",
        scale: 1.5,
        useCORS: true,
        allowTaint: true,
        logging: DEBUG_MODE,
        width: actualWidth,
        height: actualHeight,
        windowWidth: actualWidth,
        windowHeight: actualHeight,
        imageTimeout: 5000,
        removeContainer: true,
        foreignObjectRendering: false,
      });

      return {
        success: true,
        dataUrl: canvas.toDataURL("image/png", 0.92),
        width: canvas.width,
        height: canvas.height,
      };
    } catch (error) {
      log("Capture du graphique seul a échoué, fallback sur capture standard");
      return captureChartAsImage(chartWidgetId, options);
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erreur de capture",
    };
  }
}

/**
 * Génère un PDF avec uniquement les données tabulaires (sans image)
 * Utile pour exporter toutes les données même si elles ne sont pas visibles
 * @param chartWidgetId - ID du widget Chart
 * @param title - Titre du document
 * @returns Promise<Blob | null>
 */
export async function generateChartDataPdf(
  chartWidgetId: string,
  title?: string,
): Promise<Blob | null> {
  try {
    const dataResult = await extractChartDataComplete(chartWidgetId);

    if (!dataResult.success || !dataResult.data) {
      logWarn("Échec de l'extraction des données:", dataResult.error);
      return null;
    }

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    let currentY = margin;

    // Titre
    const docTitle = title || dataResult.chartTitle || "Données du diagramme";
    pdf.setFontSize(18);
    pdf.setFont("helvetica", "bold");
    pdf.text(docTitle, pageWidth / 2, currentY, { align: "center" });
    currentY += 10;

    // Informations
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(100, 100, 100);
    pdf.text(
      `${dataResult.totalRecords} enregistrements | ${dataResult.data.length} catégories | Type: ${dataResult.chartType}`,
      pageWidth / 2,
      currentY,
      { align: "center" },
    );
    currentY += 15;

    // Tableau
    const colWidth1 = (pageWidth - 2 * margin) * 0.5;
    const colWidth2 = (pageWidth - 2 * margin) * 0.3;
    const colWidth3 = (pageWidth - 2 * margin) * 0.2;

    // En-têtes
    pdf.setFillColor(52, 73, 94); // Bleu foncé
    pdf.rect(margin, currentY - 5, pageWidth - 2 * margin, 10, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text(dataResult.categoryField || "Catégorie", margin + 3, currentY);
    pdf.text(
      dataResult.valueField || "Valeur",
      margin + colWidth1 + 3,
      currentY,
    );
    pdf.text("%", margin + colWidth1 + colWidth2 + 3, currentY);
    currentY += 10;

    // Calculer le total pour les pourcentages
    const total = dataResult.data.reduce((sum, row) => sum + row.value, 0);

    // Données
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);

    for (let i = 0; i < dataResult.data.length; i++) {
      const row = dataResult.data[i];

      // Nouvelle page si nécessaire
      if (currentY > pageHeight - 25) {
        pdf.addPage();
        currentY = margin;

        // En-têtes sur nouvelle page
        pdf.setFillColor(52, 73, 94);
        pdf.rect(margin, currentY - 5, pageWidth - 2 * margin, 10, "F");
        pdf.setTextColor(255, 255, 255);
        pdf.setFont("helvetica", "bold");
        pdf.text(dataResult.categoryField || "Catégorie", margin + 3, currentY);
        pdf.text(
          dataResult.valueField || "Valeur",
          margin + colWidth1 + 3,
          currentY,
        );
        pdf.text("%", margin + colWidth1 + colWidth2 + 3, currentY);
        currentY += 10;
        pdf.setFont("helvetica", "normal");
      }

      // Alternance de couleur
      if (i % 2 === 0) {
        pdf.setFillColor(245, 245, 245);
        pdf.rect(margin, currentY - 4, pageWidth - 2 * margin, 7, "F");
      }

      pdf.setTextColor(0, 0, 0);
      pdf.text(String(row.category), margin + 3, currentY);
      pdf.text(formatNumber(row.value), margin + colWidth1 + 3, currentY);

      const percentage =
        total > 0 ? ((row.value / total) * 100).toFixed(1) : "0";
      pdf.text(`${percentage}%`, margin + colWidth1 + colWidth2 + 3, currentY);

      currentY += 7;
    }

    // Ligne de total
    currentY += 3;
    pdf.setFillColor(52, 73, 94);
    pdf.rect(margin, currentY - 4, pageWidth - 2 * margin, 8, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.text("TOTAL", margin + 3, currentY);
    pdf.text(formatNumber(total), margin + colWidth1 + 3, currentY);
    pdf.text("100%", margin + colWidth1 + colWidth2 + 3, currentY);

    // Pied de page
    const totalPages = pdf.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(128, 128, 128);
      pdf.text(
        `Généré le: ${new Date().toLocaleString()} | Page ${i}/${totalPages}`,
        pageWidth / 2,
        pageHeight - 5,
        { align: "center" },
      );
    }

    return pdf.output("blob");
  } catch (error) {
    logWarn("Erreur lors de la génération du PDF de données:", error);
    return null;
  }
}

/**
 * Génère et télécharge un PDF complet avec image et données
 */
export async function generateAndDownloadCompleteChartPdf(
  chartWidgetId: string,
  options: ChartPrintOptions,
  filename?: string,
  includeDataTable: boolean = true,
): Promise<boolean> {
  try {
    const pdfBlob = await generateCompleteChartPdf(
      chartWidgetId,
      options,
      includeDataTable,
    );

    if (!pdfBlob) {
      return false;
    }

    const chartInfo = getChartWidgetInfo(chartWidgetId);
    const defaultFilename =
      chartInfo?.label || options.chartTitle || "chart-complet";

    downloadPdf(pdfBlob, filename || defaultFilename);
    return true;
  } catch (error) {
    logWarn("Erreur lors du téléchargement du PDF complet:", error);
    return false;
  }
}

/**
 * Trouve l'élément DOM du widget Chart
 * @optimized Utilise un cache pour éviter les recherches répétées
 * @param chartWidgetId - ID du widget Chart
 * @returns HTMLElement ou null
 */
export function getChartElement(chartWidgetId: string): HTMLElement | null {
  if (!chartWidgetId) return null;

  // Vérifier le cache d'abord
  const cached = chartElementCache.get(chartWidgetId);
  if (cached && Date.now() - cached.timestamp < ELEMENT_CACHE_TTL) {
    // Vérifier que l'élément est toujours dans le DOM
    if (document.contains(cached.element)) {
      log("Élément Chart trouvé dans le cache");
      return cached.element;
    }
    // L'élément n'est plus dans le DOM, supprimer du cache
    chartElementCache.delete(chartWidgetId);
  }

  log("Recherche de l'élément DOM pour le widget Chart:", chartWidgetId);

  // Sélecteurs prioritaires (les plus probables en premier)
  const primarySelectors = [
    `[data-widgetid="${chartWidgetId}"]`,
    `[data-widget-id="${chartWidgetId}"]`,
    `#widget-${chartWidgetId}`,
  ];

  // Recherche rapide avec les sélecteurs prioritaires
  for (const selector of primarySelectors) {
    try {
      const element = document.querySelector(selector) as HTMLElement;
      if (element) {
        log("Élément trouvé avec le sélecteur:", selector);
        chartElementCache.set(chartWidgetId, {
          element,
          timestamp: Date.now(),
        });
        return element;
      }
    } catch (e) {
      // Ignorer les erreurs de sélecteur invalide
    }
  }

  // Sélecteurs secondaires (moins probables)
  const secondarySelectors = [
    `#${chartWidgetId}`,
    `.widget-${chartWidgetId}`,
    `[id*="${chartWidgetId}"] .jimu-widget`,
  ];

  for (const selector of secondarySelectors) {
    try {
      const element = document.querySelector(selector) as HTMLElement;
      if (element) {
        log("Élément trouvé avec le sélecteur secondaire:", selector);
        chartElementCache.set(chartWidgetId, {
          element,
          timestamp: Date.now(),
        });
        return element;
      }
    } catch (e) {
      // Ignorer les erreurs de sélecteur invalide
    }
  }

  // Méthode alternative optimisée : chercher uniquement dans les widgets
  const allWidgets = document.querySelectorAll("[data-widgetid]");
  log("Nombre total de widgets trouvés dans le DOM:", allWidgets.length);

  for (let i = 0; i < allWidgets.length; i++) {
    const widget = allWidgets[i];
    if (widget.getAttribute("data-widgetid") === chartWidgetId) {
      log("Widget Chart trouvé par itération");
      const element = widget as HTMLElement;
      chartElementCache.set(chartWidgetId, { element, timestamp: Date.now() });
      return element;
    }
  }

  logWarn("Aucun élément DOM trouvé pour le widget Chart:", chartWidgetId);
  return null;
}

/**
 * Capture le diagramme en tant qu'image
 * @optimized Utilise un cache pour éviter les captures répétées
 * @param chartWidgetId - ID du widget Chart
 * @param options - Options de capture
 * @param forceRefresh - Force une nouvelle capture même si en cache
 * @returns Promise<ChartCaptureResult>
 */
export async function captureChartAsImage(
  chartWidgetId: string,
  options?: Partial<ChartPrintOptions>,
  forceRefresh: boolean = false,
): Promise<ChartCaptureResult> {
  try {
    // Vérifier le cache sauf si forceRefresh
    if (!forceRefresh) {
      const cached = captureCache.get(chartWidgetId);
      if (cached && Date.now() - cached.timestamp < CAPTURE_CACHE_TTL) {
        log("Capture trouvée dans le cache");
        return cached.result;
      }
    }

    // Vérifier si le widget existe
    if (!isChartWidgetAvailable(chartWidgetId)) {
      return {
        success: false,
        error: `Widget Chart non trouvé: ${chartWidgetId}`,
      };
    }

    // Trouver l'élément DOM
    const chartElement = getChartElement(chartWidgetId);
    if (!chartElement) {
      return {
        success: false,
        error: `Élément DOM du Chart non trouvé: ${chartWidgetId}`,
      };
    }

    // Capturer le diagramme en utilisant Canvas
    const canvas = await htmlToCanvas(chartElement, options);

    if (!canvas) {
      return {
        success: false,
        error: "Échec de la capture du diagramme",
      };
    }

    const result: ChartCaptureResult = {
      success: true,
      dataUrl: canvas.toDataURL("image/png", 0.92), // Qualité 92% pour réduire la taille
      width: canvas.width,
      height: canvas.height,
    };

    // Mettre en cache le résultat
    captureCache.set(chartWidgetId, { result, timestamp: Date.now() });

    return result;
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Erreur inconnue lors de la capture",
    };
  }
}

/**
 * Convertit un élément HTML en Canvas
 * @optimized
 *   - Paramètres html2canvas optimisés pour la performance
 *   - Utilisation du pool de canvas
 *   - Désactivation du logging en production
 * @param element - Élément HTML à capturer
 * @param options - Options de rendu
 * @returns Promise<HTMLCanvasElement | null>
 */
async function htmlToCanvas(
  element: HTMLElement,
  options?: Partial<ChartPrintOptions>,
): Promise<HTMLCanvasElement | null> {
  try {
    log("Début de la capture du chart avec html2canvas");

    // Chercher le conteneur du chart (pas la toolbar)
    const chartContainer =
      (element.querySelector(".chart-container") as HTMLElement) || element;

    // Récupérer les dimensions du chart-container
    const containerRect = chartContainer.getBoundingClientRect();

    // Utiliser les dimensions réelles du chart container
    const actualWidth = Math.round(containerRect.width) || 400;
    const actualHeight = Math.round(containerRect.height) || 300;

    // Dimensions cibles pour le canvas de sortie
    const targetWidth = options?.chartSize?.width || actualWidth;
    const targetHeight = options?.chartSize?.height || actualHeight;

    // Déterminer le scale optimal (1.5 est un bon compromis qualité/performance)
    const scale = Math.min(
      2,
      Math.max(1, Math.ceil(targetWidth / actualWidth)),
    );

    // MÉTHODE 1: Essayer d'abord de récupérer un canvas existant (le plus rapide)
    const existingCanvas = findLargestCanvas(element);
    if (
      existingCanvas &&
      existingCanvas.width > 100 &&
      existingCanvas.height > 100
    ) {
      log(
        `Canvas existant trouvé: ${existingCanvas.width}x${existingCanvas.height}`,
      );

      // Utiliser directement le canvas existant si les dimensions correspondent
      if (
        Math.abs(existingCanvas.width - targetWidth) < 50 &&
        Math.abs(existingCanvas.height - targetHeight) < 50
      ) {
        return existingCanvas;
      }

      // Redimensionner si nécessaire
      const outputCanvas = getPooledCanvas(targetWidth, targetHeight);
      const ctx = outputCanvas.getContext("2d", { alpha: false });
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.fillStyle = options?.chartBackground || "#FFFFFF";
        ctx.fillRect(0, 0, targetWidth, targetHeight);
        ctx.drawImage(existingCanvas, 0, 0, targetWidth, targetHeight);
        return outputCanvas;
      }
    }

    // MÉTHODE 2: Utiliser html2canvas avec paramètres optimisés
    log("Utilisation de html2canvas pour capturer le chart...");

    try {
      const canvas = await html2canvas(chartContainer, {
        backgroundColor: options?.chartBackground || "#FFFFFF",
        scale: scale,
        useCORS: true,
        allowTaint: true,
        logging: DEBUG_MODE,
        width: actualWidth,
        height: actualHeight,
        windowWidth: actualWidth,
        windowHeight: actualHeight,
        // Optimisations de performance
        imageTimeout: 5000, // Timeout réduit pour les images
        removeContainer: true, // Nettoyer le conteneur cloné
        foreignObjectRendering: false, // Désactiver pour plus de compatibilité
      });

      log(`html2canvas capture réussie: ${canvas.width}x${canvas.height}`);

      // Redimensionner seulement si nécessaire
      if (
        Math.abs(canvas.width - targetWidth * scale) > 10 ||
        Math.abs(canvas.height - targetHeight * scale) > 10
      ) {
        const resizedCanvas = getPooledCanvas(targetWidth, targetHeight);
        const ctx = resizedCanvas.getContext("2d", { alpha: false });
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(canvas, 0, 0, targetWidth, targetHeight);
          return resizedCanvas;
        }
      }

      return canvas;
    } catch (html2canvasError) {
      log("html2canvas a échoué, utilisation du fallback");
    }

    // MÉTHODE 3 (FALLBACK): Chercher le SVG principal
    const allSvgs = chartContainer.querySelectorAll("svg");
    let chartSvg: SVGElement | null = null;
    let svgMaxArea = 0;

    for (let i = 0; i < allSvgs.length; i++) {
      const s = allSvgs[i];
      const svgRect = s.getBoundingClientRect();
      const area = svgRect.width * svgRect.height;
      if (area > svgMaxArea && svgRect.width > 50 && svgRect.height > 50) {
        svgMaxArea = area;
        chartSvg = s as SVGElement;
      }
    }

    if (chartSvg) {
      log("SVG trouvé, conversion en image...");
      const svgRect = chartSvg.getBoundingClientRect();
      const svgClone = chartSvg.cloneNode(true) as SVGElement;
      svgClone.setAttribute("width", String(svgRect.width || targetWidth));
      svgClone.setAttribute("height", String(svgRect.height || targetHeight));

      const svgData = new XMLSerializer().serializeToString(svgClone);
      const svgBlob = new Blob([svgData], {
        type: "image/svg+xml;charset=utf-8",
      });
      const url = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.crossOrigin = "anonymous";

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Échec SVG"));
        setTimeout(() => reject(new Error("Timeout SVG")), 5000);
        img.src = url;
      });

      const canvas = getPooledCanvas(targetWidth, targetHeight);
      const ctx = canvas.getContext("2d", { alpha: false });
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.fillStyle = options?.chartBackground || "#FFFFFF";
        ctx.fillRect(0, 0, targetWidth, targetHeight);
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        URL.revokeObjectURL(url);
        return canvas;
      }
      URL.revokeObjectURL(url);
    }

    logWarn("Aucune méthode de capture n'a fonctionné");
    return null;
  } catch (error) {
    logWarn("Erreur lors de la conversion HTML vers Canvas:", error);
    return null;
  }
}

/**
 * Crée un élément d'impression pour le diagramme
 * @optimized Utilise le cache de capture
 * @param chartWidgetId - ID du widget Chart
 * @param options - Options d'impression
 * @returns Promise<ChartPrintElement | null>
 */
export async function createChartPrintElement(
  chartWidgetId: string,
  options: ChartPrintOptions,
): Promise<ChartPrintElement | null> {
  log("=== Début createChartPrintElement ===");

  const captureResult = await captureChartAsImage(chartWidgetId, options);

  if (!captureResult.success || !captureResult.dataUrl) {
    logWarn(
      "Échec de la création de l'élément d'impression:",
      captureResult.error,
    );
    return null;
  }

  log(
    "Capture réussie, taille:",
    Math.round(captureResult.dataUrl.length / 1024),
    "KB",
  );

  return {
    type: "chart",
    content: captureResult.dataUrl,
    position: options.chartPosition,
    size: options.chartSize,
    title: options.chartTitle,
  };
}

/**
 * Ajoute un diagramme aux propriétés du template d'impression
 * @param printTemplateProperties - Propriétés du template d'impression
 * @param chartElement - Élément du diagramme
 * @returns Propriétés modifiées
 */
export function addChartToTemplate(
  printTemplateProperties: any,
  chartElement: ChartPrintElement,
): any {
  if (!printTemplateProperties || !chartElement) {
    return printTemplateProperties;
  }

  // Ajouter l'élément chart aux éléments supplémentaires
  const extraElements = printTemplateProperties.extraElements || [];
  extraElements.push(chartElement);

  return {
    ...printTemplateProperties,
    extraElements,
  };
}

/**
 * Génère un PDF avec le diagramme inclus
 * @optimized Utilise jsPDF pour génération PDF native
 * @param chartWidgetId - ID du widget Chart
 * @param options - Options d'impression
 * @returns Promise<Blob | null>
 */
export async function generateChartPdf(
  chartWidgetId: string,
  options: ChartPrintOptions,
): Promise<Blob | null> {
  try {
    const captureResult = await captureChartAsImage(chartWidgetId, options);

    if (!captureResult.success || !captureResult.dataUrl) {
      logWarn("Échec de la capture pour le PDF:", captureResult.error);
      return null;
    }

    const imgWidth = captureResult.width || 400;
    const imgHeight = captureResult.height || 300;
    log("Diagramme capturé pour PDF:", imgWidth, "x", imgHeight);

    // Créer un PDF avec jsPDF
    const pdf = new jsPDF({
      orientation: imgWidth > imgHeight ? "landscape" : "portrait",
      unit: "mm",
      format: "a4",
    });

    // Dimensions de la page A4 en mm
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10; // marge en mm

    // Calculer les dimensions de l'image pour qu'elle s'adapte à la page
    const ratio = Math.min(
      (pageWidth - 2 * margin) / imgWidth,
      (pageHeight - 2 * margin - 20) / imgHeight, // 20mm pour le titre
    );

    const scaledWidth = imgWidth * ratio;
    const scaledHeight = imgHeight * ratio;

    // Centrer l'image
    const x = (pageWidth - scaledWidth) / 2;
    let y = margin;

    // Ajouter le titre si présent
    if (options.chartTitle) {
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.text(options.chartTitle, pageWidth / 2, y + 5, { align: "center" });
      y += 15;
    }

    // Ajouter l'image du diagramme
    pdf.addImage(
      captureResult.dataUrl,
      "PNG",
      x,
      y,
      scaledWidth,
      scaledHeight,
      undefined,
      "FAST", // Compression rapide
    );

    // Ajouter la date en bas de page
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(128, 128, 128);
    pdf.text(
      `Généré le: ${new Date().toLocaleString()}`,
      pageWidth / 2,
      pageHeight - 5,
      { align: "center" },
    );

    // Retourner le PDF comme Blob
    return pdf.output("blob");
  } catch (error) {
    logWarn("Erreur lors de la génération du PDF:", error);
    return null;
  }
}

/**
 * Options pour la génération de PDF
 */
export interface PdfGenerationOptions {
  orientation?: "portrait" | "landscape";
  format?: "a4" | "a3" | "letter" | "legal";
  margin?: number;
  includeTimestamp?: boolean;
  includeTitle?: boolean;
  quality?: "FAST" | "MEDIUM" | "SLOW";
}

/**
 * Génère un PDF avec plusieurs diagrammes
 * @param chartWidgetIds - Liste des IDs des widgets Chart
 * @param options - Options d'impression communes
 * @param pdfOptions - Options spécifiques au PDF
 * @returns Promise<Blob | null>
 */
export async function generateMultiChartPdf(
  chartWidgetIds: string[],
  options: Partial<ChartPrintOptions>,
  pdfOptions: PdfGenerationOptions = {},
): Promise<Blob | null> {
  try {
    if (!chartWidgetIds || chartWidgetIds.length === 0) {
      logWarn("Aucun widget Chart spécifié");
      return null;
    }

    const {
      orientation = "portrait",
      format = "a4",
      margin = 10,
      includeTimestamp = true,
      quality = "FAST",
    } = pdfOptions;

    // Créer le PDF
    const pdf = new jsPDF({
      orientation,
      unit: "mm",
      format,
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Capturer et ajouter chaque diagramme
    for (let i = 0; i < chartWidgetIds.length; i++) {
      const chartWidgetId = chartWidgetIds[i];

      if (i > 0) {
        pdf.addPage();
      }

      const captureResult = await captureChartAsImage(chartWidgetId, options);

      if (!captureResult.success || !captureResult.dataUrl) {
        log(
          `Échec de la capture pour le widget ${chartWidgetId}, page ignorée`,
        );
        continue;
      }

      // Calculer les dimensions
      const imgWidth = captureResult.width || 400;
      const imgHeight = captureResult.height || 300;
      const ratio = Math.min(
        (pageWidth - 2 * margin) / imgWidth,
        (pageHeight - 2 * margin - 20) / imgHeight,
      );

      const scaledWidth = imgWidth * ratio;
      const scaledHeight = imgHeight * ratio;
      const x = (pageWidth - scaledWidth) / 2;
      let y = margin;

      // Ajouter le titre du chart si disponible
      const chartInfo = getChartWidgetInfo(chartWidgetId);
      if (chartInfo?.label) {
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(0, 0, 0);
        pdf.text(chartInfo.label, pageWidth / 2, y + 5, { align: "center" });
        y += 12;
      }

      // Ajouter l'image
      pdf.addImage(
        captureResult.dataUrl,
        "PNG",
        x,
        y,
        scaledWidth,
        scaledHeight,
        undefined,
        quality,
      );

      // Numéro de page
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(128, 128, 128);
      pdf.text(
        `Page ${i + 1} / ${chartWidgetIds.length}`,
        pageWidth - margin,
        pageHeight - 5,
        { align: "right" },
      );

      // Timestamp
      if (includeTimestamp) {
        pdf.text(
          `Généré le: ${new Date().toLocaleString()}`,
          margin,
          pageHeight - 5,
          { align: "left" },
        );
      }
    }

    return pdf.output("blob");
  } catch (error) {
    logWarn("Erreur lors de la génération du PDF multi-charts:", error);
    return null;
  }
}

/**
 * Télécharge le PDF généré
 * @param blob - Blob du PDF
 * @param filename - Nom du fichier
 */
export function downloadPdf(
  blob: Blob,
  filename: string = "chart-export",
): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename.replace(/[^a-z0-9]/gi, "_")}_${Date.now()}.pdf`;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Génère et télécharge directement un PDF du diagramme
 * @param chartWidgetId - ID du widget Chart
 * @param options - Options d'impression
 * @param filename - Nom du fichier
 * @returns Promise<boolean> - true si succès
 */
export async function generateAndDownloadChartPdf(
  chartWidgetId: string,
  options: ChartPrintOptions,
  filename?: string,
): Promise<boolean> {
  try {
    const pdfBlob = await generateChartPdf(chartWidgetId, options);

    if (!pdfBlob) {
      return false;
    }

    const chartInfo = getChartWidgetInfo(chartWidgetId);
    const defaultFilename =
      chartInfo?.label || options.chartTitle || "chart-export";

    downloadPdf(pdfBlob, filename || defaultFilename);
    return true;
  } catch (error) {
    logWarn("Erreur lors du téléchargement du PDF:", error);
    return false;
  }
}

/**
 * Valide les options d'impression du diagramme
 * @param options - Options à valider
 * @returns Objet avec le résultat de la validation
 */
export function validateChartPrintOptions(
  options: Partial<ChartPrintOptions>,
): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!options.chartWidgetId) {
    errors.push("chartWidgetId est requis");
  }

  if (options.chartSize) {
    if (options.chartSize.width <= 0) {
      errors.push("La largeur du diagramme doit être positive");
    }
    if (options.chartSize.height <= 0) {
      errors.push("La hauteur du diagramme doit être positive");
    }
  }

  if (
    options.chartPosition &&
    !Object.values(ChartPosition).includes(options.chartPosition)
  ) {
    errors.push("Position du diagramme invalide");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Liste tous les widgets Chart disponibles dans l'application
 * @returns Array d'objets avec id et label des widgets Chart
 */
export function listAvailableChartWidgets(): Array<{
  id: string;
  label: string;
}> {
  const widgets = getAppStore().getState().appConfig?.widgets;
  if (!widgets) return [];

  const chartWidgets: Array<{ id: string; label: string }> = [];

  Object.keys(widgets).forEach((widgetId) => {
    const widget = widgets[widgetId];
    if (widget.uri?.includes("chart")) {
      chartWidgets.push({
        id: widgetId,
        label: widget.label || widgetId,
      });
    }
  });

  return chartWidgets;
}

/**
 * Imprime uniquement un diagramme (sans carte)
 * Génère un PDF téléchargeable contenant le chart
 * @optimized Utilise jsPDF pour génération PDF native
 * @param chartElement - Élément de diagramme capturé
 * @param title - Titre du document
 * @param outputFormat - Format de sortie: 'pdf' (défaut), 'png', ou 'print' (fenêtre d'impression)
 * @returns Promise<{ url: string; blob?: Blob }> - URL et Blob du fichier généré
 */
export async function printChartOnly(
  chartElement: ChartPrintElement,
  title: string = "Chart Export",
  outputFormat: "pdf" | "png" | "print" = "pdf",
): Promise<{ url: string; blob?: Blob }> {
  log("printChartOnly: Démarrage impression chart en format", outputFormat);

  if (!chartElement || !chartElement.content) {
    throw new Error("No chart element provided for printing");
  }

  try {
    const displayTitle = chartElement.title || title;

    // Format PDF (par défaut)
    if (outputFormat === "pdf") {
      // Extraire les dimensions de l'image
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Échec du chargement de l'image"));
        img.src = chartElement.content;
      });

      const imgWidth = img.naturalWidth || chartElement.size.width;
      const imgHeight = img.naturalHeight || chartElement.size.height;

      // Créer le PDF
      const pdf = new jsPDF({
        orientation: imgWidth > imgHeight ? "landscape" : "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;

      // Calculer les dimensions pour adapter à la page
      const ratio = Math.min(
        (pageWidth - 2 * margin) / imgWidth,
        (pageHeight - 2 * margin - 20) / imgHeight,
      );

      const scaledWidth = imgWidth * ratio;
      const scaledHeight = imgHeight * ratio;
      const x = (pageWidth - scaledWidth) / 2;
      let y = margin;

      // Ajouter le titre
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.text(displayTitle, pageWidth / 2, y + 5, { align: "center" });
      y += 15;

      // Ajouter l'image
      pdf.addImage(
        chartElement.content,
        "PNG",
        x,
        y,
        scaledWidth,
        scaledHeight,
        undefined,
        "FAST",
      );

      // Ajouter le timestamp
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(128, 128, 128);
      pdf.text(
        `Généré le: ${new Date().toLocaleString()}`,
        pageWidth / 2,
        pageHeight - 5,
        { align: "center" },
      );

      // Générer le Blob et l'URL
      const pdfBlob = pdf.output("blob");
      const pdfUrl = URL.createObjectURL(pdfBlob);

      // Télécharger automatiquement
      downloadPdf(pdfBlob, displayTitle);

      return { url: pdfUrl, blob: pdfBlob };
    }

    // Format PNG
    if (outputFormat === "png") {
      downloadChartAsImage(chartElement.content, displayTitle);
      return { url: chartElement.content };
    }

    // Format Print (fenêtre d'impression du navigateur)
    const escapedTitle = displayTitle.replace(
      /[<>&"']/g,
      (c) =>
        ({
          "<": "&lt;",
          ">": "&gt;",
          "&": "&amp;",
          '"': "&quot;",
          "'": "&#39;",
        })[c] || c,
    );

    const printContent = `<!DOCTYPE html><html><head><title>${escapedTitle}</title><style>@page{size:A4;margin:20mm}body{font-family:Arial,sans-serif;margin:0;padding:20px;display:flex;flex-direction:column;align-items:center}h1{color:#333;margin-bottom:20px;text-align:center}.chart-container{max-width:100%;display:flex;justify-content:center}.chart-container img{max-width:100%;height:auto;border:1px solid #ddd;box-shadow:0 2px 8px rgba(0,0,0,.1)}.timestamp{margin-top:20px;font-size:12px;color:#666}</style></head><body><h1>${escapedTitle}</h1><div class="chart-container"><img src="${chartElement.content}" alt="Chart"/></div><div class="timestamp">Generated: ${new Date().toLocaleString()}</div></body></html>`;

    const printWindow = window.open("", "_blank", "width=800,height=600");

    if (!printWindow) {
      log("Popup bloqué, téléchargement PDF direct");
      // Fallback vers PDF si popup bloqué
      return printChartOnly(chartElement, title, "pdf");
    }

    printWindow.document.write(printContent);
    printWindow.document.close();

    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 250);
    };

    return { url: chartElement.content };
  } catch (error) {
    logWarn("printChartOnly error:", error);
    throw error;
  }
}

/**
 * Télécharge le chart comme image
 * @optimized Réutilisation de l'élément link
 * @param dataUrl - Data URL de l'image
 * @param title - Nom du fichier
 */
function downloadChartAsImage(dataUrl: string, title: string): void {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = `${title.replace(/[^a-z0-9]/gi, "_")}_${Date.now()}.png`;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  // Utiliser setTimeout pour permettre au navigateur de traiter le téléchargement
  setTimeout(() => document.body.removeChild(link), 100);
}

/**
 * Précharge les dépendances pour améliorer les performances futures
 * Appelé au démarrage pour initialiser le cache
 */
export function preloadChartPrintDependencies(): void {
  // Force le chargement de html2canvas dans le cache du navigateur
  if (typeof html2canvas === "function") {
    log("html2canvas préchargé");
  }
}

/**
 * Libère les ressources et nettoie les caches
 * Appelé lors du démontage du composant
 */
export function cleanupChartPrintResources(): void {
  chartElementCache.clear();
  captureCache.clear();
  canvasPool.length = 0;
  log("Ressources chart-print nettoyées");
}
