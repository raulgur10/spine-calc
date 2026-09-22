// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTES DE PRESENTACIÓN
// ═══════════════════════════════════════════════════════════════════════════
// Componentes puros: todo entra por props, ninguno toca estado global ni datos.
import { useState, useEffect, useRef } from "react";
import { COLORS, FONT_SANS, FONT_SERIF, MOMENTOS } from "./theme";
import { TIPOS_CIRUGIA, SEGMENTOS, SEGMENTOS_TORACICOS, SEGMENTOS_TODOS } from "./constants";
import { useI18n } from "./i18n";
import { diffMensaje } from "./utils";

export function InfoTooltip({ text, figureSrc }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  // Click fuera cierra el popover (importante porque ahora puede ser grande con imagen)
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);
  const hasFigure = !!figureSrc;
  return (
    <span ref={wrapRef} style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
      onMouseEnter={() => { if (!hasFigure) setOpen(true); }}
      onMouseLeave={() => { if (!hasFigure) setOpen(false); }}>
      <span
        role="button"
        tabIndex={0}
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
        onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 16, height: 16, borderRadius: "50%", background: COLORS.inputHover, color: COLORS.textDim, fontSize: 10, cursor: "pointer", fontWeight: 700, border: `1px solid ${COLORS.inputBorder}`, userSelect: "none", outline: "none" }}>?</span>
      {open && (
        <span style={{
          position: "absolute", top: "calc(100% + 8px)", left: -4, zIndex: 100,
          width: hasFigure ? 340 : 280, maxWidth: "min(90vw, 380px)",
          padding: "12px 14px",
          background: COLORS.text, color: "#F1F5F9",
          fontSize: 12, lineHeight: 1.5, fontWeight: 400, fontFamily: "'DM Sans', sans-serif",
          borderRadius: 8, boxShadow: "0 6px 20px rgba(0,0,0,0.22)",
          whiteSpace: "normal",
          display: "block"
        }}>
          <span style={{ display: "block" }}>{text}</span>
          {hasFigure && (
            <span style={{ display: "block", marginTop: 10, background: "#0f172a", borderRadius: 6, padding: 6, textAlign: "center" }}>
              <img src={figureSrc} alt="" style={{ maxWidth: "100%", maxHeight: 200, objectFit: "contain", display: "inline-block" }} />
            </span>
          )}
        </span>
      )}
    </span>
  );
}

export function InputField({ label, tooltip, tooltipFigure, value, onChange, unit = "°", min, max, type = "number", placeholder, step, list, transform, maxLength }) {
  const [focused, setFocused] = useState(false);
  const isTextLike = type === "text" || type === "date";
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, minWidth: 0 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</label>
        {tooltip && <InfoTooltip text={tooltip} figureSrc={tooltipFigure} />}
      </div>
      <div style={{ display: "flex", alignItems: "center", background: COLORS.inputBg, borderRadius: 8, border: `1.5px solid ${focused ? COLORS.inputFocus : COLORS.inputBorder}`, overflow: "hidden", transition: "border-color 0.15s" }}>
        <input type={type} value={value} placeholder={placeholder} min={min} max={max} step={step} list={list} maxLength={maxLength}
          onChange={e => { const raw = e.target.value; if (type === "number") onChange(raw === "" ? "" : Number(raw)); else onChange(transform ? transform(raw) : raw); }}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          style={{ flex: 1, padding: "10px 12px", background: "transparent", border: "none", color: COLORS.text, fontSize: isTextLike ? 14 : 15, fontFamily: isTextLike ? "'DM Sans', sans-serif" : "'JetBrains Mono', monospace", outline: "none", width: "100%" }} />
        {unit && <span style={{ padding: "0 12px", color: COLORS.textMuted, fontSize: 13, fontWeight: 500 }}>{unit}</span>}
      </div>
    </div>
  );
}

export function SelectField({ label, value, onChange, options, tooltip, placeholder }) {
  const { t } = useI18n();
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{label}</label>
        {tooltip && <InfoTooltip text={tooltip} />}
      </div>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ width: "100%", padding: "10px 12px", background: COLORS.inputBg, borderRadius: 8, border: `1.5px solid ${COLORS.inputBorder}`, color: value ? COLORS.text : COLORS.textMuted, fontSize: 14, outline: "none", fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}>
        <option value="">{placeholder ?? t("select.placeholder")}</option>
        {/* Acepta cadenas (nombres propios, que no se traducen) u objetos
            { value, label } cuando la etiqueta visible sí depende del idioma. */}
        {options.map(o => typeof o === "string"
          ? <option key={o} value={o}>{o}</option>
          : <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

export function TipoEvaluacionToggle({ value, onChange }) {
  const { t } = useI18n();
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: 8, display: "block" }}>{t("eval.tipo")}</label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {Object.entries(MOMENTOS).map(([key, m]) => {
          const active = value === key;
          return (
            <button key={key} onClick={() => onChange(key)} style={{ padding: "12px 10px", borderRadius: 10, border: `1.5px solid ${active ? m.color : COLORS.inputBorder}`, background: active ? m.bg : COLORS.inputBg, color: active ? m.color : COLORS.textDim, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.15s" }}>
              <span style={{ fontSize: 14 }}>{m.icon}</span> {t(m.key)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DiffInfoBox({ diffInfo }) {
  const { t } = useI18n();
  if (!diffInfo) return null;
  const isWarning = diffInfo.tipo === "warning";
  const color = isWarning ? COLORS.secondary : COLORS.accent;
  const bg = isWarning ? COLORS.secondaryDim : COLORS.accentDim;
  return (
    <div style={{ padding: "10px 14px", borderRadius: 8, background: bg, border: `1px solid ${color}44`, fontSize: 12, color: isWarning ? COLORS.secondary : COLORS.accentDark, marginBottom: 16, marginTop: -6, display: "flex", alignItems: "center", gap: 8, lineHeight: 1.4 }}>
      <span style={{ fontSize: 14 }}>⏱️</span>
      <div>{isWarning ? <strong>{t(diffInfo.warningKey)}</strong> : diffMensaje(t, diffInfo)}</div>
    </div>
  );
}

export function IMCBadge({ imc }) {
  const { t } = useI18n();
  if (!imc) return null;
  return (
    <div style={{ padding: "10px 14px", borderRadius: 8, background: imc.color + "15", border: `1px solid ${imc.color}44`, fontSize: 12, color: imc.color, marginBottom: 16, marginTop: -6, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontWeight: 600 }}>
      <span>📊 {t("imc.calculado")}</span>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{imc.valor.toFixed(1)} · {t(imc.categoriaKey)}</span>
    </div>
  );
}

export function Chip({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{ padding: "6px 14px", borderRadius: 999, border: `1.5px solid ${active ? COLORS.accent : COLORS.inputBorder}`, background: active ? COLORS.accentDim : COLORS.inputBg, color: active ? COLORS.accentDark : COLORS.textDim, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", transition: "all 0.15s" }}>{label}</button>
  );
}

export function CirugiaCard({ cirugia, onUpdate, onRemove, index }) {
  const { t } = useI18n();
  // Orden anatómico, no el de los clics: así se imprimen en el PDF.
  const toggleSeg = (seg) => { const n = cirugia.segmentos.includes(seg) ? cirugia.segmentos.filter(s => s !== seg) : [...cirugia.segmentos, seg]; onUpdate({ ...cirugia, segmentos: SEGMENTOS_TODOS.filter(s => n.includes(s)) }); };
  const grupo = (labelKey, segs) => (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 4, fontWeight: 600, letterSpacing: "0.04em" }}>{t(labelKey)}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{segs.map(s => <Chip key={s} label={s} active={cirugia.segmentos.includes(s)} onClick={() => toggleSeg(s)} />)}</div>
    </div>
  );
  return (
    <div style={{ padding: 14, borderRadius: 10, background: COLORS.inputHover, border: `1px solid ${COLORS.inputBorder}`, marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.accentDark, fontFamily: "'JetBrains Mono', monospace" }}>{t("cirugia.card.titulo", { n: index + 1 })}</span>
        <button onClick={onRemove} style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${COLORS.red}44`, background: "transparent", color: COLORS.red, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>{t("common.eliminar")}</button>
      </div>
      <select value={cirugia.tipo} onChange={e => onUpdate({ ...cirugia, tipo: e.target.value })}
        style={{ width: "100%", padding: "8px 10px", background: COLORS.card, borderRadius: 6, border: `1.5px solid ${COLORS.inputBorder}`, color: COLORS.text, fontSize: 13, outline: "none", marginBottom: 10, cursor: "pointer" }}>
        <option value="">{t("cirugia.tipo.placeholder")}</option>
        {TIPOS_CIRUGIA.map(o => <option key={o.value} value={o.value}>{t(o.key)}</option>)}
        <option value="otro">{t("cirugia.otro")}</option>
      </select>
      {cirugia.tipo === "otro" && <input type="text" value={cirugia.tipoCustom || ""} placeholder={t("cirugia.otro.placeholder")} onChange={e => onUpdate({ ...cirugia, tipoCustom: e.target.value })} style={{ width: "100%", padding: "8px 10px", background: COLORS.card, borderRadius: 6, border: `1.5px solid ${COLORS.inputBorder}`, color: COLORS.text, fontSize: 13, outline: "none", marginBottom: 10 }} />}
      <div>
        <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 6, fontWeight: 600 }}>{t("cirugia.segmentos")} {cirugia.segmentos.length > 0 && `(${cirugia.segmentos.length})`}</div>
        {grupo("cirugia.segmentos.toracicos", SEGMENTOS_TORACICOS)}
        {grupo("cirugia.segmentos.lumbares", SEGMENTOS)}
      </div>
    </div>
  );
}

export function ParamRow({ name, diff, score, label, sub, maxScore }) {
  const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;
  const barColor = score === 0 ? COLORS.green : score <= 1 ? COLORS.yellow : COLORS.red;
  const barBg = score === 0 ? COLORS.greenBg : score <= 1 ? COLORS.yellowBg : COLORS.redBg;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: `1px solid ${COLORS.cardBorder}` }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.accentDark, fontFamily: "'JetBrains Mono', monospace" }}>{name}</span>
          <span style={{ fontSize: 12, color: COLORS.textDim }}>{diff !== undefined ? `(${diff >= 0 ? "+" : ""}${diff.toFixed(1)}°)` : ""}</span>
        </div>
        <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 2 }}>{label} · {sub}</div>
        <div style={{ marginTop: 6, height: 4, borderRadius: 2, background: COLORS.inputHover, overflow: "hidden", maxWidth: 160 }}>
          <div style={{ height: "100%", borderRadius: 2, background: barColor, width: `${Math.max(pct, 8)}%` }} />
        </div>
      </div>
      <div style={{ width: 40, height: 40, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: barBg, color: barColor, fontSize: 18, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace" }}>{score}</div>
    </div>
  );
}

export function ShareButton({ icon, label, color, bg, onClick, disabled }) {
  const [hover, setHover] = useState(false);
  return (
    <button onClick={disabled ? null : onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ flex: 1, minWidth: 100, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 8px", borderRadius: 10, border: `1.5px solid ${disabled ? COLORS.inputBorder : color + "44"}`, background: disabled ? COLORS.inputHover : (hover ? color + "22" : bg), color: disabled ? COLORS.textMuted : color, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.55 : 1, fontSize: 13, fontWeight: 700, transition: "all 0.15s" }}>
      <span style={{ fontSize: 18 }}>{icon}</span>{label}
    </button>
  );
}

export function MomentoBadge({ tipo }) {
  const { t } = useI18n();
  const m = MOMENTOS[tipo] || MOMENTOS.preoperatorio;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 6, background: m.bg, border: `1px solid ${m.color}44`, color: m.color, fontSize: 10, fontWeight: 700 }}><span style={{ fontSize: 9 }}>{m.icon}</span> {t(m.shortKey)}</span>;
}

export function Card({ children, style = {} }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ background: COLORS.card, borderRadius: 14, border: `1px solid ${COLORS.cardBorder}`, padding: "22px 22px 20px", marginBottom: 20, boxShadow: hover ? COLORS.cardShadowHover : COLORS.cardShadow, transform: hover ? "translateY(-1px)" : "translateY(0)", transition: "box-shadow 240ms cubic-bezier(0.2, 0.8, 0.2, 1), transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1)", ...style }}>
      {children}
    </div>
  );
}

