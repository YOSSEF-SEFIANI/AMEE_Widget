/**
 * Chart Print Service
 *
 * Service d'impression de diagrammes avec génération PDF.
 *
 * @module chart/print
 * @version 1.0.0
 */

import { jsPDF } from "jspdf";
import type { ChartPrintOptions, ChartPrintElement } from "./types";
import { captureChartAsImage } from "./capture";
import { log, logWarn } from "./cache";

/**
 * Crée un élément d'impression pour un widget Chart
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

  const extraElements = printTemplateProperties.extraElements || [];
  extraElements.push(chartElement);

  return {
    ...printTemplateProperties,
    extraElements,
  };
}

/**
 * Télécharge un PDF
 * @param blob - Blob du PDF
 * @param filename - Nom du fichier
 */
function downloadPdf(blob: Blob, filename: string): void {
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
 * Télécharge le chart comme image PNG
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
  setTimeout(() => document.body.removeChild(link), 100);
}

/**
 * Imprime un diagramme seul (sans carte)
 * @param chartElement - Élément du diagramme à imprimer
 * @param title - Titre du document
 * @param outputFormat - Format de sortie (pdf, png, print)
 * @returns Promise<{ url: string; blob?: Blob }>
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
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Échec du chargement de l'image"));
        img.src = chartElement.content;
      });

      const imgWidth = img.naturalWidth || chartElement.size.width;
      const imgHeight = img.naturalHeight || chartElement.size.height;

      const pdf = new jsPDF({
        orientation: imgWidth > imgHeight ? "landscape" : "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;

      const ratio = Math.min(
        (pageWidth - 2 * margin) / imgWidth,
        (pageHeight - 2 * margin - 20) / imgHeight,
      );

      const scaledWidth = imgWidth * ratio;
      const scaledHeight = imgHeight * ratio;
      const x = (pageWidth - scaledWidth) / 2;
      let y = margin;

      // Titre
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.text(displayTitle, pageWidth / 2, y + 5, { align: "center" });
      y += 15;

      // Image
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

      // Timestamp
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(128, 128, 128);
      pdf.text(
        `Généré le: ${new Date().toLocaleString()}`,
        pageWidth / 2,
        pageHeight - 5,
        { align: "center" },
      );

      const pdfBlob = pdf.output("blob");
      const pdfUrl = URL.createObjectURL(pdfBlob);

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
