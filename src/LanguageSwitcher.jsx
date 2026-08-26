import { useI18n, LANGS } from "./i18n";
import { COLORS, FONT_SANS } from "./theme";

export function LanguageSwitcher() {
  const { lang, setLang } = useI18n();
  return (
    <div
      role="group"
      aria-label="Idioma / Language / Langue"
      style={{ display: "inline-flex", gap: 4, padding: 3, background: COLORS.inputBg, borderRadius: 999, border: `1px solid ${COLORS.inputBorder}` }}
    >
      {LANGS.map((l) => {
        const active = lang === l.code;
        return (
          <button
            key={l.code}
            onClick={() => setLang(l.code)}
            title={l.label}
            aria-pressed={active}
            style={{
              padding: "4px 10px",
              borderRadius: 999,
              border: "none",
              background: active ? COLORS.accent : "transparent",
              color: active ? "#fff" : COLORS.textDim,
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: FONT_SANS,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              transition: "all 0.15s",
            }}
          >
            <span aria-hidden="true">{l.flag}</span>
            {l.code.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
