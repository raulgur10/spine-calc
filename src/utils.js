// ═══════════════════════════════════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════════════════════════════════
import { COLORS } from "./theme";

export const normalizeName = (text) =>
  text.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9\s\-]/g, "");

export const resizeImage = (file, maxWidth = 1000, quality = 0.7) =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ratio = Math.min(maxWidth / img.width, 1);
        canvas.width = img.width * ratio; canvas.height = img.height * ratio;
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });

export const dataURLtoBlob = (dataUrl) => {
  const arr = dataUrl.split(",");
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length; const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new Blob([u8arr], { type: mime });
};

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const hoy = () => new Date().toISOString().slice(0, 10);

// ID de caso público: GAP-YYYY-XXXX (XXXX alfanumérico sin 0/O/1/I/L para no confundir)
export const CASE_ID_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const generarCasoId = () => {
  const year = new Date().getFullYear();
  let s = "";
  for (let i = 0; i < 4; i++) s += CASE_ID_ALPHABET[Math.floor(Math.random() * CASE_ID_ALPHABET.length)];
  return `GAP-${year}-${s}`;
};
export const normalizeIniciales = (s) =>
  s.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z]/g, "").slice(0, 5);

export const cirugiasTexto = (cirugias) =>
  cirugias.map(c => {
    const tipo = c.tipo === "otro" ? c.tipoCustom : c.tipo;
    const segs = c.segmentos.length > 0 ? c.segmentos.join(", ") : "sin segmentos";
    return `${tipo} (${segs})`;
  }).join(" | ");

export const nombreCompleto = (apellidos, nombre) => {
  const a = (apellidos || "").trim(); const n = (nombre || "").trim();
  return (a && n) ? `${a} ${n}` : (a || n || "");
};

// IMC según OMS
export function calcularIMC(peso, talla) {
  if (!peso || !talla) return null;
  const tallaM = Number(talla) / 100;
  const imc = Number(peso) / (tallaM * tallaM);
  let categoria, color;
  if (imc < 18.5) { categoria = "Bajo peso"; color = COLORS.blue; }
  else if (imc < 25) { categoria = "Normal"; color = COLORS.green; }
  else if (imc < 30) { categoria = "Sobrepeso"; color = COLORS.yellow; }
  else if (imc < 35) { categoria = "Obesidad I"; color = COLORS.secondary; }
  else if (imc < 40) { categoria = "Obesidad II"; color = COLORS.red; }
  else { categoria = "Obesidad III"; color = COLORS.red; }
  return { valor: imc, categoria, color };
}

export function calcularDiferencia(fechaEstudio, fechaCirugia, tipoEvaluacion) {
  if (!fechaEstudio || !fechaCirugia) return null;
  const estudio = new Date(fechaEstudio + "T00:00:00");
  const cirugia = new Date(fechaCirugia + "T00:00:00");
  const diffDays = Math.round((estudio - cirugia) / (1000 * 60 * 60 * 24));
  const absDays = Math.abs(diffDays);

  let texto;
  if (absDays === 0) texto = "mismo día";
  else if (absDays < 14) texto = `${absDays} días`;
  else if (absDays < 60) {
    const weeks = Math.floor(absDays / 7);
    const days = absDays % 7;
    texto = days === 0 ? `${weeks} semanas` : `${weeks} sem y ${days} d`;
  } else if (absDays < 730) {
    const months = Math.round(absDays / 30);
    texto = `${months} ${months === 1 ? "mes" : "meses"}`;
  } else {
    const years = Math.floor(absDays / 365);
    const remMonths = Math.round((absDays % 365) / 30);
    texto = remMonths > 0 ? `${years} año${years > 1 ? "s" : ""} ${remMonths} m` : `${years} año${years > 1 ? "s" : ""}`;
  }

  let mensaje, tipo = "info", warning = null;
  if (diffDays === 0) mensaje = "Estudio realizado el mismo día de la cirugía";
  else if (diffDays < 0) {
    mensaje = `Estudio ${texto} antes de la cirugía`;
    if (tipoEvaluacion === "postoperatorio") { tipo = "warning"; warning = "⚠ Inconsistencia: estudio anterior a la cirugía marcado como postoperatorio"; }
  } else {
    mensaje = `Estudio ${texto} después de la cirugía`;
    if (tipoEvaluacion === "preoperatorio") { tipo = "warning"; warning = "⚠ Inconsistencia: estudio posterior a la cirugía marcado como preoperatorio"; }
  }
  return { dias: diffDays, absDias: absDays, texto, mensaje, tipo, warning };
}
