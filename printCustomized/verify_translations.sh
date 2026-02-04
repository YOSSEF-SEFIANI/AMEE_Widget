#!/bin/bash

# Script de vérification des traductions Chart
# Widget: printCustomized v1.17.0
# Date: 4 février 2026

echo "╔════════════════════════════════════════════════════════════╗"
echo "║   Vérification des Traductions Chart - printCustomized    ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Compteurs
setting_count=$(grep -l "chartSettings" src/setting/translations/*.js 2>/dev/null | wc -l)
runtime_count=$(grep -l "chartSettings" src/runtime/translations/*.js 2>/dev/null | wc -l)

echo "📁 Vérification des fichiers de traduction..."
echo ""

# Setting
echo "🔧 Setting translations:"
if [ "$setting_count" -ge 38 ]; then
    echo -e "   ${GREEN}✓${NC} $setting_count fichiers contiennent 'chartSettings'"
else
    echo -e "   ${RED}✗${NC} Seulement $setting_count fichiers (attendu: 38+)"
fi

# Runtime
echo ""
echo "⚡ Runtime translations:"
if [ "$runtime_count" -ge 38 ]; then
    echo -e "   ${GREEN}✓${NC} $runtime_count fichiers contiennent 'chartSettings'"
else
    echo -e "   ${RED}✗${NC} Seulement $runtime_count fichiers (attendu: 38+)"
fi

echo ""
echo "─────────────────────────────────────────────────────────────"

# Vérification du français
echo ""
echo "🇫🇷 Vérification des traductions françaises:"
echo ""

# Setting FR
if grep -q 'chartSettings:"Paramètres des diagrammes"' src/setting/translations/fr.js 2>/dev/null; then
    echo -e "   ${GREEN}✓${NC} Setting FR: traduction française correcte"
else
    echo -e "   ${RED}✗${NC} Setting FR: traduction manquante ou incorrecte"
fi

# Runtime FR
if grep -q 'chartSettings:"Paramètres des diagrammes"' src/runtime/translations/fr.js 2>/dev/null; then
    echo -e "   ${GREEN}✓${NC} Runtime FR: traduction française correcte"
else
    echo -e "   ${RED}✗${NC} Runtime FR: traduction manquante ou incorrecte"
fi

echo ""
echo "─────────────────────────────────────────────────────────────"

# Vérification détaillée des clés
echo ""
echo "🔑 Vérification des clés de traduction dans default.ts:"
echo ""

keys=("selectChart" "includeChartInPrint" "chartPosition" "positionTop" "positionBottom" "positionLeft" "positionRight" "noChartWidgetAvailable" "none" "chartSettings")

all_keys_present=true

for key in "${keys[@]}"; do
    # Vérifier Setting
    if grep -q "$key:" src/setting/translations/default.ts 2>/dev/null; then
        echo -e "   ${GREEN}✓${NC} Setting:  $key"
    else
        echo -e "   ${RED}✗${NC} Setting:  $key (manquant)"
        all_keys_present=false
    fi
done

echo ""
echo "─────────────────────────────────────────────────────────────"

# Résultat final
echo ""
total_files=$((setting_count + runtime_count))
expected_files=77  # 38 setting + 39 runtime

if [ "$total_files" -ge "$expected_files" ] && [ "$all_keys_present" = true ]; then
    echo -e "${GREEN}✓ TOUTES LES VÉRIFICATIONS SONT PASSÉES${NC}"
    echo ""
    echo "Le widget devrait maintenant afficher le sélecteur de chart en recette."
    echo ""
    echo "Prochaines étapes:"
    echo "  1. Redéployer le widget en recette"
    echo "  2. Vider le cache du navigateur (CTRL+SHIFT+R)"
    echo "  3. Tester le sélecteur dans les paramètres du widget"
    exit 0
else
    echo -e "${YELLOW}⚠ ATTENTION: Certaines vérifications ont échoué${NC}"
    echo ""
    echo "Fichiers trouvés: $total_files / $expected_files attendus"
    echo ""
    echo "Veuillez exécuter le script de correction:"
    echo "  python3 src/setting/translations/add_chart_translations.py"
    exit 1
fi
