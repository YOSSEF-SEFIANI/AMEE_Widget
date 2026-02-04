/**
 * Chart Capture Service
 *
 * Service de capture de diagrammes en images pour l'impression.
 *
 * @module chart/capture
 * @version 1.0.0
 */

import html2canvas from "html2canvas";
import type { ChartCaptureResult, ChartPrintOptions } from "./types";
import { isChartWidgetAvailable, getChartElement } from "./widget-utils";
import {
  log,
  logWarn,
  getPooledCanvas,
  getCachedCapture,
  setCachedCapture,
} from "./cache";

/**
 * Trouve récursivement tous les canvas dans un élément
 */
function findAllCanvases(element: Element): HTMLCanvasElement[] {
  const canvases: HTMLCanvasElement[] = [];
  const stack: Element[] = [element];

  while (stack.length > 0) {
    const current = stack.pop()!;

    if (current.tagName === "CANVAS") {
      canvases.push(current as HTMLCanvasElement);
    }

    const directCanvases = current.querySelectorAll(":scope > canvas");
    for (let i = 0; i < directCanvases.length; i++) {
      canvases.push(directCanvases[i] as HTMLCanvasElement);
    }

    const children = current.children;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.shadowRoot) {
        stack.push(child.shadowRoot as unknown as Element);
      }
      if (child.children.length > 0 || child.shadowRoot) {
        stack.push(child);
      }
    }
  }

  // Dédupliquer
  const uniqueCanvases: HTMLCanvasElement[] = [];
  const seen = new Set<HTMLCanvasElement>();
  for (const canvas of canvases) {
    if (!seen.has(canvas)) {
      seen.add(canvas);
      uniqueCanvases.push(canvas);
    }
  }
  return uniqueCanvases;
}

/**
 * Trouve le plus grand canvas dans un élément
 */
function findLargestCanvas(element: Element): HTMLCanvasElement | null {
  const allCanvases = findAllCanvases(element);
  let largestCanvas: HTMLCanvasElement | null = null;
  let maxArea = 0;
  const SUFFICIENT_AREA = 200000;

  for (const canvas of allCanvases) {
    const area = canvas.width * canvas.height;
    if (area > maxArea) {
      maxArea = area;
      largestCanvas = canvas;
      if (area >= SUFFICIENT_AREA) break;
    }
  }

  return largestCanvas;
}

/**
 * Convertit un élément HTML en Canvas
 */
async function htmlToCanvas(
  element: HTMLElement,
  options?: Partial<ChartPrintOptions>,
): Promise<HTMLCanvasElement | null> {
  log("=== htmlToCanvas démarré ===");

  try {
    const chartContainer =
      (element.querySelector(".chart-container") as HTMLElement) || element;

    log(
      "chartContainer trouvé:",
      chartContainer !== element
        ? "Oui (.chart-container)"
        : "Non (utilise element)",
    );

    const containerRect = chartContainer.getBoundingClientRect();
    log("containerRect:", containerRect);

    const actualWidth = Math.round(containerRect.width) || 400;
    const actualHeight = Math.round(containerRect.height) || 300;
    log("Dimensions actuelles:", actualWidth, "x", actualHeight);

    const targetWidth = options?.chartSize?.width || actualWidth;
    const targetHeight = options?.chartSize?.height || actualHeight;
    log("Dimensions cibles:", targetWidth, "x", targetHeight);

    const scale = Math.min(
      2,
      Math.max(1, Math.ceil(targetWidth / actualWidth)),
    );

    // MÉTHODE 1: Canvas existant
    log("Recherche d'un canvas existant...");
    const existingCanvas = findLargestCanvas(element);
    log(
      "Canvas existant trouvé:",
      existingCanvas
        ? `${existingCanvas.width}x${existingCanvas.height}`
        : "NON",
    );

    if (
      existingCanvas &&
      existingCanvas.width > 100 &&
      existingCanvas.height > 100
    ) {
      log("Utilisation du canvas existant");
      if (
        Math.abs(existingCanvas.width - targetWidth) < 50 &&
        Math.abs(existingCanvas.height - targetHeight) < 50
      ) {
        return existingCanvas;
      }

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

    // MÉTHODE 2: html2canvas
    log("Tentative avec html2canvas...");
    try {
      const canvas = await html2canvas(chartContainer, {
        backgroundColor: options?.chartBackground || "#FFFFFF",
        scale: scale,
        useCORS: true,
        allowTaint: true,
        logging: true, // Activer le logging de html2canvas
        width: actualWidth,
        height: actualHeight,
        windowWidth: actualWidth,
        windowHeight: actualHeight,
        imageTimeout: 5000,
        removeContainer: true,
        foreignObjectRendering: false,
      });

      log("html2canvas réussi:", canvas.width, "x", canvas.height);

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
      log("html2canvas a échoué, utilisation du fallback SVG");
    }

    // MÉTHODE 3: SVG Fallback
    const allSvgs = chartContainer.querySelectorAll("svg");
    let chartSvg: SVGElement | null = null;
    let svgMaxArea = 0;

    for (const s of allSvgs) {
      const svgRect = s.getBoundingClientRect();
      const area = svgRect.width * svgRect.height;
      if (area > svgMaxArea && svgRect.width > 50 && svgRect.height > 50) {
        svgMaxArea = area;
        chartSvg = s as SVGElement;
      }
    }

    if (chartSvg) {
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

    return null;
  } catch (error) {
    log("Erreur dans htmlToCanvas:", error);
    return null;
  }
}

/**
 * Capture un widget Chart comme image
 * @param chartWidgetId - ID du widget Chart
 * @param options - Options de capture
 * @param forceRefresh - Forcer une nouvelle capture
 * @returns Promise<ChartCaptureResult>
 */
export async function captureChartAsImage(
  chartWidgetId: string,
  options?: Partial<ChartPrintOptions>,
  forceRefresh: boolean = false,
): Promise<ChartCaptureResult> {
  log("=== captureChartAsImage démarré ===");
  log("chartWidgetId:", chartWidgetId);
  log("options:", options);
  log("forceRefresh:", forceRefresh);

  try {
    // Vérifier le cache
    if (!forceRefresh) {
      const cached = getCachedCapture(chartWidgetId);
      if (cached) {
        log("Capture trouvée dans le cache");
        return cached;
      }
    }

    // Vérifier si le widget existe
    log("Vérification de la disponibilité du widget...");
    const widgetAvailable = isChartWidgetAvailable(chartWidgetId);
    log("Widget disponible:", widgetAvailable);

    if (!widgetAvailable) {
      const error = `Widget Chart non trouvé dans appConfig: ${chartWidgetId}`;
      logWarn(error);
      return {
        success: false,
        error: error,
      };
    }

    // Trouver l'élément DOM
    log("Recherche de l'élément DOM...");
    const chartElement = getChartElement(chartWidgetId);
    log("Élément DOM trouvé:", chartElement ? "OUI" : "NON");

    if (chartElement) {
      log("Détails de l'élément:", {
        tagName: chartElement.tagName,
        className: chartElement.className,
        id: chartElement.id,
        dimensions: {
          width: chartElement.offsetWidth,
          height: chartElement.offsetHeight,
          clientWidth: chartElement.clientWidth,
          clientHeight: chartElement.clientHeight,
        },
      });
    }

    if (!chartElement) {
      const error = `Élément DOM du Chart non trouvé: ${chartWidgetId}`;
      logWarn(error);
      // Afficher les éléments disponibles dans le DOM pour debug
      const allWidgets = document.querySelectorAll("[data-widgetid]");
      log(
        "Widgets trouvés dans le DOM:",
        Array.from(allWidgets).map((el) => el.getAttribute("data-widgetid")),
      );
      return {
        success: false,
        error: error,
      };
    }

    // Capturer le diagramme
    log("Démarrage de la capture htmlToCanvas...");
    const canvas = await htmlToCanvas(chartElement, options);
    log(
      "Canvas résultat:",
      canvas ? `${canvas.width}x${canvas.height}` : "NULL",
    );

    if (!canvas) {
      const error =
        "Échec de la capture du diagramme - htmlToCanvas a retourné null";
      logWarn(error);
      return {
        success: false,
        error: error,
      };
    }

    const result: ChartCaptureResult = {
      success: true,
      dataUrl: canvas.toDataURL("image/png", 0.92),
      width: canvas.width,
      height: canvas.height,
    };

    log(
      "Capture réussie, taille dataUrl:",
      Math.round(result.dataUrl!.length / 1024),
      "KB",
    );

    // Mettre en cache
    setCachedCapture(chartWidgetId, result);

    return result;
  } catch (error) {
    const errorMsg =
      error instanceof Error
        ? error.message
        : "Erreur inconnue lors de la capture";
    logWarn("Exception dans captureChartAsImage:", errorMsg);
    return {
      success: false,
      error: errorMsg,
    };
  }
}
