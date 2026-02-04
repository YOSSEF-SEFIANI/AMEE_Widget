import { React, type QueriableDataSource } from "jimu-core"

/**
 * Interface pour un filtre parsé depuis une clause WHERE SQL
 */
export interface ParsedFilter {
  field: string
  operator: string
  value: string | number
  displayValue?: string
}

/**
 * Interface pour les options de génération de titre
 */
export interface DynamicTitleOptions {
  baseTitle: string
  includeFilters?: boolean
  filterPrefix?: string
  filterSeparator?: string
  maxFilters?: number
  fieldAliases?: { [fieldName: string]: string }
  titleTemplate?: string
  titleFormat?: "simple" | "descriptif" | "complet" | "narratif"
}

/**
 * Parse une clause WHERE SQL pour extraire les filtres
 * Supporte les opérateurs: =, !=, >, <, >=, <=, LIKE, IN, BETWEEN
 *
 * @param whereClause - La clause WHERE SQL (ex: "Type_Traitement='Depth Migration' AND Annee_Acquisition=2013")
 * @returns Tableau de filtres parsés
 */
export function parseWhereClause(whereClause: string): ParsedFilter[] {
  if (!whereClause || whereClause === "1=1") {
    return []
  }

  const filters: ParsedFilter[] = []

  // Nettoyer la clause
  const cleanWhere = whereClause.trim()

  // Pattern pour différents types de filtres SQL
  const patterns = [
    // field = 'string' ou field = number
    {
      regex: /(\w+)\s*=\s*'([^']*)'/g,
      handler: (match: RegExpExecArray) => ({
        field: match[1],
        operator: "=",
        value: match[2],
        displayValue: match[2],
      }),
    },
    {
      regex: /(\w+)\s*=\s*(\d+)/g,
      handler: (match: RegExpExecArray) => ({
        field: match[1],
        operator: "=",
        value: parseInt(match[2]),
        displayValue: match[2],
      }),
    },
    // field != 'string'
    {
      regex: /(\w+)\s*!=\s*'([^']*)'/g,
      handler: (match: RegExpExecArray) => ({
        field: match[1],
        operator: "!=",
        value: match[2],
        displayValue: `≠ ${match[2]}`,
      }),
    },
    // field > number ou >= number
    {
      regex: /(\w+)\s*>=\s*(\d+)/g,
      handler: (match: RegExpExecArray) => ({
        field: match[1],
        operator: ">=",
        value: parseInt(match[2]),
        displayValue: `≥ ${match[2]}`,
      }),
    },
    {
      regex: /(\w+)\s*>\s*(\d+)/g,
      handler: (match: RegExpExecArray) => ({
        field: match[1],
        operator: ">",
        value: parseInt(match[2]),
        displayValue: `> ${match[2]}`,
      }),
    },
    // field < number ou <= number
    {
      regex: /(\w+)\s*<=\s*(\d+)/g,
      handler: (match: RegExpExecArray) => ({
        field: match[1],
        operator: "<=",
        value: parseInt(match[2]),
        displayValue: `≤ ${match[2]}`,
      }),
    },
    {
      regex: /(\w+)\s*<\s*(\d+)/g,
      handler: (match: RegExpExecArray) => ({
        field: match[1],
        operator: "<",
        value: parseInt(match[2]),
        displayValue: `< ${match[2]}`,
      }),
    },
    // field LIKE '%value%'
    {
      regex: /(\w+)\s+LIKE\s+'%([^%]*)%'/gi,
      handler: (match: RegExpExecArray) => ({
        field: match[1],
        operator: "LIKE",
        value: match[2],
        displayValue: `contient "${match[2]}"`,
      }),
    },
    // field IN ('val1', 'val2', ...)
    {
      regex: /(\w+)\s+IN\s*\(([^)]+)\)/gi,
      handler: (match: RegExpExecArray) => {
        const values = match[2]
          .split(",")
          .map((v) => v.trim().replace(/'/g, ""))
        return {
          field: match[1],
          operator: "IN",
          value: values.join(", "),
          displayValue: `dans [${values.join(", ")}]`,
        }
      },
    },
    // field BETWEEN val1 AND val2
    {
      regex: /(\w+)\s+BETWEEN\s+(\d+)\s+AND\s+(\d+)/gi,
      handler: (match: RegExpExecArray) => ({
        field: match[1],
        operator: "BETWEEN",
        value: `${match[2]}-${match[3]}`,
        displayValue: `entre ${match[2]} et ${match[3]}`,
      }),
    },
  ]

  // Appliquer chaque pattern
  for (const pattern of patterns) {
    let match: RegExpExecArray | null
    while ((match = pattern.regex.exec(cleanWhere)) !== null) {
      try {
        const filter = pattern.handler(match)
        // Éviter les doublons (un filtre peut matcher plusieurs patterns)
        if (!filters.find((f) => f.field === filter.field)) {
          filters.push(filter)
        }
      } catch (error) {
        console.warn(
          `[parseWhereClause] Erreur lors du parsing du filtre:`,
          match,
          error,
        )
      }
    }
  }

  return filters
}

/**
 * Génère un titre formaté selon le template et les filtres
 */
function buildFormattedTitle(
  baseTitle: string,
  filters: ParsedFilter[],
  options: DynamicTitleOptions,
): string {
  const {
    titleTemplate,
    titleFormat = "simple",
    fieldAliases = {},
    filterSeparator = ", ",
    maxFilters = 3,
  } = options

  // Si un template personnalisé est fourni
  if (titleTemplate) {
    let result = titleTemplate

    // Remplacer {baseTitle}
    result = result.replace(/\{baseTitle\}/g, baseTitle)

    // Remplacer {filters} par la liste des filtres
    const filterTexts = filters.slice(0, maxFilters).map((f) => {
      const fieldName = fieldAliases[f.field] || f.field
      return `${fieldName}: ${f.displayValue || f.value}`
    })
    result = result.replace(/\{filters\}/g, filterTexts.join(filterSeparator))

    // Remplacer {field:nom_du_champ} par la valeur du filtre
    filters.forEach((filter) => {
      const regex = new RegExp(`\\{field:${filter.field}\\}`, "g")
      result = result.replace(regex, String(filter.value))
    })

    return result
  }

  // Format prédéfini selon titleFormat
  switch (titleFormat) {
    case "descriptif": {
      // Format : "Répartition par {field1}, et par {field2}"
      const fields = filters
        .slice(0, maxFilters)
        .map((f) => fieldAliases[f.field] || f.field)
        .join(", et par ")

      if (fields) {
        return `Répartition par ${fields}`
      }
      return baseTitle
    }

    case "complet": {
      // Format : "Répartition par {field1}, et par {field2} ({field1}: {value1}, {field2}: {value2})"
      const fields = filters
        .slice(0, maxFilters)
        .map((f) => fieldAliases[f.field] || f.field)
        .join(", et par ")

      const values = filters.slice(0, maxFilters).map((f) => {
        const fieldName = fieldAliases[f.field] || f.field
        return `${fieldName}: ${f.displayValue || f.value}`
      })

      if (fields && values.length > 0) {
        return `Répartition par ${fields} (${values.join(filterSeparator)})`
      }
      return baseTitle
    }

    case "narratif": {
      // Format : "Répartition par {field1} au niveau {value1} et par {field2} sélectionnée {value2}"
      const parts: string[] = []

      filters.slice(0, maxFilters).forEach((filter, index) => {
        const fieldName = fieldAliases[filter.field] || filter.field
        const value = filter.displayValue || filter.value

        if (index === 0) {
          parts.push(`${fieldName} au niveau ${value}`)
        } else {
          parts.push(`${fieldName} sélectionnée ${value}`)
        }
      })

      if (parts.length > 0) {
        return `Répartition par ${parts.join(" et par ")}`
      }
      return baseTitle
    }

    case "simple":
    // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
    default: {
      // Format simple : "Titre de base (Field1: Value1, Field2: Value2)"
      return baseTitle
    }
  }
}

/**
 * Génère un titre dynamique basé sur les filtres appliqués à une DataSource
 *
 * @param dataSource - La DataSource queriable
 * @param options - Options de génération du titre
 * @returns Le titre dynamique généré
 *
 * @example
 * const title = generateDynamicTitle(dataSource, {
 *   baseTitle: "Total par Type_Traitement",
 *   includeFilters: true,
 *   titleFormat: "descriptif",
 *   fieldAliases: { "Type_Traitement": "Type", "Annee_Acquisition": "Année" }
 * })
 * // Résultat: "Répartition par Type, et par Année"
 */
export function generateDynamicTitle(
  dataSource: QueriableDataSource | null,
  options: DynamicTitleOptions,
): string {
  const {
    baseTitle,
    includeFilters = true,
    filterPrefix = "",
    filterSeparator = ", ",
    maxFilters = 3,
    fieldAliases = {},
    titleTemplate,
    titleFormat = "simple",
  } = options

  let finalTitle = baseTitle

  if (!includeFilters || !dataSource) {
    return finalTitle
  }

  try {
    // Récupérer la clause WHERE de la DataSource
    const queryParams = dataSource.getCurrentQueryParams()
    const whereClause = queryParams?.where

    if (!whereClause || whereClause === "1=1") {
      return finalTitle
    }

    // Parser les filtres
    const filters = parseWhereClause(whereClause)

    if (filters.length === 0) {
      // Fallback: si le parsing échoue mais qu'on a une clause WHERE
      return `${finalTitle} (Filtré)`
    }

    // Utiliser le format personnalisé ou prédéfini
    if (titleFormat !== "simple" || titleTemplate) {
      return buildFormattedTitle(baseTitle, filters, options)
    }

    // Format simple (existant)
    const displayedFilters = filters.slice(0, maxFilters)

    // Construire la partie filtre du titre
    const filterParts = displayedFilters.map((filter) => {
      const fieldName = fieldAliases[filter.field] || filter.field
      const displayValue = filter.displayValue || filter.value

      // Si l'opérateur est "=", on simplifie l'affichage
      if (filter.operator === "=") {
        return `${fieldName}: ${displayValue}`
      } else {
        return `${fieldName} ${displayValue}`
      }
    })

    // Ajouter une indication s'il y a plus de filtres que maxFilters
    if (filters.length > maxFilters) {
      filterParts.push(`+${filters.length - maxFilters} autres`)
    }

    // Assembler le titre final
    const filterText = filterParts.join(filterSeparator)
    finalTitle = `${finalTitle} ${filterPrefix}(${filterText})`

    console.log("✅ [generateDynamicTitle] Titre généré:", finalTitle)
  } catch (error) {
    console.error("[generateDynamicTitle] Erreur:", error)
    // En cas d'erreur, retourner le titre de base avec indication générique
    return `${finalTitle} (Filtré)`
  }

  return finalTitle
}

/**
 * Extrait les alias de champs depuis le schéma de la DataSource
 *
 * @param dataSource - La DataSource
 * @returns Map des noms de champs vers leurs alias
 */
export function extractFieldAliases(dataSource: QueriableDataSource | null): {
  [fieldName: string]: string
} {
  if (!dataSource) {
    return {}
  }

  try {
    const schema = dataSource.getSchema()
    if (!schema?.fields) {
      return {}
    }

    const aliases: { [fieldName: string]: string } = {}

    Object.entries(schema.fields).forEach(([fieldName, fieldInfo]) => {
      if (fieldInfo.alias && fieldInfo.alias !== fieldName) {
        aliases[fieldName] = fieldInfo.alias
      }
    })

    return aliases
  } catch (error) {
    console.warn("[extractFieldAliases] Erreur:", error)
    return {}
  }
}

/**
 * Hook React pour générer un titre dynamique
 * Se met à jour automatiquement quand les filtres changent
 */
export function useDynamicTitle(
  dataSource: QueriableDataSource | null,
  baseTitle: string,
  queryVersion?: number, // Pour forcer la mise à jour
): string {
  const [title, setTitle] = React.useState(baseTitle)

  React.useEffect(() => {
    if (!dataSource) {
      setTitle(baseTitle)
      return
    }

    // Extraire les alias de champs automatiquement
    const fieldAliases = extractFieldAliases(dataSource)

    // Générer le titre dynamique
    const newTitle = generateDynamicTitle(dataSource, {
      baseTitle,
      includeFilters: true,
      fieldAliases,
      maxFilters: 3,
      filterSeparator: ", ",
    })

    setTitle(newTitle)
  }, [dataSource, baseTitle, queryVersion])

  return title
}

// Export pour utilisation en tant que module
export default {
  parseWhereClause,
  generateDynamicTitle,
  extractFieldAliases,
  useDynamicTitle,
}
