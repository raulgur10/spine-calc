// ═══════════════════════════════════════════════════════════════════════════
// DTO canónico del caso
// ═══════════════════════════════════════════════════════════════════════════
// Moneda de cambio entre la interfaz y la capa de datos. Es agnóstico del motor
// de persistencia: ni Firestore ni Postgres aparecen aquí.
//
// Dos reglas de diseño, tomadas para que la migración a Supabase sea mecánica:
//
//  1. Las mediciones son escalares planos dentro de `meas`, no un objeto
//     anidado por dominio. Cada una mapea a una columna numérica.
//  2. Una sola forma para el caso privado y el público. El caso público es el
//     mismo objeto con los campos identificables en null y `visibility` en
//     "public"; en Postgres es la misma fila con una columna `visibility`.
//
// Los nombres de este DTO son los nombres persistidos. Donde el estado de React
// difiere (c2tiltDirect → c2tilt), la traducción ocurre una sola vez, en
// form.js, y en ningún otro lugar.

export const CASO_SCHEMA_VERSION = 2;

// Claves de medición, en el orden en que se presentan en el formulario.
// `sva`, `bmdTscore` y `nvl` son las tres que hoy se calculan pero no se guardan.
export const MEAS_KEYS = [
  "pi", "ss", "pt", "l1s1", "l4s1", "gt",
  "l1pa", "t4pa", "c2tilt", "cpa", "t1tilt", "t1pa", "l1tilt",
  "sva", "bmdTscore", "nvl",
];

// Campos que NO viajan en un caso público: identifican al paciente o al equipo.
export const PRIVATE_FIELDS = [
  "patientLastName", "patientFirstName", "patientFullName",
  "surgeonName", "measurerName", "ownerUid", "ownerEmail", "photos",
];

export function emptyCaso() {
  return {
    schemaVersion: CASO_SCHEMA_VERSION,
    id: null,
    publicId: null,
    visibility: "private",
    createdAt: null,
    ownerUid: null,
    ownerEmail: null,
    deviceId: null,
    consentVersion: null,
    consentAcceptedAt: null,

    studyDate: null,
    surgeryDate: null,
    evaluationType: "preoperatorio",
    daysDiff: null,
    timeLabel: null,

    patientLastName: null,
    patientFirstName: null,
    patientFullName: null,
    patientInitials: null,
    surgeonName: null,
    measurerName: null,

    age: null,
    weightKg: null,
    heightCm: null,
    bmi: null,
    bmiCategory: null,

    surgeries: [],
    meas: Object.fromEntries(MEAS_KEYS.map((k) => [k, null])),
    derivedKey: null,

    gap: null,
    hills: null,
    tilts: null,
    schwab: null,
    roussouly: null,
    gapb: null,

    landmarks: null,
    photos: [],
  };
}

// Convierte "" / undefined / NaN a null, y lo demás a Number. Es la única
// puerta por la que entran los valores numéricos al DTO: así ningún campo
// numérico llega a la base como cadena vacía.
export function num(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

// Redondea a `d` decimales conservando null.
export function round(v, d = 2) {
  const n = num(v);
  return n === null ? null : Number(n.toFixed(d));
}

// Rellena los huecos de un caso leído de la base con la forma completa, para
// que la interfaz nunca tenga que comprobar la existencia de cada campo.
export function normalizeCaso(caso) {
  if (!caso) return null;
  const base = emptyCaso();
  return {
    ...base,
    ...caso,
    meas: { ...base.meas, ...(caso.meas || {}) },
    surgeries: caso.surgeries || [],
    photos: caso.photos || [],
  };
}

// Despersonaliza un caso para publicarlo. No modifica el original.
export function toPublicCaso(caso) {
  const out = { ...caso, visibility: "public" };
  for (const f of PRIVATE_FIELDS) out[f] = f === "photos" ? [] : null;
  return out;
}
