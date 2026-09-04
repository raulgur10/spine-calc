// ═══════════════════════════════════════════════════════════════════════════
// i18n del sitio — idiomas, rutas y traducción
// ═══════════════════════════════════════════════════════════════════════════
// El español vive en la raíz (`/conceptos`) y los demás idiomas bajo su
// prefijo (`/en/concepts`). Esa asimetría es deliberada: las URLs en español
// ya están impresas en el QR y citadas en el borrador del artículo, y no
// pueden cambiar.
//
// Los slugs se traducen. La identidad de una página no es su URL sino su
// clave (`concepts`), y `pathFor` la resuelve a la URL del idioma pedido. Así
// el selector de idioma puede mantener al lector en la misma página en vez de
// devolverlo a la portada.

import es from './es.js';
import en from './en.js';
import fr from './fr.js';

const DICTS = { es, en, fr };

export const DEFAULT_LANG = 'es';

export const LANGS = [
  { code: 'es', label: 'Español', short: 'ES' },
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'fr', label: 'Français', short: 'FR' },
];

export const LANG_CODES = LANGS.map((l) => l.code);

/** Slug de cada página por idioma. `''` es la portada. */
export const ROUTES = {
  home:       { es: '',            en: '',            fr: '' },
  concepts:   { es: 'conceptos',   en: 'concepts',    fr: 'concepts' },
  references: { es: 'referencias', en: 'references',  fr: 'references' },
  team:       { es: 'equipo',      en: 'team',        fr: 'equipe' },
  disclaimer: { es: 'descargo',    en: 'disclaimer',  fr: 'avertissement' },
};

export const PAGE_KEYS = Object.keys(ROUTES);

/**
 * URL absoluta (desde la raíz del sitio) de una página en un idioma.
 * El idioma por defecto no lleva prefijo.
 */
export function pathFor(pageKey, lang = DEFAULT_LANG) {
  const slug = ROUTES[pageKey]?.[lang] ?? ROUTES[pageKey]?.[DEFAULT_LANG] ?? '';
  const prefix = lang === DEFAULT_LANG ? '' : `/${lang}`;
  if (!slug) return prefix === '' ? '/' : `${prefix}/`;
  return `${prefix}/${slug}`;
}

/** Idioma de una URL. `/en/concepts` → `en`; `/conceptos` → `es`. */
export function getLangFromUrl(url) {
  const [, first] = url.pathname.split('/');
  return LANG_CODES.includes(first) && first !== DEFAULT_LANG ? first : DEFAULT_LANG;
}

/**
 * Clave de página de una URL, para que el selector de idioma conserve la
 * página. Devuelve `null` si la ruta no es una de las traducidas (404, /calc).
 */
export function getPageKeyFromUrl(url) {
  const parts = url.pathname.split('/').filter(Boolean);
  const slug = LANG_CODES.includes(parts[0]) ? parts[1] : parts[0];
  if (!slug) return 'home';
  return PAGE_KEYS.find((k) => Object.values(ROUTES[k]).includes(slug)) ?? null;
}

/**
 * Ruta a la calculadora. El `?lang=` es lo que hace que la app —que tiene su
 * propio i18n -- arranque en el idioma en que venía leyendo el usuario.
 */
export function calcPath(lang = DEFAULT_LANG) {
  return lang === DEFAULT_LANG ? '/calc' : `/calc?lang=${lang}`;
}

/**
 * Traductor. Cae al español ante una clave sin traducir, para que una omisión
 * se vea como texto en español y nunca como la clave cruda.
 * `params` sustituye marcadores `{nombre}`.
 */
export function useTranslations(lang) {
  const dict = DICTS[lang] ?? DICTS[DEFAULT_LANG];
  return function t(key, params) {
    let s = dict[key] ?? DICTS[DEFAULT_LANG][key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
    }
    return s;
  };
}
