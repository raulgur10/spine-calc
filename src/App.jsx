import { useState, useMemo, useEffect, useRef } from "react";
import jsPDF from "jspdf";
import { firebaseEnabled, db, storage, auth, googleProvider } from "./firebase";
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy, where, getDoc, setDoc, increment, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { onAuthStateChanged, signInWithPopup, signInWithEmailAndPassword, signOut } from "firebase/auth";
import LandmarkAnnotator from "./landmarkAnnotator";

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════════════════════
const CIRUJANOS = [
  "Dr. Eduardo Galván Hernández",
  "Dr. Iván Sámano López",
  "Dr. Rafael Avendaño Pradel",
];
const MEDIDORES = [
  "Avendaño Pradel Rafael",
  "Galván Hernández Eduardo",
  "Guillén Rojas Raúl",
  "Sámano López Iván",
];
const TIPOS_CIRUGIA = ["Instrumentación lumbar anterior", "Instrumentación lumbar posterior"];
const SEGMENTOS = ["L1-L2", "L2-L3", "L3-L4", "L4-L5", "L5-S1"];
const CATEGORIAS_FOTO = ["Radiografía lateral", "Radiografía AP", "Radiografía anotada", "Planificación", "Otra"];
const STORAGE_KEY = "gap_calculator_casos";

const REFERENCIAS = [
  { year: 1998, cite: "Legaye J, Duval-Beaupère G, Hecquet J, Marty C. Pelvic incidence: a fundamental pelvic parameter for three-dimensional regulation of spinal sagittal curves. Eur Spine J. 1998;7:99-103." },
  { year: 2005, cite: "Roussouly P, Gollogly S, Berthonnaud E, Dimnet J. Classification of the Normal Variation in the Sagittal Alignment of the Human Lumbar Spine and Pelvis in the Standing Position. Spine. 2005;30:346-353." },
  { year: 2017, cite: "Yilgor C, Sogunmez N, Boissiere L, Yavuz Y, Obeid I, et al. Global Alignment and Proportion (GAP) Score: Development and Validation of a New Method of Analyzing Spinopelvic Alignment to Predict Mechanical Complications After Adult Spinal Deformity Surgery. J Bone Joint Surg Am. 2017;99:1661-1672. doi:10.2106/JBJS.16.01594" },
  { year: 2017, cite: "Laouissat F, Sebaaly A, Gehrchen M, Roussouly P. Classification of normal sagittal spine alignment: refounding the Roussouly classification. Eur Spine J. 2017;26:2572-2588. doi:10.1007/s00586-017-5111-x" },
  { year: 2018, cite: "Sebaaly A, Grobost P, Mallam L, Roussouly P. Description of the sagittal alignment of the degenerative human spine. Eur Spine J. 2018;27:489-496. doi:10.1007/s00586-017-5404-0" },
  { year: 2019, cite: "Bari TJ, Ohrt-Nissen S, Hansen LV, Dahl B, Gehrchen M. Ability of the Global Alignment and Proportion Score to Predict Mechanical Failure Following Adult Spinal Deformity Surgery—Validation in 149 Patients With Two-Year Follow-up. Spine Deformity. 2019;7:331-337." },
  { year: 2019, cite: "Le Huec JC, Thompson W, Mohsinaly Y, Barrey C, Faundez A. Sagittal balance of the spine. Eur Spine J. 2019;28:1958-1968. doi:10.1007/s00586-019-06083-1" },
  { year: 2020, cite: "Noh SH, Ha Y, Obeid I, Park JY, Kuh SU, Chin DK, et al. Modified Global Alignment and Proportion Scoring With Body Mass Index and Bone Mineral Density (GAPB) for improving Predictions of Mechanical Complications After Adult Spinal Deformity Surgery. Spine J. 2020;20(5):776-784. doi:10.1016/j.spinee.2019.11.006" },
  { year: 2020, cite: "Sebaaly A, Gehrchen M, Silvestre C, Kharrat K, Bari TJ, Kreichati G, et al. Mechanical complications in adult spinal deformity and the effect of restoring the spinal shapes according to the Roussouly classification: a multicentric study. Eur Spine J. 2020;29:904-913. doi:10.1007/s00586-019-06253-1" },
  { year: 2020, cite: "Bari TJ, Hansen LV, Gehrchen M. Surgical correction of Adult Spinal Deformity in accordance to the Roussouly classification: effect on postoperative mechanical complications. Spine Deform. 2020;8:1027-1037. doi:10.1007/s43390-020-00112-6" },
  { year: 2021, cite: "Kwan KYH, Shaffrey CI, Cheung KMC, et al. Are Higher Global Alignment and Proportion Scores Associated With Increased Risks of Mechanical Complications After Adult Spinal Deformity Surgery? An External Validation. Clin Orthop Relat Res. 2021;479:312-320. doi:10.1097/CORR.0000000000001521" },
  { year: 2022, cite: "Hills J, Lenke LG, Sardar ZM, Le Huec JC, Bourret S, Hasegawa K, et al. The T4-L1-Hip Axis: Defining a Normal Sagittal Spinal Alignment. Spine. 2022;47:1399-1406." },
  { year: 2024, cite: "Cho M, Lee S, Kim HJ. Assessing the predictive power of the GAP score on mechanical complications: a comprehensive systematic review and meta-analysis. Eur Spine J. 2024;33:1311-1319. doi:10.1007/s00586-024-08135-7" },
  { year: 2025, cite: "Ferraz VR, Piedade GS, Goulart CR, Souza MF, Furlan MD, Mercier PA, et al. The predictive value of the global alignment and proportion (GAP) score for mechanical complications following adult spinal deformity surgery: A systematic review and meta-analysis. N Am Spine Soc J. 2025;24:100816. doi:10.1016/j.xnsj.2025.100816" },
  { year: 2025, cite: "Haddad S, Yilgor C, Jacobs E, Vila L, Nuñez-Pereira S, Ramirez Valencia M, et al. Long-term mechanical failure in well aligned adult spinal deformity patients. Spine J. 2025;25:337-346." }
];
// Version del algoritmo, inyectada por Vite desde package.json (vite.config.js).
// Se imprime en el pie de cada reporte PDF y junto al aviso de la interfaz.
const APP_VERSION = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";

const CONSENT_VERSION = "1.0";
const CONSENT_CONTACT = "raulguillen@cardioanestesia.com.mx";
const PUBLIC_CONSENT_VERSION = "1.0";
const PUBLIC_CONSENT_LS_KEY = "gap_public_consent";
const PUBLIC_CASES_LS_KEY = "gap_my_public_cases";
// Feature flag: en modo simplificado solo se muestra C2 tilt directo en la sección de tilts.
// Cambia a true para reactivar CPA, T1 tilt directo, T1PA, L1 tilt directo (Hills 2022 completo).
const TILTS_FULL_MODE = true;
const PUBLIC_CONSENT_TEXT = `Acepto que se guarden los datos de este cálculo (parámetros radiográficos, resultados, edad y antropometría) en una base de datos en la nube, con dos fines:

1) Asistencia propia: poder recuperar el caso después usando el ID generado (formato GAP-AAAA-XXXX) desde cualquier dispositivo, y volver a generar el reporte.

2) Estadística agregada anonimizada: análisis de cohorte para validar GAP Score, eje T4-L1-cadera y tilts vertebrales en una población más amplia.

NO se guardarán datos identificables del paciente (nombre, apellidos, expediente, fotografías) ni datos del médico que realiza la medición. El nombre del médico, si lo capturas, se usa solo para imprimirlo en el PDF y no se persiste en la base de datos.`;
const CONSENT_TEXT = `Al guardar casos en esta aplicación acepto que los datos clínicos y radiográficos capturados (identificadores del paciente, parámetros espinopélvicos, diagnóstico, tipo de cirugía y resultados calculados) se almacenen de forma segura en Firebase y sean utilizados con dos fines:

1) Asistencia clínica propia: consulta y seguimiento de los casos que yo mismo registro como cirujano responsable o medidor. Solo yo puedo ver los casos que yo guardo.

2) Investigación y desarrollo de modelos de IA: análisis agregado de la cohorte para estudios de variabilidad interobservador, validación del GAP Score (Yilgor 2017) y del eje T4-L1-cadera (Hills 2022), y entrenamiento de modelos predictivos de alineación espinopélvica. Los resultados publicados serán siempre anónimos y agregados; no se divulgarán datos identificables del paciente.

Entiendo que soy responsable de obtener el consentimiento correspondiente de cada paciente cuyos datos capture, conforme a la NOM-024-SSA3 y buenas prácticas del Centro Médico ABC. Puedo solicitar en cualquier momento la eliminación de los casos que yo haya registrado escribiendo a ${CONSENT_CONTACT}.`;

// ═══════════════════════════════════════════════════════════════════════════
// PALETA "CLARO CON PERSONALIDAD"
// ═══════════════════════════════════════════════════════════════════════════
const COLORS = {
  bg: "#F6F1E8",              // cream profundo, más papel
  bgAtmos: "radial-gradient(1100px 700px at 18% -8%, #EAF5F2 0%, transparent 60%), radial-gradient(900px 600px at 92% 110%, #F2EAD6 0%, transparent 55%)",
  card: "#FFFFFF",
  cardBorder: "#E5DECF",      // piedra cálida
  cardShadow: "0 1px 0 rgba(30, 41, 59, 0.02), 0 12px 28px -16px rgba(20, 30, 45, 0.12)",
  cardShadowHover: "0 1px 0 rgba(30, 41, 59, 0.02), 0 22px 40px -18px rgba(13, 60, 56, 0.18)",

  ink: "#0F1B1A",             // tinta editorial casi negra con verde
  accent: "#0D7A72",          // teal médico, más profundo
  accentDim: "#D9F0EC",       // teal muy claro, suavizado
  accentDark: "#0B423E",
  accentSoft: "#88B5AF",

  secondary: "#9B3B0E",       // terracota más editorial
  secondaryDim: "#FCE6D2",

  green: "#15803D",
  greenBg: "#DCFCE7",
  yellow: "#B45309",
  yellowBg: "#FEF3C7",
  red: "#B91C1C",
  redBg: "#FEE2E2",
  purple: "#6D28D9",
  purpleBg: "#EDE9FE",
  blue: "#1D4ED8",
  blueBg: "#DBEAFE",

  text: "#1B2A2A",
  textDim: "#475569",
  textMuted: "#8C8475",

  inputBg: "#FBF8F2",
  inputBorder: "#D9D2BF",
  inputFocus: "#0D7A72",
  inputHover: "#F0EAD9",

  rule: "#E5DECF",
};
const FONT_SERIF = "'Fraunces', 'Georgia', serif";
const FONT_SANS = "'DM Sans', system-ui, sans-serif";
const FONT_MONO = "'JetBrains Mono', ui-monospace, monospace";

const MOMENTOS = {
  preoperatorio:  { label: "Preoperatorio",  icon: "🔵", color: COLORS.blue,  bg: COLORS.blueBg,  short: "Pre-op" },
  postoperatorio: { label: "Postoperatorio", icon: "🟢", color: COLORS.green, bg: COLORS.greenBg, short: "Post-op" }
};

// ═══════════════════════════════════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════════════════════════════════
const normalizeName = (text) =>
  text.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9\s\-]/g, "");

const resizeImage = (file, maxWidth = 1000, quality = 0.7) =>
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

const dataURLtoBlob = (dataUrl) => {
  const arr = dataUrl.split(",");
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length; const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new Blob([u8arr], { type: mime });
};

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const hoy = () => new Date().toISOString().slice(0, 10);

// ID de caso público: GAP-YYYY-XXXX (XXXX alfanumérico sin 0/O/1/I/L para no confundir)
const CASE_ID_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const generarCasoId = () => {
  const year = new Date().getFullYear();
  let s = "";
  for (let i = 0; i < 4; i++) s += CASE_ID_ALPHABET[Math.floor(Math.random() * CASE_ID_ALPHABET.length)];
  return `GAP-${year}-${s}`;
};
const normalizeIniciales = (s) =>
  s.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z]/g, "").slice(0, 5);

const cirugiasTexto = (cirugias) =>
  cirugias.map(c => {
    const tipo = c.tipo === "otro" ? c.tipoCustom : c.tipo;
    const segs = c.segmentos.length > 0 ? c.segmentos.join(", ") : "sin segmentos";
    return `${tipo} (${segs})`;
  }).join(" | ");

const nombreCompleto = (apellidos, nombre) => {
  const a = (apellidos || "").trim(); const n = (nombre || "").trim();
  return (a && n) ? `${a} ${n}` : (a || n || "");
};

// IMC según OMS
function calcularIMC(peso, talla) {
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

function calcularDiferencia(fechaEstudio, fechaCirugia, tipoEvaluacion) {
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

// ═══════════════════════════════════════════════════════════════════════════
// LÓGICA GAP
// ═══════════════════════════════════════════════════════════════════════════
function classify(score) {
  if (score <= 2) return { label: "Proporcionado", color: COLORS.green, bg: COLORS.greenBg, risk: "Riesgo bajo (~4%)" };
  if (score <= 6) return { label: "Moderadamente Desproporcionado", color: COLORS.yellow, bg: COLORS.yellowBg, risk: "Riesgo moderado (~36-57%)" };
  return { label: "Severamente Desproporcionado", color: COLORS.red, bg: COLORS.redBg, risk: "Riesgo alto (~73-100%)" };
}
const rpvCalc = (s, i) => { const d = s - i; return d < -15 ? { score: 3, label: "Retroversion Severa", sub: "< -15°" } : d < -7 ? { score: 2, label: "Retroversion Moderada", sub: "-15° a -7.1°" } : d <= 5 ? { score: 0, label: "Alineado", sub: "-7° a 5°" } : { score: 1, label: "Anteversion", sub: "> 5°" }; };
const rllCalc = (s, i) => { const d = s - i; return d < -25 ? { score: 3, label: "Hipolordosis Severa", sub: "< -25°" } : d < -14 ? { score: 2, label: "Hipolordosis Moderada", sub: "-25° a -14.1°" } : d <= 11 ? { score: 0, label: "Alineado", sub: "-14° a 11°" } : { score: 3, label: "Hiperlordosis", sub: "> 11°" }; };
const ldiCalc = (l4, l1) => { if (l1 === 0) return { score: 0, label: "N/A", sub: "-", value: 0 }; const p = (l4 / l1) * 100; return p < 40 ? { score: 2, label: "Maldistribuido (bajo)", sub: "< 40%", value: p } : p < 50 ? { score: 1, label: "Maldistribucion Moderada", sub: "40-49%", value: p } : p <= 80 ? { score: 0, label: "Alineado", sub: "50-80%", value: p } : { score: 3, label: "Maldistribuido (alto)", sub: "> 80%", value: p }; };
const rsaCalc = (s, i) => { const d = s - i; return d > 18 ? { score: 3, label: "Desajuste Positivo Severo", sub: "> 18°" } : d > 10 ? { score: 1, label: "Desajuste Positivo Moderado", sub: "10.1° a 18°" } : d >= -7 ? { score: 0, label: "Alineado", sub: "-7° a 10°" } : { score: 1, label: "Desajuste Negativo", sub: "< -7°" }; };
const afCalc = (a) => a >= 60 ? { score: 1, label: ">= 60 años", sub: "+1 pt" } : { score: 0, label: "< 60 años", sub: "0 pts" };

// Tilts vertebrales (Hills 2022) — IC 80% poblacional sano (n=320)
// Tres niveles: Normal (dentro IC 80%) · Borderline (≤2° fuera) · Alterado (>2° fuera)
const TILT_NORMS = {
  c2: { lo: -4.4, hi: -1.1, label: "C2 tilt", normalText: "−4.4° a −1.1°" },
  t1: { lo: -7.0, hi: -3.6, label: "T1 tilt", normalText: "−7.0° a −3.6°" },
  l1: { lo: -10.3, hi: -5.1, label: "L1 tilt", normalText: "−10.3° a −5.1°" }
};
const TILT_TOL = 2; // ° de tolerancia para "Borderline"
const tiltClass = (v, lo, hi) => {
  if (v >= lo && v <= hi) return { level: "ok", label: "Normal", color: COLORS.green, bg: COLORS.greenBg };
  if (v >= lo - TILT_TOL && v <= hi + TILT_TOL) return { level: "warn", label: "Borderline", color: COLORS.yellow, bg: COLORS.yellowBg };
  return { level: "bad", label: "Alterado", color: COLORS.red, bg: COLORS.redBg };
};
// Calcula tilt directo + derivado (PA−PT) + delta entre ambos + clasificación
const computeTilt = (key, direct, pa, pt) => {
  const norm = TILT_NORMS[key];
  const hasDirect = direct !== "" && direct !== null && direct !== undefined && !Number.isNaN(Number(direct));
  const hasDerived = pa !== "" && pa !== null && pa !== undefined && !Number.isNaN(Number(pa)) && pt !== null && !Number.isNaN(pt);
  if (!hasDirect && !hasDerived) return null;
  const d = hasDirect ? Number(direct) : null;
  const der = hasDerived ? (Number(pa) - pt) : null;
  // Para clasificar, prioriza el directo (es la medición); si no hay, usa derivado
  const ref = hasDirect ? d : der;
  const cls = tiltClass(ref, norm.lo, norm.hi);
  const delta = (hasDirect && hasDerived) ? (d - der) : null;
  return { direct: d, derived: der, delta, cls, norm };
};

// ═══════════════════════════════════════════════════════════════════════════
// Roussouly — clasificación actualizada
// ═══════════════════════════════════════════════════════════════════════════
// Asignación del tipo actual (Bari 2020, Fig. 2 · Laouissat/Roussouly 2017):
//   SS < 35°        → NVL ≤ 3 → Tipo 1 ; NVL > 3 → Tipo 2
//   35° ≤ SS < 45°  → PI < 50° Y PT < 5° → Tipo 3-AP ; en caso contrario → Tipo 3
//   SS ≥ 45°        → Tipo 4
// Tipo ideal / objetivo quirúrgico (Bari 2020, Fig. 3):
//   Tipo 1 → PI < 50° : Tipo 1   | PI ≥ 50° : Tipo 3 ó 4
//   Tipo 2 → PI < 50° : Tipo 2   | PI ≥ 50° : Tipo 3 ó 4
//   Tipo 3 → PI < 50° y PT < 5° : Tipo 3-AP | PI ≥ 50° : PT < 25° → Tipo 3 ; PT ≥ 25° → Tipo 4
//   Tipo 4 → Tipo 4
// Regla de concordancia por PI (Sebaaly 2020, Eur Spine J): PI < 50° debe restaurarse
// a tipo 1 ó 2; PI ≥ 50° a tipo 3 ó 4. No cumplirla: RR 3 de complicación mecánica.
const R_TYPES = {
  "1":    { label: "Tipo 1", short: "1", desc: "SS < 35° con lordosis corta (≤ 3 vértebras lordóticas). Apex bajo (L5), arco inferior corto y cifosis toracolumbar por encima. Asociado a PI baja." },
  "2":    { label: "Tipo 2", short: "2", desc: "SS < 35° con lordosis larga y plana (> 3 vértebras lordóticas). Dorso plano global con punto de inflexión alto. Asociado a PI baja." },
  "3":    { label: "Tipo 3 (armónico)", short: "3", desc: "SS 35–45°. Apex en L4, distribución armónica de los arcos lordóticos. El patrón más frecuente en población sana." },
  "3AP":  { label: "Tipo 3 anteverted", short: "3-AP", desc: "SS ≥ 35° con PI < 50° y PT < 5°: pelvis anteverted. Lordosis prominente sobre una pelvis de baja incidencia (Laouissat 2017)." },
  "4":    { label: "Tipo 4", short: "4", desc: "SS ≥ 45° con PI alta. Apex en L3 o superior, lordosis larga y angulada con arco inferior prominente." },
  "1|2":  { label: "Tipo 1 ó 2", short: "1 / 2", desc: "SS < 35°: corresponde a tipo 1 ó 2. Para diferenciarlos se requiere el número de vértebras lordóticas (≤ 3 → tipo 1; > 3 → tipo 2)." },
  "3|4":  { label: "Tipo 3 ó 4", short: "3 / 4", desc: "Objetivo: restaurar lordosis hasta un shape de PI alta (tipo 3 ó 4). El PT residual esperado define cuál de los dos." },
};
const R_LOW_PI = ["1", "2", "1|2"];
const R_HIGH_PI = ["3", "4", "3|4"];

function roussoulyCurrentType(ss, pi, pt, nvl) {
  if (ss === null || ss === undefined || Number.isNaN(ss)) return null;
  if (ss < 35) {
    if (nvl === null || nvl === undefined) return { key: "1|2", uncertain: "nvl" };
    return { key: nvl <= 3 ? "1" : "2" };
  }
  if (ss >= 45) return { key: "4" };
  // 35° ≤ SS < 45°
  if (pi === null || pi === undefined || pt === null || pt === undefined) {
    return { key: "3", uncertain: "piPt" };
  }
  return { key: pi < 50 && pt < 5 ? "3AP" : "3" };
}

function roussoulyIdealType(curKey, pi, pt) {
  if (!curKey || pi === null || pi === undefined) return null;
  if (curKey === "4") return { key: "4" };
  if (curKey === "1" || curKey === "2" || curKey === "1|2") {
    return pi < 50 ? { key: curKey } : { key: "3|4" };
  }
  // Tipo 3 / 3-AP de partida
  if (pi >= 50) {
    if (pt === null || pt === undefined) return { key: "3|4", uncertain: "pt" };
    return { key: pt < 25 ? "3" : "4" };
  }
  // PI < 50°
  if (pt !== null && pt !== undefined && pt < 5) return { key: "3AP" };
  // PI < 50° con PT ≥ 5°: rama no contemplada en la Fig. 3; se aplica la regla por PI
  return { key: "1|2", inferred: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// PDF
// ═══════════════════════════════════════════════════════════════════════════
// Helper: formatea un número con grado, o "-"
function fmtDeg(v) {
  if (v === null || v === undefined || v === "" || Number.isNaN(Number(v))) return "—";
  return `${Number(v).toFixed(1)}°`;
}

function buildPDF(inputs, result) {
  const { age, pi, ss, pt, l1s1, l4s1, gt, l1pa, t4pa, paciente, medico, cirugias, fotos, tipoEvaluacion, fechaEstudio, fechaCirugia, diffInfo, peso, talla, imc, hillsResult, tiltsResult, derivedKey, sva, bmdTscore, schwabResult, roussoulyResult, gapbResult } = inputs;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, M = 18, CW = W - M * 2;
  let y = 18;
  // Helper: salto de página si falta espacio
  const ensureSpace = (needed) => { if (y + needed > 268) { doc.addPage(); y = 22; } };
  doc.setFillColor(13, 148, 136); doc.rect(0, 0, W, 16, "F");
  doc.setTextColor(255, 255, 255); doc.setFontSize(13); doc.setFont("helvetica", "bold");
  doc.text("CIRUGIA DE COLUMNA", M, 9.5);
  doc.setFontSize(8); doc.setFont("helvetica", "normal");
  doc.text("Calculadora GAP Score - Analisis espinopelvico", M, 13.5);
  const tipoInfo = MOMENTOS[tipoEvaluacion];
  const badgeColor = tipoEvaluacion === "preoperatorio" ? [29, 78, 216] : [21, 128, 61];
  doc.setFillColor(...badgeColor); doc.roundedRect(W - M - 42, 4, 40, 8, 2, 2, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(8);
  doc.text(tipoInfo.label.toUpperCase(), W - M - 22, 9.5, { align: "center" });
  y = 24;
  const fechaEstTxt = new Date(fechaEstudio + "T00:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
  doc.setFontSize(9); doc.setTextColor(71, 85, 105);
  doc.text(`Fecha del estudio: ${fechaEstTxt}`, M, y);
  if (fechaCirugia) { const t = new Date(fechaCirugia + "T00:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" }); doc.text(`Fecha de cirugia: ${t}`, M + 90, y); }
  y += 7;
  if (diffInfo) { doc.setFont("helvetica", "italic"); doc.setFontSize(8); doc.text(`⏱  ${diffInfo.mensaje}`, M, y); y += 6; }

  if (paciente || medico) {
    doc.setFillColor(250, 247, 242); doc.rect(M, y, CW, 10, "F"); doc.setDrawColor(231, 226, 217); doc.rect(M, y, CW, 10, "S");
    if (paciente) { doc.setTextColor(100, 116, 139); doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.text("PACIENTE", M + 3, y + 4); doc.setTextColor(30, 41, 59); doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text(paciente + (age ? ` (${age} anos)` : ""), M + 3, y + 8); }
    if (medico) { doc.setTextColor(100, 116, 139); doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.text("CIRUJANO RESPONSABLE", M + CW / 2 + 2, y + 4); doc.setTextColor(17, 94, 89); doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text(medico, M + CW / 2 + 2, y + 8); }
    y += 14;
  } else { y += 4; }

  // Antropometría
  if (peso || talla) {
    doc.setFillColor(250, 247, 242); doc.rect(M, y, CW, 8, "F"); doc.setDrawColor(231, 226, 217); doc.rect(M, y, CW, 8, "S");
    doc.setTextColor(100, 116, 139); doc.setFontSize(8); doc.setFont("helvetica", "normal");
    doc.text("ANTROPOMETRIA", M + 3, y + 3.5);
    doc.setTextColor(30, 41, 59); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    let antr = [];
    if (peso) antr.push(`${peso} kg`);
    if (talla) antr.push(`${talla} cm`);
    if (imc) antr.push(`IMC ${imc.valor.toFixed(1)} (${imc.categoria})`);
    doc.text(antr.join("  ·  "), M + 3, y + 7);
    y += 12;
  }

  if (cirugias && cirugias.length > 0) {
    doc.setFillColor(30, 41, 59); doc.rect(M, y, CW, 7, "F"); doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.setFont("helvetica", "bold");
    doc.text(tipoEvaluacion === "preoperatorio" ? "CIRUGIAS PLANIFICADAS" : "CIRUGIAS REALIZADAS", M + 3, y + 4.8); y += 10;
    cirugias.forEach((c, i) => { const tipo = c.tipo === "otro" ? c.tipoCustom : c.tipo; const segs = c.segmentos.length > 0 ? c.segmentos.join(", ") : "—"; doc.setFillColor(i % 2 === 0 ? 250 : 244, i % 2 === 0 ? 247 : 241, i % 2 === 0 ? 242 : 236); doc.rect(M, y, CW, 10, "F"); doc.setTextColor(30, 41, 59); doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.text(`${i + 1}. ${tipo}`, M + 3, y + 4); doc.setTextColor(100, 116, 139); doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.text(`Segmentos: ${segs}`, M + 3, y + 8); y += 11; });
    y += 4;
  }

  doc.setFillColor(30, 41, 59); doc.rect(M, y, CW, 7, "F"); doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.text("MEDICIONES", M + 3, y + 4.8); y += 10;
  const piTag = derivedKey === "pi" ? " (auto)" : "";
  const ssTag = derivedKey === "ss" ? " (auto)" : "";
  const ptTag = derivedKey === "pt" ? " (auto)" : "";
  const med = [
    [`Incidencia Pelv. (PI)${piTag}`, fmtDeg(pi)],
    [`Pendiente Sacra (SS)${ssTag}`, fmtDeg(ss)],
    [`Version Pelvica (PT)${ptTag}`, fmtDeg(pt)],
    ["Lordosis L1-S1", fmtDeg(l1s1)],
    ["Lordosis L4-S1", fmtDeg(l4s1)],
    ["Inclinacion Global (GT)", fmtDeg(gt)]
  ];
  if (l1pa !== "" && l1pa !== undefined) med.push(["L1 Pelvic Angle (L1PA)", fmtDeg(l1pa)]);
  if (t4pa !== "" && t4pa !== undefined) med.push(["T4 Pelvic Angle (T4PA)", fmtDeg(t4pa)]);
  const half = Math.ceil(med.length / 2);
  med.forEach(([k, v], i) => { const col = i < half ? 0 : 1; const row = i < half ? i : i - half; const x = M + col * (CW / 2); const yy = y + row * 7; doc.setFillColor(i % 2 === 0 ? 250 : 244, i % 2 === 0 ? 247 : 241, i % 2 === 0 ? 242 : 236); doc.rect(x, yy, CW / 2 - 1, 6.5, "F"); doc.setTextColor(100, 116, 139); doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.text(k, x + 2, yy + 4.2); doc.setTextColor(30, 41, 59); doc.setFont("helvetica", "bold"); doc.text(v, x + CW / 2 - 3, yy + 4.2, { align: "right" }); });
  y += half * 7 + 6;

  // Layout de columnas para tablas (también lo usan las secciones Hills más abajo).
  const colX = [M, M + 42, M + 90, M + 138];

  // Las secciones GAP (categoría, parámetros, planificación) requieren result completo.
  if (result) {
    const catRgb = result.total <= 2 ? [21, 128, 61] : result.total <= 6 ? [180, 83, 9] : [185, 28, 28];
    doc.setFillColor(...catRgb); doc.roundedRect(M, y, CW, 22, 3, 3, "F"); doc.setTextColor(255, 255, 255); doc.setFontSize(28); doc.setFont("helvetica", "bold"); doc.text(String(result.total), M + 14, y + 15, { align: "center" }); doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.text("/ 13", M + 20, y + 18); doc.setFontSize(13); doc.setFont("helvetica", "bold"); doc.text(result.cat.label, M + 30, y + 10); doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.text(result.cat.risk, M + 30, y + 17); y += 28;

    doc.setFillColor(30, 41, 59); doc.rect(M, y, CW, 7, "F"); doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text("PARAMETROS GAP", M + 3, y + 4.8); y += 10;
    const sc = (s) => s === 0 ? [21, 128, 61] : s <= 1 ? [180, 83, 9] : [185, 28, 28];
    [{ name: "RPV  Version Pelvica Relativa", r: result.rpv, diff: `${result.rpv.diff >= 0 ? "+" : ""}${result.rpv.diff.toFixed(1)}°` }, { name: "RLL  Lordosis Lumbar Relativa", r: result.rll, diff: `${result.rll.diff >= 0 ? "+" : ""}${result.rll.diff.toFixed(1)}°` }, { name: "ILD  Indice de Distribucion", r: result.ldi, diff: `${result.ldi.value.toFixed(1)}%` }, { name: "ASR  Alineacion Espinopelvica", r: result.rsa, diff: `${result.rsa.diff >= 0 ? "+" : ""}${result.rsa.diff.toFixed(1)}°` }, { name: "FE   Factor de Edad", r: result.af, diff: "" }].forEach(({ name, r, diff }, i) => { const bg = i % 2 === 0 ? [250, 247, 242] : [244, 241, 236]; doc.setFillColor(...bg); doc.rect(M, y, CW - 14, 8, "F"); doc.setFillColor(...sc(r.score)); doc.rect(M + CW - 13, y, 13, 8, "F"); doc.setTextColor(30, 41, 59); doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.text(name, M + 2, y + 3.2); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 116, 139); doc.text(`${r.label}  ${diff}`, M + 2, y + 6.5); doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text(String(r.score), M + CW - 6.5, y + 5.5, { align: "center" }); y += 9; });
    y += 4;

    doc.setFillColor(30, 41, 59); doc.rect(M, y, CW, 7, "F"); doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text("PLANIFICACION PREOPERATORIA", M + 3, y + 4.8); y += 10;
    doc.setFillColor(30, 41, 59); doc.rect(M, y, CW, 7, "F"); doc.setTextColor(255, 255, 255); doc.setFontSize(8);
    ["Parametro", "Actual", "Ideal", "Correccion"].forEach((c, i) => { doc.setFont("helvetica", "bold"); doc.text(c, colX[i] + (i === 0 ? 2 : 0), y + 4.8); }); y += 8;

    // Incluye L4-S1 ideal = L1-S1 ideal × 0.65
    const idealL4S1 = result.idealLL * 0.65;
    const planRows = [
      { name: "SS", cur: Number(ss), ideal: result.idealSS },
      { name: "L1-S1", cur: Number(l1s1), ideal: result.idealLL },
      ...(hillsResult ? [{ name: "L1-S1 (Hills)", cur: Number(l1s1), ideal: hillsResult.idealLL_Hills, hills: true }] : []),
      { name: "L4-S1", cur: Number(l4s1), ideal: idealL4S1 },
      { name: "GT", cur: Number(gt), ideal: result.idealGT }
    ];
    planRows.forEach(({ name, cur, ideal, hills }, i) => {
      const corr = ideal - cur;
      const cc = Math.abs(corr) < 5 ? [21, 128, 61] : Math.abs(corr) < 15 ? [180, 83, 9] : [185, 28, 28];
      doc.setFillColor(i % 2 === 0 ? 250 : 244, i % 2 === 0 ? 247 : 241, i % 2 === 0 ? 242 : 236);
      doc.rect(M, y, CW, 7, "F");
      if (hills) doc.setTextColor(109, 40, 217); else doc.setTextColor(17, 94, 89);
      doc.setFont("helvetica", "bold"); doc.setFontSize(9);
      doc.text(name, colX[0] + 2, y + 4.8);
      doc.setTextColor(30, 41, 59); doc.setFont("helvetica", "normal"); doc.setFontSize(8);
      doc.text(`${cur.toFixed(1)}°`, colX[1], y + 4.8);
      doc.setTextColor(21, 128, 61);
      doc.text(`${ideal.toFixed(1)}°`, colX[2], y + 4.8);
      doc.setTextColor(...cc); doc.setFont("helvetica", "bold");
      doc.text(`${corr >= 0 ? "+" : ""}${corr.toFixed(1)}°`, colX[3], y + 4.8);
      y += 7;
    });
  } else {
    // Reporte parcial: anotamos qué falta para que el cirujano sepa por qué no hay GAP score.
    const faltantes = [];
    if (pi === "" || pi === null || pi === undefined) faltantes.push("PI");
    if (ss === "" || ss === null || ss === undefined) faltantes.push("SS");
    if (l1s1 === "" || l1s1 === null) faltantes.push("L1-S1");
    if (l4s1 === "" || l4s1 === null) faltantes.push("L4-S1");
    if (gt === "" || gt === null) faltantes.push("GT");
    if (age === "" || age === null) faltantes.push("Edad");
    doc.setFillColor(244, 241, 236); doc.rect(M, y, CW, 14, "F");
    doc.setDrawColor(231, 226, 217); doc.rect(M, y, CW, 14, "S");
    doc.setTextColor(100, 116, 139); doc.setFont("helvetica", "italic"); doc.setFontSize(9);
    doc.text("GAP Score no calculado: mediciones incompletas.", M + 3, y + 5.5);
    doc.setFontSize(8);
    doc.text(faltantes.length ? `Faltan: ${faltantes.join(", ")}.` : "", M + 3, y + 10.5);
    y += 18;
  }

  // Eje T4-L1-Cadera (Hills 2022)
  if (hillsResult) {
    ensureSpace(30);
    y += 4;
    doc.setFillColor(109, 40, 217); doc.rect(M, y, CW, 7, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text("EJE T4-L1-CADERA  (Hills et al., Spine 2022)", M + 3, y + 4.8); y += 10;

    const l1paCur = Number(l1pa);
    const l1paAbs = Math.abs(hillsResult.l1paDiff);
    const l1paCC = l1paAbs < 4 ? [21, 128, 61] : l1paAbs < 8 ? [180, 83, 9] : [185, 28, 28];
    doc.setFillColor(250, 247, 242); doc.rect(M, y, CW, 7, "F");
    doc.setTextColor(109, 40, 217); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text("L1PA", M + 2, y + 4.8);
    doc.setTextColor(30, 41, 59); doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    doc.text(`${l1paCur.toFixed(1)}°`, colX[1], y + 4.8);
    doc.setTextColor(21, 128, 61);
    doc.text(`${hillsResult.idealL1PA.toFixed(1)}°`, colX[2], y + 4.8);
    doc.setTextColor(...l1paCC); doc.setFont("helvetica", "bold");
    doc.text(`${hillsResult.l1paDiff >= 0 ? "+" : ""}${hillsResult.l1paDiff.toFixed(1)}°`, colX[3], y + 4.8);
    y += 7;

    if (hillsResult.ejeDiff !== null) {
      const ejeAbs = Math.abs(hillsResult.ejeDiff);
      const ejeCC = ejeAbs <= 4 ? [21, 128, 61] : ejeAbs <= 8 ? [180, 83, 9] : [185, 28, 28];
      doc.setFillColor(244, 241, 236); doc.rect(M, y, CW, 7, "F");
      doc.setTextColor(109, 40, 217); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
      doc.text("T4PA vs L1PA", M + 2, y + 4.8);
      doc.setTextColor(30, 41, 59); doc.setFont("helvetica", "normal"); doc.setFontSize(8);
      doc.text(`${Number(t4pa).toFixed(1)}°`, colX[1], y + 4.8);
      doc.setTextColor(21, 128, 61);
      doc.text(`${l1paCur.toFixed(1)}°`, colX[2], y + 4.8);
      doc.setTextColor(...ejeCC); doc.setFont("helvetica", "bold");
      doc.text(`${hillsResult.ejeDiff >= 0 ? "+" : ""}${hillsResult.ejeDiff.toFixed(1)}°`, colX[3], y + 4.8);
      y += 7;
      doc.setFont("helvetica", "italic"); doc.setFontSize(8); doc.setTextColor(...ejeCC);
      doc.text(hillsResult.ejeLabel, M + 2, y + 4); y += 6;
    }
  }

  // Tilts vertebrales (Hills 2022) — opcional
  if (tiltsResult && (tiltsResult.c2 || tiltsResult.t1 || tiltsResult.l1)) {
    ensureSpace(40);
    y += 4;
    doc.setFillColor(109, 40, 217); doc.rect(M, y, CW, 7, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text("TILTS VERTEBRALES  (Hills et al., Spine 2022)", M + 3, y + 4.8); y += 8;
    doc.setFillColor(30, 41, 59); doc.rect(M, y, CW, 6, "F"); doc.setTextColor(255, 255, 255); doc.setFontSize(7.5);
    ["Nivel", "Directo", "Derivado (PA-PT)", "Categoria"].forEach((c, i) => { doc.setFont("helvetica", "bold"); doc.text(c, colX[i] + (i === 0 ? 2 : 0), y + 4); });
    y += 7;
    [{ key: "c2", n: "C2 tilt", normal: "-4.4 a -1.1" }, { key: "t1", n: "T1 tilt", normal: "-7.0 a -3.6" }, { key: "l1", n: "L1 tilt", normal: "-10.3 a -5.1" }].forEach((row, i) => {
      const r = tiltsResult[row.key]; if (!r) return;
      const cc = r.cls.level === "ok" ? [21, 128, 61] : r.cls.level === "warn" ? [180, 83, 9] : [185, 28, 28];
      const bg = i % 2 === 0 ? [250, 247, 242] : [244, 241, 236];
      doc.setFillColor(...bg); doc.rect(M, y, CW, 6.5, "F");
      doc.setTextColor(109, 40, 217); doc.setFont("helvetica", "bold"); doc.setFontSize(8);
      doc.text(row.n, M + 2, y + 4.3);
      doc.setTextColor(30, 41, 59); doc.setFont("helvetica", "normal"); doc.setFontSize(8);
      doc.text(r.direct !== null ? `${r.direct.toFixed(1)}°` : "—", colX[1], y + 4.3);
      doc.text(r.derived !== null ? `${r.derived.toFixed(1)}°` : "—", colX[2], y + 4.3);
      doc.setTextColor(...cc); doc.setFont("helvetica", "bold");
      doc.text(r.cls.label, colX[3], y + 4.3);
      y += 6.5;
      if (r.delta !== null) {
        const dCC = Math.abs(r.delta) <= 1 ? [21, 128, 61] : Math.abs(r.delta) <= 3 ? [180, 83, 9] : [185, 28, 28];
        doc.setFont("helvetica", "italic"); doc.setFontSize(7); doc.setTextColor(...dCC);
        doc.text(`Δ directo - derivado = ${r.delta >= 0 ? "+" : ""}${r.delta.toFixed(1)}°  ·  Normal: ${row.normal}°`, M + 4, y + 3.5);
        y += 5;
      }
    });
    if (tiltsResult.pt !== null) {
      doc.setFont("helvetica", "italic"); doc.setFontSize(7); doc.setTextColor(100, 116, 139);
      doc.text(`PT derivado de PI - SS = ${tiltsResult.pt.toFixed(1)}°`, M + 2, y + 3.5);
      y += 5;
    }
  }

  // SRS-Schwab classification (Schwab 2012)
  if (schwabResult && (schwabResult.piLL || schwabResult.pt || schwabResult.sva)) {
    ensureSpace(36);
    y += 4;
    doc.setFillColor(180, 83, 9); doc.rect(M, y, CW, 7, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text("CLASIFICACION SRS-SCHWAB  (Schwab et al., Spine 2012)", M + 3, y + 4.8); y += 8;
    doc.setFillColor(30, 41, 59); doc.rect(M, y, CW, 6, "F"); doc.setTextColor(255, 255, 255); doc.setFontSize(7.5);
    ["Modificador", "Valor", "Grado", "Umbrales"].forEach((c, i) => { doc.setFont("helvetica", "bold"); doc.text(c, colX[i] + (i === 0 ? 2 : 0), y + 4); });
    y += 7;
    const gradeRgb = (g) => !g ? [100, 116, 139] : g.g === "0" ? [21, 128, 61] : g.g === "+" ? [180, 83, 9] : [185, 28, 28];
    [
      { name: "PI - LL", val: schwabResult.piLLVal, grade: schwabResult.piLL, unit: "°",  th: "0:<10  +:10-20  ++:>20" },
      { name: "PT",      val: schwabResult.ptVal,   grade: schwabResult.pt,   unit: "°",  th: "0:<20  +:20-30  ++:>30" },
      { name: "SVA",     val: schwabResult.svaVal,  grade: schwabResult.sva,  unit: " cm", th: "0:<4  +:4-9.5  ++:>9.5" },
    ].forEach((row, i) => {
      const bg = i % 2 === 0 ? [250, 247, 242] : [244, 241, 236];
      doc.setFillColor(...bg); doc.rect(M, y, CW, 6.5, "F");
      doc.setTextColor(180, 83, 9); doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.text(row.name, M + 2, y + 4.3);
      doc.setTextColor(30, 41, 59); doc.setFont("helvetica", "normal"); doc.setFontSize(8);
      doc.text(row.val !== null && row.val !== undefined ? `${row.val.toFixed(1)}${row.unit}` : "—", colX[1], y + 4.3);
      const gc = gradeRgb(row.grade);
      doc.setTextColor(...gc); doc.setFont("helvetica", "bold"); doc.text(row.grade ? row.grade.g : "—", colX[2], y + 4.3);
      doc.setTextColor(100, 116, 139); doc.setFont("helvetica", "normal"); doc.setFontSize(7);
      doc.text(row.th, colX[3], y + 4.3);
      y += 6.5;
    });
    if (schwabResult.piLL && schwabResult.pt && schwabResult.sva) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(30, 41, 59);
      doc.text(`Resumen sagital: PI-LL ${schwabResult.piLL.g}  ·  PT ${schwabResult.pt.g}  ·  SVA ${schwabResult.sva.g}`, M + 2, y + 5);
      y += 7;
    }
  }

  // Roussouly classification
  if (roussoulyResult) {
    // Wrap description text and compute total box height
    const descLines = doc.splitTextToSize(roussoulyResult.desc, CW - 44);
    const descH = descLines.length * 3.2;
    const boxH = Math.max(16, 11 + descH);
    const idealLines = roussoulyResult.ideal ? doc.splitTextToSize(roussoulyResult.ideal.desc, CW - 44) : [];
    const idealH = roussoulyResult.ideal ? Math.max(14, 9 + idealLines.length * 3.2) : 0;
    const matchH = roussoulyResult.piMatch ? 12 : 0;
    ensureSpace(boxH + idealH + matchH + 14);
    y += 4;
    doc.setFillColor(34, 211, 238); doc.rect(M, y, CW, 7, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text("CLASIFICACION ROUSSOULY  (Laouissat 2017 / Sebaaly 2020 / Bari 2020)", M + 3, y + 4.8); y += 9;
    const rRgb = roussoulyResult.color === COLORS.green ? [21, 128, 61] : roussoulyResult.color === COLORS.red ? [185, 28, 28] : [14, 116, 144];
    doc.setFillColor(250, 247, 242); doc.rect(M, y, CW, boxH, "F");
    doc.setDrawColor(...rRgb); doc.setLineWidth(0.6); doc.rect(M, y, CW, boxH, "S");
    doc.setTextColor(...rRgb); doc.setFont("helvetica", "bold"); doc.setFontSize(16);
    doc.text(`Tipo ${roussoulyResult.type}`, M + 4, y + boxH / 2 + 3);
    doc.setFontSize(9); doc.setTextColor(30, 41, 59);
    doc.text(`ACTUAL  ·  ${roussoulyResult.label}`, M + 40, y + 5);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(100, 116, 139);
    doc.text(roussoulyResult.params, M + 40, y + 9);
    doc.text(descLines, M + 40, y + 13);
    y += boxH + 3;

    // Tipo ideal / objetivo quirúrgico (Bari 2020, Fig. 3)
    if (roussoulyResult.ideal) {
      doc.setFillColor(244, 241, 236); doc.rect(M, y, CW, idealH, "F");
      doc.setDrawColor(148, 163, 184); doc.setLineWidth(0.4); doc.rect(M, y, CW, idealH, "S");
      doc.setTextColor(51, 65, 85); doc.setFont("helvetica", "bold"); doc.setFontSize(14);
      doc.text(`Tipo ${roussoulyResult.ideal.type}`, M + 4, y + idealH / 2 + 2.5);
      doc.setFontSize(8.5); doc.setTextColor(30, 41, 59);
      doc.text(`${roussoulyResult.esPost ? "IDEAL (orientativo)" : "IDEAL / OBJETIVO"}  ·  ${roussoulyResult.ideal.label}`, M + 40, y + 5);
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(100, 116, 139);
      doc.text(idealLines, M + 40, y + 9);
      y += idealH + 3;
    }

    // Concordancia con la PI (Sebaaly 2020)
    if (roussoulyResult.piMatch) {
      const lvl = roussoulyResult.piMatch.level;
      const mRgb = lvl === "ok" ? [21, 128, 61] : lvl === "warn" ? [180, 83, 9] : [185, 28, 28];
      const piTxt = `PI ${roussoulyResult.piMatch.piLow ? "< 50" : ">= 50"}: se espera ${roussoulyResult.piMatch.esperadoLabel}.`;
      doc.setFillColor(...mRgb); doc.rect(M, y, CW, 10, "F");
      doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(8.5);
      doc.text(
        lvl === "ok" ? (roussoulyResult.esPost ? "FORMA RESTAURADA (concordante con la PI)" : "CONCORDANTE con la PI")
          : lvl === "warn" ? "CONCORDANCIA CON RESERVAS"
            : (roussoulyResult.esPost ? "FORMA NO RESTAURADA (discordante con la PI)" : "NO CONCORDANTE con la PI"),
        M + 3, y + 4.2);
      doc.setFont("helvetica", "normal"); doc.setFontSize(7);
      doc.text(
        lvl === "ok"
          ? `${piTxt} Forma sagital acorde a la incidencia pelvica.`
          : lvl === "warn"
            ? `${piTxt} Tipo 3 anteverted: variante normal, pero objetivo quirurgico desfavorable (mayor tasa de PJK).`
            : `${piTxt} No restaurar la forma = RR 3 (IC 1.5-4.3) de complicacion mecanica (Sebaaly 2020); OR 4.7 de revision (Bari 2020).`,
        M + 3, y + 7.8
      );
      y += 13;
    }
  }

  // GAP-B (Noh 2020)
  if (gapbResult) {
    ensureSpace(28);
    y += 4;
    doc.setFillColor(15, 118, 110); doc.rect(M, y, CW, 7, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text("GAP-B  (Noh et al., Spine J 2020)", M + 3, y + 4.8); y += 9;
    const gRgb = gapbResult.cat.color === COLORS.green ? [21, 128, 61] : gapbResult.cat.color === COLORS.yellow ? [180, 83, 9] : [185, 28, 28];
    doc.setFillColor(...gRgb); doc.roundedRect(M, y, CW, 16, 2, 2, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(18);
    doc.text(`${(gapbResult.prob * 100).toFixed(0)}%`, M + 12, y + 10, { align: "center" });
    doc.setFontSize(11); doc.text(gapbResult.cat.label, M + 30, y + 7);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
    doc.text(`IMC ${gapbResult.bmi.toFixed(1)}  ·  T-score ${gapbResult.tscore.toFixed(1)}  ·  GAP ${gapbResult.gap} pts`, M + 30, y + 12);
    doc.text("Probabilidad de complicacion mecanica a 2 anos", M + 30, y + 14.5);
    y += 19;
    doc.setFont("helvetica", "italic"); doc.setFontSize(6.5); doc.setTextColor(100, 116, 139);
    doc.text("Aproximacion logistica de HRs publicados (BMI 1.284, BMD 0.277, GAP 1.457). Nomograma original = Noh 2020 Fig 2.", M + 2, y + 3);
    y += 5;
  }

  if (fotos && fotos.length > 0) {
    doc.addPage(); y = 18; doc.setFillColor(13, 148, 136); doc.rect(0, 0, W, 16, "F");
    doc.setTextColor(255, 255, 255); doc.setFontSize(13); doc.setFont("helvetica", "bold");
    doc.text(`IMAGENES ADJUNTAS - ${tipoInfo.label.toUpperCase()}`, M, 9.5); y = 24;
    const thumbW = 80, thumbH = 60, gap = 6; let col = 0;
    fotos.forEach((f) => {
      if (y + thumbH > 270) { doc.addPage(); y = 20; col = 0; }
      const x = M + col * (thumbW + gap);
      try { doc.addImage(f.dataUrl, "JPEG", x, y, thumbW, thumbH); } catch (e) {}
      doc.setTextColor(100, 116, 139); doc.setFontSize(8); doc.setFont("helvetica", "normal");
      doc.text(f.categoria || "Sin categoria", x, y + thumbH + 4);
      col++; if (col >= 2) { col = 0; y += thumbH + 12; }
    });
  }

  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFillColor(30, 41, 59); doc.rect(0, 278, W, 19, "F");
    doc.setTextColor(148, 163, 184); doc.setFontSize(7); doc.setFont("helvetica", "normal");
    doc.text("Herramienta de calculo espinopelvico - No sustituye el juicio clinico del medico tratante", M, 284);
    doc.text("El uso de este calculo es responsabilidad del medico que lo utiliza", M, 287.5);
    // Version del algoritmo: hace trazable cada reporte a la version que lo genero.
    doc.text(`v${APP_VERSION}`, M, 291);
    doc.text(`Pagina ${p} de ${totalPages}`, W - M, 287.5, { align: "right" });
    if (medico) {
      doc.setDrawColor(94, 234, 212); doc.setLineWidth(0.5); doc.line(W - M - 50, 288, W - M, 288);
      doc.setTextColor(203, 213, 225); doc.setFontSize(7.5); doc.setFont("helvetica", "bold");
      doc.text(medico, W - M - 25, 292.5, { align: "center" });
      doc.setFont("helvetica", "normal"); doc.setFontSize(6.5);
      doc.text("Cirujano Responsable", W - M - 25, 295.5, { align: "center" });
    }
  }
  return doc;
}

// ═══════════════════════════════════════════════════════════════════════════
// CSV export
// ═══════════════════════════════════════════════════════════════════════════
function casosToCSV(casos) {
  const headers = [
    "ID", "Fecha guardado", "Fecha estudio", "Fecha cirugia", "Tipo evaluacion", "Dias diferencia", "Tiempo calculado",
    "Apellidos", "Nombre", "Edad", "Peso kg", "Talla cm", "IMC", "Categoria IMC",
    "Cirujano", "Cirugias",
    "PI", "SS", "PT", "Derivado (PI/SS/PT)", "L1-S1", "L4-S1", "GT",
    "L1PA", "T4PA",
    "Ideal SS", "Ideal L1-S1", "Ideal L4-S1", "Ideal GT",
    "Correccion SS", "Correccion L1-S1", "Correccion L4-S1", "Correccion GT",
    "Ideal L1PA (Hills)", "Delta L1PA", "Ideal L1-S1 (Hills)", "Correccion L1-S1 Hills",
    "T4PA-L1PA", "Eje T4-L1-cadera",
    "C2 tilt directo", "CPA", "C2 tilt derivado", "C2 tilt delta", "C2 tilt categoria",
    "T1 tilt directo", "T1PA", "T1 tilt derivado", "T1 tilt delta", "T1 tilt categoria",
    "L1 tilt directo", "L1 tilt derivado", "L1 tilt delta", "L1 tilt categoria",
    "RPV pts", "RLL pts", "LDI pts", "LDI %", "RSA pts", "FE pts",
    "GAP Total", "Categoria GAP", "Fotos"
  ];
  const escape = (v) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = casos.map(c => {
    const m = c.mediciones || {};
    const r = c.resultado || {};
    const idealSS = 0.59 * m.pi + 9;
    const idealLL = 0.62 * m.pi + 29;
    const idealGT = 0.48 * m.pi - 15;
    const idealL4S1 = idealLL * 0.65;
    const imc = c.imc?.valor?.toFixed(1) || "";
    const imcCat = c.imc?.categoria || "";
    const hasL1PA = m.l1pa !== undefined && m.l1pa !== null && m.l1pa !== "";
    const hasT4PA = m.t4pa !== undefined && m.t4pa !== null && m.t4pa !== "";
    const idealL1PA_H = hasL1PA ? (0.5 * m.pi - 21) : null;
    const deltaL1PA = hasL1PA ? (m.l1pa - idealL1PA_H) : null;
    const idealLL_H = hasL1PA ? (1.4 * m.pi - 1.7 * m.l1pa - 2) : null;
    const corrLL_H = hasL1PA ? (idealLL_H - m.l1s1) : null;
    const ejeDiff = (hasL1PA && hasT4PA) ? (m.t4pa - m.l1pa) : null;
    const ejeLabel = ejeDiff === null ? "" : Math.abs(ejeDiff) <= 4 ? "Alineado" : Math.abs(ejeDiff) <= 8 ? "Desalineacion moderada" : "Desalineacion severa";
    // PT: usar valor guardado, o derivar de PI − SS para casos legados
    const pt = (m.pt !== undefined && m.pt !== null && m.pt !== "") ? Number(m.pt) : ((m.pi !== undefined && m.ss !== undefined) ? (Number(m.pi) - Number(m.ss)) : null);
    const tiltVal = (k) => m[k] !== undefined && m[k] !== null && m[k] !== "" ? Number(m[k]) : null;
    const tiltCsv = (key, directKey, paKey) => {
      const norm = TILT_NORMS[key];
      const direct = tiltVal(directKey);
      const pa = tiltVal(paKey);
      const derived = (pa !== null && pt !== null) ? (pa - pt) : null;
      const ref = direct !== null ? direct : derived;
      const cat = ref !== null ? tiltClass(ref, norm.lo, norm.hi).label : "";
      const delta = (direct !== null && derived !== null) ? (direct - derived) : null;
      return {
        direct: direct !== null ? direct.toFixed(1) : "",
        pa: pa !== null ? pa.toFixed(1) : "",
        derived: derived !== null ? derived.toFixed(1) : "",
        delta: delta !== null ? delta.toFixed(1) : "",
        cat
      };
    };
    const c2t = tiltCsv("c2", "c2tilt", "cpa");
    const t1t = tiltCsv("t1", "t1tilt", "t1pa");
    const l1t = tiltCsv("l1", "l1tilt", "l1pa");
    return [
      c.id,
      c.fecha,
      c.fechaEstudio || "",
      c.fechaCirugia || "",
      c.tipoEvaluacion || "",
      c.diasDiferencia ?? "",
      c.tiempoCalculado || "",
      c.paciente?.apellidos || "",
      c.paciente?.nombre || "",
      c.edad || "",
      c.peso || "",
      c.talla || "",
      imc,
      imcCat,
      c.medico || "",
      cirugiasTexto(c.cirugias || []),
      m.pi ?? "", m.ss ?? "", pt !== null ? pt.toFixed(1) : "", m.derivedKey ?? "", m.l1s1 ?? "", m.l4s1 ?? "", m.gt ?? "",
      hasL1PA ? m.l1pa : "", hasT4PA ? m.t4pa : "",
      idealSS.toFixed(1), idealLL.toFixed(1), idealL4S1.toFixed(1), idealGT.toFixed(1),
      (idealSS - m.ss).toFixed(1),
      (idealLL - m.l1s1).toFixed(1),
      (idealL4S1 - m.l4s1).toFixed(1),
      (idealGT - m.gt).toFixed(1),
      idealL1PA_H !== null ? idealL1PA_H.toFixed(1) : "",
      deltaL1PA !== null ? deltaL1PA.toFixed(1) : "",
      idealLL_H !== null ? idealLL_H.toFixed(1) : "",
      corrLL_H !== null ? corrLL_H.toFixed(1) : "",
      ejeDiff !== null ? ejeDiff.toFixed(1) : "",
      ejeLabel,
      c2t.direct, c2t.pa, c2t.derived, c2t.delta, c2t.cat,
      t1t.direct, t1t.pa, t1t.derived, t1t.delta, t1t.cat,
      l1t.direct, l1t.derived, l1t.delta, l1t.cat,
      r.rpv ?? "", r.rll ?? "", r.ldi ?? "", r.ldiValor ?? "", r.rsa ?? "", r.af ?? "",
      r.total ?? "", r.categoria || "",
      c.fotos?.length || 0
    ].map(escape).join(",");
  });
  return [headers.join(","), ...rows].join("\n");
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTES
// ═══════════════════════════════════════════════════════════════════════════
function InfoTooltip({ text, figureSrc }) {
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

function InputField({ label, tooltip, tooltipFigure, value, onChange, unit = "°", min, max, type = "number", placeholder, step, list, transform, maxLength }) {
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

function SelectField({ label, value, onChange, options, tooltip, placeholder = "Selecciona..." }) {
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

function TipoEvaluacionToggle({ value, onChange }) {
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

function DiffInfoBox({ diffInfo }) {
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

function IMCBadge({ imc }) {
  if (!imc) return null;
  return (
    <div style={{ padding: "10px 14px", borderRadius: 8, background: imc.color + "15", border: `1px solid ${imc.color}44`, fontSize: 12, color: imc.color, marginBottom: 16, marginTop: -6, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontWeight: 600 }}>
      <span>📊 IMC calculado</span>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{imc.valor.toFixed(1)} · {imc.categoria}</span>
    </div>
  );
}

function Chip({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{ padding: "6px 14px", borderRadius: 999, border: `1.5px solid ${active ? COLORS.accent : COLORS.inputBorder}`, background: active ? COLORS.accentDim : COLORS.inputBg, color: active ? COLORS.accentDark : COLORS.textDim, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", transition: "all 0.15s" }}>{label}</button>
  );
}

function CirugiaCard({ cirugia, onUpdate, onRemove, index }) {
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

function ParamRow({ name, diff, score, label, sub, maxScore }) {
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

function ShareButton({ icon, label, color, bg, onClick, disabled }) {
  const [hover, setHover] = useState(false);
  return (
    <button onClick={disabled ? null : onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ flex: 1, minWidth: 100, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 8px", borderRadius: 10, border: `1.5px solid ${disabled ? COLORS.inputBorder : color + "44"}`, background: disabled ? COLORS.inputHover : (hover ? color + "22" : bg), color: disabled ? COLORS.textMuted : color, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.55 : 1, fontSize: 13, fontWeight: 700, transition: "all 0.15s" }}>
      <span style={{ fontSize: 18 }}>{icon}</span>{label}
    </button>
  );
}

function MomentoBadge({ tipo }) {
  const m = MOMENTOS[tipo] || MOMENTOS.preoperatorio;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 6, background: m.bg, border: `1px solid ${m.color}44`, color: m.color, fontSize: 10, fontWeight: 700 }}><span style={{ fontSize: 9 }}>{m.icon}</span> {m.short}</span>;
}

function Card({ children, style = {} }) {
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

function PdfSaveModal({ onSaveAndDownload, onDownloadOnly, onCancel, busy }) {
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

function EmailLoginModal({ email, password, onEmailChange, onPasswordChange, onSubmit, onCancel, error, busy }) {
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

function PublicConsentModal({ onAccept, onCancel, busy }) {
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

function ConsentModal({ onAccept, onReject, userEmail, busy }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(30, 41, 59, 0.6)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: COLORS.card, borderRadius: 16, maxWidth: 560, width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 10px 40px rgba(0,0,0,0.25)" }}>
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${COLORS.cardBorder}`, position: "sticky", top: 0, background: COLORS.card, zIndex: 1 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 6px", color: COLORS.accentDark }}>Consentimiento informado</h2>
          <p style={{ fontSize: 12, color: COLORS.textMuted, margin: 0 }}>gap-calculator · {userEmail}</p>
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

// ═══════════════════════════════════════════════════════════════════════════
// APP
// ═══════════════════════════════════════════════════════════════════════════
export default function GAPCalculator() {
  const [tipoEvaluacion, setTipoEvaluacion] = useState("preoperatorio");
  const [fechaEstudio, setFechaEstudio] = useState(hoy());
  const [fechaCirugia, setFechaCirugia] = useState(hoy());
  const [apellidos, setApellidos] = useState("");
  const [nombre, setNombre] = useState("");
  const [iniciales, setIniciales] = useState("");
  const [casoId, setCasoId] = useState(() => generarCasoId());
  const [age, setAge] = useState("");
  const [peso, setPeso] = useState("");
  const [talla, setTalla] = useState("");
  const [cirujanoSel, setCirujanoSel] = useState("");
  const [cirujanoCustom, setCirujanoCustom] = useState("");
  const [medicoPublic, setMedicoPublic] = useState(""); // input opcional en modo público (solo PDF, no se guarda)
  const medicoBase = cirujanoSel === "Otro (especificar)" ? normalizeName(cirujanoCustom) : cirujanoSel;
  const medico = medicoBase || (medicoPublic ? normalizeName(medicoPublic) : "");
  const [medidorSel, setMedidorSel] = useState("");
  const [medidorCustom, setMedidorCustom] = useState("");
  const medidor = medidorSel === "Otro (especificar)" ? normalizeName(medidorCustom) : medidorSel;
  const [cirugias, setCirugias] = useState([]);
  const [pi, setPI] = useState("");
  const [ss, setSS] = useState("");
  const [pt, setPT] = useState("");
  const [l1s1, setL1S1] = useState("");
  const [l4s1, setL4S1] = useState("");
  const [gt, setGT] = useState("");
  const [l1pa, setL1PA] = useState("");
  const [t4pa, setT4PA] = useState("");
  // Cards colapsables (Hills 2022) — secciones opcionales
  const [hillsOpen, setHillsOpen] = useState(false);
  const [tiltsOpen, setTiltsOpen] = useState(false);
  // Tilts vertebrales (Hills 2022) — opcionales
  const [c2tiltDirect, setC2TiltDirect] = useState("");
  const [cpa, setCPA] = useState("");
  const [t1tiltDirect, setT1TiltDirect] = useState("");
  const [t1pa, setT1PA] = useState("");
  const [l1tiltDirect, setL1TiltDirect] = useState("");
  // SRS-Schwab — SVA en cm (medido en radiografía), card colapsable
  const [sva, setSVA] = useState("");
  const [schwabOpen, setSchwabOpen] = useState(false);
  // Roussouly — card colapsable + NVL (nº de vértebras lordóticas, tipo 1 vs 2)
  const [roussoulyOpen, setRoussoulyOpen] = useState(false);
  const [nvl, setNvl] = useState("");
  // GAP-B (Noh 2020) — añade BMI y BMD T-score al GAP
  const [bmdTscore, setBmdTscore] = useState("");
  const [gapbOpen, setGapbOpen] = useState(false);
  const [fotos, setFotos] = useState([]);
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [casosGuardados, setCasosGuardados] = useState([]);
  const [showCasos, setShowCasos] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [showBiblio, setShowBiblio] = useState(false);

  // Auth
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [allowlisted, setAllowlisted] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  // Login email/password (alterno al de Google)
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPwd, setLoginPwd] = useState("");
  const [loginError, setLoginError] = useState("");
  // Anotador de landmarks
  const [showAnnotator, setShowAnnotator] = useState(false);

  // Splash inicial — dos etapas: 1) VML  2) Dr. Samano
  const [splashStage, setSplashStage] = useState("vml"); // "vml" | "samano" | "done"
  useEffect(() => {
    const t1 = setTimeout(() => setSplashStage("samano"), 1800);
    const t2 = setTimeout(() => setSplashStage("done"), 4000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // Tracking anónimo (modo público)
  const [deviceId, setDeviceId] = useState(null);
  const [usageCount, setUsageCount] = useState(null);
  const [hasCountedSession, setHasCountedSession] = useState(false);
  // Suscripción
  const [subEmail, setSubEmail] = useState("");
  const [subName, setSubName] = useState("");
  const [subBusy, setSubBusy] = useState(false);
  const [subDone, setSubDone] = useState(false);
  // Guardado público (consent + lookup + historial local)
  const [publicConsentAccepted, setPublicConsentAccepted] = useState(false);
  const [showPublicConsentModal, setShowPublicConsentModal] = useState(false);
  const [loadCaseIdInput, setLoadCaseIdInput] = useState("");
  const [loadingCase, setLoadingCase] = useState(false);
  const [myPublicCases, setMyPublicCases] = useState([]);
  const [savedPublicCaseId, setSavedPublicCaseId] = useState(null);

  // Modal "guardar antes de descargar PDF" (modo público, una vez por caso)
  const [showPdfSaveModal, setShowPdfSaveModal] = useState(false);
  const [pendingDownloadAfterSave, setPendingDownloadAfterSave] = useState(false);

  // Encuesta de satisfacción one-time
  const [feedbackDone, setFeedbackDone] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackHover, setFeedbackHover] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackBusy, setFeedbackBusy] = useState(false);

  // Carga inicial: consent público + historial local de casos guardados + flag de encuesta
  useEffect(() => {
    try {
      if (localStorage.getItem(PUBLIC_CONSENT_LS_KEY) === PUBLIC_CONSENT_VERSION) setPublicConsentAccepted(true);
      const arr = JSON.parse(localStorage.getItem(PUBLIC_CASES_LS_KEY) || "[]");
      if (Array.isArray(arr)) setMyPublicCases(arr);
      if (localStorage.getItem("gap_feedback_done") === "1") setFeedbackDone(true);
    } catch (e) {}
  }, []);

  const submitFeedback = async () => {
    if (!feedbackRating) { showToast("Califica con estrellas primero", false); return; }
    if (!firebaseEnabled || !db) { showToast("Servicio no disponible", false); return; }
    setFeedbackBusy(true);
    try {
      await addDoc(collection(db, "feedback"), {
        rating: feedbackRating,
        comment: feedbackComment.trim() || null,
        deviceId: deviceId || null,
        createdAt: serverTimestamp()
      });
      try { localStorage.setItem("gap_feedback_done", "1"); } catch (e) {}
      setFeedbackDone(true);
      showToast("¡Gracias por tu opinión! ✓");
    } catch (e) {
      console.error(e);
      showToast("Error enviando opinión", false);
    }
    setFeedbackBusy(false);
  };

  // Device ID + contador inicial (una vez)
  useEffect(() => {
    let id = null;
    try {
      id = localStorage.getItem("gap_device_id");
      if (!id) {
        id = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        localStorage.setItem("gap_device_id", id);
      }
    } catch (e) {}
    setDeviceId(id);
    if (firebaseEnabled && db) {
      getDoc(doc(db, "stats", "usage"))
        .then(snap => { if (snap.exists()) setUsageCount(snap.data().count || 0); else setUsageCount(0); })
        .catch(() => {});
      if (id) {
        const devRef = doc(db, "devices", id);
        getDoc(devRef).then(snap => {
          if (snap.exists()) {
            updateDoc(devRef, { lastSeen: serverTimestamp(), sessions: increment(1) }).catch(() => {});
          } else {
            setDoc(devRef, { firstSeen: serverTimestamp(), lastSeen: serverTimestamp(), sessions: 1, calcCount: 0 }).catch(() => {});
          }
        }).catch(() => {});
      }
    }
  }, []);

  useEffect(() => {
    if (!firebaseEnabled || !auth) {
      setAuthReady(true);
      loadLocalCasos();
      return;
    }
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const [allowSnap, userSnap] = await Promise.all([
            getDoc(doc(db, "allowlist", u.email)),
            getDoc(doc(db, "users", u.uid))
          ]);
          const isAllowed = allowSnap.exists();
          const hasConsent = userSnap.exists() && userSnap.data().consentVersion === CONSENT_VERSION;
          setAllowlisted(isAllowed);
          setConsentAccepted(hasConsent);
          if (isAllowed && !hasConsent) setShowConsentModal(true);
          if (isAllowed && hasConsent) loadCasos(u);
          else setCasosGuardados([]);
        } catch (e) {
          console.error("Auth check error:", e);
          setAllowlisted(false);
          setConsentAccepted(false);
          setCasosGuardados([]);
        }
      } else {
        setAllowlisted(false);
        setConsentAccepted(false);
        setCasosGuardados([]);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  const loadCasos = async (u) => {
    const usr = u || user;
    if (firebaseEnabled && db && usr) {
      try {
        const q = query(collection(db, "casos"), where("ownerUid", "==", usr.uid), orderBy("fecha", "desc"));
        const snap = await getDocs(q);
        setCasosGuardados(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) { console.error("Firebase load error:", e); setCasosGuardados([]); }
    } else {
      setCasosGuardados([]);
    }
  };
  const loadLocalCasos = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setCasosGuardados(JSON.parse(saved));
    } catch (e) {}
  };

  const canEdit = !firebaseEnabled || (!!user && allowlisted && consentAccepted);
  const paciente = canEdit
    ? nombreCompleto(apellidos, nombre)
    : (iniciales ? `${iniciales} (${casoId})` : casoId);

  const handleLogin = async () => {
    if (!firebaseEnabled || !auth) return;
    setAuthBusy(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      console.error("Login error:", e);
      if (e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request") {
        showToast("Error iniciando sesión", false);
      }
    }
    setAuthBusy(false);
  };

  const handleLogout = async () => {
    if (!auth) return;
    setAuthBusy(true);
    try {
      await signOut(auth);
      showToast("Sesión cerrada");
    } catch (e) { console.error(e); }
    setAuthBusy(false);
  };

  // ─── Login con email/password (Firebase Auth) ────────────────────────────
  const handleEmailLogin = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setLoginError("");
    const email = loginEmail.trim().toLowerCase();
    if (!email || !loginPwd) {
      setLoginError("Completa correo y contraseña.");
      return;
    }
    if (!firebaseEnabled || !auth) {
      setLoginError("Servicio no disponible.");
      return;
    }
    setAuthBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email, loginPwd);
      // onAuthStateChanged dispara el flujo de allowlist + consentimiento.
      setShowLoginModal(false);
      setLoginEmail(""); setLoginPwd(""); setLoginError("");
      showToast("Sesión iniciada ✓");
    } catch (err) {
      console.error("Email login error:", err);
      const code = err && err.code;
      if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found" || code === "auth/invalid-email") {
        setLoginError("Credenciales inválidas.");
      } else if (code === "auth/too-many-requests") {
        setLoginError("Demasiados intentos. Espera unos minutos.");
      } else if (code === "auth/network-request-failed") {
        setLoginError("Sin conexión. Reintenta.");
      } else {
        setLoginError("Error al iniciar sesión.");
      }
    }
    setAuthBusy(false);
  };

  const acceptConsent = async () => {
    if (!user) return;
    setAuthBusy(true);
    try {
      await setDoc(doc(db, "users", user.uid), {
        email: user.email,
        displayName: user.displayName || null,
        consentVersion: CONSENT_VERSION,
        consentAcceptedAt: new Date().toISOString()
      }, { merge: true });
      setConsentAccepted(true);
      setShowConsentModal(false);
      showToast("Consentimiento registrado ✓");
      loadCasos(user);
    } catch (e) {
      console.error(e);
      showToast("Error registrando consentimiento", false);
    }
    setAuthBusy(false);
  };

  const rejectConsent = async () => {
    setShowConsentModal(false);
    await handleLogout();
  };

  const imc = useMemo(() => calcularIMC(peso, talla), [peso, talla]);
  const diffInfo = useMemo(() => calcularDiferencia(fechaEstudio, fechaCirugia, tipoEvaluacion), [fechaEstudio, fechaCirugia, tipoEvaluacion]);

  // Derivación PI = PT + SS: el usuario puede llenar 2 de 3 y el tercero se calcula
  const spinopelvic = useMemo(() => {
    const piN = pi !== "" && pi !== null && !Number.isNaN(Number(pi)) ? Number(pi) : null;
    const ssN = ss !== "" && ss !== null && !Number.isNaN(Number(ss)) ? Number(ss) : null;
    const ptN = pt !== "" && pt !== null && !Number.isNaN(Number(pt)) ? Number(pt) : null;
    const filledCount = [piN, ssN, ptN].filter(v => v !== null).length;
    let effPI = piN, effSS = ssN, effPT = ptN, derivedKey = null, inconsistencyDelta = null;
    if (piN !== null && ssN !== null && ptN === null) { effPT = piN - ssN; derivedKey = "pt"; }
    else if (piN !== null && ptN !== null && ssN === null) { effSS = piN - ptN; derivedKey = "ss"; }
    else if (ssN !== null && ptN !== null && piN === null) { effPI = ssN + ptN; derivedKey = "pi"; }
    else if (filledCount === 3) {
      inconsistencyDelta = piN - (ssN + ptN);
    }
    return { effPI, effSS, effPT, derivedKey, inconsistencyDelta, filledCount };
  }, [pi, ss, pt]);

  const allFilled = spinopelvic.effPI !== null && spinopelvic.effSS !== null && l1s1 !== "" && l4s1 !== "" && gt !== "" && age !== "";

  // ¿Hay AL MENOS un ángulo medido? Habilita export PDF parcial.
  const hasAnyMeasurement =
    spinopelvic.effPI !== null || spinopelvic.effSS !== null || spinopelvic.effPT !== null ||
    l1s1 !== "" || l4s1 !== "" || gt !== "" ||
    l1pa !== "" || t4pa !== "" ||
    c2tiltDirect !== "" || cpa !== "" ||
    t1tiltDirect !== "" || t1pa !== "" ||
    l1tiltDirect !== "";

  const result = useMemo(() => {
    if (!allFilled) return null;
    const piE = spinopelvic.effPI, ssE = spinopelvic.effSS;
    const idealSS = 0.59 * piE + 9, idealLL = 0.62 * piE + 29, idealGT = 0.48 * piE - 15;
    const rpv = rpvCalc(ssE, idealSS), rll = rllCalc(l1s1, idealLL), ldi = ldiCalc(l4s1, l1s1), rsa = rsaCalc(gt, idealGT), af = afCalc(age);
    const total = rpv.score + rll.score + ldi.score + rsa.score + af.score;
    return { idealSS, idealLL, idealGT, rpv: { ...rpv, diff: ssE - idealSS }, rll: { ...rll, diff: l1s1 - idealLL }, ldi, rsa: { ...rsa, diff: gt - idealGT }, af, total, cat: classify(total) };
  }, [age, spinopelvic, l1s1, l4s1, gt, allFilled]);

  // Hills et al. 2022 — T4-L1-Hip Axis (opcional, complementa al GAP)
  const hillsResult = useMemo(() => {
    if (spinopelvic.effPI === null || l1pa === "") return null;
    const piN = spinopelvic.effPI, l1paN = Number(l1pa);
    const idealL1PA = 0.5 * piN - 21;
    const l1paDiff = l1paN - idealL1PA;
    const idealLL_Hills = 1.4 * piN - 1.7 * l1paN - 2;
    const idealLL_Hills_L4S1 = idealLL_Hills * 0.65;
    let ejeDiff = null, ejeStatus = null, ejeLabel = null;
    if (t4pa !== "") {
      ejeDiff = Number(t4pa) - l1paN;
      const abs = Math.abs(ejeDiff);
      if (abs <= 4)      { ejeStatus = "ok";   ejeLabel = "Eje T4-L1-cadera alineado"; }
      else if (abs <= 8) { ejeStatus = "warn"; ejeLabel = "Desalineación moderada"; }
      else               { ejeStatus = "bad";  ejeLabel = "Desalineación severa"; }
    }
    return { idealL1PA, l1paDiff, idealLL_Hills, idealLL_Hills_L4S1, ejeDiff, ejeStatus, ejeLabel };
  }, [spinopelvic, l1pa, t4pa]);

  // Contador atómico de mediciones (una vez por sesión, al primer GAP completo)
  useEffect(() => {
    if (!result || hasCountedSession || !firebaseEnabled || !db) return;
    setHasCountedSession(true);
    setDoc(doc(db, "stats", "usage"), { count: increment(1), lastUpdated: serverTimestamp() }, { merge: true })
      .then(() => setUsageCount(c => (c ?? 0) + 1))
      .catch(() => {});
    if (deviceId) {
      updateDoc(doc(db, "devices", deviceId), { calcCount: increment(1), lastCalcAt: serverTimestamp() }).catch(() => {});
    }
  }, [result, hasCountedSession, deviceId]);

  // Tilts vertebrales C2/T1/L1 (Hills 2022) — opcionales
  // PT efectivo (de spinopelvic): PI − SS, o ingresado directo, o derivado de los otros dos.
  const tiltsResult = useMemo(() => {
    const ptE = spinopelvic.effPT;
    const c2 = computeTilt("c2", c2tiltDirect, cpa, ptE);
    const t1 = computeTilt("t1", t1tiltDirect, t1pa, ptE);
    const l1 = computeTilt("l1", l1tiltDirect, l1pa, ptE);
    if (!c2 && !t1 && !l1) return null;
    return { pt: ptE, c2, t1, l1 };
  }, [spinopelvic, c2tiltDirect, cpa, t1tiltDirect, t1pa, l1tiltDirect, l1pa]);

  // SRS-Schwab classification (Schwab et al, Spine 2012) — modificadores sagitales
  // PI-LL: 0 < 10°, + 10-20°, ++ > 20°
  // PT:    0 < 20°, + 20-30°, ++ > 30°
  // SVA:   0 < 4cm, + 4-9.5cm, ++ > 9.5cm
  const schwabResult = useMemo(() => {
    const piN = spinopelvic.effPI;
    const llN = l1s1 === "" || l1s1 === null ? null : Number(l1s1);
    const ptN = spinopelvic.effPT;
    const svaN = sva === "" || sva === null ? null : Number(sva);
    const grade = (v, t0, t1) => {
      if (v === null || v === undefined || Number.isNaN(v)) return null;
      if (v < t0)  return { g: "0",  label: "Normal",   color: COLORS.green,  bg: COLORS.greenBg };
      if (v <= t1) return { g: "+",  label: "Moderado", color: COLORS.yellow, bg: COLORS.yellowBg };
      return       { g: "++", label: "Marcado",  color: COLORS.red,    bg: COLORS.redBg };
    };
    const piLLVal = (piN !== null && llN !== null && !Number.isNaN(llN)) ? piN - llN : null;
    return {
      piLLVal, piLL: grade(piLLVal, 10, 20),
      ptVal: ptN, pt: grade(ptN, 20, 30),
      svaVal: svaN, sva: grade(svaN, 4, 9.5),
    };
  }, [spinopelvic.effPI, spinopelvic.effPT, l1s1, sva]);

  // Roussouly classification — Laouissat/Roussouly 2017 + algoritmos de
  // Sebaaly 2020 (Eur Spine J) y Bari 2020 (Spine Deform): tipo actual, tipo
  // ideal (objetivo quirúrgico) y concordancia con la PI.
  const roussoulyResult = useMemo(() => {
    const ssN = spinopelvic.effSS;
    const piN = spinopelvic.effPI;
    const ptN = spinopelvic.effPT;
    const nvlN = nvl === "" || nvl === null || nvl === undefined || Number.isNaN(Number(nvl)) ? null : Number(nvl);
    const cur = roussoulyCurrentType(ssN, piN, ptN, nvlN);
    if (!cur) return null;
    const curDef = R_TYPES[cur.key];
    const ideal = roussoulyIdealType(cur.key, piN, ptN);
    const idealDef = ideal ? R_TYPES[ideal.key] : null;

    // Concordancia con la PI (Sebaaly 2020): PI < 50° → tipos 1/2 · PI ≥ 50° → tipos 3/4
    let piMatch = null;
    if (piN !== null && piN !== undefined && !Number.isNaN(piN)) {
      const esperado = piN < 50 ? R_LOW_PI : R_HIGH_PI;
      // 3-AP con PI baja: entidad normal propia para Laouissat 2017, pero Sebaaly
      // 2020 lo señala como objetivo quirúrgico desfavorable (PJK) → advertencia.
      const antevertedWarn = cur.key === "3AP" && piN < 50;
      const level = esperado.includes(cur.key) ? "ok" : antevertedWarn ? "warn" : "bad";
      piMatch = {
        level,
        ok: level !== "bad",
        piLow: piN < 50,
        esperadoLabel: piN < 50 ? "tipo 1 ó 2" : "tipo 3 ó 4",
        antevertedWarn,
      };
    }

    const levelColor = { ok: COLORS.green, warn: COLORS.yellow, bad: COLORS.red };
    const levelBg = { ok: COLORS.greenBg, warn: COLORS.yellowBg, bad: COLORS.redBg };
    const color = piMatch === null ? COLORS.cyan : levelColor[piMatch.level];
    const bg = piMatch === null ? (COLORS.cyanBg || COLORS.cyan + "22") : levelBg[piMatch.level];
    const params = `SS ${ssN.toFixed(1)}°`
      + (piN !== null && piN !== undefined ? ` · PI ${piN.toFixed(1)}°` : "")
      + (ptN !== null && ptN !== undefined ? ` · PT ${ptN.toFixed(1)}°` : "")
      + (nvlN !== null ? ` · NVL ${nvlN}` : "");

    return {
      type: curDef.short,
      typeKey: cur.key,
      label: curDef.label,
      desc: curDef.desc,
      uncertain: cur.uncertain || null,
      color, bg, params,
      esPost: tipoEvaluacion === "postoperatorio",
      ideal: idealDef ? {
        type: idealDef.short,
        key: ideal.key,
        label: idealDef.label,
        desc: idealDef.desc,
        uncertain: ideal.uncertain || null,
        inferred: ideal.inferred || false,
        same: ideal.key === cur.key,
      } : null,
      piMatch,
    };
  }, [spinopelvic.effSS, spinopelvic.effPI, spinopelvic.effPT, nvl, tipoEvaluacion]);

  // GAP-B (Noh 2020, Spine J) — extiende el GAP con BMI y BMD T-score
  // Modelo de regresión logística multivariable derivado de los HRs publicados:
  //   BMI HR 1.284, BMD T-score HR 0.277, GAP HR 1.457
  //   logit(p) = b0 + 0.250·BMI − 1.284·Tscore + 0.377·GAP
  //   b0 ≈ −11.0 calibrado contra el caso ejemplo de Noh 2020 (BMI 28, T −2.0, GAP 7 → ~77%).
  const gapbResult = useMemo(() => {
    if (!result) return null;
    const bmiN = imc && imc.valor ? Number(imc.valor) : null;
    const tN = bmdTscore === "" || bmdTscore === null ? null : Number(bmdTscore);
    const gapN = result.total;
    if (bmiN === null || Number.isNaN(bmiN) || tN === null || Number.isNaN(tN)) return null;
    const lp = -11.0 + 0.250 * bmiN + (-1.284) * tN + 0.377 * gapN;
    const prob = 1 / (1 + Math.exp(-lp));
    let cat;
    if (prob < 0.25)      cat = { label: "Riesgo bajo",      color: COLORS.green,  bg: COLORS.greenBg };
    else if (prob < 0.55) cat = { label: "Riesgo moderado",  color: COLORS.yellow, bg: COLORS.yellowBg };
    else                  cat = { label: "Riesgo alto",      color: COLORS.red,    bg: COLORS.redBg };
    return { bmi: bmiN, tscore: tN, gap: gapN, lp, prob, cat };
  }, [result, imc, bmdTscore]);

  const showToast = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500); };

  const submitSubscribe = async () => {
    const email = subEmail.trim().toLowerCase();
    const name = subName.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast("Correo no válido", false); return; }
    if (name.length < 2) { showToast("Ingresa tu nombre", false); return; }
    if (!firebaseEnabled || !db) { showToast("Servicio no disponible", false); return; }
    setSubBusy(true);
    try {
      await setDoc(doc(db, "subscribers", email), {
        email, name,
        addedAt: serverTimestamp(),
        source: "public",
        deviceId: deviceId || null
      }, { merge: true });
      setSubDone(true);
      setSubEmail(""); setSubName("");
      showToast("✓ Gracias, te avisaremos");
    } catch (e) {
      showToast("No se pudo registrar. Intenta más tarde.", false);
    }
    setSubBusy(false);
  };
  const inputs = { age, pi: spinopelvic.effPI ?? "", ss: spinopelvic.effSS ?? "", pt: spinopelvic.effPT ?? "", l1s1, l4s1, gt, l1pa, t4pa, c2tiltDirect, cpa, t1tiltDirect, t1pa, l1tiltDirect, paciente, medico, cirugias, fotos, tipoEvaluacion, fechaEstudio, fechaCirugia, diffInfo, peso, talla, imc, hillsResult, tiltsResult, derivedKey: spinopelvic.derivedKey, sva, bmdTscore, schwabResult, roussoulyResult, gapbResult };

  const addCirugia = () => setCirugias([...cirugias, { id: uid(), tipo: "", tipoCustom: "", segmentos: [] }]);
  const updateCirugia = (id, n) => setCirugias(cirugias.map(c => c.id === id ? n : c));
  const removeCirugia = (id) => setCirugias(cirugias.filter(c => c.id !== id));

  const handleFotos = async (e) => {
    const files = Array.from(e.target.files);
    const nuevas = [];
    for (const f of files) { try { const dataUrl = await resizeImage(f); nuevas.push({ id: uid(), name: f.name, dataUrl, categoria: CATEGORIAS_FOTO[0] }); } catch (err) {} }
    setFotos([...fotos, ...nuevas]); e.target.value = "";
    if (nuevas.length > 0) showToast(`${nuevas.length} foto${nuevas.length > 1 ? "s" : ""} agregada${nuevas.length > 1 ? "s" : ""}`);
  };
  const removeFoto = (id) => setFotos(fotos.filter(f => f.id !== id));
  const updateFotoCat = (id, categoria) => setFotos(fotos.map(f => f.id === id ? { ...f, categoria } : f));

  const buildPdfFile = () => {
    const docP = buildPDF(inputs, result);
    const tipoTag = tipoEvaluacion === "preoperatorio" ? "PRE" : "POST";
    const filename = `GAP_${tipoTag}${paciente ? "_" + paciente.replace(/\s+/g, "_") : (iniciales ? "_" + iniciales : "")}_${fechaEstudio}.pdf`;
    const blob = docP.output("blob");
    return { file: new File([blob], filename, { type: "application/pdf" }), filename, blob };
  };

  const triggerDownload = () => {
    const { file, filename } = buildPdfFile();
    const url = URL.createObjectURL(file);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    showToast("PDF descargado ✓");
  };

  const handleDownload = () => {
    if (!hasAnyMeasurement) { showToast("Ingresa al menos una medición", false); return; }
    // Modo público + caso no guardado todavía → ofrecer guardar primero
    // (solo cuando el GAP está completo; guardar requiere result)
    if (result && !canEdit && firebaseEnabled && savedPublicCaseId !== casoId) {
      setShowPdfSaveModal(true);
      return;
    }
    triggerDownload();
  };

  // Cuando el guardado del caso completa con éxito y el usuario eligió "Guardar y descargar",
  // dispara la descarga al siguiente tick.
  useEffect(() => {
    if (saved && pendingDownloadAfterSave) {
      setPendingDownloadAfterSave(false);
      triggerDownload();
    }
  }, [saved, pendingDownloadAfterSave]);

  // Texto resumido para el cuerpo del correo cuando hay que adjuntar manualmente
  const buildEmailBody = () => {
    const fTxt = new Date(fechaEstudio + "T00:00:00").toLocaleDateString("es-MX");
    const tLabel = MOMENTOS[tipoEvaluacion].label;
    const cTxt = fechaCirugia ? new Date(fechaCirugia + "T00:00:00").toLocaleDateString("es-MX") : null;
    const ref = paciente || iniciales || casoId;
    return [
      `GAP Score · ${tLabel}${ref ? " · " + ref : ""}`,
      `Fecha del estudio: ${fTxt}`,
      ...(cTxt ? [`Fecha de cirugía: ${cTxt}`] : []),
      ...(diffInfo ? [diffInfo.mensaje] : []),
      ...(age ? [`Edad: ${age} años`] : []),
      ...(imc ? [`IMC: ${imc.valor.toFixed(1)} (${imc.categoria})`] : []),
      ...(medico ? [`Médico: ${medico}`] : []),
      "",
      ...(result
        ? [`Resultado: ${result.total}/13 — ${result.cat.label}`, result.cat.risk]
        : ["Reporte parcial — GAP Score no calculado (mediciones incompletas)."])
    ].join("\n");
  };

  const handleEmail = async () => {
    if (!hasAnyMeasurement) { showToast("Ingresa al menos una medición", false); return; }
    const { file, filename } = buildPdfFile();
    // Web Share API con archivos (móvil + algunos desktop)
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `GAP Score · ${MOMENTOS[tipoEvaluacion].label}`,
          text: buildEmailBody()
        });
        return;
      }
    } catch (e) {
      if (e.name === "AbortError") return; // usuario canceló
    }
    // Fallback desktop: descarga PDF + abre mailto con recordatorio de adjuntarlo
    const url = URL.createObjectURL(file);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    const subject = `GAP Score · ${MOMENTOS[tipoEvaluacion].label}${paciente ? " · " + paciente : ""}`;
    const body = buildEmailBody() + "\n\n📎 Adjunta al correo el PDF que se descargó automáticamente.";
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    showToast("PDF descargado · adjúntalo al correo", true);
  };

  const saveCaso = async () => {
    if (!result) { showToast("Completa las mediciones primero", false); return; }
    if (firebaseEnabled) {
      if (!user) { setShowLoginModal(true); return; }
      if (!allowlisted) { showToast("Tu cuenta aún no está autorizada. Contacta al administrador.", false); return; }
      if (!consentAccepted) { setShowConsentModal(true); return; }
    }
    setSaving(true);
    const casoBase = {
      fecha: new Date().toISOString(), fechaEstudio, fechaCirugia: fechaCirugia || null,
      tipoEvaluacion, tiempoCalculado: diffInfo?.mensaje || null, diasDiferencia: diffInfo?.dias ?? null,
      paciente: { apellidos, nombre, completo: paciente }, edad: Number(age),
      peso: peso ? Number(peso) : null, talla: talla ? Number(talla) : null,
      imc: imc ? { valor: Number(imc.valor.toFixed(2)), categoria: imc.categoria } : null,
      medico, medidor, cirugias,
      ...(user ? { ownerUid: user.uid, ownerEmail: user.email } : {}),
      mediciones: {
        pi: Number(spinopelvic.effPI), ss: Number(spinopelvic.effSS), pt: Number(spinopelvic.effPT),
        derivedKey: spinopelvic.derivedKey,
        l1s1: Number(l1s1), l4s1: Number(l4s1), gt: Number(gt),
        l1pa: l1pa !== "" ? Number(l1pa) : null,
        t4pa: t4pa !== "" ? Number(t4pa) : null,
        c2tilt: c2tiltDirect !== "" ? Number(c2tiltDirect) : null,
        cpa: cpa !== "" ? Number(cpa) : null,
        t1tilt: t1tiltDirect !== "" ? Number(t1tiltDirect) : null,
        t1pa: t1pa !== "" ? Number(t1pa) : null,
        l1tilt: l1tiltDirect !== "" ? Number(l1tiltDirect) : null
      },
      resultado: { total: result.total, categoria: result.cat.label, rpv: result.rpv.score, rll: result.rll.score, ldi: result.ldi.score, ldiValor: Number(result.ldi.value.toFixed(2)), rsa: result.rsa.score, af: result.af.score },
      hills: hillsResult ? {
        idealL1PA: Number(hillsResult.idealL1PA.toFixed(2)),
        l1paDiff: Number(hillsResult.l1paDiff.toFixed(2)),
        idealLL_Hills: Number(hillsResult.idealLL_Hills.toFixed(2)),
        ejeDiff: hillsResult.ejeDiff !== null ? Number(hillsResult.ejeDiff.toFixed(2)) : null,
        ejeStatus: hillsResult.ejeStatus
      } : null,
      tilts: tiltsResult ? {
        pt: tiltsResult.pt !== null ? Number(tiltsResult.pt.toFixed(2)) : null,
        c2: tiltsResult.c2 ? { direct: tiltsResult.c2.direct, derived: tiltsResult.c2.derived !== null ? Number(tiltsResult.c2.derived.toFixed(2)) : null, delta: tiltsResult.c2.delta !== null ? Number(tiltsResult.c2.delta.toFixed(2)) : null, level: tiltsResult.c2.cls.level, label: tiltsResult.c2.cls.label } : null,
        t1: tiltsResult.t1 ? { direct: tiltsResult.t1.direct, derived: tiltsResult.t1.derived !== null ? Number(tiltsResult.t1.derived.toFixed(2)) : null, delta: tiltsResult.t1.delta !== null ? Number(tiltsResult.t1.delta.toFixed(2)) : null, level: tiltsResult.t1.cls.level, label: tiltsResult.t1.cls.label } : null,
        l1: tiltsResult.l1 ? { direct: tiltsResult.l1.direct, derived: tiltsResult.l1.derived !== null ? Number(tiltsResult.l1.derived.toFixed(2)) : null, delta: tiltsResult.l1.delta !== null ? Number(tiltsResult.l1.delta.toFixed(2)) : null, level: tiltsResult.l1.cls.level, label: tiltsResult.l1.cls.label } : null
      } : null
    };

    if (firebaseEnabled && db && storage) {
      try {
        const docRef = await addDoc(collection(db, "casos"), { ...casoBase, fotos: [] });
        const fotosFirebase = [];
        for (const f of fotos) {
          const blob = dataURLtoBlob(f.dataUrl);
          const imageRef = ref(storage, `casos/${docRef.id}/${f.id}.jpg`);
          await uploadBytes(imageRef, blob);
          const url = await getDownloadURL(imageRef);
          fotosFirebase.push({ id: f.id, name: f.name, categoria: f.categoria, url });
        }
        if (fotosFirebase.length > 0) await updateDoc(doc(db, "casos", docRef.id), { fotos: fotosFirebase });
        await loadCasos(user);
        showToast("Caso guardado en Firebase ✓");
      } catch (e) { console.error(e); showToast("Error guardando en Firebase.", false); }
    } else {
      try {
        const caso = { id: uid(), ...casoBase, fotos };
        const updated = [caso, ...casosGuardados];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        setCasosGuardados(updated);
        showToast(`Caso guardado localmente (${updated.length} totales)`);
      } catch (e) { showToast("Error: almacenamiento lleno (fotos pesadas).", false); }
    }
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 4000);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Modo público — guardado anónimo, lookup por ID, historial localStorage
  // ─────────────────────────────────────────────────────────────────────────
  const savePublicCase = async (skipConsentCheck = false) => {
    if (!result) { showToast("Completa las mediciones primero", false); return; }
    if (!firebaseEnabled || !db) { showToast("Servicio no disponible", false); return; }
    if (!skipConsentCheck && !publicConsentAccepted) { setShowPublicConsentModal(true); return; }
    setSaving(true);
    try {
      const cleanCirugias = (cirugias || []).map(c => ({ tipo: c.tipo || null, tipoCustom: c.tipoCustom || null, segmentos: c.segmentos || [] }));
      const casoData = {
        casoId,
        createdAt: serverTimestamp(),
        fechaCaso: new Date().toISOString(),
        fechaEstudio,
        fechaCirugia: fechaCirugia || null,
        tipoEvaluacion,
        tiempoCalculado: diffInfo?.mensaje || null,
        diasDiferencia: diffInfo?.dias ?? null,
        iniciales: iniciales || null,
        edad: Number(age),
        peso: peso ? Number(peso) : null,
        talla: talla ? Number(talla) : null,
        imc: imc ? { valor: Number(imc.valor.toFixed(2)), categoria: imc.categoria } : null,
        cirugias: cleanCirugias,
        deviceId: deviceId || null,
        consentVersion: PUBLIC_CONSENT_VERSION,
        consentAcceptedAt: serverTimestamp(),
        mediciones: {
          pi: Number(spinopelvic.effPI), ss: Number(spinopelvic.effSS), pt: Number(spinopelvic.effPT),
          derivedKey: spinopelvic.derivedKey,
          l1s1: Number(l1s1), l4s1: Number(l4s1), gt: Number(gt),
          l1pa: l1pa !== "" ? Number(l1pa) : null,
          t4pa: t4pa !== "" ? Number(t4pa) : null,
          c2tilt: c2tiltDirect !== "" ? Number(c2tiltDirect) : null,
          cpa: cpa !== "" ? Number(cpa) : null,
          t1tilt: t1tiltDirect !== "" ? Number(t1tiltDirect) : null,
          t1pa: t1pa !== "" ? Number(t1pa) : null,
          l1tilt: l1tiltDirect !== "" ? Number(l1tiltDirect) : null
        },
        resultado: { total: result.total, categoria: result.cat.label, rpv: result.rpv.score, rll: result.rll.score, ldi: result.ldi.score, ldiValor: Number(result.ldi.value.toFixed(2)), rsa: result.rsa.score, af: result.af.score },
        hills: hillsResult ? {
          idealL1PA: Number(hillsResult.idealL1PA.toFixed(2)),
          l1paDiff: Number(hillsResult.l1paDiff.toFixed(2)),
          idealLL_Hills: Number(hillsResult.idealLL_Hills.toFixed(2)),
          ejeDiff: hillsResult.ejeDiff !== null ? Number(hillsResult.ejeDiff.toFixed(2)) : null,
          ejeStatus: hillsResult.ejeStatus
        } : null,
        tilts: tiltsResult ? {
          pt: tiltsResult.pt !== null ? Number(tiltsResult.pt.toFixed(2)) : null,
          c2: tiltsResult.c2 ? { direct: tiltsResult.c2.direct, derived: tiltsResult.c2.derived !== null ? Number(tiltsResult.c2.derived.toFixed(2)) : null, level: tiltsResult.c2.cls.level, label: tiltsResult.c2.cls.label } : null,
          t1: tiltsResult.t1 ? { direct: tiltsResult.t1.direct, derived: tiltsResult.t1.derived !== null ? Number(tiltsResult.t1.derived.toFixed(2)) : null, level: tiltsResult.t1.cls.level, label: tiltsResult.t1.cls.label } : null,
          l1: tiltsResult.l1 ? { direct: tiltsResult.l1.direct, derived: tiltsResult.l1.derived !== null ? Number(tiltsResult.l1.derived.toFixed(2)) : null, level: tiltsResult.l1.cls.level, label: tiltsResult.l1.cls.label } : null
        } : null
      };
      await setDoc(doc(db, "public_cases", casoId), casoData);
      try {
        const arr = JSON.parse(localStorage.getItem(PUBLIC_CASES_LS_KEY) || "[]");
        const entry = { id: casoId, fechaCaso: casoData.fechaCaso, tipoEvaluacion, gapTotal: result.total, gapCategoria: result.cat.label };
        const updated = [entry, ...arr.filter(x => x.id !== casoId)].slice(0, 50);
        localStorage.setItem(PUBLIC_CASES_LS_KEY, JSON.stringify(updated));
        setMyPublicCases(updated);
      } catch (e) {}
      setSavedPublicCaseId(casoId);
      setSaved(true);
      showToast(`Caso ${casoId} guardado ✓`);
      setTimeout(() => setSaved(false), 5000);
    } catch (e) {
      console.error(e);
      showToast("Error guardando caso", false);
    }
    setSaving(false);
  };

  const acceptPublicConsent = async () => {
    try { localStorage.setItem(PUBLIC_CONSENT_LS_KEY, PUBLIC_CONSENT_VERSION); } catch (e) {}
    setPublicConsentAccepted(true);
    setShowPublicConsentModal(false);
    await savePublicCase(true);
  };

  const loadPublicCase = async (overrideId) => {
    const id = (overrideId || loadCaseIdInput).trim().toUpperCase();
    if (!/^GAP-\d{4}-[A-Z0-9]{4}$/i.test(id)) { showToast("ID inválido. Formato: GAP-AAAA-XXXX", false); return; }
    if (!firebaseEnabled || !db) { showToast("Servicio no disponible", false); return; }
    setLoadingCase(true);
    try {
      const snap = await getDoc(doc(db, "public_cases", id));
      if (!snap.exists()) { showToast("Caso no encontrado", false); setLoadingCase(false); return; }
      const c = snap.data();
      const m = c.mediciones || {};
      setCasoId(id);
      setFechaEstudio(c.fechaEstudio || hoy());
      setFechaCirugia(c.fechaCirugia || "");
      setTipoEvaluacion(c.tipoEvaluacion || "preoperatorio");
      setIniciales(c.iniciales || "");
      setAge(c.edad ?? "");
      setPeso(c.peso ?? "");
      setTalla(c.talla ?? "");
      setCirugias(Array.isArray(c.cirugias) ? c.cirugias.map(x => ({ id: uid(), tipo: x.tipo || "", tipoCustom: x.tipoCustom || "", segmentos: x.segmentos || [] })) : []);
      setPI(m.pi ?? "");
      setSS(m.ss ?? "");
      setPT(m.pt ?? "");
      setL1S1(m.l1s1 ?? "");
      setL4S1(m.l4s1 ?? "");
      setGT(m.gt ?? "");
      setL1PA(m.l1pa ?? "");
      setT4PA(m.t4pa ?? "");
      setC2TiltDirect(m.c2tilt ?? "");
      setCPA(m.cpa ?? "");
      setT1TiltDirect(m.t1tilt ?? "");
      setT1PA(m.t1pa ?? "");
      setL1TiltDirect(m.l1tilt ?? "");
      setLoadCaseIdInput("");
      setSavedPublicCaseId(id);
      showToast(`Caso ${id} cargado ✓`);
    } catch (e) {
      console.error(e);
      showToast("Error cargando caso", false);
    }
    setLoadingCase(false);
  };

  const deleteCaso = async (id) => {
    if (!confirm("¿Eliminar este caso?")) return;
    if (firebaseEnabled && db) {
      try { await deleteDoc(doc(db, "casos", id)); await loadCasos(user); showToast("Caso eliminado"); }
      catch (e) { console.error(e); showToast("Error eliminando caso", false); }
    } else {
      const updated = casosGuardados.filter(c => c.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setCasosGuardados(updated);
      showToast("Caso eliminado");
    }
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(casosGuardados, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `GAP_dataset_${hoy()}.json`; a.click();
    URL.revokeObjectURL(url); showToast(`Dataset JSON exportado (${casosGuardados.length} casos)`);
  };

  const exportCSV = () => {
    const csv = casosToCSV(casosGuardados);
    // BOM for Excel UTF-8
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `GAP_dataset_${hoy()}.csv`; a.click();
    URL.revokeObjectURL(url); showToast(`CSV exportado (${casosGuardados.length} casos)`);
  };

  const clearAll = () => { setAge(""); setPeso(""); setTalla(""); setPI(""); setSS(""); setPT(""); setL1S1(""); setL4S1(""); setGT(""); setL1PA(""); setT4PA(""); setC2TiltDirect(""); setCPA(""); setT1TiltDirect(""); setT1PA(""); setL1TiltDirect(""); setApellidos(""); setNombre(""); setIniciales(""); setCasoId(generarCasoId()); setCirujanoSel(""); setCirujanoCustom(""); setCirugias([]); setFotos([]); setFechaCirugia(""); setFechaEstudio(hoy()); setTipoEvaluacion("preoperatorio"); setSaved(false); setSavedPublicCaseId(null); setMedidorSel(""); setMedidorCustom(""); setMedicoPublic("");};

  const conteos = { todos: casosGuardados.length, preoperatorio: casosGuardados.filter(c => c.tipoEvaluacion === "preoperatorio").length, postoperatorio: casosGuardados.filter(c => c.tipoEvaluacion === "postoperatorio").length };
  const casosFiltrados = filtroTipo === "todos" ? casosGuardados : casosGuardados.filter(c => c.tipoEvaluacion === filtroTipo);

  const idealL4S1 = result ? result.idealLL * 0.65 : 0;

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, backgroundImage: COLORS.bgAtmos, backgroundAttachment: "fixed", color: COLORS.text, fontFamily: FONT_SANS, padding: "28px 16px 32px", position: "relative" }}>
      <div aria-hidden="true" style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, mixBlendMode: "multiply", opacity: 0.05, backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='matrix' values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.6 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")" }} />
      <div style={{ position: "relative", zIndex: 1 }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:ital,opsz,wght@0,9..144,500..800;1,9..144,500..700&family=JetBrains+Mono:wght@400;500;700;800&display=swap" rel="stylesheet" />
      <datalist id="ages-list">{Array.from({ length: 76 }, (_, i) => 15 + i).map(n => <option key={n} value={n} />)}</datalist>

      {toast && <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, padding: "12px 20px", borderRadius: 10, background: toast.ok ? COLORS.green : COLORS.red, color: "#fff", fontSize: 13, fontWeight: 700, boxShadow: "0 8px 24px rgba(0,0,0,0.15)", maxWidth: 320 }}>{toast.msg}</div>}

      {/* Splash inicial — Etapa 1: VML, luego Etapa 2: Dr. Samano */}
      {splashStage !== "done" && (
        <div
          onClick={() => setSplashStage("done")}
          style={{
            position: "fixed", inset: 0, zIndex: 10001,
            background: COLORS.bg,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            padding: 24, cursor: "pointer"
          }}>
          {splashStage === "vml" && (
            <div key="vml" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, animation: "splashStage 1800ms ease both" }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2.5, textTransform: "uppercase", color: COLORS.textMuted }}>
                Una aplicación de
              </div>
              <img
                src="/vml-logo.png"
                alt="Virtual Medical Learning"
                style={{ width: "min(180px, 45vw)", height: "auto", objectFit: "contain" }} />
            </div>
          )}
          {splashStage === "samano" && (
            <div key="samano" style={{ display: "flex", flexDirection: "column", alignItems: "center", animation: "splashStage 2200ms ease both" }}>
              <img
                src="/samano.jpeg"
                alt="Logo Dr. Iván Samano López"
                style={{ width: "min(220px, 55vw)", height: "auto", objectFit: "contain" }} />
              <div style={{ marginTop: 26, textAlign: "center" }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase", color: COLORS.textMuted, marginBottom: 6 }}>
                  Dr.
                </div>
                <div style={{ fontSize: 30, fontWeight: 600, fontFamily: FONT_SERIF, fontVariationSettings: "'opsz' 96, 'SOFT' 50", color: COLORS.ink, letterSpacing: "-0.015em", lineHeight: 1.05 }}>
                  Iván Samano López
                </div>
              </div>
            </div>
          )}
          <div style={{ position: "absolute", bottom: 22, fontSize: 10, color: COLORS.textMuted, fontWeight: 500, opacity: 0.7 }}>
            Toca para saltar
          </div>
          <style>{`@keyframes splashStage { 0% { opacity: 0; transform: translateY(10px); } 12% { opacity: 1; transform: translateY(0); } 80% { opacity: 1; transform: translateY(0); } 100% { opacity: 0; transform: translateY(-6px); } }`}</style>
        </div>
      )}

      {/* Barra de autenticación */}
      {firebaseEnabled && authReady && (
        <div style={{ maxWidth: 560, margin: "0 auto 16px", display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {user ? (
            <>
              <div style={{ fontSize: 11, color: COLORS.textMuted, textAlign: "right", lineHeight: 1.3 }}>
                <div style={{ fontWeight: 600, color: COLORS.text, fontSize: 12 }}>{user.displayName || user.email}</div>
                <div style={{ fontSize: 10 }}>
                  {canEdit ? <span style={{ color: COLORS.green, fontWeight: 600 }}>✓ Modo clínico activo</span>
                   : allowlisted && !consentAccepted ? <span style={{ color: COLORS.yellow, fontWeight: 600 }}>⏳ Falta aceptar consentimiento</span>
                   : <span style={{ color: COLORS.textMuted }}>Pendiente de autorización</span>}
                </div>
              </div>
              <button onClick={handleLogout} disabled={authBusy} style={{ padding: "6px 12px", borderRadius: 6, border: `1px solid ${COLORS.inputBorder}`, background: "transparent", color: COLORS.textDim, fontSize: 11, cursor: authBusy ? "wait" : "pointer", fontWeight: 600 }}>Salir</button>
            </>
          ) : (
            <>
              <button onClick={() => setShowLoginModal(true)} style={{ padding: "8px 14px", borderRadius: 8, border: `1.5px solid ${COLORS.accent}`, background: COLORS.accent, color: "#fff", fontSize: 12, cursor: "pointer", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 14 }}>🔐</span> Acceso clínico
              </button>
              <button onClick={handleLogin} disabled={authBusy} title="Iniciar sesión con Google (admin)" style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${COLORS.inputBorder}`, background: "transparent", color: COLORS.textDim, fontSize: 11, cursor: authBusy ? "wait" : "pointer", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13 }}>🅖</span> Google
              </button>
            </>
          )}
        </div>
      )}

      {/* Encabezado — composición editorial */}
      <div style={{ maxWidth: 560, margin: "0 auto 36px", textAlign: "center", padding: "0 8px" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <span aria-hidden="true" style={{ width: 22, height: 1, background: COLORS.accent, opacity: 0.7 }} />
          <span style={{ fontSize: 10, fontWeight: 600, color: COLORS.accent, letterSpacing: 3, textTransform: "uppercase", fontFamily: FONT_SANS }}>Cirugía de Columna</span>
          <span aria-hidden="true" style={{ width: 22, height: 1, background: COLORS.accent, opacity: 0.7 }} />
        </div>
        <h1 style={{ fontSize: "clamp(34px, 7vw, 48px)", fontWeight: 600, margin: "0 0 10px", fontFamily: FONT_SERIF, fontVariationSettings: "'opsz' 144, 'SOFT' 30", color: COLORS.ink, letterSpacing: "-0.025em", lineHeight: 1.02 }}>
          Calculadora <em style={{ fontStyle: "italic", fontWeight: 500, color: COLORS.accent, fontVariationSettings: "'opsz' 144, 'SOFT' 100" }}>GAP&nbsp;Score</em>
        </h1>
        <p style={{ fontSize: 13.5, color: COLORS.textDim, lineHeight: 1.55, maxWidth: 440, margin: "0 auto", fontFamily: FONT_SANS }}>
          Alineación global y proporción · análisis espinopélvico individualizado.
        </p>
        {firebaseEnabled && !user && (
          <div style={{ marginTop: 14, display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 12px", borderRadius: 999, background: COLORS.accentDim, border: `1px solid ${COLORS.accent}33`, fontSize: 11, color: COLORS.accentDark, fontWeight: 500 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS.accent }} />
            Calculadora abierta · inicia sesión para guardar
            {usageCount !== null && usageCount > 0 && (
              <span style={{ paddingLeft: 8, marginLeft: 4, borderLeft: `1px solid ${COLORS.accent}33`, fontFamily: FONT_MONO, fontWeight: 700 }}>
                {usageCount.toLocaleString("es-MX")} <span style={{ fontFamily: FONT_SANS, fontWeight: 500, opacity: 0.75 }}>mediciones</span>
              </span>
            )}
          </div>
        )}
      </div>

      <div style={{ maxWidth: 560, margin: "0 auto" }}>

        {/* Datos del caso */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h2 style={{ fontSize: 19, fontWeight: 600, margin: 0, color: COLORS.ink, fontFamily: FONT_SERIF, fontVariationSettings: "'opsz' 36, 'SOFT' 50", letterSpacing: "-0.01em" }}>📋 Datos del caso</h2>
            <button onClick={clearAll} style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${COLORS.inputBorder}`, background: "transparent", color: COLORS.textDim, fontSize: 12, cursor: "pointer" }}>Limpiar</button>
          </div>
          <TipoEvaluacionToggle value={tipoEvaluacion} onChange={setTipoEvaluacion} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <InputField label="Fecha del estudio" value={fechaEstudio} onChange={setFechaEstudio} type="date" unit="" />
            <InputField label="Fecha de cirugía" value={fechaCirugia} onChange={setFechaCirugia} type="date" unit="" />
          </div>
          <DiffInfoBox diffInfo={diffInfo} />
          {canEdit && (
            <>
              <SelectField label="Cirujano responsable" value={cirujanoSel} onChange={setCirujanoSel} options={[...CIRUJANOS, "Otro (especificar)"]} />
              {cirujanoSel === "Otro (especificar)" && <InputField label="Nombre del cirujano" value={cirujanoCustom} onChange={setCirujanoCustom} type="text" unit="" placeholder="DR. APELLIDO, NOMBRE" transform={normalizeName} maxLength={60} />}
              <SelectField label="Medición radiográfica realizada por" value={medidorSel} onChange={setMedidorSel}
                options={[...MEDIDORES, "Otro (especificar)"]} />
              {medidorSel === "Otro (especificar)" && (
                <InputField label="Nombre del medidor" value={medidorCustom} onChange={setMedidorCustom}
                  type="text" unit="" placeholder="APELLIDO NOMBRE" transform={normalizeName} maxLength={60} />
              )}
            </>
          )}
          {canEdit ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <InputField label="Apellidos" value={apellidos} onChange={setApellidos} type="text" unit="" placeholder="EJ: GARCIA LOPEZ" transform={normalizeName} maxLength={50} />
              <InputField label="Nombre" value={nombre} onChange={setNombre} type="text" unit="" placeholder="EJ: JUAN CARLOS" transform={normalizeName} maxLength={50} />
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 12, alignItems: "start" }}>
                <InputField label="Iniciales del paciente" value={iniciales} onChange={setIniciales} type="text" unit="" placeholder="EJ: JCR" transform={normalizeIniciales} maxLength={5} />
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>ID del caso</label>
                    <InfoTooltip text="Identificador auto-generado. Si guardas el caso, podrás recuperarlo después usando este ID desde cualquier dispositivo." />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", background: COLORS.inputBg, borderRadius: 8, border: `1.5px solid ${COLORS.inputBorder}`, overflow: "hidden" }}>
                    <span style={{ flex: 1, padding: "10px 12px", color: COLORS.accentDark, fontSize: 14, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, letterSpacing: 0.5, userSelect: "all" }}>{casoId}</span>
                    <button type="button" onClick={() => setCasoId(generarCasoId())} title="Generar nuevo ID" style={{ padding: "10px 12px", background: COLORS.inputHover, border: "none", borderLeft: `1px solid ${COLORS.inputBorder}`, color: COLORS.textDim, cursor: "pointer", fontSize: 14 }}>↻</button>
                  </div>
                </div>
              </div>
              <InputField label="Nombre del médico (opcional, solo para el reporte)" value={medicoPublic} onChange={setMedicoPublic} type="text" unit="" placeholder="DR. APELLIDO, NOMBRE" transform={normalizeName} maxLength={60} />
              {/* Cargar caso anterior */}
              <div style={{ marginTop: 4, padding: 12, borderRadius: 10, background: COLORS.inputHover, border: `1px dashed ${COLORS.inputBorder}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.textDim, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  🔎 ¿Tienes un ID de un caso anterior?
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text"
                    value={loadCaseIdInput}
                    onChange={e => setLoadCaseIdInput(e.target.value.toUpperCase())}
                    placeholder="GAP-2026-XXXX"
                    maxLength={13}
                    style={{ flex: 1, padding: "10px 12px", background: COLORS.inputBg, border: `1.5px solid ${COLORS.inputBorder}`, borderRadius: 8, color: COLORS.accentDark, fontSize: 14, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, letterSpacing: 0.5, outline: "none" }} />
                  <button onClick={loadPublicCase} disabled={loadingCase || !loadCaseIdInput} style={{ padding: "10px 18px", borderRadius: 8, border: `1.5px solid ${COLORS.accent}`, background: loadingCase || !loadCaseIdInput ? COLORS.inputBg : COLORS.accent, color: loadingCase || !loadCaseIdInput ? COLORS.textMuted : "#fff", fontSize: 13, fontWeight: 700, cursor: loadingCase ? "wait" : !loadCaseIdInput ? "not-allowed" : "pointer" }}>
                    {loadingCase ? "..." : "Cargar"}
                  </button>
                </div>
              </div>
            </>
          )}
          <InputField label="Edad del paciente" value={age} onChange={setAge} unit="años" min={15} max={90} list="ages-list" placeholder="15-90" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <InputField label="Peso" value={peso} onChange={setPeso} unit="kg" min={20} max={300} step="0.1" placeholder="Ej: 72.5" />
            <InputField label="Talla" value={talla} onChange={setTalla} unit="cm" min={100} max={230} placeholder="Ej: 170" />
          </div>
          <IMCBadge imc={imc} />
        </Card>

        {/* Cirugías */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h2 style={{ fontSize: 19, fontWeight: 600, margin: 0, color: COLORS.ink, fontFamily: FONT_SERIF, fontVariationSettings: "'opsz' 36, 'SOFT' 50", letterSpacing: "-0.01em" }}>{tipoEvaluacion === "preoperatorio" ? "🔧 Cirugías planificadas" : "🔧 Cirugías realizadas"}</h2>
            <button onClick={addCirugia} style={{ padding: "6px 14px", borderRadius: 8, border: `1.5px solid ${COLORS.accent}66`, background: COLORS.accentDim, color: COLORS.accentDark, fontSize: 12, cursor: "pointer", fontWeight: 700 }}>+ Agregar</button>
          </div>
          {cirugias.length === 0 && <div style={{ padding: 20, textAlign: "center", color: COLORS.textMuted, fontSize: 13, background: COLORS.inputHover, borderRadius: 10, border: `1px dashed ${COLORS.inputBorder}` }}>Toca <strong style={{ color: COLORS.accentDark }}>+ Agregar</strong> para registrar cirugías con sus segmentos.</div>}
          {cirugias.map((c, i) => <CirugiaCard key={c.id} cirugia={c} index={i} onUpdate={(n) => updateCirugia(c.id, n)} onRemove={() => removeCirugia(c.id)} />)}
        </Card>

        {/* Mediciones */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
            <h2 style={{ fontSize: 19, fontWeight: 600, margin: 0, color: COLORS.ink, fontFamily: FONT_SERIF, fontVariationSettings: "'opsz' 36, 'SOFT' 50", letterSpacing: "-0.01em" }}>📐 Medición GAP</h2>
            <button onClick={() => setShowAnnotator(true)} style={{ padding: "8px 14px", borderRadius: 8, border: `1.5px solid ${COLORS.accent}`, background: COLORS.accent, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 14 }}>📐</span> Medir desde radiografía
            </button>
          </div>
          <p style={{ fontSize: 11, color: COLORS.textMuted, margin: "0 0 14px" }}>
            Ingresa <strong>2 de 3</strong> entre PI · SS · PT y la app calcula el tercero (relación: <strong>PI = PT + SS</strong>).
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            <InputField label="Incidencia Pélvica (PI)" value={pi} onChange={setPI} min={0} max={120}
              placeholder={spinopelvic.derivedKey === "pi" && spinopelvic.effPI !== null ? spinopelvic.effPI.toFixed(1) : ""}
              tooltip="Parámetro morfológico fijo (no cambia con la postura). Ángulo entre la línea perpendicular al platillo superior de S1 en su punto medio y la línea que une ese punto con el centro del eje bicoxofemoral. Normal ≈ 50°. Relación: PI = SS + PT. (Legaye, Duval-Beaupère 1998)"
              tooltipFigure="/landmarks/angulo_pi.png" />
            <InputField label="Pendiente Sacra (SS)" value={ss} onChange={setSS} min={-30} max={90}
              placeholder={spinopelvic.derivedKey === "ss" && spinopelvic.effSS !== null ? spinopelvic.effSS.toFixed(1) : ""}
              tooltip="Parámetro postural. Ángulo entre el platillo superior de S1 y la horizontal. Aumenta con la anteversión pélvica y disminuye con la retroversión. Determina en buena medida la lordosis lumbar."
              tooltipFigure="/landmarks/angulo_ss.png" />
            <InputField label="Versión Pélvica (PT)" value={pt} onChange={setPT} min={-30} max={60}
              placeholder={spinopelvic.derivedKey === "pt" && spinopelvic.effPT !== null ? spinopelvic.effPT.toFixed(1) : ""}
              tooltip="Pelvic Tilt. Parámetro postural. Ángulo entre la vertical y la línea del centro del eje bicoxofemoral al centro del platillo superior de S1. Aumenta en retroversión pélvica (mecanismo compensatorio del desbalance sagital). Relación: PT = PI − SS."
              tooltipFigure="/landmarks/angulo_pt.png" />
          </div>
          {/* Banner de derivación / inconsistencia */}
          {(() => {
            if (spinopelvic.filledCount === 2 && spinopelvic.derivedKey) {
              const labels = { pi: { name: "PI", val: spinopelvic.effPI, formula: "SS + PT" }, ss: { name: "SS", val: spinopelvic.effSS, formula: "PI − PT" }, pt: { name: "PT", val: spinopelvic.effPT, formula: "PI − SS" } };
              const d = labels[spinopelvic.derivedKey];
              return (
                <div style={{ padding: "8px 12px", borderRadius: 8, background: COLORS.accentDim, border: `1px solid ${COLORS.accent}44`, fontSize: 12, color: COLORS.accentDark, marginTop: 4, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span>↻ <strong>{d.name}</strong> derivado automáticamente ({d.formula})</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{d.val.toFixed(1)}°</span>
                </div>
              );
            }
            if (spinopelvic.filledCount === 3 && spinopelvic.inconsistencyDelta !== null && Math.abs(spinopelvic.inconsistencyDelta) > 1) {
              return (
                <div style={{ padding: "8px 12px", borderRadius: 8, background: COLORS.yellowBg, border: `1px solid ${COLORS.yellow}66`, fontSize: 12, color: COLORS.yellow, marginTop: 4, marginBottom: 8, fontWeight: 600 }}>
                  ⚠️ Inconsistencia: PI debería = SS + PT (Δ {spinopelvic.inconsistencyDelta >= 0 ? "+" : ""}{spinopelvic.inconsistencyDelta.toFixed(1)}°). Revisa la medición.
                </div>
              );
            }
            if (spinopelvic.filledCount === 1) {
              return (
                <div style={{ padding: "8px 12px", borderRadius: 8, background: COLORS.inputHover, border: `1px dashed ${COLORS.inputBorder}`, fontSize: 11, color: COLORS.textMuted, marginTop: 4, marginBottom: 8, textAlign: "center" }}>
                  Ingresa al menos 2 de PI / SS / PT para que el GAP Score pueda calcularse.
                </div>
              );
            }
            return null;
          })()}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <InputField label="Lordosis L1-S1" value={l1s1} onChange={setL1S1} min={0} max={120}
              tooltip="Lordosis lumbar total. Ángulo de Cobb entre el platillo superior de L1 y el platillo superior de S1. Valor ideal depende de la PI. Meta GAP: 0.62·PI + 29°."
              tooltipFigure="/landmarks/angulo_l1s1.png" />
            <InputField label="Lordosis L4-S1" value={l4s1} onChange={setL4S1} min={0} max={90}
              tooltip="Lordosis lumbar distal. Ángulo de Cobb entre el platillo superior de L4 y el platillo superior de S1. Aporta ≈ 65% de la lordosis total. Base del Índice de Distribución (ILD = L4-S1 / L1-S1 × 100; normal 50–80%)."
              tooltipFigure="/landmarks/angulo_l4s1.png" />
          </div>
          <InputField label="Inclinación Global (GT)" value={gt} onChange={setGT} min={-30} max={70}
            tooltip="Global Tilt. Ángulo entre la vertical y la línea del centro del cuerpo vertebral de C7 al centro del eje bicoxofemoral. Mide el desbalance sagital global. Meta GAP: 0.48·PI − 15."
            tooltipFigure="/landmarks/angulo_gt.png" />
        </Card>

        {/* Eje T4-L1-Cadera (Hills 2022) — colapsable, opcional */}
        <Card>
          <button
            type="button"
            onClick={() => setHillsOpen(o => !o)}
            aria-expanded={hillsOpen}
            style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, padding: 0, background: "transparent", border: "none", cursor: "pointer", textAlign: "left", color: COLORS.ink }}>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: 19, fontWeight: 600, margin: "0 0 4px", color: COLORS.ink, fontFamily: FONT_SERIF, fontVariationSettings: "'opsz' 36, 'SOFT' 50", letterSpacing: "-0.01em" }}>🎯 Eje T4-L1-Cadera</h2>
              <p style={{ fontSize: 11, color: COLORS.textMuted, margin: 0 }}>
                Hills et al., Spine 2022 · <em>Opcional, complementa al GAP</em>
              </p>
            </div>
            <span aria-hidden="true" style={{ fontSize: 18, color: COLORS.textMuted, fontWeight: 700, transform: hillsOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.18s", lineHeight: 1, paddingTop: 4 }}>⌃</span>
          </button>
          {hillsOpen && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
                <button onClick={() => setShowAnnotator(true)} style={{ padding: "8px 14px", borderRadius: 8, border: `1.5px solid ${COLORS.accent}`, background: COLORS.accent, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 14 }}>📐</span> Medir desde radiografía
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <InputField label="L1 Pelvic Angle (L1PA)" value={l1pa} onChange={setL1PA} min={-30} max={40}
                  tooltip="Ángulo vertebro-pélvico de L1. Subtendido desde el eje bicoxofemoral al centro del platillo de S1 y al centroide del cuerpo de L1. Geométricamente: L1PA = Versión Pélvica + inclinación de L1. Parámetro relativamente fijo que captura magnitud y distribución de la lordosis. Normal ≈ 0.5·PI − 21°. (Hills, Spine 2022)"
                  tooltipFigure="/landmarks/angulo_gt.png" />
                <InputField label="T4 Pelvic Angle (T4PA)" value={t4pa} onChange={setT4PA} min={-30} max={40}
                  tooltip="Ángulo vertebro-pélvico de T4. Análogo al L1PA pero al centroide del cuerpo de T4. En columnas normales se alinea con el L1PA (diferencia < 4°), definiendo el eje T4-L1-cadera. Una diferencia > 4° indica desalineación torácica y activación de mecanismos compensatorios (retroversión pélvica, hipocifosis)."
                  tooltipFigure="/landmarks/cervical_t4.png" />
              </div>
              {hillsResult && (
                <div style={{ marginTop: 8 }}>
                  {/* L1PA ideal */}
                  <div style={{ padding: "10px 14px", borderRadius: 8, background: COLORS.accentDim, border: `1px solid ${COLORS.accent}44`, marginBottom: 10, fontSize: 12, color: COLORS.accentDark, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <span><strong>L1PA ideal</strong> = 0.5·PI − 21</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
                      {hillsResult.idealL1PA.toFixed(1)}°
                      <span style={{ color: Math.abs(hillsResult.l1paDiff) < 4 ? COLORS.green : Math.abs(hillsResult.l1paDiff) < 8 ? COLORS.yellow : COLORS.red, marginLeft: 8 }}>
                        (Δ {hillsResult.l1paDiff >= 0 ? "+" : ""}{hillsResult.l1paDiff.toFixed(1)}°)
                      </span>
                    </span>
                  </div>
                  {/* L1-S1 Hills ideal */}
                  <div style={{ padding: "10px 14px", borderRadius: 8, background: COLORS.purpleBg, border: `1px solid ${COLORS.purple}44`, marginBottom: 10, fontSize: 12, color: COLORS.purple, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <span><strong>L1-S1 ideal (Hills)</strong> = 1.4·PI − 1.7·L1PA − 2</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{hillsResult.idealLL_Hills.toFixed(1)}°</span>
                  </div>
                  {/* Semáforo eje T4-L1-Hip */}
                  {hillsResult.ejeDiff !== null && (() => {
                    const c = hillsResult.ejeStatus === "ok" ? COLORS.green : hillsResult.ejeStatus === "warn" ? COLORS.yellow : COLORS.red;
                    const bg = hillsResult.ejeStatus === "ok" ? COLORS.greenBg : hillsResult.ejeStatus === "warn" ? COLORS.yellowBg : COLORS.redBg;
                    return (
                      <div style={{ padding: "12px 14px", borderRadius: 8, background: bg, border: `1.5px solid ${c}44`, fontSize: 12, color: c, fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <span>🎯 {hillsResult.ejeLabel}</span>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800 }}>
                          T4PA − L1PA = {hillsResult.ejeDiff >= 0 ? "+" : ""}{hillsResult.ejeDiff.toFixed(1)}°
                        </span>
                      </div>
                    );
                  })()}
                </div>
              )}
              {!hillsResult && (
                <div style={{ padding: 12, borderRadius: 8, background: COLORS.inputHover, border: `1px dashed ${COLORS.inputBorder}`, fontSize: 11, color: COLORS.textMuted, textAlign: "center" }}>
                  Ingresa la Incidencia Pélvica (PI) y el L1PA para activar el análisis Hills.
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Tilts vertebrales (Hills 2022) — colapsable, opcional */}
        <Card>
          <button
            type="button"
            onClick={() => setTiltsOpen(o => !o)}
            aria-expanded={tiltsOpen}
            style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, padding: 0, background: "transparent", border: "none", cursor: "pointer", textAlign: "left", color: COLORS.ink }}>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: 19, fontWeight: 600, margin: "0 0 4px", color: COLORS.ink, fontFamily: FONT_SERIF, fontVariationSettings: "'opsz' 36, 'SOFT' 50", letterSpacing: "-0.01em" }}>🦴 Tilts vertebrales</h2>
              <p style={{ fontSize: 11, color: COLORS.textMuted, margin: 0 }}>
                Hills 2022 · IC 80% poblacional · <em>opcional, complementa al GAP</em>
              </p>
            </div>
            <span aria-hidden="true" style={{ fontSize: 18, color: COLORS.textMuted, fontWeight: 700, transform: tiltsOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.18s", lineHeight: 1, paddingTop: 4 }}>⌃</span>
          </button>
          {tiltsOpen && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
                <button onClick={() => setShowAnnotator(true)} style={{ padding: "8px 14px", borderRadius: 8, border: `1.5px solid ${COLORS.accent}`, background: COLORS.accent, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 14 }}>📐</span> Medir desde radiografía
                </button>
              </div>
              <p style={{ fontSize: 11, color: COLORS.textMuted, margin: "0 0 12px" }}>
                Para cada nivel: mide el tilt directo en PACS o ingresa el Pelvic Angle correspondiente; la app deriva tilt = <strong>PA − PT</strong>.
              </p>
              {[
                { key: "c2", titulo: "C2", direct: c2tiltDirect, setDirect: setC2TiltDirect, pa: cpa, setPA: setCPA, paLabel: "C2 Pelvic Angle (CPA)", paTooltip: "Ángulo C2-pélvico: subtendido desde el eje bicoxofemoral al centro del platillo S1 y al centroide del cuerpo de C2. CPA = C2 tilt + PT.", directTooltip: "C2 tilt directo: ángulo entre la línea del eje bicoxofemoral al centroide del cuerpo de C2 y la vertical. Convención: positivo si C2 está anterior a las cabezas femorales, negativo si posterior. Normal: −4.4° a −1.1° (Hills 2022, IC 80%)." },
                { key: "t1", titulo: "T1", direct: t1tiltDirect, setDirect: setT1TiltDirect, pa: t1pa, setPA: setT1PA, paLabel: "T1 Pelvic Angle (T1PA)", paTooltip: "Ángulo T1-pélvico: análogo al CPA pero al centroide de T1. T1PA = T1 tilt + PT.", directTooltip: "T1 tilt directo: ángulo entre el eje bicoxofemoral al centroide de T1 y la vertical (positivo anterior, negativo posterior). Normal: −7.0° a −3.6° (Hills 2022, IC 80%)." },
                { key: "l1", titulo: "L1", direct: l1tiltDirect, setDirect: setL1TiltDirect, pa: l1pa, setPA: setL1PA, paLabel: "L1 Pelvic Angle (L1PA)", paTooltip: "L1PA = L1 tilt + PT. Mismo dato usado en el bloque Eje T4-L1-Cadera.", directTooltip: "L1 tilt directo: ángulo entre el eje bicoxofemoral al centroide de L1 y la vertical (positivo anterior, negativo posterior). Normal: −10.3° a −5.1° (Hills 2022, IC 80%)." }
              ].map(row => {
                const r = tiltsResult ? tiltsResult[row.key] : null;
                const norm = TILT_NORMS[row.key];
                return (
                  <div key={row.key} style={{ marginBottom: 14, padding: 12, borderRadius: 10, background: COLORS.inputHover, border: `1px solid ${COLORS.inputBorder}` }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: COLORS.text, fontFamily: "'JetBrains Mono', monospace" }}>{row.titulo}</span>
                      <span style={{ fontSize: 11, color: COLORS.textMuted }}>{norm.normalText}</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <InputField
                        label="Tilt directo"
                        value={row.direct}
                        onChange={row.setDirect}
                        min={-30}
                        max={30}
                        step={0.1}
                        tooltip={row.directTooltip}
                      />
                      <InputField
                        label={row.paLabel}
                        value={row.pa}
                        onChange={row.setPA}
                        min={-30}
                        max={50}
                        step={0.1}
                        tooltip={row.paTooltip}
                      />
                    </div>
                    {r && (
                      <div style={{ marginTop: 6, padding: "10px 12px", borderRadius: 8, background: r.cls.bg, border: `1px solid ${r.cls.color}44`, fontSize: 12, color: r.cls.color }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                          <span style={{ fontWeight: 700 }}>{row.titulo} tilt · {r.cls.label}</span>
                        </div>
                        <div style={{ display: "flex", gap: 14, marginTop: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: COLORS.text, flexWrap: "wrap" }}>
                          {r.direct !== null && <span><strong>Directo:</strong> {r.direct.toFixed(1)}°</span>}
                          {r.derived !== null && <span><strong>Derivado (PA−PT):</strong> {r.derived.toFixed(1)}°</span>}
                          {r.delta !== null && (
                            <span style={{ color: Math.abs(r.delta) <= 1 ? COLORS.green : Math.abs(r.delta) <= 3 ? COLORS.yellow : COLORS.red }}>
                              <strong>Δ directo−derivado:</strong> {r.delta >= 0 ? "+" : ""}{r.delta.toFixed(1)}°
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {tiltsResult && tiltsResult.pt !== null ? (
                <div style={{ fontSize: 10, color: COLORS.textMuted, fontStyle: "italic", marginTop: 4 }}>
                  PT efectivo = {tiltsResult.pt.toFixed(1)}° {spinopelvic.derivedKey === "pt" ? "(derivado de PI − SS)" : ""}
                </div>
              ) : (
                <div style={{ fontSize: 11, color: COLORS.textMuted, fontStyle: "italic", marginTop: 4, textAlign: "center" }}>
                  Para el cálculo derivado se requieren PI y SS llenos (o PT directo).
                </div>
              )}
            </div>
          )}
        </Card>

        {/* SRS-Schwab classification (Schwab 2012) — colapsable, opcional */}
        <Card>
          <button
            type="button"
            onClick={() => setSchwabOpen(o => !o)}
            aria-expanded={schwabOpen}
            style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, padding: 0, background: "transparent", border: "none", cursor: "pointer", textAlign: "left", color: COLORS.ink }}>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: 19, fontWeight: 600, margin: "0 0 4px", color: COLORS.ink, fontFamily: FONT_SERIF, fontVariationSettings: "'opsz' 36, 'SOFT' 50", letterSpacing: "-0.01em" }}>📊 Clasificación SRS-Schwab</h2>
              <p style={{ fontSize: 11, color: COLORS.textMuted, margin: 0 }}>
                Schwab 2012 · modificadores sagitales · <em>opcional, complementa al GAP</em>
              </p>
            </div>
            <span aria-hidden="true" style={{ fontSize: 18, color: COLORS.textMuted, fontWeight: 700, transform: schwabOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.18s", lineHeight: 1, paddingTop: 4 }}>⌃</span>
          </button>
          {schwabOpen && (
            <div style={{ marginTop: 14 }}>
              <p style={{ fontSize: 11, color: COLORS.textMuted, margin: "0 0 12px", lineHeight: 1.5 }}>
                Tres modificadores sagitales (Schwab et al., Spine 2012). <strong>PI−LL</strong> y <strong>PT</strong> se derivan de los parámetros espinopélvicos. <strong>SVA</strong> requiere medición directa en la radiografía (distancia horizontal del plomo desde el centro del cuerpo de C7 hasta el borde posterosuperior de S1).
              </p>
              <InputField
                label="SVA (Sagittal Vertical Axis)"
                value={sva}
                onChange={setSVA}
                unit="cm"
                min={-20} max={30} step={0.1}
                tooltip="Sagittal Vertical Axis: distancia horizontal entre el plomo trazado desde el centro del cuerpo de C7 y el borde posterosuperior de S1. Positivo si C7 está anterior a S1. Mide la alineación sagital global. Normal < 4 cm. (Schwab et al., Spine 2012)"
              />
              {[
                { key: "piLL", titulo: "PI − LL", subtitulo: "Mismatch lumbo-pélvico (deformidad regional)", val: schwabResult.piLLVal, grade: schwabResult.piLL, unit: "°", t0: "< 10°", t1: "10–20°", t2: "> 20°" },
                { key: "pt",   titulo: "PT",       subtitulo: "Pelvic Tilt (mecanismo compensatorio)",        val: schwabResult.ptVal,   grade: schwabResult.pt,   unit: "°", t0: "< 20°", t1: "20–30°", t2: "> 30°" },
                { key: "sva",  titulo: "SVA",      subtitulo: "Sagittal Vertical Axis (alineación global)",   val: schwabResult.svaVal,  grade: schwabResult.sva,  unit: " cm", t0: "< 4 cm", t1: "4–9.5 cm", t2: "> 9.5 cm" },
              ].map(row => (
                <div key={row.key} style={{ marginBottom: 10, padding: 12, borderRadius: 10, background: COLORS.inputHover, border: `1px solid ${COLORS.inputBorder}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, fontFamily: "'JetBrains Mono', monospace" }}>{row.titulo}</div>
                      <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>{row.subtitulo}</div>
                      <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 4, fontFamily: "'JetBrains Mono', monospace" }}>
                        <span style={{ color: COLORS.green }}>0: {row.t0}</span> · <span style={{ color: COLORS.yellow }}>+: {row.t1}</span> · <span style={{ color: COLORS.red }}>++: {row.t2}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      {row.val !== null && row.val !== undefined ? (
                        <div style={{ fontSize: 16, fontWeight: 800, color: COLORS.text, fontFamily: "'JetBrains Mono', monospace" }}>
                          {row.val.toFixed(1)}{row.unit}
                        </div>
                      ) : (
                        <div style={{ fontSize: 11, color: COLORS.textMuted, fontStyle: "italic" }}>—</div>
                      )}
                      {row.grade && (
                        <div style={{ marginTop: 4, display: "inline-block", padding: "3px 10px", borderRadius: 6, background: row.grade.bg, color: row.grade.color, fontSize: 13, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", border: `1px solid ${row.grade.color}44` }}>
                          {row.grade.g}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {(schwabResult.piLL && schwabResult.pt && schwabResult.sva) ? (
                <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 10, background: COLORS.inputBg, border: `1px solid ${COLORS.cardBorder}` }}>
                  <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 4, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>Modificadores sagitales</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.ink, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.04em" }}>
                    PI−LL <span style={{ color: schwabResult.piLL.color }}>{schwabResult.piLL.g}</span> · PT <span style={{ color: schwabResult.pt.color }}>{schwabResult.pt.g}</span> · SVA <span style={{ color: schwabResult.sva.color }}>{schwabResult.sva.g}</span>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 11, color: COLORS.textMuted, fontStyle: "italic", marginTop: 4, textAlign: "center" }}>
                  Llena PI, L1-S1 y SVA para obtener la clasificación completa.
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Clasificación Roussouly — colapsable, opcional */}
        <Card>
          <button
            type="button"
            onClick={() => setRoussoulyOpen(o => !o)}
            aria-expanded={roussoulyOpen}
            style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, padding: 0, background: "transparent", border: "none", cursor: "pointer", textAlign: "left", color: COLORS.ink }}>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: 19, fontWeight: 600, margin: "0 0 4px", color: COLORS.ink, fontFamily: FONT_SERIF, fontVariationSettings: "'opsz' 36, 'SOFT' 50", letterSpacing: "-0.01em" }}>🧬 Clasificación Roussouly</h2>
              <p style={{ fontSize: 11, color: COLORS.textMuted, margin: 0 }}>
                Laouissat 2017 · Sebaaly 2020 · Bari 2020 · <em>tipo actual, ideal y concordancia con la PI</em>
              </p>
            </div>
            <span aria-hidden="true" style={{ fontSize: 18, color: COLORS.textMuted, fontWeight: 700, transform: roussoulyOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.18s", lineHeight: 1, paddingTop: 4 }}>⌃</span>
          </button>
          {roussoulyOpen && (
            <div style={{ marginTop: 14 }}>
              <p style={{ fontSize: 11, color: COLORS.textMuted, margin: "0 0 12px", lineHeight: 1.5 }}>
                Tipos sagitales según <strong>SS</strong>, número de vértebras lordóticas y <strong>PT</strong> (algoritmo de Bari 2020, Fig. 2). Se calcula además el <strong>tipo ideal</strong> a restaurar (Fig. 3) y la concordancia con la <strong>PI</strong>: no restaurar la forma sagital multiplica ×3 el riesgo de complicación mecánica (Sebaaly 2020).
              </p>
              <InputField
                label="Vértebras lordóticas (NVL)"
                value={nvl}
                onChange={setNvl}
                unit="vért."
                min={0} max={12} step={1}
                tooltip="Número de vértebras incluidas en la lordosis: desde S1 hasta la vértebra del punto de inflexión. Sólo se usa cuando SS < 35°, para separar tipo 1 (≤ 3 vértebras, lordosis corta) de tipo 2 (> 3 vértebras, dorso plano). Media en población normal ≈ 6 (Sebaaly 2020)."
              />
              {roussoulyResult ? (
                <>
                  <div style={{ padding: 14, borderRadius: 10, background: roussoulyResult.bg, border: `1.5px solid ${roussoulyResult.color}66` }}>
                    <div style={{ fontSize: 10, color: COLORS.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Tipo actual</div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
                      <span style={{ fontSize: 28, fontWeight: 800, color: roussoulyResult.color, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.02em" }}>{roussoulyResult.type}</span>
                      <span style={{ fontSize: 15, fontWeight: 700, color: roussoulyResult.color }}>{roussoulyResult.label}</span>
                    </div>
                    <div style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: "'JetBrains Mono', monospace", marginBottom: 8 }}>{roussoulyResult.params}</div>
                    <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.5 }}>{roussoulyResult.desc}</div>
                    {roussoulyResult.uncertain === "nvl" && (
                      <div style={{ marginTop: 8, fontSize: 11, color: COLORS.yellow, lineHeight: 1.45 }}>
                        ⚠ Ingresa el número de vértebras lordóticas para separar tipo 1 de tipo 2.
                      </div>
                    )}
                    {roussoulyResult.uncertain === "piPt" && (
                      <div style={{ marginTop: 8, fontSize: 11, color: COLORS.yellow, lineHeight: 1.45 }}>
                        ⚠ Faltan PI y/o PT: no puede descartarse un tipo 3 anteverted (PI &lt; 50° y PT &lt; 5°).
                      </div>
                    )}
                  </div>

                  {roussoulyResult.ideal && (
                    <div style={{ marginTop: 10, padding: 14, borderRadius: 10, background: COLORS.inputHover, border: `1px solid ${COLORS.inputBorder}` }}>
                      <div style={{ fontSize: 10, color: COLORS.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                        {roussoulyResult.esPost ? "Tipo ideal · referencia orientativa" : "Tipo ideal · objetivo de corrección"}
                      </div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
                        <span style={{ fontSize: 24, fontWeight: 800, color: COLORS.text, fontFamily: "'JetBrains Mono', monospace" }}>{roussoulyResult.ideal.type}</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>{roussoulyResult.ideal.label}</span>
                        {roussoulyResult.ideal.same && (
                          <span style={{ fontSize: 11, color: COLORS.green, fontWeight: 700 }}>= tipo actual, mantener la forma</span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.5 }}>{roussoulyResult.ideal.desc}</div>
                      {roussoulyResult.esPost && (
                        <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 8, background: COLORS.inputBg, border: `1px solid ${COLORS.cardBorder}`, fontSize: 11, color: COLORS.textMuted, lineHeight: 1.45 }}>
                          Estudio <strong>postoperatorio</strong>: el algoritmo de la Fig. 3 parte del tipo <em>preoperatorio</em>, así que este objetivo derivado de la forma post-op es sólo orientativo. Para juzgar si el paciente quedó "restaurado", usa la concordancia con la PI de abajo, que sí se aplica directamente sobre la forma postoperatoria.
                        </div>
                      )}
                      {roussoulyResult.ideal.uncertain === "pt" && (
                        <div style={{ marginTop: 8, fontSize: 11, color: COLORS.yellow, lineHeight: 1.45 }}>
                          ⚠ Falta PT para definir entre tipo 3 (PT &lt; 25°) y tipo 4 (PT ≥ 25°).
                        </div>
                      )}
                      {roussoulyResult.ideal.inferred && (
                        <div style={{ marginTop: 8, fontSize: 11, color: COLORS.textMuted, lineHeight: 1.45 }}>
                          Rama no contemplada en la Fig. 3 de Bari (PI &lt; 50° con PT ≥ 5°): objetivo derivado de la regla por PI de Sebaaly 2020.
                        </div>
                      )}
                    </div>
                  )}

                  {roussoulyResult.piMatch && (
                    <div style={{ marginTop: 10, padding: "12px 14px", borderRadius: 10, background: roussoulyResult.piMatch.level === "ok" ? COLORS.greenBg : roussoulyResult.piMatch.level === "warn" ? COLORS.yellowBg : COLORS.redBg, border: `1.5px solid ${(roussoulyResult.piMatch.level === "ok" ? COLORS.green : roussoulyResult.piMatch.level === "warn" ? COLORS.yellow : COLORS.red)}66` }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: roussoulyResult.piMatch.level === "ok" ? COLORS.green : roussoulyResult.piMatch.level === "warn" ? COLORS.yellow : COLORS.red, marginBottom: 4 }}>
                        {roussoulyResult.piMatch.level === "ok"
                          ? (roussoulyResult.esPost ? "✓ Forma restaurada (concordante con la PI)" : "✓ Forma concordante con la PI")
                          : roussoulyResult.piMatch.level === "warn"
                            ? "⚠ Concordancia con reservas"
                            : (roussoulyResult.esPost ? "✕ Forma NO restaurada (discordante con la PI)" : "✕ Forma NO concordante con la PI")}
                      </div>
                      <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.5 }}>
                        PI {roussoulyResult.piMatch.piLow ? "< 50°" : "≥ 50°"} → se espera <strong>{roussoulyResult.piMatch.esperadoLabel}</strong>.
                        {roussoulyResult.piMatch.level === "bad" && " No restaurar la forma sagital según la PI se asoció a RR 3 (IC 1.5–4.3) de complicación mecánica (46.8% vs 22.5%, Sebaaly 2020) y OR 4.7 de revisión por falla mecánica (Bari 2020)."}
                        {roussoulyResult.piMatch.antevertedWarn && " El tipo 3 anteverted es una variante normal reconocida (Laouissat 2017), pero convertir quirúrgicamente una PI baja en un anteverted es un objetivo desfavorable: se asocia a mayor tasa de PJK."}
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 8, background: COLORS.inputHover, border: `1px solid ${COLORS.inputBorder}`, fontSize: 11, color: COLORS.textMuted, lineHeight: 1.55 }}>
                    <strong style={{ color: COLORS.text }}>Algoritmo de asignación (Bari 2020, Fig. 2):</strong><br/>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>SS &lt; 35° · NVL ≤ 3 → Tipo 1 (lordosis corta, apex L5)</span><br/>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>SS &lt; 35° · NVL &gt; 3 → Tipo 2 (dorso plano)</span><br/>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>35° ≤ SS &lt; 45° · PI &lt; 50° y PT &lt; 5° → Tipo 3-AP</span><br/>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>35° ≤ SS &lt; 45° · PI ≥ 50° ó PT ≥ 5° → Tipo 3</span><br/>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>SS ≥ 45° → Tipo 4</span><br/>
                    <strong style={{ color: COLORS.text }}>Tipo ideal (Fig. 3):</strong><br/>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>Tipo 1/2 · PI &lt; 50° → se mantiene · PI ≥ 50° → Tipo 3 ó 4</span><br/>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>Tipo 3 · PI &lt; 50° y PT &lt; 5° → 3-AP</span><br/>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>Tipo 3 · PI ≥ 50° → PT &lt; 25° = Tipo 3 · PT ≥ 25° = Tipo 4</span><br/>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>Tipo 4 → Tipo 4</span>
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 11, color: COLORS.textMuted, fontStyle: "italic", marginTop: 4, textAlign: "center" }}>
                  Llena SS (o PI + PT) para obtener la clasificación Roussouly.
                </div>
              )}
            </div>
          )}
        </Card>

        {/* GAP-B (Noh 2020) — colapsable, opcional */}
        <Card>
          <button
            type="button"
            onClick={() => setGapbOpen(o => !o)}
            aria-expanded={gapbOpen}
            style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, padding: 0, background: "transparent", border: "none", cursor: "pointer", textAlign: "left", color: COLORS.ink }}>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: 19, fontWeight: 600, margin: "0 0 4px", color: COLORS.ink, fontFamily: FONT_SERIF, fontVariationSettings: "'opsz' 36, 'SOFT' 50", letterSpacing: "-0.01em" }}>🦴 GAP-B</h2>
              <p style={{ fontSize: 11, color: COLORS.textMuted, margin: 0 }}>
                Noh 2020 · GAP + IMC + DMO · <em>predicción de complicaciones mecánicas</em>
              </p>
            </div>
            <span aria-hidden="true" style={{ fontSize: 18, color: COLORS.textMuted, fontWeight: 700, transform: gapbOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.18s", lineHeight: 1, paddingTop: 4 }}>⌃</span>
          </button>
          {gapbOpen && (
            <div style={{ marginTop: 14 }}>
              <p style={{ fontSize: 11, color: COLORS.textMuted, margin: "0 0 12px", lineHeight: 1.5 }}>
                Modificación del GAP score que añade <strong>IMC</strong> y <strong>DMO</strong> (T-score de columna o fémur, lo peor). AUC reportado 0.885 vs 0.798 del GAP original (Noh SH et al., Spine J 2020).
              </p>
              <InputField
                label="DMO (T-score peor de columna/fémur)"
                value={bmdTscore}
                onChange={setBmdTscore}
                unit=""
                min={-5} max={5} step={0.1}
                placeholder="Ej. -2.5"
                tooltip="T-score por DEXA (densitometría). Usar el peor valor entre columna lumbar y fémur. Normal ≥ -1, osteopenia -1 a -2.5, osteoporosis ≤ -2.5. Si no tienes T-score reciente, deja en blanco."
              />
              <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 8, background: COLORS.inputHover, border: `1px solid ${COLORS.inputBorder}`, fontSize: 12, color: COLORS.text }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, fontFamily: "'JetBrains Mono', monospace" }}>
                  <div>
                    <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 2 }}>IMC</div>
                    <div style={{ fontWeight: 700, color: imc && imc.valor ? COLORS.text : COLORS.textMuted }}>{imc && imc.valor ? `${Number(imc.valor).toFixed(1)} kg/m²` : "—"}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 2 }}>GAP</div>
                    <div style={{ fontWeight: 700, color: result ? COLORS.text : COLORS.textMuted }}>{result ? `${result.total} pts` : "—"}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 2 }}>T-score</div>
                    <div style={{ fontWeight: 700, color: bmdTscore !== "" ? COLORS.text : COLORS.textMuted }}>{bmdTscore !== "" ? Number(bmdTscore).toFixed(1) : "—"}</div>
                  </div>
                </div>
                {(!imc || !imc.valor || !result || bmdTscore === "") && (
                  <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 6, fontStyle: "italic" }}>
                    Faltan: {[!imc || !imc.valor ? "peso/talla" : null, !result ? "GAP completo" : null, bmdTscore === "" ? "T-score DMO" : null].filter(Boolean).join(" · ")}
                  </div>
                )}
              </div>
              {gapbResult ? (
                <div style={{ padding: 14, borderRadius: 10, background: gapbResult.cat.bg, border: `1.5px solid ${gapbResult.cat.color}66` }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: 28, fontWeight: 800, color: gapbResult.cat.color, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.02em" }}>{(gapbResult.prob * 100).toFixed(0)}%</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: gapbResult.cat.color }}>{gapbResult.cat.label}</span>
                  </div>
                  <div style={{ fontSize: 11, color: COLORS.textMuted, lineHeight: 1.5 }}>
                    Probabilidad estimada de complicación mecánica postoperatoria (PJK/PJF, fractura de varilla o falla de implante) a 2 años, basada en la regresión logística de Noh 2020.
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 11, color: COLORS.textMuted, fontStyle: "italic", marginTop: 4, textAlign: "center" }}>
                  Llena peso, talla, los parámetros del GAP y el T-score de DMO para obtener la predicción GAP-B.
                </div>
              )}
              <div style={{ marginTop: 10, fontSize: 10, color: COLORS.textMuted, lineHeight: 1.45, fontStyle: "italic" }}>
                ⚠ Aproximación logística derivada de los HR multivariables publicados (BMI 1.284 · BMD 0.277 · GAP 1.457). El nomograma original de Noh 2020 (Fig. 2) es la referencia clínica formal. No sustituye juicio clínico.
              </div>
            </div>
          )}
        </Card>

        {/* Fotos — solo en modo clínico (los datos se asocian a un paciente identificado) */}
        {canEdit && (
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ fontSize: 19, fontWeight: 600, margin: 0, color: COLORS.ink, fontFamily: FONT_SERIF, fontVariationSettings: "'opsz' 36, 'SOFT' 50", letterSpacing: "-0.01em" }}>📸 Imágenes ({fotos.length})</h2>
              <label style={{ padding: "6px 14px", borderRadius: 8, border: `1.5px solid ${COLORS.purple}66`, background: COLORS.purpleBg, color: COLORS.purple, fontSize: 12, cursor: "pointer", fontWeight: 700 }}>
                + Agregar fotos
                <input type="file" accept="image/*" multiple capture="environment" onChange={handleFotos} style={{ display: "none" }} />
              </label>
            </div>
            {fotos.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: COLORS.textMuted, fontSize: 13, background: COLORS.inputHover, borderRadius: 10, border: `1px dashed ${COLORS.inputBorder}` }}>Sube radiografías. Se comprimen automáticamente.</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
                {fotos.map(f => (
                  <div key={f.id} style={{ position: "relative", background: COLORS.inputHover, borderRadius: 10, overflow: "hidden", border: `1px solid ${COLORS.inputBorder}` }}>
                    <img src={f.dataUrl} alt={f.name} style={{ width: "100%", height: 110, objectFit: "cover", display: "block" }} />
                    <button onClick={() => removeFoto(f.id)} style={{ position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: "50%", border: "none", background: "rgba(185,28,28,0.9)", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>×</button>
                    <select value={f.categoria} onChange={e => updateFotoCat(f.id, e.target.value)} style={{ width: "100%", padding: "6px 8px", background: COLORS.card, border: "none", borderTop: `1px solid ${COLORS.inputBorder}`, color: COLORS.text, fontSize: 11, outline: "none", cursor: "pointer" }}>
                      {CATEGORIAS_FOTO.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Mis casos guardados (modo público, desde localStorage) */}
        {!canEdit && myPublicCases.length > 0 && (
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: COLORS.text }}>📂 Mis casos guardados ({myPublicCases.length})</h2>
              <span style={{ fontSize: 10, color: COLORS.textMuted, fontStyle: "italic" }}>solo en este dispositivo</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 240, overflowY: "auto" }}>
              {myPublicCases.map(c => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: COLORS.inputHover, borderRadius: 8, border: `1px solid ${COLORS.inputBorder}` }}>
                  <span style={{ flex: 1, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: COLORS.accentDark }}>{c.id}</span>
                  <span style={{ fontSize: 10, color: COLORS.textMuted }}>{c.fechaCaso ? new Date(c.fechaCaso).toLocaleDateString("es-MX", { day: "2-digit", month: "short" }) : ""}</span>
                  {c.tipoEvaluacion && <MomentoBadge tipo={c.tipoEvaluacion} />}
                  {typeof c.gapTotal === "number" && <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.text }}>{c.gapTotal}/13</span>}
                  <button onClick={() => loadPublicCase(c.id)} style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${COLORS.accent}66`, background: COLORS.accentDim, color: COLORS.accentDark, fontSize: 11, cursor: "pointer", fontWeight: 700 }}>Cargar</button>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Suscripción a actualizaciones — solo modo público */}
        {!canEdit && firebaseEnabled && (
          <Card>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: subDone ? 0 : 14 }}>
              <div style={{ fontSize: 22, lineHeight: 1 }}>📬</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, marginBottom: 4 }}>
                  Recibe avisos de nuevas funciones
                </div>
                <p style={{ fontSize: 12, color: COLORS.textDim, lineHeight: 1.5, margin: 0 }}>
                  Tu correo solo se usará para enviarte actualizaciones de la calculadora. No se comparte con terceros.
                </p>
              </div>
            </div>
            {subDone ? (
              <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, background: COLORS.greenBg, border: `1px solid ${COLORS.green}44`, fontSize: 12, color: COLORS.green, fontWeight: 600, textAlign: "center" }}>
                ✓ Gracias, te avisaremos cuando haya novedades.
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, alignItems: "end" }}>
                <InputField label="Nombre" value={subName} onChange={setSubName} type="text" placeholder="Dr. Apellido" unit="" />
                <InputField label="Correo electrónico" value={subEmail} onChange={setSubEmail} type="text" placeholder="tu@correo.com" unit="" />
                <button
                  onClick={submitSubscribe}
                  disabled={subBusy}
                  style={{ gridColumn: "1 / -1", padding: "10px 16px", borderRadius: 8, border: `1.5px solid ${COLORS.accent}`, background: subBusy ? COLORS.inputHover : COLORS.accent, color: subBusy ? COLORS.textMuted : "#fff", fontSize: 13, fontWeight: 700, cursor: subBusy ? "wait" : "pointer", marginTop: 4 }}>
                  {subBusy ? "Registrando..." : "Suscribirme"}
                </button>
              </div>
            )}
          </Card>
        )}

        {/* Resultado — bloque editorial */}
        {result && (
          <div style={{ position: "relative", background: COLORS.card, borderRadius: 14, border: `1px solid ${COLORS.cardBorder}`, padding: "28px 26px 26px", marginBottom: 22, textAlign: "center", boxShadow: COLORS.cardShadow, overflow: "hidden" }}>
            <div aria-hidden="true" style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: result.cat.color }} />
            <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
              <span aria-hidden="true" style={{ width: 18, height: 1, background: result.cat.color, opacity: 0.6 }} />
              <span style={{ fontSize: 10, fontWeight: 600, color: result.cat.color, textTransform: "uppercase", letterSpacing: 3, fontFamily: FONT_SANS }}>GAP Score</span>
              <MomentoBadge tipo={tipoEvaluacion} />
              <span aria-hidden="true" style={{ width: 18, height: 1, background: result.cat.color, opacity: 0.6 }} />
            </div>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 8, lineHeight: 1 }}>
              <span style={{ fontSize: "clamp(72px, 16vw, 96px)", fontWeight: 600, fontFamily: FONT_SERIF, fontVariationSettings: "'opsz' 144, 'SOFT' 30", color: result.cat.color, letterSpacing: "-0.04em" }}>{result.total}</span>
              <span style={{ fontSize: 18, fontWeight: 500, fontFamily: FONT_SERIF, fontVariationSettings: "'opsz' 36", color: COLORS.textMuted, letterSpacing: "-0.01em" }}>/13</span>
            </div>
            <div style={{ marginTop: 14, fontFamily: FONT_SERIF, fontVariationSettings: "'opsz' 36, 'SOFT' 100", fontSize: 19, fontStyle: "italic", fontWeight: 500, color: result.cat.color, letterSpacing: "-0.005em" }}>
              {result.cat.label}
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: COLORS.textDim, fontFamily: FONT_SANS }}>Riesgo: {result.cat.risk}</div>
          </div>
        )}

        {/* Exportar */}
        <Card style={{ padding: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 4px", color: COLORS.text }}>Exportar y guardar</h2>
          <p style={{ fontSize: 11, color: COLORS.textMuted, margin: "0 0 14px" }}>{result ? "Resultado listo para exportar" : hasAnyMeasurement ? "Mediciones parciales · el PDF incluirá solo lo medido" : "⚠ Ingresa al menos una medición para habilitar exportación"}</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <ShareButton icon="📄" label="PDF" color={COLORS.accent} bg={COLORS.accentDim} onClick={handleDownload} disabled={!hasAnyMeasurement} />
            <ShareButton icon="✉️" label="Correo" color={COLORS.purple} bg={COLORS.purpleBg} onClick={handleEmail} disabled={!hasAnyMeasurement} />
          </div>
          {(() => {
            const isPublic = !canEdit;
            const needsLogin = firebaseEnabled && !user;
            const pendingAuth = firebaseEnabled && user && !allowlisted;
            const pendingConsent = firebaseEnabled && user && allowlisted && !consentAccepted;
            const hardDisabled = !result || saving || (saved && !isPublic) || pendingAuth;
            const onClick = isPublic ? () => savePublicCase() : saveCaso;
            const label = saving ? "⏳ Guardando..."
              : (saved && isPublic && savedPublicCaseId) ? `✅ Guardado · ${savedPublicCaseId}`
              : saved ? "✅ Caso guardado"
              : !firebaseEnabled ? "💾 Guardar localmente"
              : isPublic ? "💾 Guardar caso (recuperable con su ID)"
              : pendingAuth ? "⏳ Cuenta pendiente de autorización"
              : pendingConsent ? "📝 Aceptar consentimiento y guardar"
              : "💾 Guardar caso en Firebase";
            const bgColor = saved ? COLORS.greenBg
              : hardDisabled ? COLORS.inputHover
              : isPublic ? COLORS.accentDim
              : needsLogin ? COLORS.accentDim
              : pendingConsent ? COLORS.yellowBg
              : COLORS.yellowBg;
            const fgColor = saved ? COLORS.green
              : hardDisabled ? COLORS.textMuted
              : isPublic ? COLORS.accentDark
              : needsLogin ? COLORS.accentDark
              : pendingConsent ? COLORS.yellow
              : COLORS.yellow;
            const borderColor = saved ? COLORS.green + "66"
              : hardDisabled ? COLORS.inputBorder
              : isPublic ? COLORS.accent + "66"
              : needsLogin ? COLORS.accent + "66"
              : COLORS.yellow + "66";
            return (
              <>
                <button onClick={onClick} disabled={hardDisabled} style={{
                  width: "100%", padding: "12px", borderRadius: 10,
                  border: `1.5px solid ${borderColor}`,
                  background: bgColor, color: fgColor,
                  fontSize: 14, fontWeight: 700,
                  cursor: hardDisabled ? "not-allowed" : "pointer",
                  opacity: hardDisabled ? 0.55 : 1
                }}>
                  {label}
                </button>
                {isPublic && saved && savedPublicCaseId && (
                  <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 8, background: COLORS.greenBg, border: `1px solid ${COLORS.green}44`, fontSize: 12, color: COLORS.green, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <span>Guarda este ID para recuperar el caso después:</span>
                    <button onClick={() => { try { navigator.clipboard.writeText(savedPublicCaseId); showToast("ID copiado ✓"); } catch (e) {} }} style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${COLORS.green}66`, background: COLORS.card, color: COLORS.green, fontSize: 12, cursor: "pointer", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>📋 {savedPublicCaseId}</button>
                  </div>
                )}
              </>
            );
          })()}
        </Card>

        {/* Encuesta de satisfacción + sugerencias (one-time, requiere haber calculado al menos una vez) */}
        {result && !feedbackDone && firebaseEnabled && (
          <Card>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
              <div style={{ fontSize: 22, lineHeight: 1 }}>💬</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, marginBottom: 4 }}>
                  ¿Qué te pareció la calculadora?
                </div>
                <p style={{ fontSize: 12, color: COLORS.textDim, lineHeight: 1.5, margin: 0 }}>
                  Tu opinión es anónima y nos ayuda a mejorar. Esta encuesta solo aparece una vez.
                </p>
              </div>
            </div>
            <div onMouseLeave={() => setFeedbackHover(0)} style={{ display: "flex", justifyContent: "center", gap: 8, padding: "10px 0", marginBottom: 12 }}>
              {[1, 2, 3, 4, 5].map(n => {
                const filled = (feedbackHover || feedbackRating) >= n;
                return (
                  <span key={n}
                    onMouseEnter={() => setFeedbackHover(n)}
                    onClick={() => setFeedbackRating(n)}
                    style={{ cursor: "pointer", fontSize: 36, lineHeight: 1, color: filled ? "#F59E0B" : COLORS.inputBorder, transition: "color 0.12s, transform 0.12s", transform: filled ? "scale(1.05)" : "scale(1)", userSelect: "none" }}>
                    ★
                  </span>
                );
              })}
            </div>
            <textarea
              value={feedbackComment}
              onChange={e => setFeedbackComment(e.target.value)}
              placeholder="Sugerencias o comentarios (opcional, máx 500 caracteres)"
              maxLength={500}
              style={{ width: "100%", minHeight: 70, padding: "10px 12px", background: COLORS.inputBg, border: `1.5px solid ${COLORS.inputBorder}`, borderRadius: 8, color: COLORS.text, fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: "none", resize: "vertical", boxSizing: "border-box" }} />
            <button
              onClick={submitFeedback}
              disabled={feedbackBusy || !feedbackRating}
              style={{ width: "100%", marginTop: 10, padding: "10px 16px", borderRadius: 8, border: `1.5px solid ${feedbackRating ? COLORS.accent : COLORS.inputBorder}`, background: feedbackBusy ? COLORS.inputHover : feedbackRating ? COLORS.accent : COLORS.inputBg, color: feedbackBusy ? COLORS.textMuted : feedbackRating ? "#fff" : COLORS.textMuted, fontSize: 13, fontWeight: 700, cursor: feedbackBusy ? "wait" : feedbackRating ? "pointer" : "not-allowed", opacity: feedbackBusy ? 0.7 : 1 }}>
              {feedbackBusy ? "Enviando..." : feedbackRating ? `Enviar opinión (${feedbackRating}★)` : "Selecciona una calificación"}
            </button>
          </Card>
        )}

        {/* Parámetros y planificación */}
        {result && (
          <>
            <Card>
              <h2 style={{ fontSize: 19, fontWeight: 600, margin: "0 0 4px", color: COLORS.ink, fontFamily: FONT_SERIF, fontVariationSettings: "'opsz' 36, 'SOFT' 50", letterSpacing: "-0.01em" }}>Parámetros GAP</h2>
              <p style={{ fontSize: 12, color: COLORS.textMuted, margin: "0 0 12px" }}>RPV · RLL · ILD · ASR · FE</p>
              <ParamRow name="RPV" diff={result.rpv.diff} score={result.rpv.score} label={result.rpv.label} sub={result.rpv.sub} maxScore={3} />
              <ParamRow name="RLL" diff={result.rll.diff} score={result.rll.score} label={result.rll.label} sub={result.rll.sub} maxScore={3} />
              <ParamRow name="ILD" diff={undefined} score={result.ldi.score} label={`${result.ldi.value.toFixed(1)}% — ${result.ldi.label}`} sub={result.ldi.sub} maxScore={3} />
              <ParamRow name="ASR" diff={result.rsa.diff} score={result.rsa.score} label={result.rsa.label} sub={result.rsa.sub} maxScore={3} />
              <ParamRow name="FE" diff={undefined} score={result.af.score} label={result.af.label} sub={result.af.sub} maxScore={1} />
            </Card>
            <Card>
              <h2 style={{ fontSize: 19, fontWeight: 600, margin: "0 0 4px", color: COLORS.ink, fontFamily: FONT_SERIF, fontVariationSettings: "'opsz' 36, 'SOFT' 50", letterSpacing: "-0.01em" }}>Planificación Preoperatoria</h2>
              <p style={{ fontSize: 11, color: COLORS.textMuted, margin: "0 0 14px" }}>Valores ideales según Yilgor et al. 2017 · L4-S1 ideal = L1-S1 × 0.65{hillsResult && " · Hills 2022 añade target normativo"}</p>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr style={{ borderBottom: `2px solid ${COLORS.cardBorder}` }}>{["Parámetro", "Actual", "Ideal", "Corrección"].map(h => <th key={h} style={{ padding: "8px 10px", textAlign: h === "Parámetro" ? "left" : "right", fontWeight: 700, color: COLORS.textDim, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>{h}</th>)}</tr></thead>
                <tbody>{[
                  { name: "SS", current: ss, ideal: result.idealSS },
                  { name: "L1-S1", current: l1s1, ideal: result.idealLL },
                  ...(hillsResult ? [{ name: "L1-S1 (Hills)", current: l1s1, ideal: hillsResult.idealLL_Hills, accent: COLORS.purple }] : []),
                  { name: "L4-S1", current: l4s1, ideal: idealL4S1 },
                  { name: "GT", current: gt, ideal: result.idealGT }
                ].map(r => { const corr = r.ideal - r.current; const nameColor = r.accent || COLORS.accentDark; return <tr key={r.name} style={{ borderBottom: `1px solid ${COLORS.cardBorder}` }}><td style={{ padding: "10px", fontWeight: 700, color: nameColor, fontFamily: "'JetBrains Mono', monospace" }}>{r.name}</td><td style={{ padding: "10px", textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>{Number(r.current).toFixed(1)}°</td><td style={{ padding: "10px", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", color: COLORS.green, fontWeight: 600 }}>{r.ideal.toFixed(1)}°</td><td style={{ padding: "10px", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: Math.abs(corr) < 5 ? COLORS.green : Math.abs(corr) < 15 ? COLORS.yellow : COLORS.red }}>{corr >= 0 ? "+" : ""}{corr.toFixed(1)}°</td></tr>; })}</tbody>
              </table>
            </Card>
          </>
        )}

        {/* Casos guardados (solo modo clínico) */}
        {canEdit && (
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ fontSize: 19, fontWeight: 600, margin: 0, color: COLORS.ink, fontFamily: FONT_SERIF, fontVariationSettings: "'opsz' 36, 'SOFT' 50", letterSpacing: "-0.01em" }}>🗄️ Casos guardados</h2>
            <button onClick={() => setShowCasos(!showCasos)} style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${COLORS.inputBorder}`, background: "transparent", color: COLORS.textDim, fontSize: 12, cursor: "pointer" }}>{showCasos ? "Ocultar" : "Ver todos"}</button>
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {[{ v: "todos", l: "Todos", c: conteos.todos }, { v: "preoperatorio", l: "🔵 Pre-op", c: conteos.preoperatorio }, { v: "postoperatorio", l: "🟢 Post-op", c: conteos.postoperatorio }].map(t => (
              <button key={t.v} onClick={() => setFiltroTipo(t.v)} style={{ flex: 1, padding: "6px 8px", borderRadius: 6, border: `1px solid ${filtroTipo === t.v ? COLORS.accent : COLORS.inputBorder}`, background: filtroTipo === t.v ? COLORS.accentDim : "transparent", color: filtroTipo === t.v ? COLORS.accentDark : COLORS.textDim, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                {t.l} ({t.c})
              </button>
            ))}
          </div>
          {showCasos && casosFiltrados.length > 0 && (
            <div style={{ maxHeight: 350, overflowY: "auto", marginBottom: 12 }}>
              {casosFiltrados.map(c => {
                const pacDisplay = c.paciente?.completo || c.paciente || "Sin nombre";
                const fechaDisplay = c.fechaEstudio ? new Date(c.fechaEstudio + "T00:00:00").toLocaleDateString("es-MX") : new Date(c.fecha).toLocaleDateString("es-MX");
                return (
                  <div key={c.id} style={{ padding: 10, background: COLORS.inputHover, borderRadius: 8, marginBottom: 6, border: `1px solid ${COLORS.inputBorder}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div style={{ fontSize: 12, color: COLORS.text, flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2, flexWrap: "wrap" }}>
                          <strong>{pacDisplay}</strong>
                          <span style={{ color: COLORS.textMuted }}>· {c.edad} años</span>
                          {c.imc && <span style={{ color: COLORS.textMuted, fontSize: 11 }}>· IMC {c.imc.valor.toFixed(1)}</span>}
                          {c.tipoEvaluacion && <MomentoBadge tipo={c.tipoEvaluacion} />}
                        </div>
                        <div style={{ color: COLORS.textMuted, fontSize: 11 }}>
                          📅 {fechaDisplay}
                          {c.tiempoCalculado && <> · ⏱️ {c.tiempoCalculado}</>}
                          <> · GAP: <strong style={{ color: COLORS.accentDark }}>{c.resultado.total}/13</strong> · {c.resultado.categoria}</>
                        </div>
                        {((c.fotos?.length || 0) > 0) && <div style={{ fontSize: 11, color: COLORS.purple, marginTop: 2 }}>📸 {c.fotos.length}</div>}
                      </div>
                      <button onClick={() => deleteCaso(c.id)} style={{ padding: "2px 8px", borderRadius: 4, border: `1px solid ${COLORS.red}44`, background: "transparent", color: COLORS.red, fontSize: 10, cursor: "pointer" }}>🗑</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {showCasos && casosFiltrados.length === 0 && <div style={{ padding: 20, textAlign: "center", color: COLORS.textMuted, fontSize: 12, background: COLORS.inputHover, borderRadius: 8 }}>No hay casos en este filtro.</div>}
          {casosGuardados.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
              <button onClick={exportCSV} style={{ padding: "10px", borderRadius: 8, border: `1.5px solid ${COLORS.green}66`, background: COLORS.greenBg, color: COLORS.green, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>📊 Exportar CSV</button>
              <button onClick={exportJSON} style={{ padding: "10px", borderRadius: 8, border: `1.5px solid ${COLORS.accent}66`, background: COLORS.accentDim, color: COLORS.accentDark, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>📥 Exportar JSON</button>
            </div>
          )}
          <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 10, lineHeight: 1.5 }}>
            🔒 Solo tú ves los casos que guardas. Sincronizado con Firebase.
            <br />CSV se abre directo en Numbers o Excel. JSON sirve para entrenamiento de IA.
          </div>
        </Card>
        )}

        {/* Disclaimer — nota editorial */}
        <div style={{ padding: "16px 20px", marginBottom: 16, fontSize: 12, color: COLORS.textDim, lineHeight: 1.6, textAlign: "center", borderTop: `1px solid ${COLORS.rule}`, borderBottom: `1px solid ${COLORS.rule}` }}>
          <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 999, fontSize: 9, fontWeight: 600, letterSpacing: 2.5, textTransform: "uppercase", color: COLORS.secondary, background: COLORS.secondaryDim, marginBottom: 8, fontFamily: FONT_SANS }}>
            Aviso
          </span>
          <div style={{ fontFamily: FONT_SERIF, fontStyle: "italic", fontVariationSettings: "'opsz' 24, 'SOFT' 100", fontSize: 13, color: COLORS.text }}>
            Esta es únicamente una herramienta de cálculo y no representa una recomendación clínica.
          </div>
          <div style={{ marginTop: 4, fontSize: 11, color: COLORS.textMuted }}>
            Su uso es responsabilidad del médico que la utilice.
          </div>
          <div style={{ marginTop: 8, fontSize: 10, color: COLORS.textMuted, fontFamily: FONT_MONO }}>
            v{APP_VERSION}
          </div>
        </div>

        {/* Bibliografía colapsable */}
        <div style={{ marginBottom: 32, borderRadius: 12, background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, overflow: "hidden" }}>
          <button
            onClick={() => setShowBiblio(!showBiblio)}
            style={{ width: "100%", padding: "14px 18px", background: "transparent", border: "none", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", fontSize: 13, fontWeight: 700, color: COLORS.text, fontFamily: "'DM Sans', sans-serif" }}
          >
            <span>📚 Bibliografía ({REFERENCIAS.length})</span>
            <span style={{ fontSize: 12, color: COLORS.textMuted, fontWeight: 600 }}>{showBiblio ? "▲ Ocultar" : "▼ Mostrar"}</span>
          </button>
          {showBiblio && (
            <div style={{ maxHeight: 320, overflowY: "auto", borderTop: `1px solid ${COLORS.cardBorder}`, padding: "10px 18px 14px" }}>
              <ol style={{ margin: 0, paddingLeft: 22, fontSize: 12, color: COLORS.textDim, lineHeight: 1.55 }}>
                {REFERENCIAS.map((r, i) => (
                  <li key={i} style={{ marginBottom: 10, paddingLeft: 4 }}>
                    {r.cite}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        {/* Atribución VML — pie editorial */}
        <a
          href="https://vml.solutions/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "20px 12px 14px", textDecoration: "none", color: COLORS.textMuted, opacity: 0.85, transition: "opacity 200ms" }}
          onMouseEnter={e => e.currentTarget.style.opacity = 1}
          onMouseLeave={e => e.currentTarget.style.opacity = 0.85}>
          <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: 3, textTransform: "uppercase", color: COLORS.textMuted, fontFamily: FONT_SANS }}>
            Una aplicación de
          </span>
          <img
            src="/vml-logo.png"
            alt="Virtual Medical Learning"
            style={{ width: 88, height: "auto", objectFit: "contain" }} />
          <span style={{ fontSize: 11, color: COLORS.textMuted, textAlign: "center", lineHeight: 1.4, fontFamily: FONT_SERIF, fontStyle: "italic", fontVariationSettings: "'opsz' 18" }}>
            vml.solutions
          </span>
        </a>
      </div>

      {showConsentModal && user && (
        <ConsentModal
          onAccept={acceptConsent}
          onReject={rejectConsent}
          userEmail={user.email}
          busy={authBusy}
        />
      )}

      {showPublicConsentModal && (
        <PublicConsentModal
          onAccept={acceptPublicConsent}
          onCancel={() => setShowPublicConsentModal(false)}
          busy={saving}
        />
      )}

      {showPdfSaveModal && (
        <PdfSaveModal
          busy={saving}
          onSaveAndDownload={() => {
            setShowPdfSaveModal(false);
            setPendingDownloadAfterSave(true);
            savePublicCase();
          }}
          onDownloadOnly={() => { setShowPdfSaveModal(false); triggerDownload(); }}
          onCancel={() => setShowPdfSaveModal(false)}
        />
      )}

      {showLoginModal && (
        <EmailLoginModal
          email={loginEmail}
          password={loginPwd}
          onEmailChange={setLoginEmail}
          onPasswordChange={setLoginPwd}
          onSubmit={handleEmailLogin}
          onCancel={() => { setShowLoginModal(false); setLoginError(""); setLoginEmail(""); setLoginPwd(""); }}
          error={loginError}
          busy={authBusy}
        />
      )}

      <LandmarkAnnotator
        open={showAnnotator}
        onClose={() => setShowAnnotator(false)}
        canEdit={canEdit}
        onSaveAnnotated={(dataUrl) => {
          const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
          const foto = { id: uid(), name: `anotada_${stamp}.jpg`, dataUrl, categoria: "Radiografía anotada" };
          setFotos(prev => [...prev, foto]);
          showToast("Imagen anotada agregada al caso ✓");
        }}
        onApply={(v) => {
          if (v.pi !== undefined) setPI(v.pi);
          if (v.ss !== undefined) setSS(v.ss);
          if (v.pt !== undefined) setPT(v.pt);
          if (v.l1s1 !== undefined) setL1S1(v.l1s1);
          if (v.l4s1 !== undefined) setL4S1(v.l4s1);
          if (v.gt !== undefined) setGT(v.gt);
          // Hills 2022 — opcionales según landmarks colocados.
          if (v.l1pa !== undefined) setL1PA(v.l1pa);
          if (v.t4pa !== undefined) setT4PA(v.t4pa);
          if (v.c2tilt !== undefined) setC2TiltDirect(v.c2tilt);
          if (v.t1tilt !== undefined) setT1TiltDirect(v.t1tilt);
          if (v.l1tilt !== undefined) setL1TiltDirect(v.l1tilt);
          if (v.sva !== undefined) setSVA(v.sva);
          const count = Object.keys(v).length;
          showToast(`${count} medición${count === 1 ? "" : "es"} aplicada${count === 1 ? "" : "s"} al formulario ✓`);
        }}
      />
      </div>
    </div>
  );
}
