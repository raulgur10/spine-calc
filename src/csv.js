// ═══════════════════════════════════════════════════════════════════════════
// CSV export
// ═══════════════════════════════════════════════════════════════════════════
import { cirugiasTexto } from "./utils";
import { TILT_NORMS, tiltClass } from "./scoring";

export function casosToCSV(casos) {
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

