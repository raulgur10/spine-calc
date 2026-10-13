import { useState, useRef, useEffect } from "react";
import { apiPost } from "./auth";
import { LANDMARK_KEYS } from "./data/landmarks";
import { useI18n } from "./i18n";

// ═══════════════════════════════════════════════════════════════════════════
// Premarcado sugerido con IA
// ═══════════════════════════════════════════════════════════════════════════
// Flujo: aviso → encuadre y tapado → revisión de lo que sale → envío.
// Lo único que sale del navegador es el recorte que el usuario aprobó, con los
// rectángulos negros ya quemados y reescalado; sin metadatos ni nombre de
// archivo. Los puntos vuelven como SUGERENCIAS: el anotador los dibuja aparte y
// no deja aplicar mediciones hasta que el usuario los revise.

const C = {
  panel: "#262626", panelLight: "#333", text: "#f1f5f9", textDim: "#94a3b8",
  accent: "#a8927a", red: "#ef4444", yellow: "#f59e0b", violet: "#a78bfa",
};
const MAX_LADO = 1600;

const MODELOS_IA = [
  { id: "gemini", label: "Gemini Flash" },
  { id: "luna", label: "GPT Luna" },
  { id: "deepseek", label: "DeepSeek 4.1 Flash" },
  { id: "grok", label: "Grok" },
];

function cargarImagen(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

// Recorte + tapado + reescalado. Devuelve el dataURL que se envía y el
// rectángulo de recorte (en pixeles de la placa) para deshacer la transformación.
async function prepararEnvio(imageSrc, recorte, tapados) {
  const img = await cargarImagen(imageSrc);
  const esc = Math.min(1, MAX_LADO / Math.max(recorte.w, recorte.h));
  const cw = Math.max(1, Math.round(recorte.w * esc));
  const ch = Math.max(1, Math.round(recorte.h * esc));
  const cv = document.createElement("canvas");
  cv.width = cw; cv.height = ch;
  const ctx = cv.getContext("2d");
  ctx.drawImage(img, recorte.x, recorte.y, recorte.w, recorte.h, 0, 0, cw, ch);
  ctx.fillStyle = "#000";
  for (const r of tapados) {
    ctx.fillRect((r.x - recorte.x) * esc, (r.y - recorte.y) * esc, r.w * esc, r.h * esc);
  }
  return cv.toDataURL("image/jpeg", 0.9);
}

const normRect = (a, b) => ({
  x: Math.min(a.x, b.x), y: Math.min(a.y, b.y),
  w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y),
});

export default function PremarcadoIA({ imageSrc, imageDims, onClose, onResult }) {
  const { t } = useI18n();
  const [paso, setPaso] = useState("aviso"); // aviso | encuadre | revision | enviando
  const [acepto, setAcepto] = useState(false);
  const [modelo, setModelo] = useState(() => {
    try { return localStorage.getItem("spinecalc_ia_modelo") || "gemini"; } catch { return "gemini"; }
  });
  const [herramienta, setHerramienta] = useState("tapar"); // recorte | tapar
  const [recorte, setRecorte] = useState({ x: 0, y: 0, w: imageDims.w, h: imageDims.h });
  const [tapados, setTapados] = useState([]);
  const [arrastre, setArrastre] = useState(null); // { a, b }
  const [vista, setVista] = useState(null); // dataURL a enviar
  const [sinDatos, setSinDatos] = useState(false);
  const [error, setError] = useState(null);
  const lienzoRef = useRef(null);

  useEffect(() => {
    try { localStorage.setItem("spinecalc_ia_modelo", modelo); } catch { /* sin almacenamiento */ }
  }, [modelo]);

  const aImagen = (e) => {
    const r = lienzoRef.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * imageDims.w;
    const y = ((e.clientY - r.top) / r.height) * imageDims.h;
    return { x: Math.max(0, Math.min(imageDims.w, x)), y: Math.max(0, Math.min(imageDims.h, y)) };
  };
  const down = (e) => {
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* sin captura */ }
    const p = aImagen(e);
    setArrastre({ a: p, b: p });
  };
  const move = (e) => { if (arrastre) setArrastre({ ...arrastre, b: aImagen(e) }); };
  const up = () => {
    if (!arrastre) return;
    const r = normRect(arrastre.a, arrastre.b);
    setArrastre(null);
    const minimo = Math.max(imageDims.w, imageDims.h) * 0.01;
    if (r.w < minimo || r.h < minimo) return;
    if (herramienta === "recorte") setRecorte(r);
    else setTapados((ts) => [...ts, r]);
  };

  const irARevision = async () => {
    setError(null);
    setVista(await prepararEnvio(imageSrc, recorte, tapados));
    setSinDatos(false);
    setPaso("revision");
  };

  const enviar = async () => {
    setPaso("enviando"); setError(null);
    try {
      const r = await apiPost("ia/premarcar", { imagen: vista, modelo });
      // De 0-1000 sobre el recorte a pixeles de la placa original.
      const puntos = LANDMARK_KEYS.map((k) => {
        const p = r.puntos?.[k];
        if (!p) return null;
        return {
          x: recorte.x + (p.x / 1000) * recorte.w,
          y: recorte.y + (p.y / 1000) * recorte.h,
          confianza: p.confianza,
        };
      });
      onResult({ puntos, notas: r.notas, modelo: r.modelo, uso: r.uso });
    } catch (err) {
      setError(err.message);
      setPaso("revision");
    }
  };

  const svgRect = (r, props) => <rect x={r.x} y={r.y} width={r.w} height={r.h} {...props} />;
  const sw = Math.max(imageDims.w, imageDims.h) / 400;

  const btn = (primario, deshabilitado) => ({
    padding: "10px 16px", borderRadius: 8, fontSize: 12.5, fontWeight: 700,
    cursor: deshabilitado ? "not-allowed" : "pointer", opacity: deshabilitado ? 0.5 : 1,
    border: `1.5px solid ${primario ? C.violet : C.panelLight}`,
    background: primario ? C.violet : "transparent", color: primario ? "#1a1a1a" : C.text,
  });
  const herr = (activa, color) => ({
    padding: "6px 12px", borderRadius: 6, fontSize: 11.5, fontWeight: 700, cursor: "pointer",
    border: `1.5px solid ${color}`, background: activa ? color : "transparent", color: activa ? "#1a1a1a" : color,
  });

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.78)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: paso === "aviso" ? 520 : 980, maxHeight: "100%", overflow: "auto", background: C.panel, border: `1.5px solid ${C.violet}66`, borderRadius: 12, padding: "20px 22px", color: C.text, boxShadow: "0 12px 40px rgba(0,0,0,0.6)" }}>

        {paso === "aviso" && (
          <>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 12 }}>✨ {t("ia.aviso.titulo")}</div>
            <div style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.65, background: "#1a1a1a", border: `1px solid ${C.yellow}55`, borderRadius: 8, padding: "12px 14px", marginBottom: 14 }}>
              <div style={{ color: C.yellow, fontWeight: 800, marginBottom: 6 }}>⚠ {t("ia.aviso.importante")}</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                <li>{t("ia.aviso.l1")}</li>
                <li>{t("ia.aviso.l2")}</li>
                <li>{t("ia.aviso.l3")}</li>
                <li>{t("ia.aviso.l4")}</li>
              </ul>
            </div>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, marginBottom: 14 }}>
              <span style={{ color: C.textDim }}>{t("ia.modelo")}</span>
              <select value={modelo} onChange={(e) => setModelo(e.target.value)}
                style={{ background: "#1a1a1a", color: C.text, border: `1px solid ${C.panelLight}`, borderRadius: 6, padding: "5px 8px", fontSize: 12 }}>
                {MODELOS_IA.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, lineHeight: 1.5, marginBottom: 16, cursor: "pointer" }}>
              <input type="checkbox" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} style={{ marginTop: 3 }} />
              <span>{t("ia.aviso.acepto")}</span>
            </label>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={onClose} style={btn(false)}>{t("common.cancelar")}</button>
              <button disabled={!acepto} onClick={() => setPaso("encuadre")} style={btn(true, !acepto)}>{t("ia.continuar")}</button>
            </div>
          </>
        )}

        {paso === "encuadre" && (
          <>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6 }}>{t("ia.encuadre.titulo")}</div>
            <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.55, marginBottom: 10 }}>{t("ia.encuadre.ayuda")}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              <button onClick={() => setHerramienta("tapar")} style={herr(herramienta === "tapar", C.red)}>⬛ {t("ia.encuadre.tapar")}</button>
              <button onClick={() => setHerramienta("recorte")} style={herr(herramienta === "recorte", C.violet)}>⛶ {t("ia.encuadre.recortar")}</button>
              <button onClick={() => setTapados((ts) => ts.slice(0, -1))} disabled={!tapados.length} style={btn(false, !tapados.length)}>↶ {t("ia.encuadre.quitar_tapado")}</button>
              <button onClick={() => { setTapados([]); setRecorte({ x: 0, y: 0, w: imageDims.w, h: imageDims.h }); }} style={btn(false)}>{t("ia.encuadre.restablecer")}</button>
            </div>
            <div style={{ display: "flex", justifyContent: "center", background: "#000", borderRadius: 8, padding: 8 }}>
              <svg ref={lienzoRef} viewBox={`0 0 ${imageDims.w} ${imageDims.h}`}
                onPointerDown={down} onPointerMove={move} onPointerUp={up}
                style={{ maxWidth: "100%", maxHeight: "58vh", touchAction: "none", cursor: "crosshair", userSelect: "none" }}>
                <image href={imageSrc} x="0" y="0" width={imageDims.w} height={imageDims.h} style={{ pointerEvents: "none" }} />
                {/* Lo que queda fuera del recorte se oscurece */}
                <path fillRule="evenodd" fill="rgba(0,0,0,0.65)" pointerEvents="none"
                  d={`M0 0H${imageDims.w}V${imageDims.h}H0Z M${recorte.x} ${recorte.y}h${recorte.w}v${recorte.h}h${-recorte.w}Z`} />
                {svgRect(recorte, { fill: "none", stroke: C.violet, strokeWidth: sw * 1.5, strokeDasharray: `${sw * 6},${sw * 4}`, pointerEvents: "none" })}
                {tapados.map((r, i) => <g key={i}>{svgRect(r, { fill: "#000", stroke: C.red, strokeWidth: sw, pointerEvents: "none" })}</g>)}
                {arrastre && svgRect(normRect(arrastre.a, arrastre.b), {
                  fill: herramienta === "tapar" ? "rgba(0,0,0,0.8)" : "none",
                  stroke: herramienta === "tapar" ? C.red : C.violet, strokeWidth: sw * 1.5, pointerEvents: "none",
                })}
              </svg>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 12 }}>
              <button onClick={() => setPaso("aviso")} style={btn(false)}>{t("ia.atras")}</button>
              <button onClick={irARevision} style={btn(true)}>{t("ia.encuadre.revisar")}</button>
            </div>
          </>
        )}

        {(paso === "revision" || paso === "enviando") && vista && (
          <>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6 }}>{t("ia.revision.titulo")}</div>
            <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.55, marginBottom: 10 }}>{t("ia.revision.ayuda")}</div>
            <div style={{ display: "flex", justifyContent: "center", background: "#000", borderRadius: 8, padding: 8 }}>
              <img src={vista} alt={t("ia.revision.titulo")} style={{ maxWidth: "100%", maxHeight: "52vh", objectFit: "contain" }} />
            </div>
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, lineHeight: 1.5, margin: "12px 0", cursor: "pointer" }}>
              <input type="checkbox" checked={sinDatos} onChange={(e) => setSinDatos(e.target.checked)} style={{ marginTop: 3 }} disabled={paso === "enviando"} />
              <span>{t("ia.revision.confirmo")}</span>
            </label>
            {error && <div style={{ fontSize: 12.5, color: C.red, background: "#ef444422", borderRadius: 6, padding: "8px 10px", marginBottom: 10 }}>{error}</div>}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setPaso("encuadre")} disabled={paso === "enviando"} style={btn(false, paso === "enviando")}>{t("ia.atras")}</button>
              <button onClick={enviar} disabled={!sinDatos || paso === "enviando"} style={btn(true, !sinDatos || paso === "enviando")}>
                {paso === "enviando" ? t("ia.enviando") : t("ia.enviar", { modelo: MODELOS_IA.find((m) => m.id === modelo)?.label || modelo })}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
