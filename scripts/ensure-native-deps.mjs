// El proyecto vive en OneDrive y se comparte entre macOS y Windows, asi que
// node_modules viaja entre ambas maquinas. Los paquetes JS puros sobreviven al
// viaje, pero los binarios nativos (rolldown, que usa Vite) son por plataforma:
// un arbol instalado en Windows revienta en el Mac con "Cannot find native binding".
//
// Este script deja una marca con la plataforma para la que se instalo el arbol y,
// si no coincide con la maquina actual, reinstala antes de arrancar Vite.
//
// Usa `npm ci` y no `npm install` a proposito: el lock ya lista los binarios de
// todas las plataformas y `ci` elige el correcto sin reescribir el lockfile.
// `install` si lo reescribe (deriva semver de dependencias transitivas), y las
// dos maquinas terminarian pisandose el lock una a la otra en cada cambio.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const marker = join(root, 'node_modules', '.platform')
const tag = `${process.platform}-${process.arch}`

const installed = existsSync(marker) ? readFileSync(marker, 'utf8').trim() : null

if (installed === tag) {
  process.exit(0)
}

console.log(
  installed
    ? `[deps] node_modules se instalo para ${installed}; reinstalando para ${tag}...`
    : `[deps] node_modules sin marca de plataforma; reinstalando para ${tag}...`,
)

// npm_execpath lo define npm al correr un script: es la ruta a npm-cli.js.
// Invocarlo con node evita el lio de npm vs npm.cmd en Windows.
const npmCli = process.env.npm_execpath

function npm(...args) {
  const opts = { cwd: root, stdio: 'inherit' }
  if (npmCli) {
    execFileSync(process.execPath, [npmCli, ...args], opts)
  } else {
    execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, opts)
  }
}

// Sin lockfile `npm ci` no puede correr, asi que ahi toca `install`.
const hasLock = existsSync(join(root, 'package-lock.json'))

try {
  npm(hasLock ? 'ci' : 'install', '--no-audit', '--no-fund')
} catch (error) {
  if (!hasLock) throw error
  // `npm ci` aborta si el lock quedo desincronizado de package.json. Antes que
  // dejar la maquina bloqueada, se repara con `install`; eso si reescribe el
  // lock, asi que conviene commitear el resultado para que la otra maquina no
  // tenga que repetir la reparacion.
  console.warn('[deps] `npm ci` fallo (lockfile desincronizado); reparando con `npm install`...')
  npm('install', '--no-audit', '--no-fund')
  console.warn('[deps] revisa `git diff package-lock.json` y commitea el resultado.')
}

writeFileSync(marker, `${tag}\n`)
console.log(`[deps] listo para ${tag}`)
