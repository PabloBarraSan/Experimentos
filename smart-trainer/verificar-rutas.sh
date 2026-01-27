#!/bin/bash
# Script para verificar que las rutas estén correctas para GitHub Pages

echo "🔍 Verificando rutas para GitHub Pages..."
echo ""

BASE_PATH="/Experimentos/smart-trainer"
ERRORS=0

# Verificar manifest.json
echo "📄 Verificando manifest.json..."
if grep -q "$BASE_PATH" smart-trainer/manifest.json 2>/dev/null; then
    echo "  ✅ manifest.json: Rutas correctas"
else
    echo "  ❌ manifest.json: Rutas incorrectas"
    ERRORS=$((ERRORS + 1))
fi

# Verificar sw.js
echo "📄 Verificando sw.js..."
if grep -q "BASE_PATH = '/Experimentos/smart-trainer'" smart-trainer/sw.js 2>/dev/null || grep -q "BASE_PATH = \"/Experimentos/smart-trainer\"" smart-trainer/sw.js 2>/dev/null; then
    echo "  ✅ sw.js: BASE_PATH configurado correctamente"
else
    echo "  ❌ sw.js: BASE_PATH no encontrado o incorrecto"
    ERRORS=$((ERRORS + 1))
fi

# Verificar que no haya rutas antiguas
echo "📄 Verificando rutas antiguas..."
if grep -r "\"/smart-trainer/\"" smart-trainer/ --exclude-dir=.git 2>/dev/null | grep -v "BASE_PATH" | grep -v "Experimentos" > /dev/null; then
    echo "  ⚠️  Se encontraron rutas antiguas /smart-trainer/ (puede ser normal en comentarios)"
else
    echo "  ✅ No se encontraron rutas antiguas problemáticas"
fi

echo ""
if [ $ERRORS -eq 0 ]; then
    echo "✅ Todas las verificaciones pasaron. Listo para GitHub Pages!"
    echo ""
    echo "📋 Próximos pasos:"
    echo "   1. git add smart-trainer/"
    echo "   2. git commit -m 'Ajustar rutas para GitHub Pages'"
    echo "   3. git push origin main"
    echo "   4. Activar GitHub Pages en: https://github.com/PabloBarraSan/Experimentos/settings/pages"
    echo "   5. URL final: https://PabloBarraSan.github.io/Experimentos/smart-trainer/"
else
    echo "❌ Se encontraron $ERRORS error(es). Revisa los archivos."
    exit 1
fi
