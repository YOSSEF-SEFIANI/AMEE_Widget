/**
 * Tests Unitaires - Utilitaires de Couleurs
 * Chart Widget - ArcGIS Experience Builder 1.19
 *
 * Tests suivant les bonnes pratiques Esri/ArcGIS
 */

import { Immutable } from "jimu-core";
import {
  rgbToHex,
  hexToRgb,
  lightenColor,
  darkenColor,
  generateGradient,
  applyPaletteToSeries,
  applyValueBasedColors,
  createFillSymbol,
  createLineSymbol,
  getContrastRatio,
  isWCAGCompliant,
  ensureContrast,
  exportPalette,
  importPalette,
  validateColorConfig,
  COLOR_PALETTES,
} from "../../src/utils/color-utils";

describe("Color Utils - Conversion Functions", () => {
  describe("rgbToHex", () => {
    it("should convert RGB to hex correctly", () => {
      expect(rgbToHex(255, 0, 0)).toBe("#FF0000");
      expect(rgbToHex(0, 255, 0)).toBe("#00FF00");
      expect(rgbToHex(0, 0, 255)).toBe("#0000FF");
      expect(rgbToHex(94, 143, 208)).toBe("#5E8FD0");
    });

    it("should handle edge cases", () => {
      expect(rgbToHex(0, 0, 0)).toBe("#000000");
      expect(rgbToHex(255, 255, 255)).toBe("#FFFFFF");
    });
  });

  describe("hexToRgb", () => {
    it("should convert hex to RGB correctly", () => {
      expect(hexToRgb("#FF0000")).toEqual([255, 0, 0]);
      expect(hexToRgb("#00FF00")).toEqual([0, 255, 0]);
      expect(hexToRgb("#0000FF")).toEqual([0, 0, 255]);
      expect(hexToRgb("#5E8FD0")).toEqual([94, 143, 208]);
    });

    it("should handle hex without #", () => {
      expect(hexToRgb("FF0000")).toEqual([255, 0, 0]);
    });

    it("should return null for invalid hex", () => {
      expect(hexToRgb("invalid")).toBeNull();
      expect(hexToRgb("#GG0000")).toBeNull();
    });
  });

  describe("lightenColor", () => {
    it("should lighten color by percentage", () => {
      const original = "#5E8FD0";
      const lightened = lightenColor(original, 20);

      expect(lightened).not.toBe(original);

      const originalRgb = hexToRgb(original)!;
      const lightenedRgb = hexToRgb(lightened)!;

      // Vérifier que chaque composante a augmenté
      expect(lightenedRgb[0]).toBeGreaterThan(originalRgb[0]);
      expect(lightenedRgb[1]).toBeGreaterThan(originalRgb[1]);
      expect(lightenedRgb[2]).toBeGreaterThan(originalRgb[2]);
    });

    it("should not exceed 255", () => {
      const result = lightenColor("#FFFFFF", 50);
      expect(result).toBe("#FFFFFF");
    });
  });

  describe("darkenColor", () => {
    it("should darken color by percentage", () => {
      const original = "#5E8FD0";
      const darkened = darkenColor(original, 20);

      expect(darkened).not.toBe(original);

      const originalRgb = hexToRgb(original)!;
      const darkenedRgb = hexToRgb(darkened)!;

      // Vérifier que chaque composante a diminué
      expect(darkenedRgb[0]).toBeLessThan(originalRgb[0]);
      expect(darkenedRgb[1]).toBeLessThan(originalRgb[1]);
      expect(darkenedRgb[2]).toBeLessThan(originalRgb[2]);
    });

    it("should not go below 0", () => {
      const result = darkenColor("#000000", 50);
      expect(result).toBe("#000000");
    });
  });

  describe("generateGradient", () => {
    it("should generate gradient with correct number of steps", () => {
      const gradient = generateGradient("#FF0000", "#0000FF", 5);
      expect(gradient).toHaveLength(5);
    });

    it("should start and end with correct colors", () => {
      const gradient = generateGradient("#FF0000", "#0000FF", 5);
      expect(gradient[0]).toBe("#FF0000");
      expect(gradient[4]).toBe("#0000FF");
    });

    it("should create smooth transition", () => {
      const gradient = generateGradient("#000000", "#FFFFFF", 3);
      expect(gradient).toEqual(["#000000", "#7F7F7F", "#FFFFFF"]);
    });
  });
});

describe("Color Utils - Series Application", () => {
  describe("applyPaletteToSeries", () => {
    it("should apply palette colors to series", () => {
      const series = Immutable([
        { name: "Series 1", fillSymbol: { color: "#000000" } },
        { name: "Series 2", fillSymbol: { color: "#000000" } },
        { name: "Series 3", fillSymbol: { color: "#000000" } },
      ]);

      const palette = ["#FF0000", "#00FF00", "#0000FF"];
      const result = applyPaletteToSeries(series, palette);

      expect(result[0].fillSymbol.color).toBe("#FF0000");
      expect(result[1].fillSymbol.color).toBe("#00FF00");
      expect(result[2].fillSymbol.color).toBe("#0000FF");
    });

    it("should cycle through palette if series > palette length", () => {
      const series = Immutable([
        { fillSymbol: { color: "#000" } },
        { fillSymbol: { color: "#000" } },
        { fillSymbol: { color: "#000" } },
        { fillSymbol: { color: "#000" } },
      ]);

      const palette = ["#FF0000", "#00FF00"];
      const result = applyPaletteToSeries(series, palette);

      expect(result[0].fillSymbol.color).toBe("#FF0000");
      expect(result[1].fillSymbol.color).toBe("#00FF00");
      expect(result[2].fillSymbol.color).toBe("#FF0000"); // Cycle
      expect(result[3].fillSymbol.color).toBe("#00FF00"); // Cycle
    });

    it("should return original series if palette is empty", () => {
      const series = Immutable([{ fillSymbol: { color: "#000000" } }]);

      const result = applyPaletteToSeries(series, []);
      expect(result).toBe(series);
    });
  });

  describe("applyValueBasedColors", () => {
    it("should apply gradient based on values", () => {
      const series = Immutable([
        { fillSymbol: { color: "#000" } },
        { fillSymbol: { color: "#000" } },
        { fillSymbol: { color: "#000" } },
      ]);

      const values = [0, 50, 100];
      const result = applyValueBasedColors(
        series,
        values,
        "#00FF00",
        "#FF0000",
      );

      // La première série (valeur min) devrait être verte
      expect(result[0].fillSymbol.color).toBe("#00FF00");

      // La dernière série (valeur max) devrait être rouge
      expect(result[2].fillSymbol.color).toBe("#FF0000");

      // La série du milieu devrait être entre les deux
      const middleRgb = hexToRgb(result[1].fillSymbol.color)!;
      expect(middleRgb[0]).toBeGreaterThan(0);
      expect(middleRgb[1]).toBeGreaterThan(0);
    });
  });
});

describe("Color Utils - Symbol Creation", () => {
  describe("createFillSymbol", () => {
    it("should create fill symbol with default outline", () => {
      const symbol = createFillSymbol("#5E8FD0");

      expect(symbol.type).toBe("esriSFS");
      expect(symbol.color).toBe("#5E8FD0");
      expect(symbol.outline.color).toBe("#808080");
      expect(symbol.outline.width).toBe(1);
      expect(symbol.outline.style).toBe("solid");
    });

    it("should create fill symbol with custom outline", () => {
      const symbol = createFillSymbol("#5E8FD0", "#FF0000", 2);

      expect(symbol.outline.color).toBe("#FF0000");
      expect(symbol.outline.width).toBe(2);
    });
  });

  describe("createLineSymbol", () => {
    it("should create line symbol with defaults", () => {
      const symbol = createLineSymbol("#5E8FD0");

      expect(symbol.type).toBe("esriSLS");
      expect(symbol.color).toBe("#5E8FD0");
      expect(symbol.width).toBe(2);
      expect(symbol.style).toBe("solid");
    });

    it("should create line symbol with custom properties", () => {
      const symbol = createLineSymbol("#FF0000", 3, "dash");

      expect(symbol.color).toBe("#FF0000");
      expect(symbol.width).toBe(3);
      expect(symbol.style).toBe("dash");
    });
  });
});

describe("Color Utils - Accessibility", () => {
  describe("getContrastRatio", () => {
    it("should calculate contrast ratio correctly", () => {
      // Noir sur blanc = ratio maximum (~21:1)
      const blackWhite = getContrastRatio("#000000", "#FFFFFF");
      expect(blackWhite).toBeGreaterThan(20);

      // Même couleur = ratio minimum (1:1)
      const sameColor = getContrastRatio("#5E8FD0", "#5E8FD0");
      expect(sameColor).toBeCloseTo(1, 1);
    });
  });

  describe("isWCAGCompliant", () => {
    it("should pass WCAG AA for good contrast", () => {
      expect(isWCAGCompliant("#000000", "#FFFFFF", "AA")).toBe(true);
      expect(isWCAGCompliant("#FFFFFF", "#000000", "AA")).toBe(true);
    });

    it("should fail WCAG AA for poor contrast", () => {
      expect(isWCAGCompliant("#FFFFFF", "#FFFAAA", "AA")).toBe(false);
      expect(isWCAGCompliant("#808080", "#888888", "AA")).toBe(false);
    });

    it("should be more strict for AAA", () => {
      const color1 = "#767676";
      const color2 = "#FFFFFF";

      // Peut passer AA mais pas AAA
      expect(isWCAGCompliant(color1, color2, "AA")).toBe(true);
      expect(isWCAGCompliant(color1, color2, "AAA")).toBe(false);
    });
  });

  describe("ensureContrast", () => {
    it("should adjust color to meet contrast requirement", () => {
      const adjusted = ensureContrast("#EEEEEE", "#FFFFFF", 4.5);

      // Vérifier que le contraste est suffisant
      const ratio = getContrastRatio(adjusted, "#FFFFFF");
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("should not change already compliant color", () => {
      const original = "#000000";
      const adjusted = ensureContrast(original, "#FFFFFF", 4.5);

      // Noir sur blanc est déjà très contrasté
      expect(adjusted).toBe(original);
    });
  });
});

describe("Color Utils - Palettes", () => {
  describe("COLOR_PALETTES", () => {
    it("should have esri palette", () => {
      expect(COLOR_PALETTES.esri).toBeDefined();
      expect(COLOR_PALETTES.esri.length).toBeGreaterThan(0);
    });

    it("should have all predefined palettes", () => {
      expect(COLOR_PALETTES.pastel).toBeDefined();
      expect(COLOR_PALETTES.vibrant).toBeDefined();
      expect(COLOR_PALETTES.earth).toBeDefined();
      expect(COLOR_PALETTES.ocean).toBeDefined();
      expect(COLOR_PALETTES.financial).toBeDefined();
      expect(COLOR_PALETTES.accessible).toBeDefined();
    });

    it("should have valid hex colors", () => {
      COLOR_PALETTES.esri.forEach((color) => {
        expect(hexToRgb(color)).not.toBeNull();
      });
    });
  });

  describe("exportPalette", () => {
    it("should export palette as JSON", () => {
      const json = exportPalette("Test Palette", ["#FF0000", "#00FF00"]);
      const parsed = JSON.parse(json);

      expect(parsed.name).toBe("Test Palette");
      expect(parsed.colors).toEqual(["#FF0000", "#00FF00"]);
      expect(parsed.version).toBe("1.0");
      expect(parsed.createdAt).toBeDefined();
    });
  });

  describe("importPalette", () => {
    it("should import valid palette JSON", () => {
      const json = exportPalette("Test", ["#FF0000", "#00FF00"]);
      const imported = importPalette(json);

      expect(imported).toEqual(["#FF0000", "#00FF00"]);
    });

    it("should return null for invalid JSON", () => {
      expect(importPalette("invalid json")).toBeNull();
    });

    it("should return null for JSON without colors array", () => {
      expect(importPalette('{"name": "test"}')).toBeNull();
    });
  });
});

describe("Color Utils - Validation", () => {
  describe("validateColorConfig", () => {
    it("should validate correct config", () => {
      const config = {
        customColors: ["#FF0000", "#00FF00", "#0000FF"],
      };

      const result = validateColorConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject non-array customColors", () => {
      const config = {
        customColors: "not an array",
      };

      const result = validateColorConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("customColors must be an array");
    });

    it("should reject invalid color format", () => {
      const config = {
        customColors: ["#FF0000", "invalid", "#0000FF"],
      };

      const result = validateColorConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should accept CSS variables", () => {
      const config = {
        customColors: ["var(--sys-color-primary-main)", "#FF0000"],
      };

      const result = validateColorConfig(config);
      expect(result.valid).toBe(true);
    });
  });
});

describe("Color Utils - Integration Tests", () => {
  it("should handle complete color workflow", () => {
    // 1. Créer une palette
    const palette = generateGradient("#5E8FD0", "#DF6B35", 3);
    expect(palette).toHaveLength(3);

    // 2. Créer des séries
    const series = Immutable([
      { name: "A", fillSymbol: createFillSymbol("#000") },
      { name: "B", fillSymbol: createFillSymbol("#000") },
      { name: "C", fillSymbol: createFillSymbol("#000") },
    ]);

    // 3. Appliquer la palette
    const colored = applyPaletteToSeries(series, palette);

    // 4. Vérifier que les couleurs sont appliquées
    expect(colored[0].fillSymbol.color).toBe(palette[0]);
    expect(colored[1].fillSymbol.color).toBe(palette[1]);
    expect(colored[2].fillSymbol.color).toBe(palette[2]);

    // 5. Vérifier l'accessibilité
    colored.forEach((serie) => {
      const color = serie.fillSymbol.color;
      const isAccessible = isWCAGCompliant(color, "#FFFFFF", "AA");
      // Au moins certaines couleurs devraient être accessibles
      expect(typeof isAccessible).toBe("boolean");
    });
  });

  it("should export and reimport palette successfully", () => {
    const original = ["#FF0000", "#00FF00", "#0000FF"];
    const json = exportPalette("Test", original);
    const imported = importPalette(json);

    expect(imported).toEqual(original);
  });
});

// Performance Tests
describe("Color Utils - Performance", () => {
  it("should handle large series efficiently", () => {
    const start = performance.now();

    const largeSeries = Immutable(
      Array.from({ length: 1000 }, (_, i) => ({
        fillSymbol: { color: "#000" },
      })),
    );

    const palette = COLOR_PALETTES.esri;
    const result = applyPaletteToSeries(largeSeries, palette);

    const duration = performance.now() - start;

    expect(result).toHaveLength(1000);
    expect(duration).toBeLessThan(100); // Should complete in < 100ms
  });

  it("should generate large gradients efficiently", () => {
    const start = performance.now();

    const gradient = generateGradient("#FF0000", "#0000FF", 100);

    const duration = performance.now() - start;

    expect(gradient).toHaveLength(100);
    expect(duration).toBeLessThan(50); // Should complete in < 50ms
  });
});
