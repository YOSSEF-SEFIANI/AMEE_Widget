import {
  React,
  Immutable,
  QueryScope,
  type IMFeatureLayerQueryParams,
  type QueriableDataSource,
  type ImmutableArray,
  type ImmutableObject,
} from "jimu-core";
import type {
  ISimpleLineSymbol,
  WebChartPieChartSlice,
} from "jimu-ui/advanced/chart";
import { getFillSymbol } from "../../../../../../../utils/default";

export const convertStripColors = (colors: string[]) => {
  return colors.map((color) => ({
    label: color,
    value: color,
    color: color,
  }));
};

export const applyPieSlicesColors = (
  propSlices: ImmutableArray<WebChartPieChartSlice>,
  colors: string[],
): ImmutableArray<WebChartPieChartSlice> => {
  if (!colors) return;
  const slices = propSlices?.map((slice, index) => {
    const color = getNextColor(colors, index);
    slice = slice.setIn(["fillSymbol", "color"], color);
    return slice as any;
  });
  return slices;
};

export const applyPieSlicesOutline = (
  propSlices: ImmutableArray<WebChartPieChartSlice>,
  outline: ImmutableObject<ISimpleLineSymbol>,
): ImmutableArray<WebChartPieChartSlice> => {
  if (!outline) return;
  const slices = propSlices?.map((slice) => {
    slice = slice.setIn(["fillSymbol", "outline"], outline);
    return slice as any;
  });
  return slices;
};

export const getNextColor = (colors: string[], index: number = 0): string => {
  if (!colors?.length) return;
  const idx = index % colors.length;
  const color = colors[idx];
  return color;
};

export const getPieSlice = (
  index: number,
  colors: string[],
  value: string,
  outline?: ImmutableObject<ISimpleLineSymbol>,
): WebChartPieChartSlice => {
  const fillColor = getNextColor(colors, index);
  const fillSymbol = getFillSymbol(fillColor, 0);
  if (outline) {
    fillSymbol.outline = outline as any;
  }
  return { sliceId: value, label: value, fillSymbol };
};

export const getByFieldPieSlices = (
  numericFields: ImmutableArray<string>,
  colors: string[],
  outline: ImmutableObject<ISimpleLineSymbol>,
): ImmutableArray<WebChartPieChartSlice> => {
  const slices = numericFields
    .filter((field) => !!field)
    .map((field, index) => {
      const slice = getPieSlice(index, colors, field, outline);
      return slice;
    });
  return slices;
};

export type LoadSlices = (
  count: number,
  outline?: ImmutableObject<ISimpleLineSymbol>,
) => Promise<{
  value: ImmutableArray<WebChartPieChartSlice>;
  loadout: boolean;
  exceed: boolean;
}>;
const defaultPieSlices = Immutable([]) as ImmutableArray<WebChartPieChartSlice>;
export const useLoadingPieSlices = (
  dataSource: QueriableDataSource,
  query: IMFeatureLayerQueryParams,
  orderByFields: ImmutableArray<string>,
  propSlices: ImmutableArray<WebChartPieChartSlice> = defaultPieSlices,
  colors: string[],
  numberLimit: number = 50,
): [LoadSlices, boolean] => {
  const recordNumberRef = React.useRef(0);
  const numberPerLoadRef = React.useRef(0);

  const [loading, setLoading] = React.useState(false);

  const categoryField = query?.groupByFieldsForStatistics?.[0] ?? "";
  let queryParams = query;
  if (orderByFields?.length) {
    queryParams = queryParams.set("orderByFields", orderByFields);
  }

  const loadSlices = (
    count: number,
    outline?: ImmutableObject<ISimpleLineSymbol>,
  ) => {
    const exceed = propSlices.length >= numberLimit;
    if (exceed)
      return Promise.resolve({
        value: propSlices,
        loadout: false,
        exceed: true,
      });

    // ✅ Fix ExB bug: Vérifier que dataSource existe avant de charger
    if (!dataSource) {
      console.warn("⚠️ [ColorLoader] DataSource not ready yet");
      return Promise.resolve({
        value: propSlices,
        loadout: false,
        exceed: false,
      });
    }

    // ✅ Fix ExB bug: Vérifier que categoryField existe
    if (!categoryField) {
      console.warn("⚠️ [ColorLoader] No category field defined");
      return Promise.resolve({
        value: propSlices,
        loadout: false,
        exceed: false,
      });
    }

    // ✅ Fix ExB bug: Vérifier que queryParams existe
    if (!queryParams) {
      console.warn("⚠️ [ColorLoader] No query params defined");
      return Promise.resolve({
        value: propSlices,
        loadout: false,
        exceed: false,
      });
    }

    setLoading(true);
    return dataSource
      .query(queryParams, { scope: QueryScope.InConfigView })
      .then(
        (result) => {
          const records = result.records;
          let slices = propSlices;
          records.some((record) => {
            recordNumberRef.current++;

            // ✅ Fix: Utiliser getData() pour accéder aux attributs complets
            const data = record.getData();
            // ✅ Fix: Chercher le label de domaine si présent (pour les coded values)
            let value = data?.[categoryField];
            let label = value;

            // Si c'est un champ avec domaine, utiliser le label au lieu de l'ID
            if (
              data?.arcgis_charts_type_domain_field_name === categoryField &&
              data?.arcgis_charts_type_domain_id_label != null
            ) {
              label = data.arcgis_charts_type_domain_id_label;
            }

            // ✅ Fix: Ignorer les valeurs null/undefined
            if (value == null) {
              return false;
            }

            const sliceId = String(value);
            // ✅ Fix: S'assurer que le label n'est jamais null/undefined
            const sliceLabel =
              label != null && String(label).trim() !== ""
                ? String(label)
                : sliceId;

            const existed = !!slices.find((slice) => slice.sliceId === sliceId);
            if (existed) {
              return false;
            }

            // ✅ Fix: Utiliser le label au lieu de sliceId pour l'affichage
            const slice = getPieSlice(
              numberPerLoadRef.current,
              colors,
              sliceId,
              outline,
            );
            const sliceWithLabel = Immutable(slice).set(
              "label",
              sliceLabel,
            ) as any;

            slices = slices.concat(sliceWithLabel);
            numberPerLoadRef.current++;
            return numberPerLoadRef.current >= count;
          });
          const loadout = recordNumberRef.current >= records.length;
          const exceed = Object.keys(slices).length >= numberLimit;
          recordNumberRef.current = 0;
          numberPerLoadRef.current = 0;
          setLoading(false);

          return { value: slices, loadout, exceed };
        },
        (error) => {
          console.error("❌ [ColorLoader] Query failed:", error);
          setLoading(false);
          return { value: propSlices, loadout: false, exceed: false };
        },
      );
  };

  return [loadSlices, loading];
};
