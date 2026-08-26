// ═══════════════════════════════════════════════════════════════════════════
// CSV export
// ═══════════════════════════════════════════════════════════════════════════
import { cirugiasTexto } from "./utils";
import { TILT_NORMS, tiltClass } from "./scoring";

// `t` (la función de traducción de useI18n()) llega desde el llamador: este
// módulo no es un componente y no puede leer el contexto por su cuenta.
export function casosToCSV(casos, t) {
  const headers = [
    t("csv.id"), t("csv.fecha_guardado"), t("csv.fecha_estudio"), t("csv.fecha_cirugia"), t("csv.tipo_evaluacion"), t("csv.dias_diferencia"), t("csv.tiempo_calculado"),
    t("csv.apellidos"), t("csv.nombre"), t("csv.edad"), t("csv.peso_kg"), t("csv.talla_cm"), t("imc.sigla"), t("csv.categoria_imc"),
    t("csv.cirujano"), t("csv.cirugias"),
    "PI", "SS", "PT", t("csv.derivado"), "L1-S1", "L4-S1", "GT",
    "L1PA", "T4PA",
    t("csv.ideal", { p: "SS" }), t("csv.ideal", { p: "L1-S1" }), t("csv.ideal", { p: "L4-S1" }), t("csv.ideal", { p: "GT" }),
    t("csv.correccion", { p: "SS" }), t("csv.correccion", { p: "L1-S1" }), t("csv.correccion", { p: "L4-S1" }), t("csv.correccion", { p: "GT" }),
    t("csv.ideal", { p: "L1PA (Hills)" }), t("csv.delta", { p: "L1PA" }), t("csv.ideal", { p: "L1-S1 (Hills)" }), t("csv.correccion", { p: "L1-S1 Hills" }),
    "T4PA-L1PA", t("csv.eje_hills"),
    t("csv.tilt_directo", { p: "C2" }), "CPA", t("csv.tilt_derivado", { p: "C2" }), t("csv.tilt_delta", { p: "C2" }), t("csv.tilt_categoria", { p: "C2" }),
    t("csv.tilt_directo", { p: "T1" }), "T1PA", t("csv.tilt_derivado", { p: "T1" }), t("csv.tilt_delta", { p: "T1" }), t("csv.tilt_categoria", { p: "T1" }),
    t("csv.tilt_directo", { p: "L1" }), t("csv.tilt_derivado", { p: "L1" }), t("csv.tilt_delta", { p: "L1" }), t("csv.tilt_categoria", { p: "L1" }),
    t("csv.pts", { p: "RPV" }), t("csv.pts", { p: "RLL" }), t("csv.pts", { p: "LDI" }), "LDI %", t("csv.pts", { p: "RSA" }), t("csv.pts", { p: "FE" }),
    t("csv.gap_total"), t("csv.categoria_gap"),
    "SVA cm", t("csv.tscore_dmo"), t("csv.vertebras_lordoticas"), t("csv.fotos")
  ];
  const escape = (v) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = casos.map(c => {
    // El caso llega como DTO. Las mediciones son escalares planos en `meas` y
    // el bloque GAP está en `gap`; el resto del cálculo de columnas no cambia.
    const m = c.meas || {};
    const r = c.gap || {};
    const idealSS = 0.59 * m.pi + 9;
    const idealLL = 0.62 * m.pi + 29;
    const idealGT = 0.48 * m.pi - 15;
    const idealL4S1 = idealLL * 0.65;
    const imc = c.bmi != null ? c.bmi.toFixed(1) : "";
    const imcCat = c.bmiCategory || "";
    const hasL1PA = m.l1pa !== undefined && m.l1pa !== null && m.l1pa !== "";
    const hasT4PA = m.t4pa !== undefined && m.t4pa !== null && m.t4pa !== "";
    const idealL1PA_H = hasL1PA ? (0.5 * m.pi - 21) : null;
    const deltaL1PA = hasL1PA ? (m.l1pa - idealL1PA_H) : null;
    const idealLL_H = hasL1PA ? (1.4 * m.pi - 1.7 * m.l1pa - 2) : null;
    const corrLL_H = hasL1PA ? (idealLL_H - m.l1s1) : null;
    const ejeDiff = (hasL1PA && hasT4PA) ? (m.t4pa - m.l1pa) : null;
    const ejeLabel = ejeDiff === null ? "" : Math.abs(ejeDiff) <= 4 ? t("hills.eje.alineado") : Math.abs(ejeDiff) <= 8 ? t("hills.eje.moderada") : t("hills.eje.severa");
    // PT: usar valor guardado, o derivar de PI − SS para casos legados
    const pt = (m.pt !== undefined && m.pt !== null && m.pt !== "") ? Number(m.pt) : ((m.pi !== undefined && m.ss !== undefined) ? (Number(m.pi) - Number(m.ss)) : null);
    const tiltVal = (k) => m[k] !== undefined && m[k] !== null && m[k] !== "" ? Number(m[k]) : null;
    const tiltCsv = (key, directKey, paKey) => {
      const norm = TILT_NORMS[key];
      const direct = tiltVal(directKey);
      const pa = tiltVal(paKey);
      const derived = (pa !== null && pt !== null) ? (pa - pt) : null;
      const ref = direct !== null ? direct : derived;
      const cat = ref !== null ? t(tiltClass(ref, norm.lo, norm.hi).key) : "";
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
      c.createdAt,
      c.studyDate || "",
      c.surgeryDate || "",
      c.evaluationType || "",
      c.daysDiff ?? "",
      c.timeLabel || "",
      c.patientLastName || "",
      c.patientFirstName || "",
      c.age ?? "",
      c.weightKg ?? "",
      c.heightCm ?? "",
      imc,
      imcCat,
      c.surgeonName || "",
      cirugiasTexto((c.surgeries || []).map(x => ({ tipo: x.type, tipoCustom: x.typeCustom, segmentos: x.segments }))),
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
      r.rpv ?? "", r.rll ?? "", r.ldi ?? "", r.ldiValue ?? "", r.rsa ?? "", r.af ?? "",
      r.total ?? "", r.category || "",
      m.sva ?? "", m.bmdTscore ?? "", m.nvl ?? "",
      c.photos?.length || 0
    ].map(escape).join(",");
  });
  return [headers.join(","), ...rows].join("\n");
}

