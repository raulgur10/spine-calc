// ═══════════════════════════════════════════════════════════════════════════
// Mapeo de cable: DTO ⇄ fila de Postgres
// ═══════════════════════════════════════════════════════════════════════════
// El DTO agrupa por dominio (meas, gap, hills, tilts…) porque así se razona en
// la interfaz. La tabla es plana y en snake_case porque así el dataset del
// artículo sale con un SELECT. Esta es la única traducción entre las dos.
//
// Lo que NO se guarda por ser derivable de otra columna:
//   roussouly.currentLabel / idealLabel  → se obtienen de la clave
//   gapb.bmi / tscore / gap              → ya están en bmi, bmd_tscore, gap_total

import { emptyCaso, normalizeCaso } from "../../caso";

// Escalares simples: clave del DTO → columna.
const CAMPOS = {
  schemaVersion: "schema_version",
  publicId: "public_id",
  visibility: "visibility",
  ownerUid: "owner_uid",
  ownerEmail: "owner_email",
  deviceId: "device_id",
  createdAt: "created_at",
  consentVersion: "consent_version",
  consentAcceptedAt: "consent_accepted_at",
  studyDate: "study_date",
  surgeryDate: "surgery_date",
  evaluationType: "evaluation_type",
  daysDiff: "days_diff",
  timeLabel: "time_label",
  patientLastName: "patient_last_name",
  patientFirstName: "patient_first_name",
  patientFullName: "patient_full_name",
  patientInitials: "patient_initials",
  surgeonName: "surgeon_name",
  measurerName: "measurer_name",
  age: "age",
  weightKg: "weight_kg",
  heightCm: "height_cm",
  bmi: "bmi",
  bmiCategory: "bmi_category",
  derivedKey: "derived_key",
};

// Mediciones: clave dentro de `meas` → columna.
const MEDICIONES = {
  pi: "pi", ss: "ss", pt: "pt",
  l1s1: "l1s1", l4s1: "l4s1", gt: "gt",
  l1pa: "l1pa", t4pa: "t4pa",
  c2tilt: "c2tilt", cpa: "cpa",
  t1tilt: "t1tilt", t1pa: "t1pa", l1tilt: "l1tilt",
  sva: "sva", bmdTscore: "bmd_tscore", nvl: "nvl",
};

const GAP = { total: "gap_total", category: "gap_category", rpv: "gap_rpv", rll: "gap_rll", ldi: "gap_ldi", ldiValue: "gap_ldi_value", rsa: "gap_rsa", af: "gap_af" };
const HILLS = { idealL1PA: "hills_ideal_l1pa", l1paDiff: "hills_l1pa_diff", idealLLHills: "hills_ideal_ll", axisDiff: "hills_axis_diff", axisStatus: "hills_axis_status" };
const SCHWAB = { piLL: "schwab_pi_ll", piLLGrade: "schwab_pi_ll_grade", ptGrade: "schwab_pt_grade", svaGrade: "schwab_sva_grade" };
const ROUSSOULY = { currentKey: "roussouly_current_key", idealKey: "roussouly_ideal_key", piMatchLevel: "roussouly_pi_match", uncertain: "roussouly_uncertain" };
const GAPB = { prob: "gapb_prob", category: "gapb_category" };
const TILT_CAMPOS = ["direct", "derived", "delta", "level"];

function volcar(destino, origen, mapa) {
  for (const [k, col] of Object.entries(mapa)) destino[col] = origen?.[k] ?? null;
}
function recoger(fila, mapa) {
  const out = {};
  for (const [k, col] of Object.entries(mapa)) out[k] = fila[col] ?? null;
  return out;
}
// Un bloque derivado vale null si no se calculó ninguno de sus campos.
const vacio = (obj) => Object.values(obj).every((v) => v === null);

/** DTO → fila de `casos`. Las tablas hijas se arman aparte. */
export function casoToRow(caso) {
  const fila = {};
  volcar(fila, caso, CAMPOS);
  volcar(fila, caso.meas, MEDICIONES);
  volcar(fila, caso.gap, GAP);
  volcar(fila, caso.hills, HILLS);
  volcar(fila, caso.schwab, SCHWAB);
  volcar(fila, caso.roussouly, ROUSSOULY);
  volcar(fila, caso.gapb, GAPB);

  fila.tilt_pt = caso.tilts?.pt ?? null;
  for (const v of ["c2", "t1", "l1"]) {
    for (const c of TILT_CAMPOS) fila[`tilt_${v}_${c}`] = caso.tilts?.[v]?.[c] ?? null;
  }

  const lm = caso.landmarks;
  fila.lm_annotator_version = lm?.annotatorVersion ?? null;
  fila.lm_image_width = lm?.imageWidth ?? null;
  fila.lm_image_height = lm?.imageHeight ?? null;
  fila.lm_image_name = lm?.imageName ?? null;
  fila.lm_mm_per_px = lm?.mmPerPx ?? null;
  fila.lm_calib_ref_mm = lm?.calibRefMm ?? null;
  fila.lm_horiz_p1x = lm?.horizontal?.p1x ?? null;
  fila.lm_horiz_p1y = lm?.horizontal?.p1y ?? null;
  fila.lm_horiz_p2x = lm?.horizontal?.p2x ?? null;
  fila.lm_horiz_p2y = lm?.horizontal?.p2y ?? null;
  fila.lm_applied_at = lm?.appliedAt ?? null;
  fila.lm_edited_after_apply = lm?.editedAfterApply ?? false;
  fila.lm_free_points = lm?.freePoints ?? null;
  fila.lm_free_segments = lm?.freeSegments ?? null;

  // `id` solo viaja si ya existe: si no, lo pone el DEFAULT de la tabla.
  if (caso.id) fila.id = caso.id;
  return fila;
}

/** DTO → filas de las tablas hijas. */
export function childRows(caso, casoId) {
  return {
    landmarks: (caso.landmarks?.points || []).map((p) => ({
      caso_id: casoId, point_key: p.key, point_idx: p.idx, x: p.x, y: p.y,
    })),
    cirugias: (caso.surgeries || []).map((s, i) => ({
      caso_id: casoId, ord: i, tipo: s.type || null,
      tipo_custom: s.typeCustom || null, segmentos: s.segments || [],
    })),
    fotos: (caso.photos || []).map((p) => ({
      caso_id: casoId, foto_id: p.id, nombre: p.name,
      categoria: p.category, storage_path: p.storagePath ?? null,
    })),
  };
}

/** Fila de `casos` (+ sus hijas) → DTO. */
export function casoFromRow(fila, { landmarks = [], cirugias = [], fotos = [] } = {}) {
  if (!fila) return null;
  const caso = emptyCaso();

  for (const [k, col] of Object.entries(CAMPOS)) caso[k] = fila[col] ?? null;
  caso.id = fila.id ?? null;
  caso.meas = recoger(fila, MEDICIONES);

  const gap = recoger(fila, GAP);
  caso.gap = vacio(gap) ? null : gap;
  const hills = recoger(fila, HILLS);
  caso.hills = vacio(hills) ? null : hills;
  const schwab = recoger(fila, SCHWAB);
  caso.schwab = vacio(schwab) ? null : schwab;
  const roussouly = recoger(fila, ROUSSOULY);
  caso.roussouly = vacio(roussouly) ? null : roussouly;
  const gapb = recoger(fila, GAPB);
  caso.gapb = vacio(gapb) ? null : gapb;

  const tiltDe = (v) => {
    const t = {};
    for (const c of TILT_CAMPOS) t[c] = fila[`tilt_${v}_${c}`] ?? null;
    return vacio(t) ? null : t;
  };
  const tilts = { pt: fila.tilt_pt ?? null, c2: tiltDe("c2"), t1: tiltDe("t1"), l1: tiltDe("l1") };
  caso.tilts = vacio(tilts) ? null : tilts;

  const puntos = (landmarks || []).map((l) => ({ key: l.point_key, idx: l.point_idx, x: Number(l.x), y: Number(l.y) }));
  caso.landmarks = puntos.length > 0 ? {
    annotatorVersion: fila.lm_annotator_version ?? null,
    imageWidth: fila.lm_image_width ?? null,
    imageHeight: fila.lm_image_height ?? null,
    imageName: fila.lm_image_name ?? null,
    mmPerPx: fila.lm_mm_per_px !== null && fila.lm_mm_per_px !== undefined ? Number(fila.lm_mm_per_px) : null,
    calibRefMm: fila.lm_calib_ref_mm !== null && fila.lm_calib_ref_mm !== undefined ? Number(fila.lm_calib_ref_mm) : null,
    horizontal: fila.lm_horiz_p1x !== null && fila.lm_horiz_p1x !== undefined ? {
      p1x: Number(fila.lm_horiz_p1x), p1y: Number(fila.lm_horiz_p1y),
      p2x: Number(fila.lm_horiz_p2x), p2y: Number(fila.lm_horiz_p2y),
    } : null,
    appliedAt: fila.lm_applied_at ?? null,
    editedAfterApply: fila.lm_edited_after_apply ?? false,
    freePoints: fila.lm_free_points ?? [],
    freeSegments: fila.lm_free_segments ?? [],
    points: puntos,
    applied: {},
  } : null;

  caso.surgeries = (cirugias || []).map((s) => ({
    id: null, type: s.tipo || "", typeCustom: s.tipo_custom || "", segments: s.segmentos || [],
  }));
  caso.photos = (fotos || []).map((p) => ({
    id: p.foto_id, name: p.nombre, category: p.categoria,
    storagePath: p.storage_path ?? null, url: p.url ?? null,
  }));

  return normalizeCaso(caso);
}

/**
 * La función `obtener_caso_publico` devuelve la fila con los hijos ya anidados
 * en `landmarks` y `cirugias`, con las claves del DTO y no las de la tabla.
 */
export function casoPublicoFromRpc(payload) {
  if (!payload) return null;
  const { landmarks = [], cirugias = [], ...fila } = payload;
  const caso = casoFromRow(fila, {
    landmarks: landmarks.map((l) => ({ point_key: l.key, point_idx: l.idx, x: l.x, y: l.y })),
    cirugias: cirugias.map((c) => ({ tipo: c.tipo, tipo_custom: c.tipoCustom, segmentos: c.segmentos })),
  });
  if (caso) caso.visibility = "public";
  return caso;
}

// Columnas que el mapeo cubre. Sirve para que una prueba compruebe que ninguna
// clave del DTO se quedó sin destino.
export const COLUMNAS_CUBIERTAS = [
  ...Object.values(CAMPOS), ...Object.values(MEDICIONES), ...Object.values(GAP),
  ...Object.values(HILLS), ...Object.values(SCHWAB), ...Object.values(ROUSSOULY),
  ...Object.values(GAPB),
];
