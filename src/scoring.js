// ═══════════════════════════════════════════════════════════════════════════
// LÓGICA GAP · tilts (Hills 2022) · Roussouly
// ═══════════════════════════════════════════════════════════════════════════
// Las fórmulas de esta sección NO se modifican: cambiarlas invalidaría los
// cálculos ya emitidos en reportes previos. Ver src/scoring.test.js.
import { COLORS } from "./theme";

export function classify(score) {
  if (score <= 2) return { label: "Proporcionado", color: COLORS.green, bg: COLORS.greenBg, risk: "Riesgo bajo (~4%)" };
  if (score <= 6) return { label: "Moderadamente Desproporcionado", color: COLORS.yellow, bg: COLORS.yellowBg, risk: "Riesgo moderado (~36-57%)" };
  return { label: "Severamente Desproporcionado", color: COLORS.red, bg: COLORS.redBg, risk: "Riesgo alto (~73-100%)" };
}
export const rpvCalc = (s, i) => { const d = s - i; return d < -15 ? { score: 3, label: "Retroversion Severa", sub: "< -15°" } : d < -7 ? { score: 2, label: "Retroversion Moderada", sub: "-15° a -7.1°" } : d <= 5 ? { score: 0, label: "Alineado", sub: "-7° a 5°" } : { score: 1, label: "Anteversion", sub: "> 5°" }; };
export const rllCalc = (s, i) => { const d = s - i; return d < -25 ? { score: 3, label: "Hipolordosis Severa", sub: "< -25°" } : d < -14 ? { score: 2, label: "Hipolordosis Moderada", sub: "-25° a -14.1°" } : d <= 11 ? { score: 0, label: "Alineado", sub: "-14° a 11°" } : { score: 3, label: "Hiperlordosis", sub: "> 11°" }; };
export const ldiCalc = (l4, l1) => { if (l1 === 0) return { score: 0, label: "N/A", sub: "-", value: 0 }; const p = (l4 / l1) * 100; return p < 40 ? { score: 2, label: "Maldistribuido (bajo)", sub: "< 40%", value: p } : p < 50 ? { score: 1, label: "Maldistribucion Moderada", sub: "40-49%", value: p } : p <= 80 ? { score: 0, label: "Alineado", sub: "50-80%", value: p } : { score: 3, label: "Maldistribuido (alto)", sub: "> 80%", value: p }; };
export const rsaCalc = (s, i) => { const d = s - i; return d > 18 ? { score: 3, label: "Desajuste Positivo Severo", sub: "> 18°" } : d > 10 ? { score: 1, label: "Desajuste Positivo Moderado", sub: "10.1° a 18°" } : d >= -7 ? { score: 0, label: "Alineado", sub: "-7° a 10°" } : { score: 1, label: "Desajuste Negativo", sub: "< -7°" }; };
export const afCalc = (a) => a >= 60 ? { score: 1, label: ">= 60 años", sub: "+1 pt" } : { score: 0, label: "< 60 años", sub: "0 pts" };

// Tilts vertebrales (Hills 2022) — IC 80% poblacional sano (n=320)
// Tres niveles: Normal (dentro IC 80%) · Borderline (≤2° fuera) · Alterado (>2° fuera)
export const TILT_NORMS = {
  c2: { lo: -4.4, hi: -1.1, label: "C2 tilt", normalText: "−4.4° a −1.1°" },
  t1: { lo: -7.0, hi: -3.6, label: "T1 tilt", normalText: "−7.0° a −3.6°" },
  l1: { lo: -10.3, hi: -5.1, label: "L1 tilt", normalText: "−10.3° a −5.1°" }
};
export const TILT_TOL = 2; // ° de tolerancia para "Borderline"
export const tiltClass = (v, lo, hi) => {
  if (v >= lo && v <= hi) return { level: "ok", label: "Normal", color: COLORS.green, bg: COLORS.greenBg };
  if (v >= lo - TILT_TOL && v <= hi + TILT_TOL) return { level: "warn", label: "Borderline", color: COLORS.yellow, bg: COLORS.yellowBg };
  return { level: "bad", label: "Alterado", color: COLORS.red, bg: COLORS.redBg };
};
// Calcula tilt directo + derivado (PA−PT) + delta entre ambos + clasificación
export const computeTilt = (key, direct, pa, pt) => {
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
export const R_TYPES = {
  "1":    { label: "Tipo 1", short: "1", desc: "SS < 35° con lordosis corta (≤ 3 vértebras lordóticas). Apex bajo (L5), arco inferior corto y cifosis toracolumbar por encima. Asociado a PI baja." },
  "2":    { label: "Tipo 2", short: "2", desc: "SS < 35° con lordosis larga y plana (> 3 vértebras lordóticas). Dorso plano global con punto de inflexión alto. Asociado a PI baja." },
  "3":    { label: "Tipo 3 (armónico)", short: "3", desc: "SS 35–45°. Apex en L4, distribución armónica de los arcos lordóticos. El patrón más frecuente en población sana." },
  "3AP":  { label: "Tipo 3 anteverted", short: "3-AP", desc: "SS ≥ 35° con PI < 50° y PT < 5°: pelvis anteverted. Lordosis prominente sobre una pelvis de baja incidencia (Laouissat 2017)." },
  "4":    { label: "Tipo 4", short: "4", desc: "SS ≥ 45° con PI alta. Apex en L3 o superior, lordosis larga y angulada con arco inferior prominente." },
  "1|2":  { label: "Tipo 1 ó 2", short: "1 / 2", desc: "SS < 35°: corresponde a tipo 1 ó 2. Para diferenciarlos se requiere el número de vértebras lordóticas (≤ 3 → tipo 1; > 3 → tipo 2)." },
  "3|4":  { label: "Tipo 3 ó 4", short: "3 / 4", desc: "Objetivo: restaurar lordosis hasta un shape de PI alta (tipo 3 ó 4). El PT residual esperado define cuál de los dos." },
};
export const R_LOW_PI = ["1", "2", "1|2"];
export const R_HIGH_PI = ["3", "4", "3|4"];

export function roussoulyCurrentType(ss, pi, pt, nvl) {
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

export function roussoulyIdealType(curKey, pi, pt) {
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
