#!/bin/bash
# Script para servir la app Smart Trainer localmente
# Útil para desarrollo y pruebas

PORT=${1:-8000}
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚴 Iniciando servidor para Smart Trainer..."
echo "📁 Directorio: $DIR"
echo "🌐 Puerto: $PORT"
echo ""
echo "⚠️  IMPORTANTE:"
echo "   - Web Bluetooth NO funciona en http://localhost"
echo "   - Para probar desde el móvil, usa ngrok:"
echo "     ngrok http $PORT"
echo ""
echo "📱 Accede desde: http://localhost:$PORT"
echo "   (Presiona Ctrl+C para detener)"
echo ""

# Intentar usar Python primero, luego Node.js, luego PHP
if command -v python3 &> /dev/null; then
    echo "✅ Usando Python 3..."
    cd "$DIR"
    python3 -m http.server "$PORT"
elif command -v python &> /dev/null; then
    echo "✅ Usando Python 2..."
    cd "$DIR"
    python -m SimpleHTTPServer "$PORT"
elif command -v node &> /dev/null; then
    echo "✅ Usando Node.js (npx serve)..."
    cd "$DIR"
    npx --yes serve -p "$PORT"
elif command -v php &> /dev/null; then
    echo "✅ Usando PHP..."
    cd "$DIR"
    php -S localhost:"$PORT"
else
    echo "❌ Error: No se encontró Python, Node.js ni PHP"
    echo "   Instala uno de ellos para servir la app"
    exit 1
fi
