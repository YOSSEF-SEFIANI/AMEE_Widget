# Widget Print Customized - Documentation

## 📋 Informations Générales

| Propriété | Valeur |
|-----------|--------|
| **Nom** | `printCustomized` |
| **Label** | Imprimer |
| **Version** | 1.17.0 |
| **Version ExB** | 1.17.0 |
| **Auteur** | Esri R&D Center Beijing |
| **Type** | Widget |
| **ID Widget** | `widget_8` |

## 🏢 Contexte Organisation

- **Portal URL**: `https://geomatic.maps.arcgis.com`
- **Organisation**: Geomatic
- **Région**: Maroc (MA)
- **Culture**: Français (fr)
- **Unités**: Métrique

---

## ⚙️ Configuration du Widget

### Type de Service d'Impression

```
printServiceType: "CUSTOMIZE"
printTemplateType: "CUSTOMIZE"
modeType: "COMPACT"
```

### Service d'Impression Utilisé

- **Utility ID**: `utility_1`
- **Widget Carte Associé**: `widget_9`

---

## 🖨️ Paramètres Communs (CommonSetting)

| Paramètre | Valeur | Description |
|-----------|--------|-------------|
| `scalePreserved` | `false` | Conservation de l'échelle |
| `titleText` | "ArcGIS Web Map" | Titre par défaut |
| `outScale` | 36978595.474472 | Échelle de sortie |
| `dpi` | 96 | Qualité d'impression |
| `printExtentType` | "CURRENT MAP EXTENT" | Type d'étendue |
| `forceFeatureAttributes` | `false` | Forcer les attributs |
| `wkid` | 102100 | Référence spatiale |
| `wkidLabel` | "WGS_1984_Web_Mercator_Auxiliary_Sphere" | Label WKID |

### Options Activées

- ✅ Titre (`enableTitle`)
- ✅ Étendues d'impression (`enableMapPrintExtents`)
- ✅ Qualité (`enableQuality`)
- ✅ Attribution des entités (`enableFeatureAttribution`)
- ❌ Référence spatiale en sortie (`enableOutputSpatialReference`)

---

## 📐 Templates d'Impression Disponibles

### Formats de Papier

| Template | Taille Cadre Carte | Unité |
|----------|-------------------|-------|
| **A3 Landscape** | 40 × 21.17 | cm |
| **A3 Portrait** | 27.68 × 33.45 | cm |
| **A4 Landscape** | 27.76 × 15.92 | cm |
| **A4 Portrait** | 19.02 × 22.29 | cm |
| **Letter ANSI A Landscape** | 10 × 6.25 | inch |
| **Letter ANSI A Portrait** | 7.5 × 8 | inch |
| **Tabloid ANSI B Landscape** | 16 × 7.76 | inch |
| **Tabloid ANSI B Portrait** | 10 × 13.61 | inch |
| **MAP_ONLY** | 800 × 1100 px | pixels |

### Configuration par Template

Chaque template dispose des options suivantes :

```typescript
{
  label: string,              // Nom du template
  layout: string,             // Mise en page
  format: "pdf",              // Format de sortie
  templateId: string,         // ID unique
  mapFrameSize: [width, height],
  mapFrameUnit: "CENTIMETER" | "INCH",
  
  // Options de mise en page
  hasAuthorText: boolean,
  hasCopyrightText: boolean,
  hasLegend: boolean,
  hasTitleText: boolean,
  enableNorthArrow: boolean,
  
  // Overrides d'éléments
  elementOverrides: {
    Legend: {...},
    "North Arrow": {...},
    "Scale bar": {...}
  }
}
```

---

## 📄 Formats de Sortie Supportés

| Format | Extension | Description |
|--------|-----------|-------------|
| `pdf` | .pdf | Adobe PDF *(par défaut)* |
| `png32` | .png | PNG 32-bit |
| `png8` | .png | PNG 8-bit |
| `jpg` | .jpg | JPEG |
| `gif` | .gif | GIF |
| `eps` | .eps | Encapsulated PostScript |
| `svg` | .svg | Scalable Vector Graphics |
| `svgz` | .svgz | SVG Compressé |
| `aix` | .aix | Adobe Illustrator |
| `tiff` | .tiff | Tagged Image File Format |

---

## 🎨 Paramètres de Prévisualisation

```typescript
{
  enablePreview: true,
  previewBackgroundColor: "rgba(0,216,237,1)",  // Cyan
  previewOutLine: {
    color: "#000",
    size: "4px"
  },
  hasInitBorder: true
}
```

---

## 🗺️ Options de Mise en Page (Layout Options)

### Éléments de Carte

| Élément | Type | Visible par défaut |
|---------|------|-------------------|
| **Legend** | CIMLegend | ✅ Oui |
| **North Arrow** | CIMMarkerNorthArrow | ✅ Oui |
| **Scale bar** | CIMGroupElement | ✅ Oui |

### Structure Scale Bar

```typescript
{
  name: "Scale bar",
  type: "CIMGroupElement",
  elements: [
    { name: "Scale Line", type: "CIMScaleLine" },
    { name: "Scale Line 1", type: "CIMScaleLine" }
  ]
}
```

---

## 🔧 Options Configurables par Template

| Option | Description |
|--------|-------------|
| `enableTitle` | Permet de modifier le titre |
| `enableAuthor` | Permet d'ajouter un auteur |
| `enableCopyright` | Permet d'ajouter un copyright |
| `enableLegend` | Affiche/masque la légende |
| `enableScalebarUnit` | Unité de la barre d'échelle |
| `enableNorthArrow` | Affiche/masque la flèche nord |
| `enableMapPrintExtents` | Définit l'étendue d'impression |
| `enableOutputSpatialReference` | Référence spatiale personnalisée |
| `enableQuality` | Qualité DPI |
| `enableFeatureAttribution` | Attribution des entités |
| `enableMapSize` | Taille de carte (MAP_ONLY) |
| `enableCustomTextElements` | Éléments de texte personnalisés |

---

## 📁 Structure des Fichiers

```
printCustomized/
├── config.json
├── manifest.json
├── README.md
└── src/
    ├── config.ts                      # Configuration + Types ChartPrintOptions
    ├── constants.ts
    ├── version-manager.ts
    ├── runtime/
    │   ├── widget.tsx                 # Composant principal
    │   ├── component/
    │   │   ├── ds-remind.tsx
    │   │   ├── loading-icon.tsx
    │   │   ├── output-datasource-list.tsx
    │   │   ├── preview-extents.tsx
    │   │   ├── setting-row.tsx
    │   │   ├── utility-remind.tsx
    │   │   ├── classic/               # Mode classique
    │   │   │   ├── index.tsx
    │   │   │   ├── template-setting.tsx
    │   │   │   └── result/
    │   │   └── compact/               # Mode compact
    │   │       ├── index.tsx
    │   │       └── result.tsx
    │   ├── style/
    │   │   └── popper-style.ts
    │   ├── translations/              # 40 langues supportées
    │   └── utils/
    │       ├── chart-print-service.ts # 📊 Service d'impression de diagrammes
    │       ├── print-service.ts
    │       └── utils.ts
    ├── setting/
    │   ├── setting.tsx
    │   ├── component/
    │   │   ├── template-list.tsx
    │   │   ├── template-setting/
    │   │   └── app-item-selector/
    │   ├── translations/
    │   └── util/
    └── tools/
        └── app-config-operations.ts
```

---

## 🌐 Langues Supportées

Le widget supporte **40 langues** :

`en`, `ar`, `bg`, `bs`, `ca`, `cs`, `da`, `de`, `el`, `es`, `et`, `fi`, `fr`, `he`, `hr`, `hu`, `id`, `it`, `ja`, `ko`, `lt`, `lv`, `nb`, `nl`, `pl`, `pt-br`, `pt-pt`, `ro`, `ru`, `sk`, `sl`, `sr`, `sv`, `th`, `tr`, `zh-cn`, `uk`, `vi`, `zh-hk`, `zh-tw`

---

## 🎯 Props du Widget (Runtime)

### Props Principales

```typescript
interface WidgetProps {
  widgetId: string;           // "widget_8"
  layoutId: string;           // "layout_0"
  layoutItemId: string;       // "6"
  autoWidth: boolean;         // false
  autoHeight: boolean;        // false
  portalUrl: string;          // URL du portail ArcGIS
  portalSelf: PortalSelf;     // Configuration du portail
  user: User;                 // Informations utilisateur
  locale: string;             // "fr"
  config: WidgetConfig;       // Configuration du widget
  theme: Theme;               // Thème de l'application
  intl: IntlShape;            // Internationalisation
}
```

### Configuration (config)

```typescript
interface WidgetConfig {
  printServiceType: "CUSTOMIZE" | "ORG" | "URL";
  printTemplateType: "CUSTOMIZE" | "ORG";
  modeType: "COMPACT" | "CLASSIC";
  commonSetting: CommonSetting;
  printCustomTemplate: PrintTemplate[];
  useUtility: { utilityId: string };
  formatList: string[];
  defaultFormat: string;
  layoutChoiceList: LayoutChoice[];
  enablePreview: boolean;
  previewBackgroundColor: string;
  previewOutLine: { color: string; size: string };
  supportCustomLayout: boolean;
  supportReport: boolean;
  supportCustomReport: boolean;
}
```

---

## 👤 Informations Utilisateur

| Propriété | Valeur |
|-----------|--------|
| **Username** | formation6_geomatic |
| **Nom Complet** | Formation 6 |
| **Email** | <elyoubi.aymane@gmail.com> |
| **Rôle** | org_publisher |
| **Type Licence** | GISProfessionalStdUT |
| **Organisation** | hjUMsSJ87zgoicvl |

### Privilèges

- `features:user:edit`
- `portal:publisher:publishFeatures`
- `portal:publisher:publishScenes`
- `portal:user:createGroup`
- `portal:user:createItem`
- `portal:user:shareToPublic`
- `premium:publisher:createNotebooks`
- `premium:user:basemaps`

---

## 🎨 Thème

Le widget utilise le thème **Default (Light)** avec :

- **Couleur Primaire** : `#076fe5` (bleu)
- **Police** : "Avenir Next", sans-serif
- **Bordures** : Rayon de 2px
- **Ombres** : Multiple niveaux (sm, default, lg)

---

## 📝 Messages Internationalisés (i18n)

### Messages Clés

| Clé | Français |
|-----|----------|
| `_widgetLabel` | Imprimer |
| `printTemplate` | Modèle d'impression |
| `printResult` | Résultat d'impression |
| `fileFormat` | Format de fichier |
| `mapPrintingExtents` | Étendues d'impression de la carte |
| `outputSpatialReference` | Référence spatiale en sortie |
| `printQuality` | Qualité d'impression |
| `includeLegend` | Inclure la légende |
| `includeNorthArrow` | Inclure la flèche d'orientation |
| `resultEmptyMessage` | Vos fichiers imprimés apparaîtront ici. |

---

## 🔗 Dépendances

- **useMapWidgetIds**: `["widget_9"]` - Widget carte associé
- **useUtilities**: `[{ utilityId: "utility_1" }]` - Service d'impression

---

## 📚 Services Helper ArcGIS

Le widget utilise les services suivants de l'organisation :

| Service | URL |
|---------|-----|
| **Print Task** | `https://utility.arcgisonline.com/.../PrintingTools/GPServer/Export%20Web%20Map%20Task` |
| **Async Print** | `https://print.arcgis.com/.../PrintingToolsAsync/GPServer/...` |
| **Geometry** | `https://utility.arcgisonline.com/.../Geometry/GeometryServer` |
| **Geocode** | `https://geocode.arcgis.com/.../World/GeocodeServer` |

---

## 📊 Impression de Diagrammes (Charts)

### Principe de Fonctionnement

Le widget Print Customized offre la possibilité d'imprimer des diagrammes (Charts) en plus des cartes. Le principe consiste à :

1. **Fournir l'identifiant du widget** diagramme au widget Print
2. **Générer un PDF personnalisé** incluant le diagramme sélectionné

### Configuration

Pour activer l'impression de diagrammes, il faut configurer le widget Print avec l'ID du widget Chart cible :

```typescript
// Exemple de configuration pour l'impression de diagramme
{
  chartWidgetId: "widget_XX",    // ID du widget Chart à imprimer
  includeChartInPrint: true,     // Activer l'inclusion du diagramme
  chartPosition: "BOTTOM",       // Position du diagramme dans le PDF
  chartSize: {
    width: 400,                  // Largeur du diagramme en pixels
    height: 300                  // Hauteur du diagramme en pixels
  }
}
```

### Étapes d'Implémentation

1. **Identifier le widget Chart** dans l'application Experience Builder
   - Ouvrir les outils de développement
   - Trouver l'ID du widget Chart (ex: `widget_10`, `widget_12`)

2. **Configurer le widget Print** pour référencer le Chart

   ```json
   {
     "useChartWidgetIds": ["widget_10"],
     "chartPrintOptions": {
       "includeInLayout": true,
       "scaleToFit": true
     }
   }
   ```

3. **Personnaliser le template de mise en page** pour inclure une zone dédiée au diagramme

### Options d'Impression de Diagramme

| Option | Type | Description |
|--------|------|-------------|
| `chartWidgetId` | `string` | ID du widget Chart à inclure |
| `includeChartInPrint` | `boolean` | Activer/désactiver l'impression du Chart |
| `chartPosition` | `enum` | Position: `TOP`, `BOTTOM`, `LEFT`, `RIGHT`, `OVERLAY` |
| `chartSize` | `object` | Dimensions `{width, height}` en pixels |
| `chartTitle` | `string` | Titre personnalisé pour le diagramme |
| `chartBackground` | `string` | Couleur de fond du diagramme |
| `preserveChartRatio` | `boolean` | Conserver le ratio d'aspect |

---

## ⚠️ Résolution de Problèmes

### Le sélecteur de chart ne s'affiche pas en recette

**Symptôme** : Le widget fonctionne en local mais le sélecteur de chart (ChartWidgetSelector) ne s'affiche pas en environnement de recette.

**Cause** : Les traductions pour les fonctionnalités chart sont manquantes dans les fichiers JavaScript compilés (`.js`).

**Solution** : Les traductions suivantes doivent être présentes dans **tous** les fichiers de langue (`.js`) :

```javascript
selectChart: "Select a chart widget",
includeChartInPrint: "Include chart in print",
chartPosition: "Chart position",
positionTop: "Top",
positionBottom: "Bottom",
positionLeft: "Left",
positionRight: "Right",
noChartWidgetAvailable: "No chart widget available in application",
none: "None",
chartSettings: "Chart settings"
```

**Emplacements** :

- `src/setting/translations/*.js` (39 fichiers)
- `src/runtime/translations/*.js` (39 fichiers)

**Vérification** :

```bash
# Vérifier que les traductions sont présentes
grep -l "chartSettings" src/setting/translations/*.js | wc -l  # Devrait retourner 38-39
grep -l "chartSettings" src/runtime/translations/*.js | wc -l  # Devrait retourner 38-39
```

---

## 📊 Options d'Impression de Diagramme

```typescript
// Dans le composant Print, récupération du diagramme
const chartWidget = getAppStore().getState().appConfig.widgets[chartWidgetId];

// Capture du diagramme pour l'impression
const chartElement = document.querySelector(`[data-widget-id="${chartWidgetId}"]`);
const chartCanvas = await html2canvas(chartElement);

// Intégration dans le PDF
printTemplateProperties.extraElements = [{
  type: 'chart',
  content: chartCanvas.toDataURL(),
  position: chartPosition,
  size: chartSize
}];
```

### Types de Diagrammes Supportés

- 📊 Graphiques à barres (Bar Chart)
- 📈 Graphiques linéaires (Line Chart)
- 🥧 Diagrammes circulaires (Pie Chart)
- 📉 Graphiques en aires (Area Chart)
- 🔵 Graphiques à nuages de points (Scatter Plot)
- 📊 Histogrammes

### Limitations

- Le diagramme doit être visible au moment de l'impression
- La résolution maximale dépend du DPI configuré
- Les animations du diagramme ne sont pas capturées
- Nécessite que le widget Chart soit chargé dans l'application

---

## 🚀 Utilisation

1. **Ajouter le widget** à une application Experience Builder
2. **Configurer** le service d'impression (utilité)
3. **Sélectionner** les templates de mise en page
4. **Personnaliser** les options par template
5. **Associer** un widget carte
6. **(Optionnel) Configurer** l'impression de diagrammes avec l'ID du widget Chart

---

## 📌 Notes

- Le widget fonctionne uniquement avec des cartes 2D (WebMap)
- Les scènes 3D ne sont pas supportées pour l'impression
- La prévisualisation affiche l'étendue d'impression sur la carte
- Support des layouts personnalisés via le service d'impression
- **Impression de diagrammes** : Fournir l'ID du widget Chart pour générer un PDF personnalisé incluant le diagramme

---

*Documentation générée le 3 février 2026*
