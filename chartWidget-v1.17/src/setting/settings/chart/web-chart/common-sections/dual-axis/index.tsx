/** @jsx jsx */
/** @jsxFrag React.Fragment */
import {
  React,
  jsx,
  type ImmutableArray,
  type ImmutableObject,
  hooks,
  Immutable,
} from "jimu-core";
import { SettingRow } from "jimu-ui/advanced/setting-components";
import { Switch, Alert, Checkbox, Label, TextInput } from "jimu-ui";
import type {
  DualAxisConfig,
  WebChartSeries,
  WebChartAxis,
} from "../../../../../../config";
import { getDefaultSecondaryAxis } from "../../../../../../utils/default";
import defaultMessages from "../../../../../translations/default";

interface DualAxisSettingProps {
  dualAxisConfig?: ImmutableObject<DualAxisConfig>;
  series: ImmutableArray<WebChartSeries>;
  axes: ImmutableArray<WebChartAxis>;
  onChange?: (dualAxisConfig: ImmutableObject<DualAxisConfig>) => void;
  onAxesChange?: (axes: ImmutableArray<WebChartAxis>) => void;
}

export const DualAxisSetting = (
  props: DualAxisSettingProps,
): React.ReactElement => {
  const {
    dualAxisConfig: propDualAxisConfig,
    series,
    axes: propAxes,
    onChange,
    onAxesChange,
  } = props;

  const translate = hooks.useTranslation(defaultMessages);
  const enabled = propDualAxisConfig?.enabled ?? false;

  // Convertir ImmutableArray en array mutable pour manipulation
  const seriesIndexes: number[] = propDualAxisConfig?.seriesIndexes
    ? propDualAxisConfig.seriesIndexes.asMutable
      ? propDualAxisConfig.seriesIndexes.asMutable()
      : [...(propDualAxisConfig.seriesIndexes as any)]
    : [];

  // Nombre total de séries
  const totalSeries = series?.length ?? 0;

  // Validation: au moins une série doit rester sur l'axe primaire
  const allSeriesOnSecondary =
    seriesIndexes.length >= totalSeries && totalSeries > 0;
  const noSeriesOnSecondary = seriesIndexes.length === 0;

  const handleEnableChange = (
    evt: React.ChangeEvent<HTMLInputElement>,
  ): void => {
    const newEnabled = evt.target.checked;

    // Utiliser le pattern set() sur l'objet existant ou créer un nouveau config
    let newDualAxisConfig: ImmutableObject<DualAxisConfig>;
    if (propDualAxisConfig) {
      newDualAxisConfig = propDualAxisConfig.set("enabled", newEnabled);
    } else {
      // Première activation - créer un nouveau config
      newDualAxisConfig = {
        enabled: newEnabled,
        seriesIndexes: [],
        position: "right",
      } as any;
    }

    // Si on active la double échelle, créer le troisième axe Y
    if (newEnabled && propAxes.length === 2) {
      const secondaryAxis = getDefaultSecondaryAxis();
      const axesArray = propAxes.asMutable({ deep: true });
      axesArray.push(secondaryAxis);
      if (newDualAxisConfig.set) {
        newDualAxisConfig = newDualAxisConfig.set(
          "secondaryAxis",
          secondaryAxis as any,
        );
      }
      onAxesChange?.(axesArray as any);
    }
    // Si on désactive, supprimer le troisième axe
    else if (!newEnabled && propAxes.length === 3) {
      const newAxes = propAxes.slice(0, 2);
      onAxesChange?.(newAxes);
    }

    onChange?.(newDualAxisConfig);
  };

  const handleSeriesCheckboxChange = (
    serieIndex: number,
    isChecked: boolean,
  ): void => {
    const newSeriesIndexes = [...seriesIndexes];

    if (isChecked) {
      // Empêcher de sélectionner TOUTES les séries pour l'axe secondaire
      // Il doit rester au moins une série sur l'axe primaire
      if (newSeriesIndexes.length >= totalSeries - 1) {
        return;
      }
      if (!newSeriesIndexes.includes(serieIndex)) {
        newSeriesIndexes.push(serieIndex);
      }
    } else {
      const idx = newSeriesIndexes.indexOf(serieIndex);
      if (idx > -1) newSeriesIndexes.splice(idx, 1);
    }

    if (!propDualAxisConfig) return;
    const newDualAxisConfig = propDualAxisConfig.set(
      "seriesIndexes",
      newSeriesIndexes,
    );
    onChange?.(newDualAxisConfig);
  };

  const handleSeriesSelectChange = (values: any[]): void => {
    // Vérifier que values existe et est un tableau
    if (!values || !Array.isArray(values)) {
      // Réinitialiser à un tableau vide
      if (!propDualAxisConfig) return;
      onChange?.(propDualAxisConfig.set("seriesIndexes", Immutable([])));
      return;
    }

    // AdvancedSelect retourne seulement l'item cliqué (pas toute la liste)
    // On doit gérer l'ajout/suppression manuellement
    const clickedItem = values.find(
      (v) =>
        v != null &&
        typeof v === "object" &&
        Object.keys(v).length > 0 &&
        v.value != null,
    );

    if (!clickedItem) {
      return;
    }

    const clickedIndex = parseInt(clickedItem.value, 10);
    if (isNaN(clickedIndex)) {
      return;
    }

    // Basculer l'état de sélection
    let newSeriesIndexes: number[];
    if (seriesIndexes.includes(clickedIndex)) {
      // Désélectionner
      newSeriesIndexes = seriesIndexes.filter((idx) => idx !== clickedIndex);
    } else {
      // Sélectionner (avec validation)
      if (seriesIndexes.length >= totalSeries - 1) {
        return;
      }
      newSeriesIndexes = [...seriesIndexes, clickedIndex];
    }

    if (!propDualAxisConfig) return;
    const newDualAxisConfig = propDualAxisConfig.set(
      "seriesIndexes",
      Immutable(newSeriesIndexes),
    );
    onChange?.(newDualAxisConfig);
  };

  const [searchTerm, setSearchTerm] = React.useState<string>("");

  const handleCheckboxChange = (
    serieIndex: number,
    isChecked: boolean,
  ): void => {
    const newSeriesIndexes = [...seriesIndexes];

    if (isChecked) {
      // Empêcher de sélectionner TOUTES les séries pour l'axe secondaire
      if (newSeriesIndexes.length >= totalSeries - 1) {
        return;
      }
      if (!newSeriesIndexes.includes(serieIndex)) {
        newSeriesIndexes.push(serieIndex);
      }
    } else {
      const idx = newSeriesIndexes.indexOf(serieIndex);
      if (idx > -1) newSeriesIndexes.splice(idx, 1);
    }

    if (!propDualAxisConfig) return;
    const newDualAxisConfig = propDualAxisConfig.set(
      "seriesIndexes",
      newSeriesIndexes,
    );
    onChange?.(newDualAxisConfig);
  };

  // Créer la liste des séries disponibles en filtrant les séries invalides
  const availableSeries: Array<{ label: string; value: string }> =
    series
      ?.map((serie, index) => {
        // Filtrer les séries nulles/undefined
        if (serie == null) {
          return null;
        }

        // Filtrer les séries sans nom valide
        const name = serie.name;
        if (
          name == null ||
          name === "" ||
          (typeof name === "string" && name.toLowerCase() === "undefined")
        ) {
          return null;
        }

        // Convertir le nom en string
        const nameStr = String(name);

        return {
          label: nameStr,
          value: String(index),
        };
      })
      .filter((item): item is { label: string; value: string } => item != null)
      .asMutable() ?? [];

  const selectedValues = seriesIndexes.map(String);

  // Filtrer les séries selon le terme de recherche
  const filteredSeries = availableSeries.filter((serie) =>
    serie.label.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Calculer quelles checkboxes doivent être désactivées
  const isCheckboxDisabled = (serieIndex: number): boolean => {
    if (
      !seriesIndexes.includes(serieIndex) &&
      seriesIndexes.length >= totalSeries - 1
    ) {
      return true;
    }
    return false;
  };

  return (
    <div className="dual-axis-setting w-100">
      <SettingRow flow="wrap" level={2}>
        <div className="d-flex align-items-center w-100 justify-content-between">
          <div className="d-flex align-items-center">
            <span className="text-truncate">{translate("dualAxis")}</span>
          </div>
          <Switch
            checked={enabled}
            onChange={handleEnableChange}
            aria-label={translate("dualAxis")}
          />
        </div>
      </SettingRow>

      {enabled && (
        <>
          <SettingRow
            label={translate("secondaryAxisSeries")}
            flow="wrap"
            level={2}
          >
            {availableSeries.length === 0 ? (
              <div
                style={{
                  color: "var(--ref-palette-neutral-900)",
                  fontSize: "12px",
                  width: "100%",
                }}
              >
                Aucune série disponible
              </div>
            ) : availableSeries.length === 1 ? (
              <div
                style={{
                  color: "var(--ref-palette-neutral-900)",
                  fontSize: "12px",
                  width: "100%",
                }}
              >
                La double échelle nécessite au moins 2 séries
              </div>
            ) : (
              <div className="w-100">
                <TextInput
                  size="sm"
                  placeholder="Rechercher une série..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  prefix={<span className="jimu-icon jimu-icon-search" />}
                  allowClear
                  className="mb-2"
                />
                <div
                  style={{
                    maxHeight: "200px",
                    overflowY: "auto",
                    border: "1px solid var(--ref-palette-neutral-500)",
                    borderRadius: "2px",
                    padding: "8px",
                  }}
                >
                  {filteredSeries.length === 0 ? (
                    <div
                      style={{
                        padding: "8px",
                        color: "var(--ref-palette-neutral-700)",
                      }}
                    >
                      Aucune série trouvée
                    </div>
                  ) : (
                    filteredSeries.map((serie) => {
                      const serieIndex = parseInt(serie.value, 10);
                      const isChecked = seriesIndexes.includes(serieIndex);
                      const isDisabled = isCheckboxDisabled(serieIndex);

                      return (
                        <Label
                          key={serie.value}
                          check
                          className="d-flex align-items-center w-100 mb-1"
                          style={{
                            cursor: isDisabled ? "not-allowed" : "pointer",
                            opacity: isDisabled ? 0.5 : 1,
                          }}
                        >
                          <Checkbox
                            checked={isChecked}
                            disabled={isDisabled}
                            onChange={(e) =>
                              handleCheckboxChange(serieIndex, e.target.checked)
                            }
                          />
                          <span
                            className="ml-2 text-truncate"
                            title={serie.label}
                          >
                            {serie.label}
                          </span>
                        </Label>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </SettingRow>

          {noSeriesOnSecondary && availableSeries.length > 1 && (
            <SettingRow flow="wrap" level={2}>
              <Alert
                type="warning"
                text="Sélectionnez au moins une série pour l'axe secondaire"
                withIcon
                closable={false}
                css={{ width: "100%" }}
              />
            </SettingRow>
          )}

          {allSeriesOnSecondary && (
            <SettingRow flow="wrap" level={2}>
              <Alert
                type="error"
                text="Au moins une série doit rester sur l'axe primaire"
                withIcon
                closable={false}
                css={{ width: "100%" }}
              />
            </SettingRow>
          )}

          <SettingRow flow="wrap" level={2}>
            <div className="text-disabled w-100" style={{ fontSize: "12px" }}>
              {seriesIndexes.length} série(s) sur l'axe secondaire (droite)
              <br />
              {totalSeries - seriesIndexes.length} série(s) sur l'axe primaire
              (gauche)
            </div>
          </SettingRow>
        </>
      )}
    </div>
  );
};
