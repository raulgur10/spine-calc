// ═══════════════════════════════════════════════════════════════════════════
// Objetivos por PI y edad · Diebo 2024 · McCarthy 2024 · Lafage 2016
// ═══════════════════════════════════════════════════════════════════════════
// Complementan al GAP sin tocarlo: nada de aquí entra al puntaje ni a las
// fórmulas de src/scoring.js. Ver src/objetivos.test.js.

// Lordosis segmentaria media por categoría de PI (Diebo BG et al., J Bone Joint
// Surg Am 2024;106:445-57, Tabla I; extrapolada de Pesenti 2018 y Charles 2022).
// Signo: lordosis positiva; el T10-L2 negativo es cifótico. Los autores advierten
// que son promedios y no una prescripción para cada paciente.
export const DIEBO_SEGMENTOS = ["T10-L2", "L1-L2", "L2-L3", "L3-L4", "L4-L5", "L5-S1"];
export const DIEBO_TABLA = {
  40: [-6.9, 1.7, 4.4, 9.5, 15, 17.5],
  50: [-4.3, 1.7, 6.2, 10.1, 15, 20],
  60: [-4.3, 3.1, 7.9, 11.2, 15, 20],
  70: [2.1, 4.9, 9.2, 15.4, 15, 20],
  80: [2.1, 5.5, 11.9, 17, 19, 20],
  90: [2.1, 7.3, 14.6, 12.9, 22, 20],
};
const CAT_MIN = 40, CAT_MAX = 90;

const num = (v) => (v === "" || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));
const suma = (a) => a.reduce((s, x) => s + x, 0);

// Categoría de la tabla más cercana a la PI medida. No se interpola: el artículo
// reporta categorías, e interpolar sería una regla nuestra. Fuera de 35-95° se
// toma el extremo de la tabla y se avisa (`fueraDeRango`).
export function dieboCategoria(pi) {
  const p = num(pi);
  if (p === null) return null;
  const cruda = Math.round(p / 10) * 10;
  const categoria = Math.min(CAT_MAX, Math.max(CAT_MIN, cruda));
  return { categoria, fueraDeRango: categoria !== cruda };
}

// Ideales por segmento y por región para la PI dada; con L1-S1 y L4-S1 medidos
// añade los valores actuales de las dos regiones de Pesenti (L1-L4 y L4-S1).
// L1-L4 actual = L1-S1 − L4-S1: los dos ángulos comparten el platillo de S1.
export function dieboObjetivos(pi, l1s1, l4s1) {
  const cat = dieboCategoria(pi);
  if (!cat) return null;
  const v = DIEBO_TABLA[cat.categoria];
  const segmentos = DIEBO_SEGMENTOS.map((name, i) => ({ name, ideal: v[i] }));
  const idealL1L4 = suma(v.slice(1, 4));
  const idealL4S1 = suma(v.slice(4, 6));
  const idealL1S1 = idealL1L4 + idealL4S1;
  const ll = num(l1s1), l4 = num(l4s1);
  const actualL4S1 = l4;
  const actualL1L4 = ll !== null && l4 !== null ? ll - l4 : null;
  return {
    ...cat,
    segmentos,
    idealL1L4, idealL4S1, idealL1S1,
    idealPctL4S1: (idealL4S1 / idealL1S1) * 100,
    actualL1L4, actualL4S1,
    actualPctL4S1: ll !== null && l4 !== null && ll !== 0 ? (l4 / ll) * 100 : null,
  };
}

// LL que necesita el paciente para su objetivo de alineación por edad
// (McCarthy MH et al., Global Spine J 2024;14(1):41-48):
//   LL = PI + 0.3·TK − 0.5·Edad + 10
// TK = cifosis torácica T2-T12 en valor positivo. En el PDF del artículo se
// pierden los signos; los reconstruyen sus Figuras 2 y 3 y la Tabla 4
// (PI 42, TK 14, 46 años → 33.2°).
export function mccarthyLL(pi, tk, age) {
  const p = num(pi), k = num(tk), a = num(age);
  if (p === null || k === null || a === null) return null;
  return p + 0.3 * k - 0.5 * a + 10;
}

// TPA objetivo por edad (Lafage R et al., Spine 2016, según la cita de McCarthy
// 2024): (Edad − 55)/2 + 16. McCarthy considera alcanzado el objetivo dentro de ±5°.
export const TPA_TOL = 5;
export function tpaObjetivo(age) {
  const a = num(age);
  return a === null ? null : (a - 55) / 2 + 16;
}
export function tpaEvaluacion(tpa, age) {
  const objetivo = tpaObjetivo(age), actual = num(tpa);
  if (objetivo === null || actual === null) return null;
  const diff = actual - objetivo;
  return { actual, objetivo, diff, enObjetivo: Math.abs(diff) <= TPA_TOL };
}
