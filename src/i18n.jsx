import { createContext, useContext, useEffect, useState, useCallback } from "react";
import es from "./locales/es";
import en from "./locales/en";
import fr from "./locales/fr";

const DICTS = { es, en, fr };

export const LANGS = [
  { code: "es", label: "Español", flag: "🇲🇽" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
];

export const SUPPORTED_LANGS = ["es", "en", "fr"];
export const LS_LANG_KEY = "spinecalc_lang";

function detectLang() {
  try {
    const saved = localStorage.getItem(LS_LANG_KEY);
    if (saved && SUPPORTED_LANGS.includes(saved)) return saved;
    const nav = (navigator.language || "es").slice(0, 2).toLowerCase();
    if (SUPPORTED_LANGS.includes(nav)) return nav;
  } catch (_) {
    /* localStorage o navigator no disponibles */
  }
  return "es";
}

const I18nContext = createContext({ lang: "es", setLang: () => {}, t: (k) => k });

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(detectLang);

  const setLang = useCallback((l) => {
    if (!SUPPORTED_LANGS.includes(l)) return;
    setLangState(l);
    try { localStorage.setItem(LS_LANG_KEY, l); } catch (_) {}
  }, []);

  const t = useCallback(
    (key, params) => {
      const dict = DICTS[lang] || DICTS.es;
      let s = dict[key] ?? DICTS.es[key] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          s = s.split(`{${k}}`).join(String(v));
        }
      }
      return s;
    },
    [lang]
  );

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
