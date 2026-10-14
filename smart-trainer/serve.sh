#!/usr/bin/env bash
# Arranca la aplicación con Vite para resolver sus dependencias del proyecto.

set -euo pipefail

PORT="${1:-8000}"
DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v npm >/dev/null 2>&1; then
    echo "❌ Se necesita Node.js con npm para iniciar Smart Trainer."
    exit 1
fi

cd "$DIR"

if [[ ! -x "$DIR/node_modules/.bin/vite" ]]; then
    echo "📦 Instalando las dependencias del proyecto..."
    npm ci
fi

echo "🚴 Iniciando Smart Trainer con Vite en http://localhost:$PORT"
echo "⚠️ Para probar Web Bluetooth desde otro dispositivo, usa una URL HTTPS."
echo "   (Presiona Ctrl+C para detener)"

exec npm run dev -- --host 0.0.0.0 --port "$PORT"
