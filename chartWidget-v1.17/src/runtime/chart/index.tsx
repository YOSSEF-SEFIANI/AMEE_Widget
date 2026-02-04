import {
  React,
  hooks,
  type IMDataSourceSchema,
  Immutable,
  type QueriableDataSource,
  type IMState,
  getAppStore,
  appActions,
} from "jimu-core"
import {
  createRuntimeSplitBySeries,
  getFieldType,
  isDataSourceReady,
  normalizeRuntimeSplitBySeries,
  queryFieldUniqueValues,
  applySeriesColors,
} from "../../utils/common"
import WebChart, { type WebChartProps } from "./web-chart"
import { getSplitByField } from "jimu-ui/advanced/chart"
import FeatureLayerDataSourceManager from "./data-source"
import { useChartRuntimeState } from "../state"
import {
  useDynamicTitle,
  generateDynamicTitle,
  extractFieldAliases,
} from "../../utils/dynamic-title-utils"
import type { DynamicTitleConfig } from "../../config"

// ============================================================================
// Interface Props avec queryObject
// ============================================================================
interface ExtraProps {
  queryObject?: any
}

interface Props extends WebChartProps {
  outputDataSourceId: string
  dynamicTitleConfig?: DynamicTitleConfig
}

// ============================================================================
// Composant ChartContent (Logique principale)
// ============================================================================
const ChartContent = (
  props: Props & ExtraProps & { customColors?: string[] },
) => {
  const {
    tools,
    options,
    widgetId,
    messages,
    useDataSource,
    outputDataSourceId,
    defaultTemplateType,
    enableDataAction = true,
    webChart: propWebChart,
    onInitDragHandler,
    queryObject,
    customColors: propsCustomColors,
    dynamicTitleConfig,
  } = props

  // 1. On récupère 'records' pour savoir si on doit masquer le widget
  // 2. On récupère 'dataSource' pour lire le filtre actif
  const { chart, dataSource, queryVersion, records } = useChartRuntimeState()

  const dataSourceId = useDataSource?.dataSourceId
  const splitByField = getSplitByField(
    propWebChart?.dataSource?.query?.where,
    true,
  )
  const query = propWebChart?.dataSource?.query

  // --- LOGIQUE TITRE DYNAMIQUE (Avec configuration Settings) ---
  const baseTitle = propWebChart?.title?.content?.text || ""

  // Configuration par défaut si non définie
  const titleConfig = dynamicTitleConfig || {
    enabled: true,
    showFilters: true,
    maxFilters: 2,
    filterSeparator: ", ",
    useShortAliases: true,
    titleFormat: "narratif",
  }

  // Générer le titre dynamique seulement si activé
  const dynamicTitle = React.useMemo(() => {
    if (!titleConfig.enabled || !titleConfig.showFilters) {
      return baseTitle
    }

    if (!dataSource) {
      return baseTitle
    }

    // Extraire les alias si nécessaire
    const fieldAliases = titleConfig.useShortAliases
      ? extractFieldAliases(dataSource as QueriableDataSource)
      : {}

    // Générer le titre avec les options configurées
    return generateDynamicTitle(dataSource as QueriableDataSource, {
      baseTitle,
      includeFilters: titleConfig.showFilters,
      maxFilters: titleConfig.maxFilters || 2,
      filterSeparator: titleConfig.filterSeparator || ", ",
      fieldAliases,
      titleFormat: titleConfig.titleFormat || "simple",
      titleTemplate: titleConfig.titleTemplate,
      filterPrefix: titleConfig.filterPrefix || "",
    })
  }, [dataSource, baseTitle, queryVersion, titleConfig])

  const [splitByValues, setSplitByValues] = React.useState<{
    [field: string]: Array<string | number>
  }>()

  // Gestion des couleurs (Code existant conservé)
  const [customColors, setCustomColors] = React.useState<string[]>(() => {
    if (propsCustomColors && propsCustomColors.length > 0)
      return propsCustomColors
    if (
      propWebChart?.customColors &&
      (propWebChart.customColors as any).length > 0
    )
      return propWebChart.customColors as any
    const seriesColors = (propWebChart?.series?.[0] as any)?.colors
    if (seriesColors && seriesColors.length > 0) return seriesColors
    return undefined
  })

  hooks.useUpdateEffect(() => {
    setCustomColors(propsCustomColors)
  }, [propsCustomColors])

  // Gestion des couleurs par série avec persistance via Query Parameters
  const queryParamKey = `chartColors_${widgetId}`
  const localStorageKey = `chart-series-colors-${widgetId}`

  const [seriesColors, setSeriesColors] = React.useState<{
    [serieId: string]: string
  }>(() => {
    // 1. Essayer de charger depuis les query parameters (priorité)
    if (queryObject?.[queryParamKey]) {
      try {
        const parsed =
          typeof queryObject[queryParamKey] === "string"
            ? JSON.parse(queryObject[queryParamKey])
            : queryObject[queryParamKey]
        console.log("🎨 Couleurs restaurées depuis URL:", parsed)
        return parsed
      } catch (error) {
        console.warn("Erreur lors du parsing des couleurs depuis URL:", error)
      }
    }

    // 2. Fallback sur localStorage
    try {
      const saved = localStorage.getItem(localStorageKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        console.log("🎨 Couleurs restaurées depuis localStorage:", parsed)
        return parsed
      }
    } catch (error) {
      console.warn("Erreur lors du chargement des couleurs:", error)
    }
    return {}
  })

  const handleSeriesColorsChange = React.useCallback(
    (colors: { [serieId: string]: string }) => {
      setSeriesColors(colors)

      // Sauvegarder dans l'URL (Query Parameters)
      try {
        const currentQuery = queryObject || {}
        const newQuery = {
          ...currentQuery,
          [queryParamKey]: JSON.stringify(colors),
        }

        getAppStore().dispatch(appActions.urlQueryChanged(newQuery, widgetId))
        console.log("✅ Couleurs sauvegardées dans l'URL")
      } catch (error) {
        console.warn("Erreur lors de la sauvegarde dans l'URL:", error)
      }

      // Backup dans localStorage
      try {
        localStorage.setItem(localStorageKey, JSON.stringify(colors))
      } catch (error) {
        console.warn("Erreur localStorage:", error)
      }
    },
    [queryObject, queryParamKey, widgetId, localStorageKey],
  )

  const splitByFieldRef = hooks.useLatest(splitByField)

  React.useEffect(() => {
    if (splitByField && isDataSourceReady(dataSource)) {
      queryFieldUniqueValues(
        dataSource as QueriableDataSource,
        splitByField,
      ).then((values) => {
        setSplitByValues({ [splitByField]: values })
      })
    }
  }, [splitByField, queryVersion, dataSource])

  const series = React.useMemo(() => {
    if (!propWebChart?.series) return Immutable([])

    let finalSeries
    if (splitByFieldRef.current && splitByValues?.[splitByFieldRef.current]) {
      const splitByFieldType = getFieldType(
        splitByFieldRef.current,
        dataSourceId,
      )
      finalSeries = Immutable(
        createRuntimeSplitBySeries(
          propWebChart.series,
          query,
          splitByFieldType,
          splitByValues[splitByFieldRef.current],
        ),
      )
    } else {
      finalSeries = normalizeRuntimeSplitBySeries(propWebChart?.series)
    }

    // Appliquer les couleurs personnalisées par série si elles existent
    if (Object.keys(seriesColors).length > 0) {
      finalSeries = finalSeries.map((serie, index) => {
        // Pour les pie charts, appliquer les couleurs aux slices
        if (serie.type === "pieSeries" && serie.slices) {
          let updatedSerie = serie
          serie.slices.forEach((slice, sliceIndex) => {
            const sliceId = slice.sliceId || `slice-${index}-${sliceIndex}`
            const customColor = seriesColors[sliceId]

            if (customColor) {
              updatedSerie = updatedSerie.setIn(
                ["slices", sliceIndex, "fillSymbol", "color"],
                customColor,
              )
            }
          })
          return updatedSerie
        } else {
          // Pour les autres types de séries (bar, line, column, etc.)
          const serieId = serie.id || serie.name || `serie-${index}`
          const customColor = seriesColors[serieId]

          if (customColor) {
            // Appliquer la couleur personnalisée selon le type de symbole
            if (serie.fillSymbol) {
              return serie.setIn(["fillSymbol", "color"], customColor)
            } else if (serie.lineSymbol) {
              return serie.setIn(["lineSymbol", "color"], customColor)
            }
          }
        }
        return serie
      })
    }

    return finalSeries
  }, [
    dataSourceId,
    splitByFieldRef,
    splitByValues,
    propWebChart?.series,
    query,
    seriesColors,
  ])

  const handleSchemaChange = (schema: IMDataSourceSchema) => {
    if (!schema) return
    chart?.refresh({ updateData: false, resetAxesBounds: false })
  }

  // Construction de la config webChart
  const webChart = React.useMemo(() => {
    if (!propWebChart) return null

    let wc = propWebChart.set("series", series)

    // Application du Titre Dynamique calculé plus haut
    if (dynamicTitle && wc) {
      // Mise à jour sécurisée du texte du titre
      wc = wc.setIn(["title", "content", "text"], dynamicTitle)
      wc = wc.setIn(["title", "visible"], true)
    }

    // Convertir seriesColors (format category-X) en customColors array pour bar/column charts
    if (Object.keys(seriesColors).length > 0) {
      // Trouver les clés de catégorie et les trier par index
      const categoryKeys = Object.keys(seriesColors)
        .filter((key) => key.startsWith("category-"))
        .sort((a, b) => {
          const indexA = parseInt(a.replace("category-", ""), 10)
          const indexB = parseInt(b.replace("category-", ""), 10)
          return indexA - indexB
        })

      if (categoryKeys.length > 0) {
        // Créer le tableau de couleurs personnalisées
        const categoryColors = categoryKeys.map((key) => seriesColors[key])
        wc = wc.set("customColors", categoryColors)
        wc = wc.set("colorMatch", false)
        console.log("🎨 customColors appliqué pour bar chart:", categoryColors)
      }
    }

    return wc
  }, [propWebChart, series, dynamicTitle, seriesColors])

  // --- LOGIQUE MASQUER LE WIDGET ---
  // Si la dataSource est chargée mais qu'il n'y a pas d'enregistrements (0 records)
  // On retourne null pour rendre le widget invisible.
  if (dataSource && records && records.length === 0) {
    console.log("🙈 [ChartContent] Aucun résultat -> Widget masqué")
    return null
  }

  return (
    <>
      <FeatureLayerDataSourceManager
        widgetId={widgetId}
        webChart={webChart}
        outputDataSourceId={outputDataSourceId}
        useDataSource={useDataSource}
        splitByValues={splitByValues}
        onSchemaChange={handleSchemaChange}
      />
      <WebChart
        widgetId={widgetId}
        messages={messages}
        useDataSource={useDataSource}
        webChart={webChart}
        tools={tools}
        options={options}
        defaultTemplateType={defaultTemplateType}
        enableDataAction={enableDataAction}
        onInitDragHandler={onInitDragHandler}
        onColorChange={setCustomColors}
        onSeriesColorsChange={handleSeriesColorsChange}
        currentSeriesColors={seriesColors}
      />
    </>
  )
}

// ============================================================================
// Composant principal avec mapExtraStateProps
// ============================================================================
const Chart = (props: Props & ExtraProps) => {
  const { webChart, dynamicTitleConfig } = props
  const customColors = webChart?.customColors

  return (
    <ChartContent
      {...props}
      customColors={customColors}
      dynamicTitleConfig={dynamicTitleConfig}
    />
  )
}

// Mapper queryObject depuis le state global
Chart.mapExtraStateProps = (state: IMState): ExtraProps => {
  return {
    queryObject: state.queryObject,
  }
}

export default Chart
