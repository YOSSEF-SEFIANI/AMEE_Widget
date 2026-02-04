/**
 * Chart Widget Utilities
 *
 * Utilitaires pour interagir avec les widgets Chart dans ArcGIS Experience Builder.
 *
 * @module chart/widget-utils
 * @version 1.0.0
 */

import { getAppStore } from "jimu-core";
import type { ChartWidgetInfo } from "./types";
import { log, getCachedElement, setCachedElement } from "./cache";

/**
 * Vérifie si un widget Chart existe dans l'application
 * @param chartWidgetId - ID du widget Chart
 * @returns boolean
 */
export function isChartWidgetAvailable(chartWidgetId: string): boolean {
  log("=== isChartWidgetAvailable ===");
  log("Vérification du widget:", chartWidgetId);

  try {
    const state = getAppStore().getState();
    const widgets = state?.appConfig?.widgets;

    if (!widgets) {
      log("Aucun widget dans appConfig");
      return false;
    }

    if (!chartWidgetId) {
      log("chartWidgetId est vide");
      return false;
    }

    const widget = widgets[chartWidgetId];
    log("Widget trouvé:", widget ? "OUI" : "NON");

    if (widget) {
      log("Manifest name:", widget?.manifest?.name);
      log("Widget label:", widget?.label);
    }

    // Vérifier si c'est un widget Chart (plusieurs formats possibles)
    const manifestName = widget?.manifest?.name?.toLowerCase() || "";
    const isChart =
      manifestName === "chart" ||
      manifestName.startsWith("chart") ||
      manifestName.includes("chartwidget");
    log("Est un widget Chart:", isChart);

    return isChart;
  } catch (error) {
    log("Erreur lors de la vérification du widget:", error);
    return false;
  }
}

/**
 * Récupère les informations d'un widget Chart
 * @param chartWidgetId - ID du widget Chart
 * @returns Informations du widget ou null
 */
export function getChartWidgetInfo(chartWidgetId: string): any | null {
  try {
    const state = getAppStore().getState();
    const widgets = state?.appConfig?.widgets;
    if (!widgets || !chartWidgetId) return null;

    return widgets[chartWidgetId] || null;
  } catch (error) {
    log("Erreur lors de la récupération des infos:", error);
    return null;
  }
}

/**
 * Récupère l'élément DOM d'un widget Chart
 * @optimized Utilise le cache pour éviter les recherches répétées
 * @param chartWidgetId - ID du widget Chart
 * @returns HTMLElement | null
 */
export function getChartElement(chartWidgetId: string): HTMLElement | null {
  log("=== getChartElement démarré ===");
  log("Recherche du widget:", chartWidgetId);

  // Vérifier le cache en premier
  const cached = getCachedElement(chartWidgetId);
  if (cached && document.body.contains(cached)) {
    log("Élément trouvé dans le cache");
    return cached;
  }

  // Rechercher l'élément dans le DOM
  const selector = `[data-widgetid="${chartWidgetId}"]`;
  log("Sélecteur utilisé:", selector);

  const widgetContainer = document.querySelector(selector) as HTMLElement;
  log("widgetContainer trouvé:", widgetContainer ? "OUI" : "NON");

  if (!widgetContainer) {
    log(`Widget container non trouvé: ${chartWidgetId}`);
    // Debug: lister tous les widgets disponibles
    const allWidgets = document.querySelectorAll("[data-widgetid]");
    log("Nombre total de widgets dans le DOM:", allWidgets.length);
    if (allWidgets.length > 0) {
      log(
        "IDs des widgets disponibles:",
        Array.from(allWidgets).map((el) => el.getAttribute("data-widgetid")),
      );
    }
    return null;
  }

  log(
    "Widget container trouvé, dimensions:",
    widgetContainer.offsetWidth,
    "x",
    widgetContainer.offsetHeight,
  );

  // Chercher le conteneur du chart - plusieurs stratégies
  // Stratégie 1: Classe standard ArcGIS Charts
  const chartContainerByClass = widgetContainer.querySelector(
    ".chart-container",
  ) as HTMLElement;

  // Stratégie 2: arcgis-charts-web-component
  const arcgisChartComponent = widgetContainer.querySelector(
    "arcgis-charts-web-component, arcgis-charts, [class*='arcgis-chart']",
  ) as HTMLElement;

  // Stratégie 3: Canvas direct (souvent utilisé par les charts)
  const directCanvas = widgetContainer.querySelector("canvas") as HTMLElement;

  // Stratégie 4: SVG direct (charts vectoriels)
  const directSvg = widgetContainer.querySelector("svg") as HTMLElement;

  // Stratégie 5: Classes génériques chart
  const chartContainerByAttr = widgetContainer.querySelector(
    '[class*="chart"]',
  ) as HTMLElement;

  log("Stratégies de détection:");
  log("  - .chart-container:", chartContainerByClass ? "OUI" : "NON");
  log("  - arcgis-charts-*:", arcgisChartComponent ? "OUI" : "NON");
  log("  - canvas direct:", directCanvas ? "OUI" : "NON");
  log("  - svg direct:", directSvg ? "OUI" : "NON");
  log("  - [class*='chart']:", chartContainerByAttr ? "OUI" : "NON");

  // Sélectionner le meilleur conteneur disponible
  const chartContainer =
    chartContainerByClass ||
    arcgisChartComponent ||
    chartContainerByAttr ||
    (directCanvas?.parentElement as HTMLElement) ||
    (directSvg?.parentElement as HTMLElement) ||
    widgetContainer;

  log(
    "Conteneur final sélectionné:",
    chartContainer === widgetContainer
      ? "widgetContainer"
      : "sous-élément chart",
  );
  log(
    "Dimensions du conteneur final:",
    chartContainer.offsetWidth,
    "x",
    chartContainer.offsetHeight,
  );

  // Afficher le contenu HTML pour debug
  if (chartContainer.offsetWidth === 0 || chartContainer.offsetHeight === 0) {
    log("ATTENTION: Le conteneur a des dimensions nulles!");
    log(
      "innerHTML (premiers 500 caractères):",
      widgetContainer.innerHTML.substring(0, 500),
    );
  }

  // Mettre en cache
  if (chartContainer) {
    setCachedElement(chartWidgetId, chartContainer);
    log("Élément mis en cache");
  }

  return chartContainer;
}

/**
 * Liste tous les widgets Chart disponibles dans l'application
 * @returns Array d'objets avec id et label
 */
export function listAvailableChartWidgets(): ChartWidgetInfo[] {
  try {
    const state = getAppStore().getState();
    const widgets = state?.appConfig?.widgets;
    if (!widgets) return [];

    const chartWidgets: ChartWidgetInfo[] = [];
    Object.keys(widgets).forEach((widgetId) => {
      const widget = widgets[widgetId];
      if (widget?.manifest?.name === "chart") {
        chartWidgets.push({
          id: widgetId,
          label: widget.label || widget.id || widgetId,
        });
      }
    });

    return chartWidgets;
  } catch (error) {
    log("Erreur lors de la liste des widgets Chart:", error);
    return [];
  }
}
