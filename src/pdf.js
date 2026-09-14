// ═══════════════════════════════════════════════════════════════════════════
// PDF
// ═══════════════════════════════════════════════════════════════════════════
import jsPDF from "jspdf";
import { COLORS, MOMENTOS } from "./theme";
import { APP_VERSION } from "./constants";
import { diffMensaje } from "./utils";

// Helper: formatea un número con grado, o "-"
export function fmtDeg(v) {
  if (v === null || v === undefined || v === "" || Number.isNaN(Number(v))) return "—";
  return `${Number(v).toFixed(1)}°`;
}

// `t` es la función de traducción de useI18n(); el llamador la inyecta porque
// este módulo vive fuera de React. `lang` fija el locale de las fechas.
export function buildPDF(inputs, result, t, lang = "es") {
  const DATE_LOCALE = { es: "es-MX", en: "en-GB", fr: "fr-FR" }[lang] || "es-MX";
  const { age, pi, ss, pt, l1s1, l4s1, gt, l1pa, t4pa, paciente, medico, cirugias, tipoEvaluacion, fechaEstudio, fechaCirugia, diffInfo, peso, talla, imc, hillsResult, tiltsResult, derivedKey, sva, bmdTscore, schwabResult, roussoulyResult, gapbResult } = inputs;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, M = 18, CW = W - M * 2;
  let y = 18;
  // Helper: salto de página si falta espacio
  const ensureSpace = (needed) => { if (y + needed > 268) { doc.addPage(); y = 22; } };
  doc.setFillColor(13, 148, 136); doc.rect(0, 0, W, 16, "F");
  doc.setTextColor(255, 255, 255); doc.setFontSize(13); doc.setFont("helvetica", "bold");
  doc.text(t("pdf.encabezado"), M, 9.5);
  doc.setFontSize(8); doc.setFont("helvetica", "normal");
  doc.text(`SpineCalc - ${t("pdf.subtitulo")}`, M, 13.5);
  const tipoInfo = MOMENTOS[tipoEvaluacion];
  const badgeColor = tipoEvaluacion === "preoperatorio" ? [29, 78, 216] : [21, 128, 61];
  doc.setFillColor(...badgeColor); doc.roundedRect(W - M - 42, 4, 40, 8, 2, 2, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(8);
  doc.text(t(tipoInfo.key).toUpperCase(), W - M - 22, 9.5, { align: "center" });
  y = 24;
  const fechaEstTxt = new Date(fechaEstudio + "T00:00:00").toLocaleDateString(DATE_LOCALE, { day: "2-digit", month: "long", year: "numeric" });
  doc.setFontSize(9); doc.setTextColor(71, 85, 105);
  doc.text(t("pdf.fecha_estudio", { fecha: fechaEstTxt }), M, y);
  if (fechaCirugia) { const fc = new Date(fechaCirugia + "T00:00:00").toLocaleDateString(DATE_LOCALE, { day: "2-digit", month: "long", year: "numeric" }); doc.text(t("pdf.fecha_cirugia", { fecha: fc }), M + 90, y); }
  y += 7;
  if (diffInfo) { doc.setFont("helvetica", "italic"); doc.setFontSize(8); doc.text(`⏱  ${diffMensaje(t, diffInfo)}`, M, y); y += 6; }

  if (paciente || medico) {
    doc.setFillColor(250, 247, 242); doc.rect(M, y, CW, 10, "F"); doc.setDrawColor(231, 226, 217); doc.rect(M, y, CW, 10, "S");
    if (paciente) { doc.setTextColor(100, 116, 139); doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.text(t("pdf.paciente"), M + 3, y + 4); doc.setTextColor(30, 41, 59); doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text(paciente + (age ? ` (${t("pdf.anos", { n: age })})` : ""), M + 3, y + 8); }
    if (medico) { doc.setTextColor(100, 116, 139); doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.text(t("pdf.cirujano"), M + CW / 2 + 2, y + 4); doc.setTextColor(17, 94, 89); doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text(medico, M + CW / 2 + 2, y + 8); }
    y += 14;
  } else { y += 4; }

  // Antropometría
  if (peso || talla) {
    doc.setFillColor(250, 247, 242); doc.rect(M, y, CW, 8, "F"); doc.setDrawColor(231, 226, 217); doc.rect(M, y, CW, 8, "S");
    doc.setTextColor(100, 116, 139); doc.setFontSize(8); doc.setFont("helvetica", "normal");
    doc.text(t("pdf.antropometria"), M + 3, y + 3.5);
    doc.setTextColor(30, 41, 59); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    let antr = [];
    if (peso) antr.push(`${peso} kg`);
    if (talla) antr.push(`${talla} cm`);
    if (imc) antr.push(`${t("imc.sigla")} ${imc.valor.toFixed(1)} (${t(imc.categoriaKey)})`);
    doc.text(antr.join("  ·  "), M + 3, y + 7);
    y += 12;
  }

  if (cirugias && cirugias.length > 0) {
    doc.setFillColor(30, 41, 59); doc.rect(M, y, CW, 7, "F"); doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.setFont("helvetica", "bold");
    doc.text(tipoEvaluacion === "preoperatorio" ? t("pdf.cirugias.planificadas") : t("pdf.cirugias.realizadas"), M + 3, y + 4.8); y += 10;
    cirugias.forEach((c, i) => { const tipo = c.tipo === "otro" ? c.tipoCustom : c.tipo; const segs = c.segmentos.length > 0 ? c.segmentos.join(", ") : "—"; doc.setFillColor(i % 2 === 0 ? 250 : 244, i % 2 === 0 ? 247 : 241, i % 2 === 0 ? 242 : 236); doc.rect(M, y, CW, 10, "F"); doc.setTextColor(30, 41, 59); doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.text(`${i + 1}. ${tipo}`, M + 3, y + 4); doc.setTextColor(100, 116, 139); doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.text(t("pdf.segmentos", { segs }), M + 3, y + 8); y += 11; });
    y += 4;
  }

  doc.setFillColor(30, 41, 59); doc.rect(M, y, CW, 7, "F"); doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.text(t("pdf.mediciones"), M + 3, y + 4.8); y += 10;
  const autoTag = ` (${t("pdf.auto")})`;
  const piTag = derivedKey === "pi" ? autoTag : "";
  const ssTag = derivedKey === "ss" ? autoTag : "";
  const ptTag = derivedKey === "pt" ? autoTag : "";
  const med = [
    [`${t("param.pi.corto")}${piTag}`, fmtDeg(pi)],
    [`${t("param.ss.corto")}${ssTag}`, fmtDeg(ss)],
    [`${t("param.pt.corto")}${ptTag}`, fmtDeg(pt)],
    [t("param.l1s1"), fmtDeg(l1s1)],
    [t("param.l4s1"), fmtDeg(l4s1)],
    [t("param.gt.corto"), fmtDeg(gt)]
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
    doc.setFillColor(...catRgb); doc.roundedRect(M, y, CW, 22, 3, 3, "F"); doc.setTextColor(255, 255, 255); doc.setFontSize(28); doc.setFont("helvetica", "bold"); doc.text(String(result.total), M + 14, y + 15, { align: "center" }); doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.text("/ 13", M + 20, y + 18); doc.setFontSize(13); doc.setFont("helvetica", "bold"); doc.text(t(result.cat.key), M + 30, y + 10); doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.text(t(result.cat.riskKey), M + 30, y + 17); y += 28;

    doc.setFillColor(30, 41, 59); doc.rect(M, y, CW, 7, "F"); doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text(t("pdf.parametros_gap"), M + 3, y + 4.8); y += 10;
    const sc = (s) => s === 0 ? [21, 128, 61] : s <= 1 ? [180, 83, 9] : [185, 28, 28];
    [{ name: `RPV  ${t("param.rpv")}`, r: result.rpv, diff: `${result.rpv.diff >= 0 ? "+" : ""}${result.rpv.diff.toFixed(1)}°` }, { name: `RLL  ${t("param.rll")}`, r: result.rll, diff: `${result.rll.diff >= 0 ? "+" : ""}${result.rll.diff.toFixed(1)}°` }, { name: `ILD  ${t("param.ldi")}`, r: result.ldi, diff: `${result.ldi.value.toFixed(1)}%` }, { name: `ASR  ${t("param.rsa")}`, r: result.rsa, diff: `${result.rsa.diff >= 0 ? "+" : ""}${result.rsa.diff.toFixed(1)}°` }, { name: `FE   ${t("param.af")}`, r: result.af, diff: "" }].forEach(({ name, r, diff }, i) => { const bg = i % 2 === 0 ? [250, 247, 242] : [244, 241, 236]; doc.setFillColor(...bg); doc.rect(M, y, CW - 14, 8, "F"); doc.setFillColor(...sc(r.score)); doc.rect(M + CW - 13, y, 13, 8, "F"); doc.setTextColor(30, 41, 59); doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.text(name, M + 2, y + 3.2); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 116, 139); doc.text(`${t(r.key)}  ${diff}`, M + 2, y + 6.5); doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text(String(r.score), M + CW - 6.5, y + 5.5, { align: "center" }); y += 9; });
    y += 4;

    doc.setFillColor(30, 41, 59); doc.rect(M, y, CW, 7, "F"); doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text(t("pdf.planificacion"), M + 3, y + 4.8); y += 10;
    doc.setFillColor(30, 41, 59); doc.rect(M, y, CW, 7, "F"); doc.setTextColor(255, 255, 255); doc.setFontSize(8);
    [t("tabla.parametro"), t("tabla.actual"), t("tabla.ideal"), t("tabla.correccion")].forEach((c, i) => { doc.setFont("helvetica", "bold"); doc.text(c, colX[i] + (i === 0 ? 2 : 0), y + 4.8); }); y += 8;

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
    if (age === "" || age === null) faltantes.push(t("campo.edad"));
    doc.setFillColor(244, 241, 236); doc.rect(M, y, CW, 14, "F");
    doc.setDrawColor(231, 226, 217); doc.rect(M, y, CW, 14, "S");
    doc.setTextColor(100, 116, 139); doc.setFont("helvetica", "italic"); doc.setFontSize(9);
    doc.text(t("pdf.sin_gap"), M + 3, y + 5.5);
    doc.setFontSize(8);
    doc.text(faltantes.length ? t("pdf.faltan", { lista: faltantes.join(", ") }) : "", M + 3, y + 10.5);
    y += 18;
  }

  // Eje T4-L1-Cadera (Hills 2022)
  if (hillsResult) {
    ensureSpace(30);
    y += 4;
    doc.setFillColor(109, 40, 217); doc.rect(M, y, CW, 7, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text(`${t("pdf.eje_hills")}  (Hills et al., Spine 2022)`, M + 3, y + 4.8); y += 10;

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
      doc.text(t(hillsResult.ejeLabelKey), M + 2, y + 4); y += 6;
    }
  }

  // Tilts vertebrales (Hills 2022) — opcional
  if (tiltsResult && (tiltsResult.c2 || tiltsResult.t1 || tiltsResult.l1)) {
    ensureSpace(40);
    y += 4;
    doc.setFillColor(109, 40, 217); doc.rect(M, y, CW, 7, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text(`${t("pdf.tilts")}  (Hills et al., Spine 2022)`, M + 3, y + 4.8); y += 8;
    doc.setFillColor(30, 41, 59); doc.rect(M, y, CW, 6, "F"); doc.setTextColor(255, 255, 255); doc.setFontSize(7.5);
    [t("tabla.nivel"), t("tabla.directo"), t("tabla.derivado_pa_pt"), t("tabla.categoria")].forEach((c, i) => { doc.setFont("helvetica", "bold"); doc.text(c, colX[i] + (i === 0 ? 2 : 0), y + 4); });
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
      doc.text(t(r.cls.key), colX[3], y + 4.3);
      y += 6.5;
      if (r.delta !== null) {
        const dCC = Math.abs(r.delta) <= 1 ? [21, 128, 61] : Math.abs(r.delta) <= 3 ? [180, 83, 9] : [185, 28, 28];
        doc.setFont("helvetica", "italic"); doc.setFontSize(7); doc.setTextColor(...dCC);
        doc.text(`${t("pdf.delta_directo_derivado")} = ${r.delta >= 0 ? "+" : ""}${r.delta.toFixed(1)}°  ·  ${t("pdf.normal")}: ${row.normal}°`, M + 4, y + 3.5);
        y += 5;
      }
    });
    if (tiltsResult.pt !== null) {
      doc.setFont("helvetica", "italic"); doc.setFontSize(7); doc.setTextColor(100, 116, 139);
      doc.text(t("pdf.pt_derivado", { v: tiltsResult.pt.toFixed(1) }), M + 2, y + 3.5);
      y += 5;
    }
  }

  // SRS-Schwab classification (Schwab 2012)
  if (schwabResult && (schwabResult.piLL || schwabResult.pt || schwabResult.sva)) {
    ensureSpace(36);
    y += 4;
    doc.setFillColor(180, 83, 9); doc.rect(M, y, CW, 7, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text(`${t("pdf.schwab")}  (Schwab et al., Spine 2012)`, M + 3, y + 4.8); y += 8;
    doc.setFillColor(30, 41, 59); doc.rect(M, y, CW, 6, "F"); doc.setTextColor(255, 255, 255); doc.setFontSize(7.5);
    [t("tabla.modificador"), t("tabla.valor"), t("tabla.grado"), t("tabla.umbrales")].forEach((c, i) => { doc.setFont("helvetica", "bold"); doc.text(c, colX[i] + (i === 0 ? 2 : 0), y + 4); });
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
      doc.text(`${t("pdf.resumen_sagital")}: PI-LL ${schwabResult.piLL.g}  ·  PT ${schwabResult.pt.g}  ·  SVA ${schwabResult.sva.g}`, M + 2, y + 5);
      y += 7;
    }
  }

  // Roussouly classification
  if (roussoulyResult) {
    // Wrap description text and compute total box height
    const descLines = doc.splitTextToSize(t(roussoulyResult.descKey), CW - 44);
    const descH = descLines.length * 3.2;
    const boxH = Math.max(16, 11 + descH);
    const idealLines = roussoulyResult.ideal ? doc.splitTextToSize(t(roussoulyResult.ideal.descKey), CW - 44) : [];
    const idealH = roussoulyResult.ideal ? Math.max(14, 9 + idealLines.length * 3.2) : 0;
    const matchH = roussoulyResult.piMatch ? 12 : 0;
    ensureSpace(boxH + idealH + matchH + 14);
    y += 4;
    doc.setFillColor(34, 211, 238); doc.rect(M, y, CW, 7, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text(`${t("pdf.roussouly")}  (Laouissat 2017 / Sebaaly 2020 / Bari 2020)`, M + 3, y + 4.8); y += 9;
    const rRgb = roussoulyResult.color === COLORS.green ? [21, 128, 61] : roussoulyResult.color === COLORS.red ? [185, 28, 28] : [14, 116, 144];
    doc.setFillColor(250, 247, 242); doc.rect(M, y, CW, boxH, "F");
    doc.setDrawColor(...rRgb); doc.setLineWidth(0.6); doc.rect(M, y, CW, boxH, "S");
    doc.setTextColor(...rRgb); doc.setFont("helvetica", "bold"); doc.setFontSize(16);
    doc.text(t("roussouly.tipo_n", { n: roussoulyResult.type }), M + 4, y + boxH / 2 + 3);
    doc.setFontSize(9); doc.setTextColor(30, 41, 59);
    doc.text(`${t("pdf.roussouly.actual")}  ·  ${t(roussoulyResult.labelKey)}`, M + 40, y + 5);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(100, 116, 139);
    doc.text(roussoulyResult.params, M + 40, y + 9);
    doc.text(descLines, M + 40, y + 13);
    y += boxH + 3;

    // Tipo ideal / objetivo quirúrgico (Bari 2020, Fig. 3)
    if (roussoulyResult.ideal) {
      doc.setFillColor(244, 241, 236); doc.rect(M, y, CW, idealH, "F");
      doc.setDrawColor(148, 163, 184); doc.setLineWidth(0.4); doc.rect(M, y, CW, idealH, "S");
      doc.setTextColor(51, 65, 85); doc.setFont("helvetica", "bold"); doc.setFontSize(14);
      doc.text(t("roussouly.tipo_n", { n: roussoulyResult.ideal.type }), M + 4, y + idealH / 2 + 2.5);
      doc.setFontSize(8.5); doc.setTextColor(30, 41, 59);
      doc.text(`${roussoulyResult.esPost ? t("pdf.roussouly.ideal_orientativo") : t("pdf.roussouly.ideal_objetivo")}  ·  ${t(roussoulyResult.ideal.labelKey)}`, M + 40, y + 5);
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(100, 116, 139);
      doc.text(idealLines, M + 40, y + 9);
      y += idealH + 3;
    }

    // Concordancia con la PI (Sebaaly 2020)
    if (roussoulyResult.piMatch) {
      const lvl = roussoulyResult.piMatch.level;
      const mRgb = lvl === "ok" ? [21, 128, 61] : lvl === "warn" ? [180, 83, 9] : [185, 28, 28];
      const piTxt = t("pdf.roussouly.pi_espera", { pi: roussoulyResult.piMatch.piLow ? "< 50" : ">= 50", tipo: t(roussoulyResult.piMatch.esperadoKey) });
      doc.setFillColor(...mRgb); doc.rect(M, y, CW, 10, "F");
      doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(8.5);
      doc.text(
        lvl === "ok" ? (roussoulyResult.esPost ? t("pdf.roussouly.restaurada") : t("pdf.roussouly.concordante"))
          : lvl === "warn" ? t("pdf.roussouly.reservas")
            : (roussoulyResult.esPost ? t("pdf.roussouly.no_restaurada") : t("pdf.roussouly.no_concordante")),
        M + 3, y + 4.2);
      doc.setFont("helvetica", "normal"); doc.setFontSize(7);
      doc.text(
        lvl === "ok"
          ? `${piTxt} ${t("pdf.roussouly.nota_ok")}`
          : lvl === "warn"
            ? `${piTxt} ${t("pdf.roussouly.nota_warn")}`
            : `${piTxt} ${t("pdf.roussouly.nota_bad")}`,
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
    doc.setFontSize(11); doc.text(t(gapbResult.cat.key), M + 30, y + 7);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
    doc.text(`${t("imc.sigla")} ${gapbResult.bmi.toFixed(1)}  ·  T-score ${gapbResult.tscore.toFixed(1)}  ·  GAP ${gapbResult.gap} ${t("comun.pts")}`, M + 30, y + 12);
    doc.text(t("pdf.gapb.prob"), M + 30, y + 14.5);
    y += 19;
    doc.setFont("helvetica", "italic"); doc.setFontSize(6.5); doc.setTextColor(100, 116, 139);
    doc.text(t("pdf.gapb.nota"), M + 2, y + 3);
    y += 5;
  }

  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFillColor(30, 41, 59); doc.rect(0, 278, W, 19, "F");
    doc.setTextColor(148, 163, 184); doc.setFontSize(7); doc.setFont("helvetica", "normal");
    doc.text(t("pdf.pie.1"), M, 284);
    doc.text(t("pdf.pie.2"), M, 287.5);
    // Version del algoritmo: hace trazable cada reporte a la version que lo genero.
    doc.text(`v${APP_VERSION}`, M, 291);
    doc.text(t("pdf.pagina", { p, total: totalPages }), W - M, 287.5, { align: "right" });
    if (medico) {
      doc.setDrawColor(94, 234, 212); doc.setLineWidth(0.5); doc.line(W - M - 50, 288, W - M, 288);
      doc.setTextColor(203, 213, 225); doc.setFontSize(7.5); doc.setFont("helvetica", "bold");
      doc.text(medico, W - M - 25, 292.5, { align: "center" });
      doc.setFont("helvetica", "normal"); doc.setFontSize(6.5);
      doc.text(t("pdf.cirujano_responsable"), W - M - 25, 295.5, { align: "center" });
    }
  }
  return doc;
}
