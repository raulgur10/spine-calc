#!/usr/bin/env bash
# Construye el sitio completo: landing (Astro) + calculadora (Vite) montada en /calc.
# Salida unificada en site/dist/ → lista para un único proyecto de hosting estático.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== [1/3] Build app (Vite, base=/calc) =="
npm run build

echo "== [2/3] Build sitio (Astro) =="
(cd site && npm install && npm run build)

echo "== [3/3] Montando app bajo site/dist/calc =="
rm -rf site/dist/calc
mkdir -p site/dist/calc
cp -R dist/. site/dist/calc/

echo "== Listo: sitio estático en site/dist/ (app en /calc) =="
