/** @jsx jsx */
import { React, jsx, css, type ImmutableArray } from "jimu-core";
import { useTheme } from "jimu-theme";
import { ThemeColorPicker } from "jimu-ui/basic/color-picker";

interface SeriesColorCustomizerProps {
  series: ImmutableArray<any>;
  onSeriesColorsChange: (seriesColors: { [serieId: string]: string }) => void;
  currentSeriesColors?: { [serieId: string]: string };
}

const SeriesColorCustomizer: React.FC<SeriesColorCustomizerProps> = (props) => {
  const { series, onSeriesColorsChange, currentSeriesColors = {} } = props;
  const theme = useTheme();

  const [localColors, setLocalColors] = React.useState(currentSeriesColors);

  const handleColorChange = (serieId: string, color: string) => {
    const newColors = { ...localColors, [serieId]: color };
    setLocalColors(newColors);
    onSeriesColorsChange(newColors);
  };

  const handleResetColor = (serieId: string) => {
    const newColors = { ...localColors };
    delete newColors[serieId];
    setLocalColors(newColors);
    onSeriesColorsChange(newColors);
  };

  const containerStyle = css`
    background: ${theme.sys.color.surface.paper};
    border: 1px solid ${theme.sys.color.divider.primary};
    border-radius: 4px;
    padding: 12px;
    min-width: 280px;
    max-width: 320px;
    max-height: 400px;
    overflow-y: auto;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  `;

  const headerStyle = css`
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 12px;
    color: ${theme.sys.color.surface.paperText};
    padding-bottom: 8px;
    border-bottom: 1px solid ${theme.sys.color.divider.secondary};
  `;

  const serieItemStyle = css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px;
    margin-bottom: 8px;
    border-radius: 4px;
    background: ${theme.sys.color.surface.overlay};
    border: 1px solid ${theme.sys.color.divider.secondary};

    &:hover {
      background: ${theme.sys.color.surface.overlay};
      opacity: 0.9;
    }
  `;

  const serieInfoStyle = css`
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
  `;

  const colorPreviewStyle = (color: string) => css`
    width: 20px;
    height: 20px;
    border-radius: 3px;
    border: 1px solid ${theme.sys.color.divider.primary};
    background-color: ${color};
    flex-shrink: 0;
  `;

  const serieNameStyle = css`
    font-size: 13px;
    font-weight: 500;
    color: ${theme.sys.color.surface.paperText};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `;

  const actionsStyle = css`
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  `;

  const resetButtonStyle = css`
    padding: 2px 8px;
    font-size: 16px;
    line-height: 1;
    border: 1px solid ${theme.sys.color.divider.primary};
    background: ${theme.sys.color.surface.paper};
    color: ${theme.sys.color.surface.paperText};
    border-radius: 3px;
    cursor: pointer;
    min-width: 28px;
    transition: all 0.2s;

    &:hover {
      background: ${theme.sys.color.surface.overlay};
      border-color: ${theme.sys.color.primary.main};
    }
  `;

  // Debug: afficher le nombre de séries
  console.log(
    "SeriesColorCustomizer - Nombre de séries:",
    series?.length || 0,
    series,
  );

  // Pour les pie charts, extraire les slices
  const items = React.useMemo(() => {
    if (!series || series.length === 0) return [];

    const result = [];
    series.forEach((serie, serieIndex) => {
      // Si c'est un pie/donut chart avec des slices
      if (
        serie.type === "pieSeries" &&
        serie.slices &&
        serie.slices.length > 0
      ) {
        console.log("Pie chart détecté avec", serie.slices.length, "slices");
        serie.slices.forEach((slice, sliceIndex) => {
          result.push({
            id: slice.sliceId || `slice-${serieIndex}-${sliceIndex}`,
            name: slice.label || slice.sliceId || `Slice ${sliceIndex + 1}`,
            fillSymbol: slice.fillSymbol,
            lineSymbol: null,
            isSlice: true,
            serieIndex,
            sliceIndex,
          });
        });
      } else {
        // Séries normales (bar, line, column, etc.)
        result.push({
          id: serie.id || serie.name || `serie-${serieIndex}`,
          name: serie.name || serie.y || serie.id || `Serie ${serieIndex + 1}`,
          fillSymbol: serie.fillSymbol,
          lineSymbol: serie.lineSymbol,
          isSlice: false,
          serieIndex,
        });
      }
    });
    console.log("Items à afficher:", result.length, result);
    return result;
  }, [series]);

  if (!items || items.length === 0) {
    return (
      <div css={containerStyle}>
        <div css={headerStyle}>🎨 Personnaliser les couleurs</div>
        <div
          style={{
            padding: "16px",
            textAlign: "center",
            color: theme.sys.color.surface.paperText,
          }}
        >
          Aucune série disponible
        </div>
      </div>
    );
  }

  return (
    <div css={containerStyle}>
      <div css={headerStyle}>🎨 Personnaliser les couleurs</div>

      {items.map((item, index) => {
        const itemId = item.id;
        const itemName = item.name;
        const currentColor =
          localColors[itemId] ||
          item.fillSymbol?.color ||
          item.lineSymbol?.color ||
          "#5E8FD0";

        return (
          <div key={itemId} css={serieItemStyle}>
            <div css={serieInfoStyle}>
              <div css={colorPreviewStyle(currentColor)} />
              <span css={serieNameStyle} title={itemName}>
                {itemName}
              </span>
            </div>

            <div css={actionsStyle}>
              <ThemeColorPicker
                specificTheme={theme}
                value={currentColor}
                onChange={(color) => { handleColorChange(itemId, color) }}
              />

              {localColors[itemId] && (
                <button
                  css={resetButtonStyle}
                  title="Réinitialiser"
                  onClick={() => { handleResetColor(itemId) }}
                >
                  ↺
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SeriesColorCustomizer;
