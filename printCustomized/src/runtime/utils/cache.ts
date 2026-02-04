/**
 * Chart Cache Utilities
 *
 * Utilitaires de cache pour optimiser les performances de capture de diagrammes.
 *
 * @module chart/cache
 * @version 1.0.0
 */

// Configuration du mode debug - désactivé en production
const DEBUG_MODE = false;
export const log = DEBUG_MODE
  ? console.log.bind(console, "[ChartService]")
  : () => {};
export const logWarn = DEBUG_MODE
  ? console.warn.bind(console, "[ChartService]")
  : () => {};

// ============== CACHE MANAGEMENT ==============

// Cache pour les éléments DOM des charts (évite les recherches répétées)
const chartElementCache = new Map<
  string,
  { element: HTMLElement; timestamp: number }
>();
const ELEMENT_CACHE_TTL = 30000; // 30 secondes

// Cache pour les captures de charts (évite les recaptures fréquentes)
const captureCache = new Map<string, { result: any; timestamp: number }>();
const CAPTURE_CACHE_TTL = 5000; // 5 secondes

// Pool de canvas réutilisables pour éviter les allocations répétées
const canvasPool: HTMLCanvasElement[] = [];
const MAX_POOL_SIZE = 3;

/**
 * Obtient un canvas du pool ou en crée un nouveau
 */
export function getPooledCanvas(
  width: number,
  height: number,
): HTMLCanvasElement {
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
export function returnCanvasToPool(canvas: HTMLCanvasElement): void {
  if (canvasPool.length < MAX_POOL_SIZE) {
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    canvasPool.push(canvas);
  }
}

/**
 * Récupère un élément du cache d'éléments DOM
 */
export function getCachedElement(chartWidgetId: string): HTMLElement | null {
  const cached = chartElementCache.get(chartWidgetId);
  if (cached && Date.now() - cached.timestamp < ELEMENT_CACHE_TTL) {
    return cached.element;
  }
  return null;
}

/**
 * Met en cache un élément DOM
 */
export function setCachedElement(
  chartWidgetId: string,
  element: HTMLElement,
): void {
  chartElementCache.set(chartWidgetId, {
    element,
    timestamp: Date.now(),
  });
}

/**
 * Récupère une capture du cache
 */
export function getCachedCapture(chartWidgetId: string): any | null {
  const cached = captureCache.get(chartWidgetId);
  if (cached && Date.now() - cached.timestamp < CAPTURE_CACHE_TTL) {
    return cached.result;
  }
  return null;
}

/**
 * Met en cache une capture
 */
export function setCachedCapture(chartWidgetId: string, result: any): void {
  captureCache.set(chartWidgetId, {
    result,
    timestamp: Date.now(),
  });
}

/**
 * Nettoie les entrées expirées des caches
 */
export function cleanExpiredCache(): void {
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

/**
 * Nettoie tous les caches
 */
export function clearAllCaches(): void {
  chartElementCache.clear();
  captureCache.clear();
  canvasPool.length = 0;
  log("Caches chart nettoyés");
}

// Nettoyage périodique du cache (toutes les 60 secondes)
if (typeof setInterval !== "undefined") {
  setInterval(cleanExpiredCache, 60000);
}
