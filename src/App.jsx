import { useState, useMemo, useEffect } from "react";
import LandmarkAnnotator from "./landmarkAnnotator";
import { REFERENCIAS, APP_VERSION } from "./constants";
import { COLORS, FONT_SERIF, FONT_SANS, FONT_MONO, MOMENTOS } from "./theme";
import {
  normalizeName, uid, hoy, calcularIMC, calcularDiferencia, diffMensaje,
} from "./utils";
import {
  classify, gapIdeals, rpvCalc, rllCalc, ldiCalc, rsaCalc, afCalc,
  TILT_NORMS, computeTilt, R_TYPES, R_LOW_PI, R_HIGH_PI,
  roussoulyCurrentType, roussoulyIdealType,
} from "./scoring";
import { buildPDF } from "./pdf";
import { feedbackAvailable, sendFeedback } from "./feedback";
import { MEASUREMENT_KEYS } from "./data/landmarks";
import {
  InputField, TipoEvaluacionToggle, DiffInfoBox, IMCBadge,
  CirugiaCard, ParamRow, ShareButton, MomentoBadge, Card,
} from "./components";
import { useI18n } from "./i18n";
import { LanguageSwitcher } from "./LanguageSwitcher";

// ═══════════════════════════════════════════════════════════════════════════
// APP
// ═══════════════════════════════════════════════════════════════════════════
export default function GAPCalculator() {
  const { t, lang } = useI18n();
  // Locale para toLocaleDateString / toLocaleString en la interfaz.
  const dateLocale = { es: "es-MX", en: "en-GB", fr: "fr-FR" }[lang] || "es-MX";
  const [tipoEvaluacion, setTipoEvaluacion] = useState("preoperatorio");
  const [fechaEstudio, setFechaEstudio] = useState(hoy());
  const [fechaCirugia, setFechaCirugia] = useState(hoy());
  const [age, setAge] = useState("");
  const [peso, setPeso] = useState("");
  const [talla, setTalla] = useState("");
  // Nombre del médico: opcional, solo se imprime en el PDF.
  const [medicoPublic, setMedicoPublic] = useState("");
  const medico = medicoPublic ? normalizeName(medicoPublic) : "";
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
  const [toast, setToast] = useState(null);
  const [showBiblio, setShowBiblio] = useState(false);

  // Anotador de landmarks
  const [showAnnotator, setShowAnnotator] = useState(false);

  // Splash inicial — VML
  const [splashStage, setSplashStage] = useState("vml"); // "vml" | "done"
  useEffect(() => {
    const t1 = setTimeout(() => setSplashStage("done"), 2400);
    return () => { clearTimeout(t1); };
  }, []);

  // Encuesta de satisfacción one-time, anónima (src/feedback.js)
  // Solo se recuerda en este navegador que la encuesta ya se respondió.
  const [feedbackDone, setFeedbackDone] = useState(() => {
    try { return localStorage.getItem("gap_feedback_done") === "1"; } catch { return false; }
  });
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackHover, setFeedbackHover] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackBusy, setFeedbackBusy] = useState(false);

  const submitFeedback = async () => {
    if (!feedbackRating) { showToast(t("toast.feedback.sin_estrellas"), false); return; }
    if (!feedbackAvailable) { showToast(t("toast.servicio_no_disponible"), false); return; }
    setFeedbackBusy(true);
    try {
      await sendFeedback({
        rating: feedbackRating,
        comment: feedbackComment.trim() || null,
      });
      try { localStorage.setItem("gap_feedback_done", "1"); } catch (e) {}
      setFeedbackDone(true);
      showToast(t("toast.feedback.gracias"));
    } catch (e) {
      console.error(e);
      showToast(t("toast.feedback.error"), false);
    }
    setFeedbackBusy(false);
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
    const { idealSS, idealLL, idealGT } = gapIdeals(piE);
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
    let ejeDiff = null, ejeStatus = null, ejeLabelKey = null;
    if (t4pa !== "") {
      ejeDiff = Number(t4pa) - l1paN;
      const abs = Math.abs(ejeDiff);
      if (abs <= 4)      { ejeStatus = "ok";   ejeLabelKey = "hills.eje.alineado"; }
      else if (abs <= 8) { ejeStatus = "warn"; ejeLabelKey = "hills.eje.moderada"; }
      else               { ejeStatus = "bad";  ejeLabelKey = "hills.eje.severa"; }
    }
    return { idealL1PA, l1paDiff, idealLL_Hills, idealLL_Hills_L4S1, ejeDiff, ejeStatus, ejeLabelKey };
  }, [spinopelvic, l1pa, t4pa]);

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
      if (v < t0)  return { g: "0",  key: "schwab.normal",   label: "Normal",   color: COLORS.green,  bg: COLORS.greenBg };
      if (v <= t1) return { g: "+",  key: "schwab.moderado", label: "Moderado", color: COLORS.yellow, bg: COLORS.yellowBg };
      return       { g: "++", key: "schwab.marcado",  label: "Marcado",  color: COLORS.red,    bg: COLORS.redBg };
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
        esperadoKey: piN < 50 ? "roussouly.esperado.bajo" : "roussouly.esperado.alto",
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
      labelKey: curDef.key,
      descKey: `${curDef.key}.desc`,
      uncertain: cur.uncertain || null,
      color, bg, params,
      esPost: tipoEvaluacion === "postoperatorio",
      ideal: idealDef ? {
        type: idealDef.short,
        key: ideal.key,
        labelKey: idealDef.key,
        descKey: `${idealDef.key}.desc`,
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
    if (prob < 0.25)      cat = { key: "riesgo.bajo",     label: "Riesgo bajo",     color: COLORS.green,  bg: COLORS.greenBg };
    else if (prob < 0.55) cat = { key: "riesgo.moderado", label: "Riesgo moderado", color: COLORS.yellow, bg: COLORS.yellowBg };
    else                  cat = { key: "riesgo.alto",     label: "Riesgo alto",     color: COLORS.red,    bg: COLORS.redBg };
    return { bmi: bmiN, tscore: tN, gap: gapN, lp, prob, cat };
  }, [result, imc, bmdTscore]);

  const showToast = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500); };

  const inputs = { age, pi: spinopelvic.effPI ?? "", ss: spinopelvic.effSS ?? "", pt: spinopelvic.effPT ?? "", l1s1, l4s1, gt, l1pa, t4pa, c2tiltDirect, cpa, t1tiltDirect, t1pa, l1tiltDirect, medico, cirugias, tipoEvaluacion, fechaEstudio, fechaCirugia, diffInfo, peso, talla, imc, hillsResult, tiltsResult, derivedKey: spinopelvic.derivedKey, sva, bmdTscore, schwabResult, roussoulyResult, gapbResult };

  const addCirugia = () => setCirugias([...cirugias, { id: uid(), tipo: "", tipoCustom: "", segmentos: [] }]);
  const updateCirugia = (id, n) => setCirugias(cirugias.map(c => c.id === id ? n : c));
  const removeCirugia = (id) => setCirugias(cirugias.filter(c => c.id !== id));

  const buildPdfFile = () => {
    const docP = buildPDF(inputs, result, t, lang);
    const tipoTag = tipoEvaluacion === "preoperatorio" ? "PRE" : "POST";
    const filename = `GAP_${tipoTag}_${fechaEstudio}.pdf`;
    const blob = docP.output("blob");
    return { file: new File([blob], filename, { type: "application/pdf" }), filename, blob };
  };

  const triggerDownload = () => {
    const { file, filename } = buildPdfFile();
    const url = URL.createObjectURL(file);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    showToast(t("toast.pdf_descargado"));
  };

  const handleDownload = () => {
    if (!hasAnyMeasurement) { showToast(t("toast.sin_mediciones"), false); return; }
    triggerDownload();
  };

  // Texto resumido para el cuerpo del correo cuando hay que adjuntar manualmente
  const buildEmailBody = () => {
    const fTxt = new Date(fechaEstudio + "T00:00:00").toLocaleDateString(dateLocale);
    const tLabel = t(MOMENTOS[tipoEvaluacion].key);
    const cTxt = fechaCirugia ? new Date(fechaCirugia + "T00:00:00").toLocaleDateString(dateLocale) : null;
    return [
      `GAP Score · ${tLabel}`,
      t("pdf.fecha_estudio", { fecha: fTxt }),
      ...(cTxt ? [t("pdf.fecha_cirugia", { fecha: cTxt })] : []),
      ...(diffInfo ? [diffMensaje(t, diffInfo)] : []),
      ...(age ? [t("mail.edad", { n: age })] : []),
      ...(imc ? [t("mail.imc", { v: imc.valor.toFixed(1), cat: t(imc.categoriaKey) })] : []),
      ...(medico ? [t("mail.medico", { nombre: medico })] : []),
      "",
      ...(result
        ? [t("mail.resultado", { total: result.total, cat: t(result.cat.key) }), t(result.cat.riskKey)]
        : [t("mail.parcial")])
    ].join("\n");
  };

  const handleEmail = async () => {
    if (!hasAnyMeasurement) { showToast(t("toast.sin_mediciones"), false); return; }
    const { file, filename } = buildPdfFile();
    // Web Share API con archivos (móvil + algunos desktop)
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `GAP Score · ${t(MOMENTOS[tipoEvaluacion].key)}`,
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
    const subject = `GAP Score · ${t(MOMENTOS[tipoEvaluacion].key)}`;
    const body = buildEmailBody() + "\n\n📎 " + t("mail.adjunta_pdf");
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    showToast(t("toast.pdf_adjuntar"), true);
  };

  // Limpiar devuelve el formulario a su estado inicial. Cualquier campo nuevo
  // debe añadirse aquí: una versión anterior olvidó sva, nvl y bmdTscore, que se
  // arrastraban al siguiente paciente.
  const clearAll = () => {
    [setAge, setPeso, setTalla, setMedicoPublic,
      setPI, setSS, setPT, setL1S1, setL4S1, setGT, setL1PA, setT4PA,
      setC2TiltDirect, setCPA, setT1TiltDirect, setT1PA, setL1TiltDirect,
      setSVA, setNvl, setBmdTscore].forEach(set => set(""));
    setTipoEvaluacion("preoperatorio");
    setFechaEstudio(hoy());
    setFechaCirugia("");
    setCirugias([]);
  };

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

      {/* Splash inicial — VML */}
      {splashStage !== "done" && (
        <div
          onClick={() => setSplashStage("done")}
          style={{
            position: "fixed", inset: 0, zIndex: 10001,
            background: COLORS.bg,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            padding: 24, cursor: "pointer"
          }}>
          <div key="vml" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, animation: "splashStage 1800ms ease both" }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2.5, textTransform: "uppercase", color: COLORS.textMuted }}>
              {t("splash.una_app_de")}
            </div>
            <img
              src={`${import.meta.env.BASE_URL}vml-logo.png`}
              alt="Virtual Medical Learning"
              style={{ width: "min(180px, 45vw)", height: "auto", objectFit: "contain" }} />
          </div>
          <div style={{ position: "absolute", bottom: 22, fontSize: 10, color: COLORS.textMuted, fontWeight: 500, opacity: 0.7 }}>
            {t("splash.saltar")}
          </div>
          <style>{`@keyframes splashStage { 0% { opacity: 0; transform: translateY(10px); } 12% { opacity: 1; transform: translateY(0); } 80% { opacity: 1; transform: translateY(0); } 100% { opacity: 0; transform: translateY(-6px); } }`}</style>
        </div>
      )}

      {/* Barra superior: idioma */}
      <div style={{ maxWidth: 560, margin: "0 auto 16px", display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <LanguageSwitcher />
      </div>

      {/* Encabezado — composición editorial */}
      <div style={{ maxWidth: 560, margin: "0 auto 36px", textAlign: "center", padding: "0 8px" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <span aria-hidden="true" style={{ width: 22, height: 1, background: COLORS.accent, opacity: 0.7 }} />
          <span style={{ fontSize: 10, fontWeight: 600, color: COLORS.accent, letterSpacing: 3, textTransform: "uppercase", fontFamily: FONT_SANS }}>{t("app.eyebrow")}</span>
          <span aria-hidden="true" style={{ width: 22, height: 1, background: COLORS.accent, opacity: 0.7 }} />
        </div>
        <h1 style={{ fontSize: "clamp(34px, 7vw, 48px)", fontWeight: 600, margin: "0 0 10px", fontFamily: FONT_SERIF, fontVariationSettings: "'opsz' 144, 'SOFT' 30", color: COLORS.ink, letterSpacing: "-0.025em", lineHeight: 1.02 }}>
          Spine<em style={{ fontStyle: "italic", fontWeight: 500, color: COLORS.accent, fontVariationSettings: "'opsz' 144, 'SOFT' 100" }}>Calc</em>
        </h1>
        <p style={{ fontSize: 13.5, color: COLORS.textDim, lineHeight: 1.55, maxWidth: 440, margin: "0 auto", fontFamily: FONT_SANS }}>
          {t("app.subtitulo")}
        </p>
        <div style={{ marginTop: 14, display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 12px", borderRadius: 999, background: COLORS.accentDim, border: `1px solid ${COLORS.accent}33`, fontSize: 11, color: COLORS.accentDark, fontWeight: 500 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS.accent }} />
          {t("app.calculadora_abierta")}
        </div>
      </div>

      <div style={{ maxWidth: 560, margin: "0 auto" }}>

        {/* Datos del caso */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h2 style={{ fontSize: 19, fontWeight: 600, margin: 0, color: COLORS.ink, fontFamily: FONT_SERIF, fontVariationSettings: "'opsz' 36, 'SOFT' 50", letterSpacing: "-0.01em" }}>📋 {t("caso.titulo")}</h2>
            <button onClick={clearAll} style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${COLORS.inputBorder}`, background: "transparent", color: COLORS.textDim, fontSize: 12, cursor: "pointer" }}>{t("common.limpiar")}</button>
          </div>
          <TipoEvaluacionToggle value={tipoEvaluacion} onChange={setTipoEvaluacion} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <InputField label={t("campo.fecha_estudio")} value={fechaEstudio} onChange={setFechaEstudio} type="date" unit="" />
            <InputField label={t("campo.fecha_cirugia")} value={fechaCirugia} onChange={setFechaCirugia} type="date" unit="" />
          </div>
          <DiffInfoBox diffInfo={diffInfo} />
          <InputField label={t("campo.medico_publico")} value={medicoPublic} onChange={setMedicoPublic} type="text" unit="" placeholder={t("placeholder.dr_apellido")} transform={normalizeName} maxLength={60} />
          <InputField label={t("campo.edad_paciente")} value={age} onChange={setAge} unit={t("unidad.anos")} min={15} max={90} list="ages-list" placeholder="15-90" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <InputField label={t("campo.peso")} value={peso} onChange={setPeso} unit="kg" min={20} max={300} step="0.1" placeholder={t("placeholder.peso")} />
            <InputField label={t("campo.talla")} value={talla} onChange={setTalla} unit="cm" min={100} max={230} placeholder={t("placeholder.talla")} />
          </div>
          <IMCBadge imc={imc} />
          <InputField
            label={t("campo.dmo_opcional")}
            value={bmdTscore}
            onChange={setBmdTscore}
            unit=""
            min={-5} max={5} step={0.1}
            placeholder={t("placeholder.tscore")}
            tooltip={t("tooltip.dmo")}
          />
        </Card>

        {/* Cirugías */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h2 style={{ fontSize: 19, fontWeight: 600, margin: 0, color: COLORS.ink, fontFamily: FONT_SERIF, fontVariationSettings: "'opsz' 36, 'SOFT' 50", letterSpacing: "-0.01em" }}>🔧 {tipoEvaluacion === "preoperatorio" ? t("cirugias.planificadas") : t("cirugias.realizadas")}</h2>
            <button onClick={addCirugia} style={{ padding: "6px 14px", borderRadius: 8, border: `1.5px solid ${COLORS.accent}66`, background: COLORS.accentDim, color: COLORS.accentDark, fontSize: 12, cursor: "pointer", fontWeight: 700 }}>{t("common.agregar")}</button>
          </div>
          {cirugias.length === 0 && <div style={{ padding: 20, textAlign: "center", color: COLORS.textMuted, fontSize: 13, background: COLORS.inputHover, borderRadius: 10, border: `1px dashed ${COLORS.inputBorder}` }}>{t("cirugias.vacio.1")}<strong style={{ color: COLORS.accentDark }}>{t("common.agregar")}</strong>{t("cirugias.vacio.2")}</div>}
          {cirugias.map((c, i) => <CirugiaCard key={c.id} cirugia={c} index={i} onUpdate={(n) => updateCirugia(c.id, n)} onRemove={() => removeCirugia(c.id)} />)}
        </Card>

        {/* Mediciones */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
            <h2 style={{ fontSize: 19, fontWeight: 600, margin: 0, color: COLORS.ink, fontFamily: FONT_SERIF, fontVariationSettings: "'opsz' 36, 'SOFT' 50", letterSpacing: "-0.01em" }}>📐 {t("gap.medicion.titulo")}</h2>
            <button onClick={() => setShowAnnotator(true)} style={{ padding: "8px 14px", borderRadius: 8, border: `1.5px solid ${COLORS.accent}`, background: COLORS.accent, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 14 }}>📐</span> {t("gap.medir_radiografia")}
            </button>
          </div>
          <p style={{ fontSize: 11, color: COLORS.textMuted, margin: "0 0 14px" }}>
            {t("gap.dos_de_tres.1")}<strong>{t("gap.dos_de_tres.strong")}</strong>{t("gap.dos_de_tres.2")}<strong>PI = PT + SS</strong>{t("gap.dos_de_tres.3")}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            <InputField label={t("param.pi")} value={pi} onChange={setPI} min={0} max={120}
              placeholder={spinopelvic.derivedKey === "pi" && spinopelvic.effPI !== null ? spinopelvic.effPI.toFixed(1) : ""}
              tooltip={t("tooltip.pi")}
              tooltipFigure={`${import.meta.env.BASE_URL}landmarks/angulo_pi.png`} />
            <InputField label={t("param.ss")} value={ss} onChange={setSS} min={-30} max={90}
              placeholder={spinopelvic.derivedKey === "ss" && spinopelvic.effSS !== null ? spinopelvic.effSS.toFixed(1) : ""}
              tooltip={t("tooltip.ss")}
              tooltipFigure={`${import.meta.env.BASE_URL}landmarks/angulo_ss.png`} />
            <InputField label={t("param.pt")} value={pt} onChange={setPT} min={-30} max={60}
              placeholder={spinopelvic.derivedKey === "pt" && spinopelvic.effPT !== null ? spinopelvic.effPT.toFixed(1) : ""}
              tooltip={t("tooltip.pt")}
              tooltipFigure={`${import.meta.env.BASE_URL}landmarks/angulo_pt.png`} />
          </div>
          {/* Banner de derivación / inconsistencia */}
          {(() => {
            if (spinopelvic.filledCount === 2 && spinopelvic.derivedKey) {
              const labels = { pi: { name: "PI", val: spinopelvic.effPI, formula: "SS + PT" }, ss: { name: "SS", val: spinopelvic.effSS, formula: "PI − PT" }, pt: { name: "PT", val: spinopelvic.effPT, formula: "PI − SS" } };
              const d = labels[spinopelvic.derivedKey];
              return (
                <div style={{ padding: "8px 12px", borderRadius: 8, background: COLORS.accentDim, border: `1px solid ${COLORS.accent}44`, fontSize: 12, color: COLORS.accentDark, marginTop: 4, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span>↻ <strong>{d.name}</strong> {t("gap.derivado_auto", { formula: d.formula })}</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{d.val.toFixed(1)}°</span>
                </div>
              );
            }
            if (spinopelvic.filledCount === 3 && spinopelvic.inconsistencyDelta !== null && Math.abs(spinopelvic.inconsistencyDelta) > 1) {
              return (
                <div style={{ padding: "8px 12px", borderRadius: 8, background: COLORS.yellowBg, border: `1px solid ${COLORS.yellow}66`, fontSize: 12, color: COLORS.yellow, marginTop: 4, marginBottom: 8, fontWeight: 600 }}>
                  ⚠️ {t("gap.inconsistencia", { delta: `${spinopelvic.inconsistencyDelta >= 0 ? "+" : ""}${spinopelvic.inconsistencyDelta.toFixed(1)}` })}
                </div>
              );
            }
            if (spinopelvic.filledCount === 1) {
              return (
                <div style={{ padding: "8px 12px", borderRadius: 8, background: COLORS.inputHover, border: `1px dashed ${COLORS.inputBorder}`, fontSize: 11, color: COLORS.textMuted, marginTop: 4, marginBottom: 8, textAlign: "center" }}>
                  {t("gap.faltan_dos")}
                </div>
              );
            }
            return null;
          })()}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <InputField label={t("param.l1s1")} value={l1s1} onChange={setL1S1} min={0} max={120}
              tooltip={t("tooltip.l1s1")}
              tooltipFigure={`${import.meta.env.BASE_URL}landmarks/angulo_l1s1.png`} />
            <InputField label={t("param.l4s1")} value={l4s1} onChange={setL4S1} min={0} max={90}
              tooltip={t("tooltip.l4s1")}
              tooltipFigure={`${import.meta.env.BASE_URL}landmarks/angulo_l4s1.png`} />
          </div>
          <InputField label={t("param.gt")} value={gt} onChange={setGT} min={-30} max={70}
            tooltip={t("tooltip.gt")}
            tooltipFigure={`${import.meta.env.BASE_URL}landmarks/angulo_gt.png`} />
        </Card>

        {/* Eje T4-L1-Cadera (Hills 2022) — colapsable, opcional */}
        <Card>
          <button
            type="button"
            onClick={() => setHillsOpen(o => !o)}
            aria-expanded={hillsOpen}
            style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, padding: 0, background: "transparent", border: "none", cursor: "pointer", textAlign: "left", color: COLORS.ink }}>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: 19, fontWeight: 600, margin: "0 0 4px", color: COLORS.ink, fontFamily: FONT_SERIF, fontVariationSettings: "'opsz' 36, 'SOFT' 50", letterSpacing: "-0.01em" }}>🎯 {t("hills.titulo")}</h2>
              <p style={{ fontSize: 11, color: COLORS.textMuted, margin: 0 }}>
                Hills et al., Spine 2022 · <em>{t("comun.opcional_complementa")}</em>
              </p>
            </div>
            <span aria-hidden="true" style={{ fontSize: 18, color: COLORS.textMuted, fontWeight: 700, transform: hillsOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.18s", lineHeight: 1, paddingTop: 4 }}>⌃</span>
          </button>
          {hillsOpen && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
                <button onClick={() => setShowAnnotator(true)} style={{ padding: "8px 14px", borderRadius: 8, border: `1.5px solid ${COLORS.accent}`, background: COLORS.accent, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 14 }}>📐</span> {t("gap.medir_radiografia")}
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <InputField label="L1 Pelvic Angle (L1PA)" value={l1pa} onChange={setL1PA} min={-30} max={40}
                  tooltip={t("tooltip.l1pa")}
                  tooltipFigure={`${import.meta.env.BASE_URL}landmarks/angulo_gt.png`} />
                <InputField label="T4 Pelvic Angle (T4PA)" value={t4pa} onChange={setT4PA} min={-30} max={40}
                  tooltip={t("tooltip.t4pa")}
                  tooltipFigure={`${import.meta.env.BASE_URL}landmarks/cervical_t4.png`} />
              </div>
              {hillsResult && (
                <div style={{ marginTop: 8 }}>
                  {/* L1PA ideal */}
                  <div style={{ padding: "10px 14px", borderRadius: 8, background: COLORS.accentDim, border: `1px solid ${COLORS.accent}44`, marginBottom: 10, fontSize: 12, color: COLORS.accentDark, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <span><strong>{t("hills.l1pa_ideal")}</strong> = 0.5·PI − 21</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
                      {hillsResult.idealL1PA.toFixed(1)}°
                      <span style={{ color: Math.abs(hillsResult.l1paDiff) < 4 ? COLORS.green : Math.abs(hillsResult.l1paDiff) < 8 ? COLORS.yellow : COLORS.red, marginLeft: 8 }}>
                        (Δ {hillsResult.l1paDiff >= 0 ? "+" : ""}{hillsResult.l1paDiff.toFixed(1)}°)
                      </span>
                    </span>
                  </div>
                  {/* L1-S1 Hills ideal */}
                  <div style={{ padding: "10px 14px", borderRadius: 8, background: COLORS.purpleBg, border: `1px solid ${COLORS.purple}44`, marginBottom: 10, fontSize: 12, color: COLORS.purple, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <span><strong>{t("hills.l1s1_ideal")}</strong> = 1.4·PI − 1.7·L1PA − 2</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{hillsResult.idealLL_Hills.toFixed(1)}°</span>
                  </div>
                  {/* Semáforo eje T4-L1-Hip */}
                  {hillsResult.ejeDiff !== null && (() => {
                    const c = hillsResult.ejeStatus === "ok" ? COLORS.green : hillsResult.ejeStatus === "warn" ? COLORS.yellow : COLORS.red;
                    const bg = hillsResult.ejeStatus === "ok" ? COLORS.greenBg : hillsResult.ejeStatus === "warn" ? COLORS.yellowBg : COLORS.redBg;
                    return (
                      <div style={{ padding: "12px 14px", borderRadius: 8, background: bg, border: `1.5px solid ${c}44`, fontSize: 12, color: c, fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <span>🎯 {t(hillsResult.ejeLabelKey)}</span>
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
                  {t("hills.faltan")}
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
              <h2 style={{ fontSize: 19, fontWeight: 600, margin: "0 0 4px", color: COLORS.ink, fontFamily: FONT_SERIF, fontVariationSettings: "'opsz' 36, 'SOFT' 50", letterSpacing: "-0.01em" }}>🦴 {t("tilts.titulo")}</h2>
              <p style={{ fontSize: 11, color: COLORS.textMuted, margin: 0 }}>
                Hills 2022 · {t("tilts.ic80")} · <em>{t("comun.opcional_complementa")}</em>
              </p>
            </div>
            <span aria-hidden="true" style={{ fontSize: 18, color: COLORS.textMuted, fontWeight: 700, transform: tiltsOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.18s", lineHeight: 1, paddingTop: 4 }}>⌃</span>
          </button>
          {tiltsOpen && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
                <button onClick={() => setShowAnnotator(true)} style={{ padding: "8px 14px", borderRadius: 8, border: `1.5px solid ${COLORS.accent}`, background: COLORS.accent, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 14 }}>📐</span> {t("gap.medir_radiografia")}
                </button>
              </div>
              <p style={{ fontSize: 11, color: COLORS.textMuted, margin: "0 0 12px" }}>
                {t("tilts.ayuda")}<strong>PA − PT</strong>.
              </p>
              {[
                { key: "c2", titulo: "C2", direct: c2tiltDirect, setDirect: setC2TiltDirect, pa: cpa, setPA: setCPA, paLabel: "C2 Pelvic Angle (CPA)", paTooltip: t("tooltip.cpa"), directTooltip: t("tooltip.c2tilt") },
                { key: "t1", titulo: "T1", direct: t1tiltDirect, setDirect: setT1TiltDirect, pa: t1pa, setPA: setT1PA, paLabel: "T1 Pelvic Angle (T1PA)", paTooltip: t("tooltip.t1pa"), directTooltip: t("tooltip.t1tilt") },
                { key: "l1", titulo: "L1", direct: l1tiltDirect, setDirect: setL1TiltDirect, pa: l1pa, setPA: setL1PA, paLabel: "L1 Pelvic Angle (L1PA)", paTooltip: t("tooltip.l1pa.tilt"), directTooltip: t("tooltip.l1tilt") }
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
                        label={t("campo.tilt_directo")}
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
                          <span style={{ fontWeight: 700 }}>{row.titulo} tilt · {t(r.cls.key)}</span>
                        </div>
                        <div style={{ display: "flex", gap: 14, marginTop: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: COLORS.text, flexWrap: "wrap" }}>
                          {r.direct !== null && <span><strong>{t("tabla.directo")}:</strong> {r.direct.toFixed(1)}°</span>}
                          {r.derived !== null && <span><strong>{t("tabla.derivado_pa_pt")}:</strong> {r.derived.toFixed(1)}°</span>}
                          {r.delta !== null && (
                            <span style={{ color: Math.abs(r.delta) <= 1 ? COLORS.green : Math.abs(r.delta) <= 3 ? COLORS.yellow : COLORS.red }}>
                              <strong>{t("pdf.delta_directo_derivado")}:</strong> {r.delta >= 0 ? "+" : ""}{r.delta.toFixed(1)}°
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
                  {t("tilts.pt_efectivo", { v: tiltsResult.pt.toFixed(1) })} {spinopelvic.derivedKey === "pt" ? t("tilts.pt_derivado_nota") : ""}
                </div>
              ) : (
                <div style={{ fontSize: 11, color: COLORS.textMuted, fontStyle: "italic", marginTop: 4, textAlign: "center" }}>
                  {t("tilts.faltan")}
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
              <h2 style={{ fontSize: 19, fontWeight: 600, margin: "0 0 4px", color: COLORS.ink, fontFamily: FONT_SERIF, fontVariationSettings: "'opsz' 36, 'SOFT' 50", letterSpacing: "-0.01em" }}>📊 {t("schwab.titulo")}</h2>
              <p style={{ fontSize: 11, color: COLORS.textMuted, margin: 0 }}>
                Schwab 2012 · {t("schwab.modificadores")} · <em>{t("comun.opcional_complementa")}</em>
              </p>
            </div>
            <span aria-hidden="true" style={{ fontSize: 18, color: COLORS.textMuted, fontWeight: 700, transform: schwabOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.18s", lineHeight: 1, paddingTop: 4 }}>⌃</span>
          </button>
          {schwabOpen && (
            <div style={{ marginTop: 14 }}>
              <p style={{ fontSize: 11, color: COLORS.textMuted, margin: "0 0 12px", lineHeight: 1.5 }}>
                {t("schwab.intro.1")}<strong>PI−LL</strong>{t("schwab.intro.2")}<strong>PT</strong>{t("schwab.intro.3")}<strong>SVA</strong>{t("schwab.intro.4")}
              </p>
              <InputField
                label="SVA (Sagittal Vertical Axis)"
                value={sva}
                onChange={setSVA}
                unit="cm"
                min={-20} max={30} step={0.1}
                tooltip={t("tooltip.sva")}
              />
              {[
                { key: "piLL", titulo: "PI − LL", subtitulo: t("schwab.pill.sub"), val: schwabResult.piLLVal, grade: schwabResult.piLL, unit: "°", t0: "< 10°", t1: "10–20°", t2: "> 20°" },
                { key: "pt",   titulo: "PT",       subtitulo: t("schwab.pt.sub"),   val: schwabResult.ptVal,   grade: schwabResult.pt,   unit: "°", t0: "< 20°", t1: "20–30°", t2: "> 30°" },
                { key: "sva",  titulo: "SVA",      subtitulo: t("schwab.sva.sub"),  val: schwabResult.svaVal,  grade: schwabResult.sva,  unit: " cm", t0: "< 4 cm", t1: "4–9.5 cm", t2: "> 9.5 cm" },
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
                  <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 4, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>{t("schwab.modificadores")}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.ink, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.04em" }}>
                    PI−LL <span style={{ color: schwabResult.piLL.color }}>{schwabResult.piLL.g}</span> · PT <span style={{ color: schwabResult.pt.color }}>{schwabResult.pt.g}</span> · SVA <span style={{ color: schwabResult.sva.color }}>{schwabResult.sva.g}</span>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 11, color: COLORS.textMuted, fontStyle: "italic", marginTop: 4, textAlign: "center" }}>
                  {t("schwab.faltan")}
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
              <h2 style={{ fontSize: 19, fontWeight: 600, margin: "0 0 4px", color: COLORS.ink, fontFamily: FONT_SERIF, fontVariationSettings: "'opsz' 36, 'SOFT' 50", letterSpacing: "-0.01em" }}>🧬 {t("roussouly.titulo")}</h2>
              <p style={{ fontSize: 11, color: COLORS.textMuted, margin: 0 }}>
                Laouissat 2017 · Sebaaly 2020 · Bari 2020 · <em>{t("roussouly.sub")}</em>
              </p>
            </div>
            <span aria-hidden="true" style={{ fontSize: 18, color: COLORS.textMuted, fontWeight: 700, transform: roussoulyOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.18s", lineHeight: 1, paddingTop: 4 }}>⌃</span>
          </button>
          {roussoulyOpen && (
            <div style={{ marginTop: 14 }}>
              <p style={{ fontSize: 11, color: COLORS.textMuted, margin: "0 0 12px", lineHeight: 1.5 }}>
                {t("roussouly.intro.1")}<strong>SS</strong>{t("roussouly.intro.2")}<strong>PT</strong>{t("roussouly.intro.3")}<strong>{t("roussouly.intro.tipo_ideal")}</strong>{t("roussouly.intro.4")}<strong>PI</strong>{t("roussouly.intro.5")}
              </p>
              <InputField
                label={t("campo.nvl")}
                value={nvl}
                onChange={setNvl}
                unit={t("unidad.vert")}
                min={0} max={12} step={1}
                tooltip={t("tooltip.nvl")}
              />
              {roussoulyResult ? (
                <>
                  <div style={{ padding: 14, borderRadius: 10, background: roussoulyResult.bg, border: `1.5px solid ${roussoulyResult.color}66` }}>
                    <div style={{ fontSize: 10, color: COLORS.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{t("roussouly.tipo_actual")}</div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
                      <span style={{ fontSize: 28, fontWeight: 800, color: roussoulyResult.color, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.02em" }}>{roussoulyResult.type}</span>
                      <span style={{ fontSize: 15, fontWeight: 700, color: roussoulyResult.color }}>{t(roussoulyResult.labelKey)}</span>
                    </div>
                    <div style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: "'JetBrains Mono', monospace", marginBottom: 8 }}>{roussoulyResult.params}</div>
                    <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.5 }}>{t(roussoulyResult.descKey)}</div>
                    {roussoulyResult.uncertain === "nvl" && (
                      <div style={{ marginTop: 8, fontSize: 11, color: COLORS.yellow, lineHeight: 1.45 }}>
                        ⚠ {t("roussouly.falta_nvl")}
                      </div>
                    )}
                    {roussoulyResult.uncertain === "piPt" && (
                      <div style={{ marginTop: 8, fontSize: 11, color: COLORS.yellow, lineHeight: 1.45 }}>
                        ⚠ {t("roussouly.faltan_pi_pt")}
                      </div>
                    )}
                  </div>

                  {roussoulyResult.ideal && (
                    <div style={{ marginTop: 10, padding: 14, borderRadius: 10, background: COLORS.inputHover, border: `1px solid ${COLORS.inputBorder}` }}>
                      <div style={{ fontSize: 10, color: COLORS.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                        {roussoulyResult.esPost ? t("roussouly.ideal.orientativo") : t("roussouly.ideal.objetivo")}
                      </div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
                        <span style={{ fontSize: 24, fontWeight: 800, color: COLORS.text, fontFamily: "'JetBrains Mono', monospace" }}>{roussoulyResult.ideal.type}</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>{t(roussoulyResult.ideal.labelKey)}</span>
                        {roussoulyResult.ideal.same && (
                          <span style={{ fontSize: 11, color: COLORS.green, fontWeight: 700 }}>{t("roussouly.mismo_tipo")}</span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.5 }}>{t(roussoulyResult.ideal.descKey)}</div>
                      {roussoulyResult.esPost && (
                        <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 8, background: COLORS.inputBg, border: `1px solid ${COLORS.cardBorder}`, fontSize: 11, color: COLORS.textMuted, lineHeight: 1.45 }}>
                          {t("roussouly.nota_post")}
                        </div>
                      )}
                      {roussoulyResult.ideal.uncertain === "pt" && (
                        <div style={{ marginTop: 8, fontSize: 11, color: COLORS.yellow, lineHeight: 1.45 }}>
                          ⚠ {t("roussouly.falta_pt")}
                        </div>
                      )}
                      {roussoulyResult.ideal.inferred && (
                        <div style={{ marginTop: 8, fontSize: 11, color: COLORS.textMuted, lineHeight: 1.45 }}>
                          {t("roussouly.rama_inferida")}
                        </div>
                      )}
                    </div>
                  )}

                  {roussoulyResult.piMatch && (
                    <div style={{ marginTop: 10, padding: "12px 14px", borderRadius: 10, background: roussoulyResult.piMatch.level === "ok" ? COLORS.greenBg : roussoulyResult.piMatch.level === "warn" ? COLORS.yellowBg : COLORS.redBg, border: `1.5px solid ${(roussoulyResult.piMatch.level === "ok" ? COLORS.green : roussoulyResult.piMatch.level === "warn" ? COLORS.yellow : COLORS.red)}66` }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: roussoulyResult.piMatch.level === "ok" ? COLORS.green : roussoulyResult.piMatch.level === "warn" ? COLORS.yellow : COLORS.red, marginBottom: 4 }}>
                        {roussoulyResult.piMatch.level === "ok"
                          ? `✓ ${roussoulyResult.esPost ? t("roussouly.match.restaurada") : t("roussouly.match.concordante")}`
                          : roussoulyResult.piMatch.level === "warn"
                            ? `⚠ ${t("roussouly.match.reservas")}`
                            : `✕ ${roussoulyResult.esPost ? t("roussouly.match.no_restaurada") : t("roussouly.match.no_concordante")}`}
                      </div>
                      <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.5 }}>
                        PI {roussoulyResult.piMatch.piLow ? "< 50°" : "≥ 50°"} → {t("roussouly.se_espera")} <strong>{t(roussoulyResult.piMatch.esperadoKey)}</strong>.
                        {roussoulyResult.piMatch.level === "bad" && ` ${t("roussouly.nota_bad")}`}
                        {roussoulyResult.piMatch.antevertedWarn && ` ${t("roussouly.nota_anteverted")}`}
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 8, background: COLORS.inputHover, border: `1px solid ${COLORS.inputBorder}`, fontSize: 11, color: COLORS.textMuted, lineHeight: 1.55 }}>
                    <strong style={{ color: COLORS.text }}>{t("roussouly.algoritmo.titulo")}</strong><br/>
                    {["roussouly.algoritmo.1", "roussouly.algoritmo.2", "roussouly.algoritmo.3", "roussouly.algoritmo.4", "roussouly.algoritmo.5"].map(k => (
                      <span key={k}><span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{t(k)}</span><br/></span>
                    ))}
                    <strong style={{ color: COLORS.text }}>{t("roussouly.ideal.titulo")}</strong><br/>
                    {["roussouly.ideal.1", "roussouly.ideal.2", "roussouly.ideal.3", "roussouly.ideal.4"].map(k => (
                      <span key={k}><span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{t(k)}</span><br/></span>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 11, color: COLORS.textMuted, fontStyle: "italic", marginTop: 4, textAlign: "center" }}>
                  {t("roussouly.faltan")}
                </div>
              )}
            </div>
          )}
        </Card>

        {/* GAP-B (Noh 2020) — solo el resultado; el T-score se captura en Datos del caso */}
        <Card style={{ textAlign: "left" }}>
          <h2 style={{ fontSize: 19, fontWeight: 600, margin: "0 0 4px", color: COLORS.ink, fontFamily: FONT_SERIF, fontVariationSettings: "'opsz' 36, 'SOFT' 50", letterSpacing: "-0.01em" }}>🦴 GAP-B</h2>
          <p style={{ fontSize: 11, color: COLORS.textMuted, margin: "0 0 14px" }}>
            Noh 2020 · GAP + {t("imc.sigla")} + {t("dmo.sigla")} · <em>{t("gapb.sub")}</em>
          </p>
          {gapbResult ? (
            <div style={{ padding: 14, borderRadius: 10, background: gapbResult.cat.bg, border: `1.5px solid ${gapbResult.cat.color}66` }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 28, fontWeight: 800, color: gapbResult.cat.color, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.02em" }}>{(gapbResult.prob * 100).toFixed(0)}%</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: gapbResult.cat.color }}>{t(gapbResult.cat.key)}</span>
              </div>
              <div style={{ fontSize: 11, color: COLORS.textMuted, lineHeight: 1.5 }}>
                {t("gapb.explicacion")}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 11, color: COLORS.textMuted, fontStyle: "italic", textAlign: "center" }}>
              {t("comun.faltan")}: {[!imc || !imc.valor ? t("gapb.falta.antropometria") : null, !result ? t("gapb.falta.gap") : null, bmdTscore === "" ? t("gapb.falta.tscore") : null].filter(Boolean).join(" · ")}
              <div style={{ marginTop: 4 }}>{t("gapb.faltan")}</div>
            </div>
          )}
          <div style={{ marginTop: 10, fontSize: 10, color: COLORS.textMuted, lineHeight: 1.45, fontStyle: "italic" }}>
⚠ {t("gapb.nota")}
          </div>
        </Card>


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
              {t(result.cat.key)}
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: COLORS.textDim, fontFamily: FONT_SANS }}>{t("resultado.riesgo")}: {t(result.cat.riskKey)}</div>
          </div>
        )}

        {/* Exportar */}
        <Card style={{ padding: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 4px", color: COLORS.text }}>{t("exportar.titulo")}</h2>
          <p style={{ fontSize: 11, color: COLORS.textMuted, margin: "0 0 14px" }}>{result ? t("exportar.listo") : hasAnyMeasurement ? t("exportar.parcial") : t("exportar.sin_mediciones")}</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <ShareButton icon="📄" label="PDF" color={COLORS.accent} bg={COLORS.accentDim} onClick={handleDownload} disabled={!hasAnyMeasurement} />
            <ShareButton icon="✉️" label={t("exportar.correo")} color={COLORS.purple} bg={COLORS.purpleBg} onClick={handleEmail} disabled={!hasAnyMeasurement} />
          </div>
          <p style={{ fontSize: 11, color: COLORS.textMuted, margin: 0, lineHeight: 1.5 }}>🔒 {t("exportar.nota_local")}</p>
        </Card>

        {/* Encuesta de satisfacción anónima (one-time, requiere haber calculado al menos una vez) */}
        {result && !feedbackDone && feedbackAvailable && (
          <Card>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
              <div style={{ fontSize: 22, lineHeight: 1 }}>💬</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, marginBottom: 4 }}>
                  {t("feedback.titulo")}
                </div>
                <p style={{ fontSize: 12, color: COLORS.textDim, lineHeight: 1.5, margin: 0 }}>
                  {t("feedback.nota")}
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
              placeholder={t("feedback.placeholder")}
              maxLength={500}
              style={{ width: "100%", minHeight: 70, padding: "10px 12px", background: COLORS.inputBg, border: `1.5px solid ${COLORS.inputBorder}`, borderRadius: 8, color: COLORS.text, fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: "none", resize: "vertical", boxSizing: "border-box" }} />
            <button
              onClick={submitFeedback}
              disabled={feedbackBusy || !feedbackRating}
              style={{ width: "100%", marginTop: 10, padding: "10px 16px", borderRadius: 8, border: `1.5px solid ${feedbackRating ? COLORS.accent : COLORS.inputBorder}`, background: feedbackBusy ? COLORS.inputHover : feedbackRating ? COLORS.accent : COLORS.inputBg, color: feedbackBusy ? COLORS.textMuted : feedbackRating ? "#fff" : COLORS.textMuted, fontSize: 13, fontWeight: 700, cursor: feedbackBusy ? "wait" : feedbackRating ? "pointer" : "not-allowed", opacity: feedbackBusy ? 0.7 : 1 }}>
              {feedbackBusy ? t("feedback.enviando") : feedbackRating ? t("feedback.enviar", { n: feedbackRating }) : t("feedback.selecciona")}
            </button>
          </Card>
        )}

        {/* Parámetros y planificación */}
        {result && (
          <>
            <Card>
              <h2 style={{ fontSize: 19, fontWeight: 600, margin: "0 0 4px", color: COLORS.ink, fontFamily: FONT_SERIF, fontVariationSettings: "'opsz' 36, 'SOFT' 50", letterSpacing: "-0.01em" }}>{t("parametros.titulo")}</h2>
              <p style={{ fontSize: 12, color: COLORS.textMuted, margin: "0 0 12px" }}>RPV · RLL · ILD · ASR · FE</p>
              <ParamRow name="RPV" diff={result.rpv.diff} score={result.rpv.score} label={t(result.rpv.key)} sub={result.rpv.sub} maxScore={3} />
              <ParamRow name="RLL" diff={result.rll.diff} score={result.rll.score} label={t(result.rll.key)} sub={result.rll.sub} maxScore={3} />
              <ParamRow name="ILD" diff={undefined} score={result.ldi.score} label={`${result.ldi.value.toFixed(1)}% — ${t(result.ldi.key)}`} sub={result.ldi.sub} maxScore={3} />
              <ParamRow name="ASR" diff={result.rsa.diff} score={result.rsa.score} label={t(result.rsa.key)} sub={result.rsa.sub} maxScore={3} />
              <ParamRow name="FE" diff={undefined} score={result.af.score} label={t(result.af.key)} sub={result.af.sub} maxScore={1} />
            </Card>
            <Card>
              <h2 style={{ fontSize: 19, fontWeight: 600, margin: "0 0 4px", color: COLORS.ink, fontFamily: FONT_SERIF, fontVariationSettings: "'opsz' 36, 'SOFT' 50", letterSpacing: "-0.01em" }}>{t("planificacion.titulo")}</h2>
              <p style={{ fontSize: 11, color: COLORS.textMuted, margin: "0 0 14px" }}>{t("planificacion.nota")}{hillsResult && ` · ${t("planificacion.nota_hills")}`}</p>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr style={{ borderBottom: `2px solid ${COLORS.cardBorder}` }}>{[t("tabla.parametro"), t("tabla.actual"), t("tabla.ideal"), t("tabla.correccion")].map((h, hi) => <th key={h} style={{ padding: "8px 10px", textAlign: hi === 0 ? "left" : "right", fontWeight: 700, color: COLORS.textDim, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>{h}</th>)}</tr></thead>
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


        {/* Disclaimer — nota editorial */}
        <div style={{ padding: "16px 20px", marginBottom: 16, fontSize: 12, color: COLORS.textDim, lineHeight: 1.6, textAlign: "center", borderTop: `1px solid ${COLORS.rule}`, borderBottom: `1px solid ${COLORS.rule}` }}>
          <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 999, fontSize: 9, fontWeight: 600, letterSpacing: 2.5, textTransform: "uppercase", color: COLORS.secondary, background: COLORS.secondaryDim, marginBottom: 8, fontFamily: FONT_SANS }}>
            {t("aviso.etiqueta")}
          </span>
          <div style={{ fontFamily: FONT_SERIF, fontStyle: "italic", fontVariationSettings: "'opsz' 24, 'SOFT' 100", fontSize: 13, color: COLORS.text }}>
            {t("aviso.texto")}
          </div>
          <div style={{ marginTop: 4, fontSize: 11, color: COLORS.textMuted }}>
            {t("aviso.responsabilidad")}
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
            <span>📚 {t("biblio.titulo")} ({REFERENCIAS.length})</span>
            <span style={{ fontSize: 12, color: COLORS.textMuted, fontWeight: 600 }}>{showBiblio ? `▲ ${t("common.ocultar")}` : `▼ ${t("common.mostrar")}`}</span>
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
            {t("splash.una_app_de")}
          </span>
          <img
            src={`${import.meta.env.BASE_URL}vml-logo.png`}
            alt="Virtual Medical Learning"
            style={{ width: 88, height: "auto", objectFit: "contain" }} />
          <span style={{ fontSize: 11, color: COLORS.textMuted, textAlign: "center", lineHeight: 1.4, fontFamily: FONT_SERIF, fontStyle: "italic", fontVariationSettings: "'opsz' 18" }}>
            vml.solutions
          </span>
        </a>
      </div>

      <LandmarkAnnotator
        open={showAnnotator}
        onClose={() => setShowAnnotator(false)}
        onSaveAnnotated={(dataUrl) => {
          // La imagen anotada se descarga al dispositivo; no se sube a ningún lado.
          const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
          const a = document.createElement("a"); a.href = dataUrl; a.download = `SpineCalc_anotada_${stamp}.jpg`; a.click();
          showToast(t("toast.imagen_anotada"));
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
          // Contar por lista explícita: `geometry` no es una medición y con
          // Object.keys se colaría en el número que ve el usuario.
          const count = MEASUREMENT_KEYS.filter(k => v[k] !== undefined).length;
          showToast(t(count === 1 ? "toast.medicion_aplicada" : "toast.mediciones_aplicadas", { n: count }));
        }}
      />
      </div>
    </div>
  );
}
