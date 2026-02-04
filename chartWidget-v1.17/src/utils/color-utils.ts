/**
 * Collection d'Exemples de Code - Personnalisation des Couleurs
 * Chart Widget - ArcGIS Experience Builder 1.19
 *
 * Ce fichier contient des snippets de code réutilisables suivant
 * les bonnes pratiques Esri/ArcGIS.
 */

import {
  React,
  Immutable,
  type ImmutableObject,
  type ImmutableArray,
} from "jimu-core";
import { useTheme2 } from "jimu-theme";
import { ThemeColorPicker } from "jimu-ui/basic/color-picker";
import type {
  ISimpleFillSymbol,
  ISimpleLineSymbol,
} from "jimu-ui/advanced/chart";

// ============================================================================
// EXEMPLE 1 : Helper Functions pour les Couleurs
// ============================================================================

/**
 * Convertit une couleur RGB en format hex
 * @example rgbToHex(255, 0, 0) => '#FF0000'
 */
export const rgbToHex = (r: number, g: number, b: number): string => {
  return (
    "#" +
    [r, g, b]
      .map((x) => {
        const hex = x.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
      })
      .join("")
  );
};

/**
 * Convertit une couleur hex en RGB
 * @example hexToRgb('#FF0000') => [255, 0, 0]
 */
export const hexToRgb = (hex: string): [number, number, number] | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
      ]
    : null;
};

/**
 * Éclaircit une couleur d'un certain pourcentage
 * @example lightenColor('#5E8FD0', 20) => '#88ADE0'
 */
export const lightenColor = (color: string, percent: number): string => {
  const rgb = hexToRgb(color);
  if (!rgb) return color;

  const [r, g, b] = rgb;
  const amount = Math.round(2.55 * percent);

  return rgbToHex(
    Math.min(255, r + amount),
    Math.min(255, g + amount),
    Math.min(255, b + amount),
  );
};

/**
 * Assombrit une couleur d'un certain pourcentage
 */
export const darkenColor = (color: string, percent: number): string => {
  const rgb = hexToRgb(color);
  if (!rgb) return color;

  const [r, g, b] = rgb;
  const amount = Math.round(2.55 * percent);

  return rgbToHex(
    Math.max(0, r - amount),
    Math.max(0, g - amount),
    Math.max(0, b - amount),
  );
};

/**
 * Génère une palette de dégradé entre deux couleurs
 * @example generateGradient('#FF0000', '#0000FF', 5)
 */
export const generateGradient = (
  startColor: string,
  endColor: string,
  steps: number,
): string[] => {
  const start = hexToRgb(startColor);
  const end = hexToRgb(endColor);

  if (!start || !end) return [];

  const colors: string[] = [];

  for (let i = 0; i < steps; i++) {
    const ratio = i / (steps - 1);
    const r = Math.round(start[0] + (end[0] - start[0]) * ratio);
    const g = Math.round(start[1] + (end[1] - start[1]) * ratio);
    const b = Math.round(start[2] + (end[2] - start[2]) * ratio);
    colors.push(rgbToHex(r, g, b));
  }

  return colors;
};

// ============================================================================
// EXEMPLE 2 : Palette de Couleurs Prédéfinies
// ============================================================================

/**
 * Palettes de couleurs professionnelles
 */
export const COLOR_PALETTES = {
  esri: [
    "#5E8FD0",
    "#77B484",
    "#DF6B35",
    "#DBCF4E",
    "#41546D",
    "#8257C2",
    "#D6558B",
    "#B40A1B",
    "#E60000",
    "#FF7F00",
  ],

  pastel: [
    "#FFB3BA",
    "#FFDFBA",
    "#FFFFBA",
    "#BAFFC9",
    "#BAE1FF",
    "#C9C9FF",
    "#FFBAF3",
    "#D4A5A5",
    "#FFD8B1",
    "#E2F0CB",
  ],

  vibrant: [
    "#FF6B6B",
    "#4ECDC4",
    "#45B7D1",
    "#FFA07A",
    "#98D8C8",
    "#FEE440",
    "#9B59B6",
    "#E74C3C",
    "#3498DB",
    "#2ECC71",
  ],

  earth: [
    "#8B4513",
    "#CD853F",
    "#DEB887",
    "#F4A460",
    "#D2691E",
    "#BC8F8F",
    "#A0522D",
    "#B8860B",
    "#DAA520",
    "#F5DEB3",
  ],

  ocean: [
    "#003366",
    "#006699",
    "#0099CC",
    "#00CCFF",
    "#33CCCC",
    "#66CCCC",
    "#99CCCC",
    "#CCE6F0",
    "#006666",
    "#009999",
  ],

  // Palette pour données financières
  financial: {
    positive: "#27AE60", // Vert
    negative: "#E74C3C", // Rouge
    neutral: "#95A5A6", // Gris
    warning: "#F39C12", // Orange
    info: "#3498DB", // Bleu
  },

  // Palette accessible (WCAG AA)
  accessible: [
    "#005A9C",
    "#C85200",
    "#007A33",
    "#8B008B",
    "#B8860B",
    "#DC143C",
    "#008B8B",
    "#483D8B",
    "#B22222",
    "#2F4F4F",
  ],
};

// ============================================================================
// EXEMPLE 3 : Composant React - Sélecteur de Couleur Avancé
// ============================================================================
// NOTE : Ce composant nécessite un fichier .tsx séparé pour le JSX
// Pour l'utiliser, créez un fichier ColorPickerWithPresets.tsx avec le code ci-dessous

/*
interface ColorPickerWithPresetsProps {
  value: string
  onChange: (color: string) => void
  label?: string
  showPresets?: boolean
  palette?: string[]
}

export const ColorPickerWithPresets: React.FC<ColorPickerWithPresetsProps> = ({
  value,
  onChange,
  label = 'Color',
  showPresets = true,
  palette = COLOR_PALETTES.esri
}) => {
  const theme = useTheme2()
  
  const presetColors = palette.map(color => ({
    label: color,
    value: color,
    color: color
  }))
  
  return (
    <div className="color-picker-with-presets">
      {label && <label>{label}</label>}
      
      <ThemeColorPicker
        specificTheme={theme}
        value={value}
        onChange={onChange}
        presetColors={showPresets ? presetColors : undefined}
        aria-label={label}
      />
      
      {showPresets && (
        <div className="preset-swatches mt-2">
          {palette.map((color, idx) => (
            <button
              key={idx}
              className="swatch"
              style={{
                backgroundColor: color,
                width: 24,
                height: 24,
                border: value === color ? '2px solid #000' : '1px solid #ccc',
                borderRadius: 4,
                cursor: 'pointer'
              }}
              onClick={() => onChange(color)}
              aria-label={`Select color ${color}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
*/

// ============================================================================
// EXEMPLE 4 : Application de Couleurs aux Séries
// ============================================================================

/**
 * Applique une palette de couleurs à un tableau de séries
 */
export const applyPaletteToSeries = <T extends { fillSymbol?: any }>(
  series: ImmutableArray<T>,
  palette: string[],
): ImmutableArray<T> => {
  if (!palette || palette.length === 0) return series;

  return series.map((serie, index) => {
    const color = palette[index % palette.length];

    if (serie.fillSymbol) {
      return Immutable.setIn(serie, ["fillSymbol", "color"], color);
    }

    return serie;
  }) as ImmutableArray<T>;
};

/**
 * Applique des couleurs basées sur des valeurs (heatmap)
 */
export const applyValueBasedColors = <T extends { fillSymbol?: any }>(
  series: ImmutableArray<T>,
  values: number[],
  minColor: string = "#00FF00", // Vert
  maxColor: string = "#FF0000", // Rouge
): ImmutableArray<T> => {
  const min = Math.min(...values);
  const max = Math.max(...values);

  return series.map((serie, index) => {
    const value = values[index];
    const ratio = (value - min) / (max - min);

    const startRgb = hexToRgb(minColor)!;
    const endRgb = hexToRgb(maxColor)!;

    const r = Math.round(startRgb[0] + (endRgb[0] - startRgb[0]) * ratio);
    const g = Math.round(startRgb[1] + (endRgb[1] - startRgb[1]) * ratio);
    const b = Math.round(startRgb[2] + (endRgb[2] - startRgb[2]) * ratio);

    const color = rgbToHex(r, g, b);

    return Immutable.setIn(serie, ["fillSymbol", "color"], color);
  }) as ImmutableArray<T>;
};

// ============================================================================
// EXEMPLE 5 : Gestion des Symboles (FillSymbol, LineSymbol)
// ============================================================================

/**
 * Crée un FillSymbol avec couleur et bordure
 */
export const createFillSymbol = (
  fillColor: string,
  outlineColor: string = "#808080",
  outlineWidth: number = 1,
): ImmutableObject<ISimpleFillSymbol> => {
  return Immutable({
    type: "esriSFS",
    color: fillColor,
    outline: {
      type: "esriSLS",
      color: outlineColor,
      width: outlineWidth,
      style: "solid",
    },
  });
};

/**
 * Crée un LineSymbol pour les graphiques linéaires
 */
export const createLineSymbol = (
  color: string,
  width: number = 2,
  style: "solid" | "dash" | "dot" = "solid",
): ImmutableObject<ISimpleLineSymbol> => {
  return Immutable({
    type: "esriSLS",
    color,
    width,
    style,
  });
};

/**
 * Met à jour uniquement la couleur d'un symbole existant
 */
export const updateSymbolColor = <
  T extends ISimpleFillSymbol | ISimpleLineSymbol,
>(
  symbol: ImmutableObject<T>,
  newColor: string,
): ImmutableObject<T> => {
  return symbol.set("color", newColor);
};

// ============================================================================
// EXEMPLE 6 : Hook React personnalisé pour la gestion des couleurs
// ============================================================================

interface UseSeriesColorsOptions {
  initialPalette?: string[];
  autoApply?: boolean;
}

export const useSeriesColors = (
  series: ImmutableArray<any>,
  options: UseSeriesColorsOptions = {},
) => {
  const { initialPalette = COLOR_PALETTES.esri, autoApply = true } = options;

  const [palette, setPalette] = React.useState<string[]>(initialPalette);

  const coloredSeries = React.useMemo(() => {
    if (!autoApply) return series;
    return applyPaletteToSeries(series, palette);
  }, [series, palette, autoApply]);

  const updateColor = React.useCallback(
    (index: number, color: string) => {
      const newPalette = [...palette];
      newPalette[index] = color;
      setPalette(newPalette);
    },
    [palette],
  );

  const resetColors = React.useCallback(() => {
    setPalette(initialPalette);
  }, [initialPalette]);

  return {
    palette,
    coloredSeries,
    updateColor,
    resetColors,
    setPalette,
  };
};

// ============================================================================
// EXEMPLE 7 : Validation et Accessibilité
// ============================================================================

/**
 * Calcule le ratio de contraste entre deux couleurs (WCAG)
 */
export const getContrastRatio = (color1: string, color2: string): number => {
  const getLuminance = (hex: string): number => {
    const rgb = hexToRgb(hex);
    if (!rgb) return 0;

    const [r, g, b] = rgb.map((val) => {
      const v = val / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);

  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);

  return (brightest + 0.05) / (darkest + 0.05);
};

/**
 * Vérifie si le contraste respecte WCAG AA (4.5:1)
 */
export const isWCAGCompliant = (
  foreground: string,
  background: string,
  level: "AA" | "AAA" = "AA",
): boolean => {
  const ratio = getContrastRatio(foreground, background);
  return level === "AA" ? ratio >= 4.5 : ratio >= 7;
};

/**
 * Ajuste automatiquement une couleur pour respecter le contraste minimum
 */
export const ensureContrast = (
  color: string,
  background: string,
  minRatio: number = 4.5,
): string => {
  let adjustedColor = color;
  let attempts = 0;
  const maxAttempts = 50;

  while (
    getContrastRatio(adjustedColor, background) < minRatio &&
    attempts < maxAttempts
  ) {
    // Assombrir ou éclaircir selon la luminosité du fond
    const bgLum = hexToRgb(background);
    const isLightBg = bgLum
      ? (bgLum[0] + bgLum[1] + bgLum[2]) / 3 > 127
      : false;

    adjustedColor = isLightBg
      ? darkenColor(adjustedColor, 5)
      : lightenColor(adjustedColor, 5);

    attempts++;
  }

  return adjustedColor;
};

// ============================================================================
// EXEMPLE 8 : Export/Import de Palettes
// ============================================================================

/**
 * Exporte une palette au format JSON
 */
export const exportPalette = (name: string, colors: string[]): string => {
  const palette = {
    name,
    colors,
    version: "1.0",
    createdAt: new Date().toISOString(),
  };
  return JSON.stringify(palette, null, 2);
};

/**
 * Importe une palette depuis JSON
 */
export const importPalette = (json: string): string[] | null => {
  try {
    const palette = JSON.parse(json);
    if (Array.isArray(palette.colors)) {
      return palette.colors;
    }
    return null;
  } catch (error) {
    console.error("Failed to import palette:", error);
    return null;
  }
};

// ============================================================================
// EXEMPLE 9 : Gestion d'État avec Context (Pattern avancé)
// ============================================================================
// NOTE : Ces composants nécessitent un fichier .tsx séparé pour le JSX
// Pour les utiliser, créez un fichier ColorContext.tsx avec le code ci-dessous

/*
interface ColorContextValue {
  palette: string[]
  setPalette: (colors: string[]) => void
  applyToPalette: <T>(series: ImmutableArray<T>) => ImmutableArray<T>
}

export const ColorContext = React.createContext<ColorContextValue | null>(null)

export const ColorProvider: React.FC<{
  initialPalette?: string[]
  children: React.ReactNode
}> = ({ initialPalette = COLOR_PALETTES.esri, children }) => {
  const [palette, setPalette] = React.useState(initialPalette)
  
  const applyToPalette = React.useCallback(<T,>(series: ImmutableArray<T>) => {
    return applyPaletteToSeries(series, palette)
  }, [palette])
  
  const value = React.useMemo(() => ({
    palette,
    setPalette,
    applyToPalette
  }), [palette, applyToPalette])
  
  return (
    <ColorContext.Provider value={value}>
      {children}
    </ColorContext.Provider>
  )
}

export const useColorPalette = () => {
  const context = React.useContext(ColorContext)
  if (!context) {
    throw new Error('useColorPalette must be used within ColorProvider')
  }
  return context
}
*/

// ============================================================================
// EXEMPLE 10 : Utilitaires de Test
// ============================================================================

/**
 * Génère des données de test avec couleurs
 */
export const generateTestSeries = (count: number = 5) => {
  return Array.from({ length: count }, (_, i) => ({
    name: `Série ${i + 1}`,
    value: Math.random() * 100,
    fillSymbol: createFillSymbol(
      COLOR_PALETTES.esri[i % COLOR_PALETTES.esri.length],
    ),
  }));
};

/**
 * Valide une configuration de couleur
 */
export const validateColorConfig = (
  config: any,
): {
  valid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];

  if (config.customColors) {
    if (!Array.isArray(config.customColors)) {
      errors.push("customColors must be an array");
    } else {
      config.customColors.forEach((color: any, index: number) => {
        if (typeof color !== "string") {
          errors.push(`Color at index ${index} must be a string`);
        } else if (!hexToRgb(color) && !color.startsWith("var(")) {
          errors.push(`Invalid color format at index ${index}: ${color}`);
        }
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export default {
  // Helpers
  rgbToHex,
  hexToRgb,
  lightenColor,
  darkenColor,
  generateGradient,

  // Palettes
  COLOR_PALETTES,

  // Application
  applyPaletteToSeries,
  applyValueBasedColors,

  // Symboles
  createFillSymbol,
  createLineSymbol,
  updateSymbolColor,

  // Accessibilité
  getContrastRatio,
  isWCAGCompliant,
  ensureContrast,

  // Import/Export
  exportPalette,
  importPalette,

  // Tests
  generateTestSeries,
  validateColorConfig,
};
