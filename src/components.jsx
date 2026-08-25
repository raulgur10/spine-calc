// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTES DE PRESENTACIÓN
// ═══════════════════════════════════════════════════════════════════════════
// Componentes puros: todo entra por props, ninguno toca estado global ni datos.
import { useState, useEffect, useRef } from "react";
import { COLORS, FONT_SANS, FONT_SERIF, MOMENTOS } from "./theme";
import { TIPOS_CIRUGIA, SEGMENTOS, CONSENT_TEXT, PUBLIC_CONSENT_TEXT } from "./constants";

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

export function SelectField({ label, value, onChange, options, tooltip, placeholder = "Selecciona..." }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{label}</label>
        {tooltip && <InfoTooltip text={tooltip} />}
      </div>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ width: "100%", padding: "10px 12px", background: COLORS.inputBg, borderRadius: 8, border: `1.5px solid ${COLORS.inputBorder}`, color: value ? COLORS.text : COLORS.textMuted, fontSize: 14, outline: "none", fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}>
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

export function TipoEvaluacionToggle({ value, onChange }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: 8, display: "block" }}>Tipo de evaluación</label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {Object.entries(MOMENTOS).map(([key, m]) => {
          const active = value === key;
          return (
            <button key={key} onClick={() => onChange(key)} style={{ padding: "12px 10px", borderRadius: 10, border: `1.5px solid ${active ? m.color : COLORS.inputBorder}`, background: active ? m.bg : COLORS.inputBg, color: active ? m.color : COLORS.textDim, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.15s" }}>
              <span style={{ fontSize: 14 }}>{m.icon}</span> {m.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DiffInfoBox({ diffInfo }) {
  if (!diffInfo) return null;
  const isWarning = diffInfo.tipo === "warning";
  const color = isWarning ? COLORS.secondary : COLORS.accent;
  const bg = isWarning ? COLORS.secondaryDim : COLORS.accentDim;
  return (
    <div style={{ padding: "10px 14px", borderRadius: 8, background: bg, border: `1px solid ${color}44`, fontSize: 12, color: isWarning ? COLORS.secondary : COLORS.accentDark, marginBottom: 16, marginTop: -6, display: "flex", alignItems: "center", gap: 8, lineHeight: 1.4 }}>
      <span style={{ fontSize: 14 }}>⏱️</span>
      <div>{isWarning ? <strong>{diffInfo.warning}</strong> : diffInfo.mensaje}</div>
    </div>
  );
}

export function IMCBadge({ imc }) {
  if (!imc) return null;
  return (
    <div style={{ padding: "10px 14px", borderRadius: 8, background: imc.color + "15", border: `1px solid ${imc.color}44`, fontSize: 12, color: imc.color, marginBottom: 16, marginTop: -6, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontWeight: 600 }}>
      <span>📊 IMC calculado</span>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{imc.valor.toFixed(1)} · {imc.categoria}</span>
    </div>
  );
}

export function Chip({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{ padding: "6px 14px", borderRadius: 999, border: `1.5px solid ${active ? COLORS.accent : COLORS.inputBorder}`, background: active ? COLORS.accentDim : COLORS.inputBg, color: active ? COLORS.accentDark : COLORS.textDim, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", transition: "all 0.15s" }}>{label}</button>
  );
}

export function CirugiaCard({ cirugia, onUpdate, onRemove, index }) {
  const toggleSeg = (seg) => { const n = cirugia.segmentos.includes(seg) ? cirugia.segmentos.filter(s => s !== seg) : [...cirugia.segmentos, seg]; onUpdate({ ...cirugia, segmentos: n }); };
  return (
    <div style={{ padding: 14, borderRadius: 10, background: COLORS.inputHover, border: `1px solid ${COLORS.inputBorder}`, marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.accentDark, fontFamily: "'JetBrains Mono', monospace" }}>CIRUGÍA #{index + 1}</span>
        <button onClick={onRemove} style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${COLORS.red}44`, background: "transparent", color: COLORS.red, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Eliminar</button>
      </div>
      <select value={cirugia.tipo} onChange={e => onUpdate({ ...cirugia, tipo: e.target.value })}
        style={{ width: "100%", padding: "8px 10px", background: COLORS.card, borderRadius: 6, border: `1.5px solid ${COLORS.inputBorder}`, color: COLORS.text, fontSize: 13, outline: "none", marginBottom: 10, cursor: "pointer" }}>
        <option value="">— Tipo de cirugía —</option>
        {TIPOS_CIRUGIA.map(t => <option key={t} value={t}>{t}</option>)}
        <option value="otro">Otro (especificar)</option>
      </select>
      {cirugia.tipo === "otro" && <input type="text" value={cirugia.tipoCustom || ""} placeholder="Especificar tipo de cirugía" onChange={e => onUpdate({ ...cirugia, tipoCustom: e.target.value })} style={{ width: "100%", padding: "8px 10px", background: COLORS.card, borderRadius: 6, border: `1.5px solid ${COLORS.inputBorder}`, color: COLORS.text, fontSize: 13, outline: "none", marginBottom: 10 }} />}
      <div>
        <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 6, fontWeight: 600 }}>SEGMENTOS {cirugia.segmentos.length > 0 && `(${cirugia.segmentos.length})`}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{SEGMENTOS.map(s => <Chip key={s} label={s} active={cirugia.segmentos.includes(s)} onClick={() => toggleSeg(s)} />)}</div>
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
  const m = MOMENTOS[tipo] || MOMENTOS.preoperatorio;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 6, background: m.bg, border: `1px solid ${m.color}44`, color: m.color, fontSize: 10, fontWeight: 700 }}><span style={{ fontSize: 9 }}>{m.icon}</span> {m.short}</span>;
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

export function PdfSaveModal({ onSaveAndDownload, onDownloadOnly, onCancel, busy }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15, 27, 26, 0.55)", backdropFilter: "blur(4px)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: COLORS.card, borderRadius: 14, maxWidth: 460, width: "100%", boxShadow: "0 20px 60px rgba(15, 27, 26, 0.35)", overflow: "hidden", border: `1px solid ${COLORS.cardBorder}` }}>
        <div aria-hidden="true" style={{ height: 4, background: COLORS.accent }} />
        <div style={{ padding: "22px 26px 18px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span aria-hidden="true" style={{ width: 18, height: 1, background: COLORS.accent, opacity: 0.7 }} />
            <span style={{ fontSize: 9, fontWeight: 600, color: COLORS.accent, textTransform: "uppercase", letterSpacing: 3, fontFamily: FONT_SANS }}>Antes de descargar</span>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 600, margin: "0 0 10px", color: COLORS.ink, fontFamily: FONT_SERIF, fontVariationSettings: "'opsz' 36, 'SOFT' 50", letterSpacing: "-0.015em", lineHeight: 1.15 }}>
            ¿Guardar el caso en la nube?
          </h2>
          <p style={{ fontSize: 13, color: COLORS.textDim, lineHeight: 1.6, margin: "0 0 8px" }}>
            Al guardarlo podrás <strong style={{ color: COLORS.text }}>recuperarlo después con su ID</strong> desde cualquier dispositivo, y aportarás a las estadísticas del proyecto.
          </p>
          <div style={{ marginTop: 14, padding: "10px 12px", background: COLORS.inputHover, borderRadius: 8, border: `1px dashed ${COLORS.inputBorder}`, fontSize: 11.5, color: COLORS.textDim, lineHeight: 1.5, fontStyle: "italic", fontFamily: FONT_SERIF, fontVariationSettings: "'opsz' 18, 'SOFT' 100" }}>
            Los datos se guardan únicamente con fines estadísticos anónimos.
            No se almacenan datos identificables del paciente ni del médico.
          </div>
        </div>
        <div style={{ padding: "0 18px 18px", display: "flex", gap: 10, flexDirection: "column" }}>
          <button onClick={onSaveAndDownload} disabled={busy} style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: `1.5px solid ${COLORS.accent}`, background: COLORS.accent, color: "#fff", fontSize: 14, fontWeight: 700, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.7 : 1, fontFamily: FONT_SANS }}>
            {busy ? "Guardando..." : "💾 Guardar y descargar PDF"}
          </button>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onCancel} disabled={busy} style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: `1px solid ${COLORS.inputBorder}`, background: "transparent", color: COLORS.textDim, fontSize: 12.5, fontWeight: 600, cursor: busy ? "wait" : "pointer" }}>Cancelar</button>
            <button onClick={onDownloadOnly} disabled={busy} style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: `1px solid ${COLORS.inputBorder}`, background: "transparent", color: COLORS.textDim, fontSize: 12.5, fontWeight: 600, cursor: busy ? "wait" : "pointer" }}>Solo descargar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function EmailLoginModal({ email, password, onEmailChange, onPasswordChange, onSubmit, onCancel, error, busy }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(30, 41, 59, 0.6)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <form onSubmit={onSubmit} style={{ background: COLORS.card, borderRadius: 16, maxWidth: 420, width: "100%", boxShadow: "0 10px 40px rgba(0,0,0,0.25)" }}>
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${COLORS.cardBorder}` }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, margin: "0 0 4px", color: COLORS.accentDark }}>🔐 Acceso clínico</h2>
          <p style={{ fontSize: 11, color: COLORS.textMuted, margin: 0 }}>Inicia sesión con tu correo y contraseña</p>
        </div>
        <div style={{ padding: "18px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.text, display: "block", marginBottom: 6 }}>Correo</label>
            <input type="email" value={email} onChange={e => onEmailChange(e.target.value)} autoComplete="username" autoFocus disabled={busy} style={{ width: "100%", padding: "10px 12px", background: COLORS.inputBg, border: `1.5px solid ${COLORS.inputBorder}`, borderRadius: 8, color: COLORS.text, fontSize: 14, outline: "none", fontFamily: "'DM Sans', sans-serif" }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.text, display: "block", marginBottom: 6 }}>Contraseña</label>
            <input type="password" value={password} onChange={e => onPasswordChange(e.target.value)} autoComplete="current-password" disabled={busy} style={{ width: "100%", padding: "10px 12px", background: COLORS.inputBg, border: `1.5px solid ${COLORS.inputBorder}`, borderRadius: 8, color: COLORS.text, fontSize: 14, outline: "none", fontFamily: "'JetBrains Mono', monospace" }} />
          </div>
          {error && <div style={{ padding: "8px 12px", borderRadius: 8, background: COLORS.redBg, border: `1px solid ${COLORS.red}44`, color: COLORS.red, fontSize: 12, fontWeight: 600 }}>{error}</div>}
          <div style={{ fontSize: 11, color: COLORS.textMuted, lineHeight: 1.5, fontStyle: "italic" }}>
            Acceso restringido. Si necesitas credenciales, contacta al administrador del proyecto.
          </div>
        </div>
        <div style={{ padding: 16, borderTop: `1px solid ${COLORS.cardBorder}`, display: "flex", gap: 10 }}>
          <button type="button" onClick={onCancel} disabled={busy} style={{ flex: 1, padding: 12, borderRadius: 8, border: `1px solid ${COLORS.inputBorder}`, background: "transparent", color: COLORS.textDim, fontSize: 13, fontWeight: 600, cursor: busy ? "wait" : "pointer" }}>Cancelar</button>
          <button type="submit" disabled={busy} style={{ flex: 1, padding: 12, borderRadius: 8, border: `1.5px solid ${COLORS.accent}`, background: COLORS.accent, color: "#fff", fontSize: 13, fontWeight: 700, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.7 : 1 }}>{busy ? "Verificando..." : "Iniciar sesión"}</button>
        </div>
      </form>
    </div>
  );
}

export function PublicConsentModal({ onAccept, onCancel, busy }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(30, 41, 59, 0.6)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: COLORS.card, borderRadius: 16, maxWidth: 540, width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 10px 40px rgba(0,0,0,0.25)" }}>
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${COLORS.cardBorder}`, position: "sticky", top: 0, background: COLORS.card, zIndex: 1 }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, margin: "0 0 4px", color: COLORS.accentDark }}>Guardar caso en la nube</h2>
          <p style={{ fontSize: 11, color: COLORS.textMuted, margin: 0 }}>Lee y acepta para continuar</p>
        </div>
        <div style={{ padding: "18px 24px", fontSize: 13, lineHeight: 1.6, color: COLORS.text, whiteSpace: "pre-wrap" }}>
          {PUBLIC_CONSENT_TEXT}
        </div>
        <div style={{ padding: 16, borderTop: `1px solid ${COLORS.cardBorder}`, display: "flex", gap: 10, position: "sticky", bottom: 0, background: COLORS.card }}>
          <button onClick={onCancel} disabled={busy} style={{ flex: 1, padding: 12, borderRadius: 8, border: `1px solid ${COLORS.inputBorder}`, background: "transparent", color: COLORS.textDim, fontSize: 13, fontWeight: 600, cursor: busy ? "wait" : "pointer" }}>Cancelar</button>
          <button onClick={onAccept} disabled={busy} style={{ flex: 1, padding: 12, borderRadius: 8, border: `1.5px solid ${COLORS.accent}`, background: COLORS.accent, color: "#fff", fontSize: 13, fontWeight: 700, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.7 : 1 }}>Acepto y guardo</button>
        </div>
      </div>
    </div>
  );
}

export function ConsentModal({ onAccept, onReject, userEmail, busy }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(30, 41, 59, 0.6)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: COLORS.card, borderRadius: 16, maxWidth: 560, width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 10px 40px rgba(0,0,0,0.25)" }}>
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${COLORS.cardBorder}`, position: "sticky", top: 0, background: COLORS.card, zIndex: 1 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 6px", color: COLORS.accentDark }}>Consentimiento informado</h2>
          <p style={{ fontSize: 12, color: COLORS.textMuted, margin: 0 }}>SpineCalc · {userEmail}</p>
        </div>
        <div style={{ padding: "20px 24px", fontSize: 13, lineHeight: 1.65, color: COLORS.text, whiteSpace: "pre-wrap" }}>
          {CONSENT_TEXT}
        </div>
        <div style={{ padding: 20, borderTop: `1px solid ${COLORS.cardBorder}`, display: "flex", gap: 10, position: "sticky", bottom: 0, background: COLORS.card }}>
          <button onClick={onReject} disabled={busy} style={{ flex: 1, padding: 12, borderRadius: 8, border: `1px solid ${COLORS.inputBorder}`, background: "transparent", color: COLORS.textDim, fontSize: 13, fontWeight: 600, cursor: busy ? "wait" : "pointer" }}>Rechazar y cerrar sesión</button>
          <button onClick={onAccept} disabled={busy} style={{ flex: 1, padding: 12, borderRadius: 8, border: `1.5px solid ${COLORS.accent}`, background: COLORS.accent, color: "#fff", fontSize: 13, fontWeight: 700, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.7 : 1 }}>Acepto y continúo</button>
        </div>
      </div>
    </div>
  );
}

