// ═══════════════════════════════════════════════════════════════════════════
// Formulario ⇄ DTO
// ═══════════════════════════════════════════════════════════════════════════
// Funciones puras, sin React. Existen para que App.jsx deje de leer treinta
// estados sueltos al guardar y de llamar a treinta setters al cargar.
//
// El formulario guarda cadenas (es lo que devuelven los <input>); el DTO guarda
// números o null. La conversión ocurre aquí y solo aquí.

import { emptyCaso, num, round, MEAS_KEYS } from "./caso";

// Campos del formulario, con su valor inicial. El orden es el de la interfaz.
// No incluye estado de interfaz (paneles abiertos, toasts, sesión): solo lo que
// describe el caso.
export function emptyForm(now = {}) {
  return {
    tipoEvaluacion: "preoperatorio",
    fechaEstudio: now.hoy ?? "",
    fechaCirugia: "",
    apellidos: "",
    nombre: "",
    iniciales: "",
    casoId: now.casoId ?? "",
    age: "",
    peso: "",
    talla: "",
    cirujanoSel: "",
    cirujanoCustom: "",
    medicoPublic: "",
    medidorSel: "",
    medidorCustom: "",
    cirugias: [],
    pi: "", ss: "", pt: "",
    l1s1: "", l4s1: "", gt: "",
    l1pa: "", t4pa: "",
    c2tiltDirect: "", cpa: "",
    t1tiltDirect: "", t1pa: "",
    l1tiltDirect: "",
    sva: "",
    nvl: "",
    bmdTscore: "",
    fotos: [],
    geometry: null,
  };
}

// Serializa un tilt (C2/T1/L1) sin arrastrar los colores del tema.
function tiltOut(t) {
  if (!t) return null;
  return {
    direct: t.direct,
    derived: round(t.derived),
    delta: round(t.delta),
    level: t.cls.level,
    label: t.cls.label,
  };
}

/**
 * Construye el DTO del caso a partir del formulario y de los valores derivados
 * que la interfaz ya calculó (para no recalcularlos aquí ni duplicar fórmulas).
 *
 * @param {object} f       bag plano de valores del formulario
 * @param {object} d       derivados: paciente, medico, medidor, imc, diffInfo,
 *                         spinopelvic, result, hillsResult, tiltsResult,
 *                         schwabResult, roussoulyResult, gapbResult, session,
 *                         deviceId, consentVersion, visibility, createdAt
 */
export function formToCaso(f, d = {}) {
  const caso = emptyCaso();
  const sp = d.spinopelvic || {};
  const visibility = d.visibility === "public" ? "public" : "private";

  caso.visibility = visibility;
  caso.createdAt = d.createdAt ?? null;
  caso.publicId = f.casoId || null;

  if (d.session) {
    caso.ownerUid = d.session.uid ?? null;
    caso.ownerEmail = d.session.email ?? null;
  }
  caso.deviceId = d.deviceId ?? null;
  caso.consentVersion = d.consentVersion ?? null;
  caso.consentAcceptedAt = d.consentAcceptedAt ?? null;

  caso.studyDate = f.fechaEstudio || null;
  caso.surgeryDate = f.fechaCirugia || null;
  caso.evaluationType = f.tipoEvaluacion;
  caso.daysDiff = d.diffInfo?.dias ?? null;
  caso.timeLabel = d.diffInfo?.mensaje || null;

  caso.patientLastName = f.apellidos || null;
  caso.patientFirstName = f.nombre || null;
  caso.patientFullName = d.paciente || null;
  caso.patientInitials = f.iniciales || null;
  caso.surgeonName = d.medico || null;
  caso.measurerName = d.medidor || null;

  caso.age = num(f.age);
  caso.weightKg = num(f.peso);
  caso.heightCm = num(f.talla);
  caso.bmi = d.imc ? round(d.imc.valor) : null;
  caso.bmiCategory = d.imc ? d.imc.categoria : null;

  caso.surgeries = (f.cirugias || []).map((c) => ({
    id: c.id ?? null,
    type: c.tipo || "",
    typeCustom: c.tipoCustom || "",
    segments: c.segmentos || [],
  }));

  // Mediciones. PI/SS/PT vienen del bloque `spinopelvic`, que ya resolvió cuál
  // de los tres se derivó de los otros dos; el resto se toma del formulario.
  caso.meas = {
    pi: num(sp.effPI), ss: num(sp.effSS), pt: num(sp.effPT),
    l1s1: num(f.l1s1), l4s1: num(f.l4s1), gt: num(f.gt),
    l1pa: num(f.l1pa), t4pa: num(f.t4pa),
    c2tilt: num(f.c2tiltDirect), cpa: num(f.cpa),
    t1tilt: num(f.t1tiltDirect), t1pa: num(f.t1pa),
    l1tilt: num(f.l1tiltDirect),
    sva: num(f.sva),
    bmdTscore: num(f.bmdTscore),
    nvl: num(f.nvl),
  };
  caso.derivedKey = sp.derivedKey ?? null;

  const r = d.result;
  caso.gap = r ? {
    total: r.total,
    category: r.cat.label,
    rpv: r.rpv.score, rll: r.rll.score,
    ldi: r.ldi.score, ldiValue: round(r.ldi.value),
    rsa: r.rsa.score, af: r.af.score,
  } : null;

  const h = d.hillsResult;
  caso.hills = h ? {
    idealL1PA: round(h.idealL1PA),
    l1paDiff: round(h.l1paDiff),
    idealLLHills: round(h.idealLL_Hills),
    axisDiff: round(h.ejeDiff),
    axisStatus: h.ejeStatus,
  } : null;

  const t = d.tiltsResult;
  caso.tilts = t ? {
    pt: round(t.pt),
    c2: tiltOut(t.c2), t1: tiltOut(t.t1), l1: tiltOut(t.l1),
  } : null;

  const s = d.schwabResult;
  caso.schwab = s ? {
    piLL: round(s.piLLVal),
    piLLGrade: s.piLL?.g ?? null,
    ptGrade: s.pt?.g ?? null,
    svaGrade: s.sva?.g ?? null,
  } : null;

  const ro = d.roussoulyResult;
  caso.roussouly = ro ? {
    currentKey: ro.cur?.key ?? null,
    currentLabel: ro.curDef?.label ?? null,
    idealKey: ro.ideal?.key ?? null,
    idealLabel: ro.idealDef?.label ?? null,
    piMatchLevel: ro.piMatch?.level ?? null,
    uncertain: ro.cur?.uncertain ?? null,
  } : null;

  const g = d.gapbResult;
  caso.gapb = g ? {
    bmi: round(g.bmi), tscore: round(g.tscore), gap: g.gap,
    prob: round(g.prob, 4), category: g.cat.label,
  } : null;

  caso.landmarks = f.geometry ?? null;
  caso.photos = (f.fotos || []).map((p) => ({
    id: p.id, name: p.name, category: p.categoria,
    url: p.url ?? null, dataUrl: p.dataUrl ?? undefined,
  }));

  return caso;
}

/**
 * Camino inverso: del DTO al bag del formulario. Devuelve solo las claves que
 * el caso puede repoblar, para que App.jsx las aplique con `applyForm`.
 * Los valores vuelven a ser cadenas, que es lo que esperan los <input>.
 */
export function casoToForm(caso) {
  if (!caso) return {};
  const m = caso.meas || {};
  const str = (v) => (v === null || v === undefined ? "" : String(v));

  const out = {
    tipoEvaluacion: caso.evaluationType || "preoperatorio",
    fechaEstudio: caso.studyDate || "",
    fechaCirugia: caso.surgeryDate || "",
    apellidos: caso.patientLastName || "",
    nombre: caso.patientFirstName || "",
    iniciales: caso.patientInitials || "",
    age: str(caso.age),
    peso: str(caso.weightKg),
    talla: str(caso.heightCm),
    // El id de la cirugía es una clave de React, no un dato clínico. Los casos
    // públicos no lo persisten, así que se sintetiza uno estable por posición
    // (los que añade el usuario en vivo usan uid() y no colisionan con "c0").
    cirugias: (caso.surgeries || []).map((s, i) => ({
      id: s.id ?? `c${i}`,
      tipo: s.type || "",
      tipoCustom: s.typeCustom || "",
      segmentos: s.segments || [],
    })),
    pi: str(m.pi), ss: str(m.ss), pt: str(m.pt),
    l1s1: str(m.l1s1), l4s1: str(m.l4s1), gt: str(m.gt),
    l1pa: str(m.l1pa), t4pa: str(m.t4pa),
    c2tiltDirect: str(m.c2tilt), cpa: str(m.cpa),
    t1tiltDirect: str(m.t1tilt), t1pa: str(m.t1pa),
    l1tiltDirect: str(m.l1tilt),
    sva: str(m.sva),
    nvl: str(m.nvl),
    bmdTscore: str(m.bmdTscore),
    geometry: caso.landmarks ?? null,
  };
  if (caso.publicId) out.casoId = caso.publicId;
  return out;
}

// Claves de medición que el formulario maneja como cadenas, emparejadas con su
// nombre en el DTO. Útil para recorrer ambos lados sin repetir la lista.
export const FORM_TO_MEAS = {
  pi: "pi", ss: "ss", pt: "pt",
  l1s1: "l1s1", l4s1: "l4s1", gt: "gt",
  l1pa: "l1pa", t4pa: "t4pa",
  c2tiltDirect: "c2tilt", cpa: "cpa",
  t1tiltDirect: "t1tilt", t1pa: "t1pa",
  l1tiltDirect: "l1tilt",
  sva: "sva", nvl: "nvl", bmdTscore: "bmdTscore",
};

// Comprobación de coherencia: toda clave de medición del DTO tiene origen en el
// formulario. Si alguien añade una medición y olvida el mapeo, esto lo delata.
export const MEAS_KEYS_COVERED = MEAS_KEYS.every((k) =>
  Object.values(FORM_TO_MEAS).includes(k));
