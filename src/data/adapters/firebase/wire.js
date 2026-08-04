// ═══════════════════════════════════════════════════════════════════════════
// Mapeo de cable: documento de Firestore ⇄ DTO
// ═══════════════════════════════════════════════════════════════════════════
// Único punto del código que conoce la forma anidada con la que Firestore
// guarda los casos ("mediciones", "resultado", "paciente"…). Al migrar, este
// archivo se sustituye por su equivalente de Supabase y nada más cambia.
//
// Tolera dos versiones:
//   v1 — la forma histórica, anidada y con nombres en español.
//   v2 — el DTO actual, con `schemaVersion`.
//
// El soporte de v1 es TEMPORAL y muere con Firebase. Los casos que hay en
// Firestore son ensayos, no datos clínicos: no se migran a Supabase y no hay
// reportes que dependan de poder releerlos. Sirve solo para que la aplicación
// siga funcionando durante el resto del refactor, mientras el motor sigue
// siendo Firebase. El adaptador de Supabase arranca con base limpia y no lleva
// ninguna compatibilidad hacia atrás.

import { emptyCaso, normalizeCaso, num, CASO_SCHEMA_VERSION } from "../../caso";

function tiltFromV1(t) {
  if (!t) return null;
  return {
    direct: t.direct ?? null,
    derived: t.derived ?? null,
    delta: t.delta ?? null,      // ausente en los casos públicos v1
    level: t.level ?? null,
    label: t.label ?? null,
  };
}

/** Convierte un documento v1 (forma anidada en español) al DTO. */
export function casoFromDocV1(doc, { id = null, visibility = "private" } = {}) {
  if (!doc) return null;
  const c = emptyCaso();
  const m = doc.mediciones || {};
  const r = doc.resultado || null;
  const h = doc.hills || null;
  const t = doc.tilts || null;

  c.schemaVersion = 1;
  c.id = id;
  c.publicId = doc.casoId ?? null;
  c.visibility = visibility;
  // `fecha` es ISO en v1; `createdAt` puede llegar como Timestamp de Firestore.
  c.createdAt = doc.fecha ?? (doc.createdAt?.toDate?.().toISOString() ?? null);
  c.ownerUid = doc.ownerUid ?? null;
  c.ownerEmail = doc.ownerEmail ?? null;
  c.deviceId = doc.deviceId ?? null;
  c.consentVersion = doc.consentVersion ?? null;

  c.studyDate = doc.fechaEstudio ?? null;
  c.surgeryDate = doc.fechaCirugia ?? null;
  c.evaluationType = doc.tipoEvaluacion ?? "preoperatorio";
  c.daysDiff = doc.diasDiferencia ?? null;
  c.timeLabel = doc.tiempoCalculado ?? null;

  c.patientLastName = doc.paciente?.apellidos ?? null;
  c.patientFirstName = doc.paciente?.nombre ?? null;
  // En v1 `paciente` es un objeto en los casos privados y no existe en los
  // públicos; algunos documentos antiguos lo guardaron como cadena suelta.
  c.patientFullName = typeof doc.paciente === "string"
    ? doc.paciente
    : (doc.paciente?.completo ?? null);
  c.patientInitials = doc.iniciales ?? null;
  c.surgeonName = doc.medico ?? null;
  c.measurerName = doc.medidor ?? null;

  c.age = num(doc.edad);
  c.weightKg = num(doc.peso);
  c.heightCm = num(doc.talla);
  c.bmi = num(doc.imc?.valor);
  c.bmiCategory = doc.imc?.categoria ?? null;

  c.surgeries = (doc.cirugias || []).map((s) => ({
    id: s.id ?? null,
    type: s.tipo || "",
    typeCustom: s.tipoCustom || "",
    segments: s.segmentos || [],
  }));

  c.meas = {
    pi: num(m.pi), ss: num(m.ss), pt: num(m.pt),
    l1s1: num(m.l1s1), l4s1: num(m.l4s1), gt: num(m.gt),
    l1pa: num(m.l1pa), t4pa: num(m.t4pa),
    c2tilt: num(m.c2tilt), cpa: num(m.cpa),
    t1tilt: num(m.t1tilt), t1pa: num(m.t1pa),
    l1tilt: num(m.l1tilt),
    // v1 nunca guardó estas tres.
    sva: null, bmdTscore: null, nvl: null,
  };
  c.derivedKey = m.derivedKey ?? null;

  c.gap = r ? {
    total: r.total ?? null, category: r.categoria ?? null,
    rpv: r.rpv ?? null, rll: r.rll ?? null,
    ldi: r.ldi ?? null, ldiValue: r.ldiValor ?? null,
    rsa: r.rsa ?? null, af: r.af ?? null,
  } : null;

  c.hills = h ? {
    idealL1PA: h.idealL1PA ?? null,
    l1paDiff: h.l1paDiff ?? null,
    idealLLHills: h.idealLL_Hills ?? null,
    axisDiff: h.ejeDiff ?? null,
    axisStatus: h.ejeStatus ?? null,
  } : null;

  c.tilts = t ? {
    pt: t.pt ?? null,
    c2: tiltFromV1(t.c2), t1: tiltFromV1(t.t1), l1: tiltFromV1(t.l1),
  } : null;

  // v1 no guardaba Schwab, Roussouly, GAP-B ni landmarks.
  c.photos = (doc.fotos || []).map((p) => ({
    id: p.id, name: p.name, category: p.categoria, url: p.url ?? null,
  }));

  return c;
}

/**
 * Lee un documento sin saber de antemano su versión. Es la puerta de entrada
 * para todo lo que venga de la base.
 */
export function casoFromDoc(doc, opts = {}) {
  if (!doc) return null;
  if (doc.schemaVersion >= CASO_SCHEMA_VERSION) {
    return normalizeCaso({ ...doc, id: opts.id ?? doc.id ?? null });
  }
  return casoFromDocV1(doc, opts);
}
