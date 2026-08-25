#!/usr/bin/env bash
# Construye el sitio completo: landing (Astro) + calculadora (Vite) montada en /calc.
# Salida unificada en site/dist/ → lista para un único proyecto de hosting estático.
# Autocontenido: instala dependencias (root + site) para que funcione en CI.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== [1/4] Install app deps =="
npm install

echo "== [2/4] Build app (Vite, base=/calc) =="
npm run build

echo "== [3/4] Install + build sitio (Astro) =="
(cd site && npm install && npm run build)

echo "== [4/4] Montando app bajo site/dist/calc =="
rm -rf site/dist/calc
mkdir -p site/dist/calc
cp -R dist/. site/dist/calc/

echo "== Listo: sitio estático en site/dist/ (app en /calc) =="
