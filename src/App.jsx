import { useState, useMemo, useEffect } from "react";
import { firebaseEnabled, db, storage, auth, googleProvider } from "./firebase";
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy, where, getDoc, setDoc, increment, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { onAuthStateChanged, signInWithPopup, signInWithEmailAndPassword, signOut } from "firebase/auth";
import LandmarkAnnotator from "./landmarkAnnotator";
import {
  CIRUJANOS, MEDIDORES, TIPOS_CIRUGIA, SEGMENTOS, CATEGORIAS_FOTO, STORAGE_KEY,
  REFERENCIAS, APP_VERSION, CONSENT_VERSION, CONSENT_CONTACT,
  PUBLIC_CONSENT_VERSION, PUBLIC_CONSENT_LS_KEY, PUBLIC_CASES_LS_KEY, TILTS_FULL_MODE,
} from "./constants";
import { COLORS, FONT_SERIF, FONT_SANS, FONT_MONO, MOMENTOS } from "./theme";
import {
  normalizeName, resizeImage, dataURLtoBlob, uid, hoy, generarCasoId,
  normalizeIniciales, nombreCompleto, calcularIMC, calcularDiferencia,
} from "./utils";
import {
  classify, rpvCalc, rllCalc, ldiCalc, rsaCalc, afCalc,
  TILT_NORMS, computeTilt, R_TYPES, R_LOW_PI, R_HIGH_PI,
  roussoulyCurrentType, roussoulyIdealType,
} from "./scoring";
import { buildPDF } from "./pdf";
import { casosToCSV } from "./csv";
import {
  InfoTooltip, InputField, SelectField, TipoEvaluacionToggle, DiffInfoBox, IMCBadge,
  Chip, CirugiaCard, ParamRow, ShareButton, MomentoBadge, Card,
  PdfSaveModal, EmailLoginModal, PublicConsentModal, ConsentModal,
} from "./components";
// ═══════════════════════════════════════════════════════════════════════════
// APP
// ═══════════════════════════════════════════════════════════════════════════
export default function GAPCalculator() {
  const [tipoEvaluacion, setTipoEvaluacion] = useState("preoperatorio");
  const [fechaEstudio, setFechaEstudio] = useState(hoy());
  const [fechaCirugia, setFechaCirugia] = useState(hoy());
  const [apellidos, setApellidos] = useState("");
  const [nombre, setNombre] = useState("");
  const [iniciales, setIniciales] = useState("");
  const [casoId, setCasoId] = useState(() => generarCasoId());
  const [age, setAge] = useState("");
  const [peso, setPeso] = useState("");
  const [talla, setTalla] = useState("");
  const [cirujanoSel, setCirujanoSel] = useState("");
  const [cirujanoCustom, setCirujanoCustom] = useState("");
  const [medicoPublic, setMedicoPublic] = useState(""); // input opcional en modo público (solo PDF, no se guarda)
  const medicoBase = cirujanoSel === "Otro (especificar)" ? normalizeName(cirujanoCustom) : cirujanoSel;
  const medico = medicoBase || (medicoPublic ? normalizeName(medicoPublic) : "");
  const [medidorSel, setMedidorSel] = useState("");
  const [medidorCustom, setMedidorCustom] = useState("");
  const medidor = medidorSel === "Otro (especificar)" ? normalizeName(medidorCustom) : medidorSel;
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
  const [gapbOpen, setGapbOpen] = useState(false);
  const [fotos, setFotos] = useState([]);
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [casosGuardados, setCasosGuardados] = useState([]);
  const [showCasos, setShowCasos] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [showBiblio, setShowBiblio] = useState(false);

  // Auth
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [allowlisted, setAllowlisted] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  // Login email/password (alterno al de Google)
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPwd, setLoginPwd] = useState("");
  const [loginError, setLoginError] = useState("");
  // Anotador de landmarks
  const [showAnnotator, setShowAnnotator] = useState(false);

  // Splash inicial — dos etapas: 1) VML  2) Dr. Samano
  const [splashStage, setSplashStage] = useState("vml"); // "vml" | "samano" | "done"
  useEffect(() => {
    const t1 = setTimeout(() => setSplashStage("samano"), 1800);
    const t2 = setTimeout(() => setSplashStage("done"), 4000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // Tracking anónimo (modo público)
  const [deviceId, setDeviceId] = useState(null);
  const [usageCount, setUsageCount] = useState(null);
  const [hasCountedSession, setHasCountedSession] = useState(false);
  // Suscripción
  const [subEmail, setSubEmail] = useState("");
  const [subName, setSubName] = useState("");
  const [subBusy, setSubBusy] = useState(false);
  const [subDone, setSubDone] = useState(false);
  // Guardado público (consent + lookup + historial local)
  const [publicConsentAccepted, setPublicConsentAccepted] = useState(false);
  const [showPublicConsentModal, setShowPublicConsentModal] = useState(false);
  const [loadCaseIdInput, setLoadCaseIdInput] = useState("");
  const [loadingCase, setLoadingCase] = useState(false);
  const [myPublicCases, setMyPublicCases] = useState([]);
  const [savedPublicCaseId, setSavedPublicCaseId] = useState(null);

  // Modal "guardar antes de descargar PDF" (modo público, una vez por caso)
  const [showPdfSaveModal, setShowPdfSaveModal] = useState(false);
  const [pendingDownloadAfterSave, setPendingDownloadAfterSave] = useState(false);

  // Encuesta de satisfacción one-time
  const [feedbackDone, setFeedbackDone] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackHover, setFeedbackHover] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackBusy, setFeedbackBusy] = useState(false);

  // Carga inicial: consent público + historial local de casos guardados + flag de encuesta
  useEffect(() => {
    try {
      if (localStorage.getItem(PUBLIC_CONSENT_LS_KEY) === PUBLIC_CONSENT_VERSION) setPublicConsentAccepted(true);
      const arr = JSON.parse(localStorage.getItem(PUBLIC_CASES_LS_KEY) || "[]");
      if (Array.isArray(arr)) setMyPublicCases(arr);
      if (localStorage.getItem("gap_feedback_done") === "1") setFeedbackDone(true);
    } catch (e) {}
  }, []);

  const submitFeedback = async () => {
    if (!feedbackRating) { showToast("Califica con estrellas primero", false); return; }
    if (!firebaseEnabled || !db) { showToast("Servicio no disponible", false); return; }
    setFeedbackBusy(true);
    try {
      await addDoc(collection(db, "feedback"), {
        rating: feedbackRating,
        comment: feedbackComment.trim() || null,
        deviceId: deviceId || null,
        createdAt: serverTimestamp()
      });
      try { localStorage.setItem("gap_feedback_done", "1"); } catch (e) {}
      setFeedbackDone(true);
      showToast("¡Gracias por tu opinión! ✓");
    } catch (e) {
      console.error(e);
      showToast("Error enviando opinión", false);
    }
    setFeedbackBusy(false);
  };

  // Device ID + contador inicial (una vez)
  useEffect(() => {
    let id = null;
    try {
      id = localStorage.getItem("gap_device_id");
      if (!id) {
        id = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        localStorage.setItem("gap_device_id", id);
      }
    } catch (e) {}
    setDeviceId(id);
    if (firebaseEnabled && db) {
      getDoc(doc(db, "stats", "usage"))
        .then(snap => { if (snap.exists()) setUsageCount(snap.data().count || 0); else setUsageCount(0); })
        .catch(() => {});
      if (id) {
        const devRef = doc(db, "devices", id);
        getDoc(devRef).then(snap => {
          if (snap.exists()) {
            updateDoc(devRef, { lastSeen: serverTimestamp(), sessions: increment(1) }).catch(() => {});
          } else {
            setDoc(devRef, { firstSeen: serverTimestamp(), lastSeen: serverTimestamp(), sessions: 1, calcCount: 0 }).catch(() => {});
          }
        }).catch(() => {});
      }
    }
  }, []);

  useEffect(() => {
    if (!firebaseEnabled || !auth) {
      setAuthReady(true);
      loadLocalCasos();
      return;
    }
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const [allowSnap, userSnap] = await Promise.all([
            getDoc(doc(db, "allowlist", u.email)),
            getDoc(doc(db, "users", u.uid))
          ]);
          const isAllowed = allowSnap.exists();
          const hasConsent = userSnap.exists() && userSnap.data().consentVersion === CONSENT_VERSION;
          setAllowlisted(isAllowed);
          setConsentAccepted(hasConsent);
          if (isAllowed && !hasConsent) setShowConsentModal(true);
          if (isAllowed && hasConsent) loadCasos(u);
          else setCasosGuardados([]);
        } catch (e) {
          console.error("Auth check error:", e);
          setAllowlisted(false);
          setConsentAccepted(false);
          setCasosGuardados([]);
        }
      } else {
        setAllowlisted(false);
        setConsentAccepted(false);
        setCasosGuardados([]);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  const loadCasos = async (u) => {
    const usr = u || user;
    if (firebaseEnabled && db && usr) {
      try {
        const q = query(collection(db, "casos"), where("ownerUid", "==", usr.uid), orderBy("fecha", "desc"));
        const snap = await getDocs(q);
        setCasosGuardados(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) { console.error("Firebase load error:", e); setCasosGuardados([]); }
    } else {
      setCasosGuardados([]);
    }
  };
  const loadLocalCasos = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setCasosGuardados(JSON.parse(saved));
    } catch (e) {}
  };

  const canEdit = !firebaseEnabled || (!!user && allowlisted && consentAccepted);
  const paciente = canEdit
    ? nombreCompleto(apellidos, nombre)
    : (iniciales ? `${iniciales} (${casoId})` : casoId);

  const handleLogin = async () => {
    if (!firebaseEnabled || !auth) return;
    setAuthBusy(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      console.error("Login error:", e);
      if (e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request") {
        showToast("Error iniciando sesión", false);
      }
    }
    setAuthBusy(false);
  };

  const handleLogout = async () => {
    if (!auth) return;
    setAuthBusy(true);
    try {
      await signOut(auth);
      showToast("Sesión cerrada");
    } catch (e) { console.error(e); }
    setAuthBusy(false);
  };

  // ─── Login con email/password (Firebase Auth) ────────────────────────────
  const handleEmailLogin = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setLoginError("");
    const email = loginEmail.trim().toLowerCase();
    if (!email || !loginPwd) {
      setLoginError("Completa correo y contraseña.");
      return;
    }
    if (!firebaseEnabled || !auth) {
      setLoginError("Servicio no disponible.");
      return;
    }
    setAuthBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email, loginPwd);
      // onAuthStateChanged dispara el flujo de allowlist + consentimiento.
      setShowLoginModal(false);
      setLoginEmail(""); setLoginPwd(""); setLoginError("");
      showToast("Sesión iniciada ✓");
    } catch (err) {
      console.error("Email login error:", err);
      const code = err && err.code;
      if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found" || code === "auth/invalid-email") {
        setLoginError("Credenciales inválidas.");
      } else if (code === "auth/too-many-requests") {
        setLoginError("Demasiados intentos. Espera unos minutos.");
      } else if (code === "auth/network-request-failed") {
        setLoginError("Sin conexión. Reintenta.");
      } else {
        setLoginError("Error al iniciar sesión.");
      }
    }
    setAuthBusy(false);
  };

  const acceptConsent = async () => {
    if (!user) return;
    setAuthBusy(true);
    try {
      await setDoc(doc(db, "users", user.uid), {
        email: user.email,
        displayName: user.displayName || null,
        consentVersion: CONSENT_VERSION,
        consentAcceptedAt: new Date().toISOString()
      }, { merge: true });
      setConsentAccepted(true);
      setShowConsentModal(false);
      showToast("Consentimiento registrado ✓");
      loadCasos(user);
    } catch (e) {
      console.error(e);
      showToast("Error registrando consentimiento", false);
    }
    setAuthBusy(false);
  };

  const rejectConsent = async () => {
    setShowConsentModal(false);
    await handleLogout();
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
    const idealSS = 0.59 * piE + 9, idealLL = 0.62 * piE + 29, idealGT = 0.48 * piE - 15;
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
    let ejeDiff = null, ejeStatus = null, ejeLabel = null;
    if (t4pa !== "") {
      ejeDiff = Number(t4pa) - l1paN;
      const abs = Math.abs(ejeDiff);
      if (abs <= 4)      { ejeStatus = "ok";   ejeLabel = "Eje T4-L1-cadera alineado"; }
      else if (abs <= 8) { ejeStatus = "warn"; ejeLabel = "Desalineación moderada"; }
      else               { ejeStatus = "bad";  ejeLabel = "Desalineación severa"; }
    }
    return { idealL1PA, l1paDiff, idealLL_Hills, idealLL_Hills_L4S1, ejeDiff, ejeStatus, ejeLabel };
  }, [spinopelvic, l1pa, t4pa]);

  // Contador atómico de mediciones (una vez por sesión, al primer GAP completo)
  useEffect(() => {
    if (!result || hasCountedSession || !firebaseEnabled || !db) return;
    setHasCountedSession(true);
    setDoc(doc(db, "stats", "usage"), { count: increment(1), lastUpdated: serverTimestamp() }, { merge: true })
      .then(() => setUsageCount(c => (c ?? 0) + 1))
      .catch(() => {});
    if (deviceId) {
      updateDoc(doc(db, "devices", deviceId), { calcCount: increment(1), lastCalcAt: serverTimestamp() }).catch(() => {});
    }
  }, [result, hasCountedSession, deviceId]);

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
      if (v < t0)  return { g: "0",  label: "Normal",   color: COLORS.green,  bg: COLORS.greenBg };
      if (v <= t1) return { g: "+",  label: "Moderado", color: COLORS.yellow, bg: COLORS.yellowBg };
      return       { g: "++", label: "Marcado",  color: COLORS.red,    bg: COLORS.redBg };
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
        esperadoLabel: piN < 50 ? "tipo 1 ó 2" : "tipo 3 ó 4",
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
      label: curDef.label,
      desc: curDef.desc,
      uncertain: cur.uncertain || null,
      color, bg, params,
      esPost: tipoEvaluacion === "postoperatorio",
      ideal: idealDef ? {
        type: idealDef.short,
        key: ideal.key,
        label: idealDef.label,
        desc: idealDef.desc,
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
    if (prob < 0.25)      cat = { label: "Riesgo bajo",      color: COLORS.green,  bg: COLORS.greenBg };
    else if (prob < 0.55) cat = { label: "Riesgo moderado",  color: COLORS.yellow, bg: COLORS.yellowBg };
    else                  cat = { label: "Riesgo alto",      color: COLORS.red,    bg: COLORS.redBg };
    return { bmi: bmiN, tscore: tN, gap: gapN, lp, prob, cat };
  }, [result, imc, bmdTscore]);

  const showToast = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500); };

  const submitSubscribe = async () => {
    const email = subEmail.trim().toLowerCase();
    const name = subName.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast("Correo no válido", false); return; }
    if (name.length < 2) { showToast("Ingresa tu nombre", false); return; }
    if (!firebaseEnabled || !db) { showToast("Servicio no disponible", false); return; }
    setSubBusy(true);
    try {
      await setDoc(doc(db, "subscribers", email), {
        email, name,
        addedAt: serverTimestamp(),
        source: "public",
        deviceId: deviceId || null
      }, { merge: true });
      setSubDone(true);
      setSubEmail(""); setSubName("");
      showToast("✓ Gracias, te avisaremos");
    } catch (e) {
      showToast("No se pudo registrar. Intenta más tarde.", false);
    }
    setSubBusy(false);
  };
  const inputs = { age, pi: spinopelvic.effPI ?? "", ss: spinopelvic.effSS ?? "", pt: spinopelvic.effPT ?? "", l1s1, l4s1, gt, l1pa, t4pa, c2tiltDirect, cpa, t1tiltDirect, t1pa, l1tiltDirect, paciente, medico, cirugias, fotos, tipoEvaluacion, fechaEstudio, fechaCirugia, diffInfo, peso, talla, imc, hillsResult, tiltsResult, derivedKey: spinopelvic.derivedKey, sva, bmdTscore, schwabResult, roussoulyResult, gapbResult };

  const addCirugia = () => setCirugias([...cirugias, { id: uid(), tipo: "", tipoCustom: "", segmentos: [] }]);
  const updateCirugia = (id, n) => setCirugias(cirugias.map(c => c.id === id ? n : c));
  const removeCirugia = (id) => setCirugias(cirugias.filter(c => c.id !== id));

  const handleFotos = async (e) => {
    const files = Array.from(e.target.files);
    const nuevas = [];
    for (const f of files) { try { const dataUrl = await resizeImage(f); nuevas.push({ id: uid(), name: f.name, dataUrl, categoria: CATEGORIAS_FOTO[0] }); } catch (err) {} }
    setFotos([...fotos, ...nuevas]); e.target.value = "";
    if (nuevas.length > 0) showToast(`${nuevas.length} foto${nuevas.length > 1 ? "s" : ""} agregada${nuevas.length > 1 ? "s" : ""}`);
  };
  const removeFoto = (id) => setFotos(fotos.filter(f => f.id !== id));
  const updateFotoCat = (id, categoria) => setFotos(fotos.map(f => f.id === id ? { ...f, categoria } : f));

  const buildPdfFile = () => {
    const docP = buildPDF(inputs, result);
    const tipoTag = tipoEvaluacion === "preoperatorio" ? "PRE" : "POST";
    const filename = `GAP_${tipoTag}${paciente ? "_" + paciente.replace(/\s+/g, "_") : (iniciales ? "_" + iniciales : "")}_${fechaEstudio}.pdf`;
    const blob = docP.output("blob");
    return { file: new File([blob], filename, { type: "application/pdf" }), filename, blob };
  };

  const triggerDownload = () => {
    const { file, filename } = buildPdfFile();
    const url = URL.createObjectURL(file);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    showToast("PDF descargado ✓");
  };

  const handleDownload = () => {
    if (!hasAnyMeasurement) { showToast("Ingresa al menos una medición", false); return; }
    // Modo público + caso no guardado todavía → ofrecer guardar primero
    // (solo cuando el GAP está completo; guardar requiere result)
    if (result && !canEdit && firebaseEnabled && savedPublicCaseId !== casoId) {
      setShowPdfSaveModal(true);
      return;
    }
    triggerDownload();
  };

  // Cuando el guardado del caso completa con éxito y el usuario eligió "Guardar y descargar",
  // dispara la descarga al siguiente tick.
  useEffect(() => {
    if (saved && pendingDownloadAfterSave) {
      setPendingDownloadAfterSave(false);
      triggerDownload();
    }
  }, [saved, pendingDownloadAfterSave]);

  // Texto resumido para el cuerpo del correo cuando hay que adjuntar manualmente
  const buildEmailBody = () => {
    const fTxt = new Date(fechaEstudio + "T00:00:00").toLocaleDateString("es-MX");
    const tLabel = MOMENTOS[tipoEvaluacion].label;
    const cTxt = fechaCirugia ? new Date(fechaCirugia + "T00:00:00").toLocaleDateString("es-MX") : null;
    const ref = paciente || iniciales || casoId;
    return [
      `GAP Score · ${tLabel}${ref ? " · " + ref : ""}`,
      `Fecha del estudio: ${fTxt}`,
      ...(cTxt ? [`Fecha de cirugía: ${cTxt}`] : []),
      ...(diffInfo ? [diffInfo.mensaje] : []),
      ...(age ? [`Edad: ${age} años`] : []),
      ...(imc ? [`IMC: ${imc.valor.toFixed(1)} (${imc.categoria})`] : []),
      ...(medico ? [`Médico: ${medico}`] : []),
      "",
      ...(result
        ? [`Resultado: ${result.total}/13 — ${result.cat.label}`, result.cat.risk]
        : ["Reporte parcial — GAP Score no calculado (mediciones incompletas)."])
    ].join("\n");
  };

  const handleEmail = async () => {
    if (!hasAnyMeasurement) { showToast("Ingresa al menos una medición", false); return; }
    const { file, filename } = buildPdfFile();
    // Web Share API con archivos (móvil + algunos desktop)
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `GAP Score · ${MOMENTOS[tipoEvaluacion].label}`,
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
    const subject = `GAP Score · ${MOMENTOS[tipoEvaluacion].label}${paciente ? " · " + paciente : ""}`;
    const body = buildEmailBody() + "\n\n📎 Adjunta al correo el PDF que se descargó automáticamente.";
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    showToast("PDF descargado · adjúntalo al correo", true);
  };

  const saveCaso = async () => {
    if (!result) { showToast("Completa las mediciones primero", false); return; }
    if (firebaseEnabled) {
      if (!user) { setShowLoginModal(true); return; }
      if (!allowlisted) { showToast("Tu cuenta aún no está autorizada. Contacta al administrador.", false); return; }
      if (!consentAccepted) { setShowConsentModal(true); return; }
    }
    setSaving(true);
    const casoBase = {
      fecha: new Date().toISOString(), fechaEstudio, fechaCirugia: fechaCirugia || null,
      tipoEvaluacion, tiempoCalculado: diffInfo?.mensaje || null, diasDiferencia: diffInfo?.dias ?? null,
      paciente: { apellidos, nombre, completo: paciente }, edad: Number(age),
      peso: peso ? Number(peso) : null, talla: talla ? Number(talla) : null,
      imc: imc ? { valor: Number(imc.valor.toFixed(2)), categoria: imc.categoria } : null,
      medico, medidor, cirugias,
      ...(user ? { ownerUid: user.uid, ownerEmail: user.email } : {}),
      mediciones: {
        pi: Number(spinopelvic.effPI), ss: Number(spinopelvic.effSS), pt: Number(spinopelvic.effPT),
        derivedKey: spinopelvic.derivedKey,
        l1s1: Number(l1s1), l4s1: Number(l4s1), gt: Number(gt),
        l1pa: l1pa !== "" ? Number(l1pa) : null,
        t4pa: t4pa !== "" ? Number(t4pa) : null,
        c2tilt: c2tiltDirect !== "" ? Number(c2tiltDirect) : null,
        cpa: cpa !== "" ? Number(cpa) : null,
        t1tilt: t1tiltDirect !== "" ? Number(t1tiltDirect) : null,
        t1pa: t1pa !== "" ? Number(t1pa) : null,
        l1tilt: l1tiltDirect !== "" ? Number(l1tiltDirect) : null
      },
      resultado: { total: result.total, categoria: result.cat.label, rpv: result.rpv.score, rll: result.rll.score, ldi: result.ldi.score, ldiValor: Number(result.ldi.value.toFixed(2)), rsa: result.rsa.score, af: result.af.score },
      hills: hillsResult ? {
        idealL1PA: Number(hillsResult.idealL1PA.toFixed(2)),
        l1paDiff: Number(hillsResult.l1paDiff.toFixed(2)),
        idealLL_Hills: Number(hillsResult.idealLL_Hills.toFixed(2)),
        ejeDiff: hillsResult.ejeDiff !== null ? Number(hillsResult.ejeDiff.toFixed(2)) : null,
        ejeStatus: hillsResult.ejeStatus
      } : null,
      tilts: tiltsResult ? {
        pt: tiltsResult.pt !== null ? Number(tiltsResult.pt.toFixed(2)) : null,
        c2: tiltsResult.c2 ? { direct: tiltsResult.c2.direct, derived: tiltsResult.c2.derived !== null ? Number(tiltsResult.c2.derived.toFixed(2)) : null, delta: tiltsResult.c2.delta !== null ? Number(tiltsResult.c2.delta.toFixed(2)) : null, level: tiltsResult.c2.cls.level, label: tiltsResult.c2.cls.label } : null,
        t1: tiltsResult.t1 ? { direct: tiltsResult.t1.direct, derived: tiltsResult.t1.derived !== null ? Number(tiltsResult.t1.derived.toFixed(2)) : null, delta: tiltsResult.t1.delta !== null ? Number(tiltsResult.t1.delta.toFixed(2)) : null, level: tiltsResult.t1.cls.level, label: tiltsResult.t1.cls.label } : null,
        l1: tiltsResult.l1 ? { direct: tiltsResult.l1.direct, derived: tiltsResult.l1.derived !== null ? Number(tiltsResult.l1.derived.toFixed(2)) : null, delta: tiltsResult.l1.delta !== null ? Number(tiltsResult.l1.delta.toFixed(2)) : null, level: tiltsResult.l1.cls.level, label: tiltsResult.l1.cls.label } : null
      } : null
    };

    if (firebaseEnabled && db && storage) {
      try {
        const docRef = await addDoc(collection(db, "casos"), { ...casoBase, fotos: [] });
        const fotosFirebase = [];
        for (const f of fotos) {
          const blob = dataURLtoBlob(f.dataUrl);
          const imageRef = ref(storage, `casos/${docRef.id}/${f.id}.jpg`);
          await uploadBytes(imageRef, blob);
          const url = await getDownloadURL(imageRef);
          fotosFirebase.push({ id: f.id, name: f.name, categoria: f.categoria, url });
        }
        if (fotosFirebase.length > 0) await updateDoc(doc(db, "casos", docRef.id), { fotos: fotosFirebase });
        await loadCasos(user);
        showToast("Caso guardado en Firebase ✓");
      } catch (e) { console.error(e); showToast("Error guardando en Firebase.", false); }
    } else {
      try {
        const caso = { id: uid(), ...casoBase, fotos };
        const updated = [caso, ...casosGuardados];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        setCasosGuardados(updated);
        showToast(`Caso guardado localmente (${updated.length} totales)`);
      } catch (e) { showToast("Error: almacenamiento lleno (fotos pesadas).", false); }
    }
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 4000);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Modo público — guardado anónimo, lookup por ID, historial localStorage
  // ─────────────────────────────────────────────────────────────────────────
  const savePublicCase = async (skipConsentCheck = false) => {
    if (!result) { showToast("Completa las mediciones primero", false); return; }
    if (!firebaseEnabled || !db) { showToast("Servicio no disponible", false); return; }
    if (!skipConsentCheck && !publicConsentAccepted) { setShowPublicConsentModal(true); return; }
    setSaving(true);
    try {
      const cleanCirugias = (cirugias || []).map(c => ({ tipo: c.tipo || null, tipoCustom: c.tipoCustom || null, segmentos: c.segmentos || [] }));
      const casoData = {
        casoId,
        createdAt: serverTimestamp(),
        fechaCaso: new Date().toISOString(),
        fechaEstudio,
        fechaCirugia: fechaCirugia || null,
        tipoEvaluacion,
        tiempoCalculado: diffInfo?.mensaje || null,
        diasDiferencia: diffInfo?.dias ?? null,
        iniciales: iniciales || null,
        edad: Number(age),
        peso: peso ? Number(peso) : null,
        talla: talla ? Number(talla) : null,
        imc: imc ? { valor: Number(imc.valor.toFixed(2)), categoria: imc.categoria } : null,
        cirugias: cleanCirugias,
        deviceId: deviceId || null,
        consentVersion: PUBLIC_CONSENT_VERSION,
        consentAcceptedAt: serverTimestamp(),
        mediciones: {
          pi: Number(spinopelvic.effPI), ss: Number(spinopelvic.effSS), pt: Number(spinopelvic.effPT),
          derivedKey: spinopelvic.derivedKey,
          l1s1: Number(l1s1), l4s1: Number(l4s1), gt: Number(gt),
          l1pa: l1pa !== "" ? Number(l1pa) : null,
          t4pa: t4pa !== "" ? Number(t4pa) : null,
          c2tilt: c2tiltDirect !== "" ? Number(c2tiltDirect) : null,
          cpa: cpa !== "" ? Number(cpa) : null,
          t1tilt: t1tiltDirect !== "" ? Number(t1tiltDirect) : null,
          t1pa: t1pa !== "" ? Number(t1pa) : null,
          l1tilt: l1tiltDirect !== "" ? Number(l1tiltDirect) : null
        },
        resultado: { total: result.total, categoria: result.cat.label, rpv: result.rpv.score, rll: result.rll.score, ldi: result.ldi.score, ldiValor: Number(result.ldi.value.toFixed(2)), rsa: result.rsa.score, af: result.af.score },
        hills: hillsResult ? {
          idealL1PA: Number(hillsResult.idealL1PA.toFixed(2)),
          l1paDiff: Number(hillsResult.l1paDiff.toFixed(2)),
          idealLL_Hills: Number(hillsResult.idealLL_Hills.toFixed(2)),
          ejeDiff: hillsResult.ejeDiff !== null ? Number(hillsResult.ejeDiff.toFixed(2)) : null,
          ejeStatus: hillsResult.ejeStatus
        } : null,
        tilts: tiltsResult ? {
          pt: tiltsResult.pt !== null ? Number(tiltsResult.pt.toFixed(2)) : null,
          c2: tiltsResult.c2 ? { direct: tiltsResult.c2.direct, derived: tiltsResult.c2.derived !== null ? Number(tiltsResult.c2.derived.toFixed(2)) : null, level: tiltsResult.c2.cls.level, label: tiltsResult.c2.cls.label } : null,
          t1: tiltsResult.t1 ? { direct: tiltsResult.t1.direct, derived: tiltsResult.t1.derived !== null ? Number(tiltsResult.t1.derived.toFixed(2)) : null, level: tiltsResult.t1.cls.level, label: tiltsResult.t1.cls.label } : null,
          l1: tiltsResult.l1 ? { direct: tiltsResult.l1.direct, derived: tiltsResult.l1.derived !== null ? Number(tiltsResult.l1.derived.toFixed(2)) : null, level: tiltsResult.l1.cls.level, label: tiltsResult.l1.cls.label } : null
        } : null
      };
      await setDoc(doc(db, "public_cases", casoId), casoData);
      try {
        const arr = JSON.parse(localStorage.getItem(PUBLIC_CASES_LS_KEY) || "[]");
        const entry = { id: casoId, fechaCaso: casoData.fechaCaso, tipoEvaluacion, gapTotal: result.total, gapCategoria: result.cat.label };
        const updated = [entry, ...arr.filter(x => x.id !== casoId)].slice(0, 50);
        localStorage.setItem(PUBLIC_CASES_LS_KEY, JSON.stringify(updated));
        setMyPublicCases(updated);
      } catch (e) {}
      setSavedPublicCaseId(casoId);
      setSaved(true);
      showToast(`Caso ${casoId} guardado ✓`);
      setTimeout(() => setSaved(false), 5000);
    } catch (e) {
      console.error(e);
      showToast("Error guardando caso", false);
    }
    setSaving(false);
  };

  const acceptPublicConsent = async () => {
    try { localStorage.setItem(PUBLIC_CONSENT_LS_KEY, PUBLIC_CONSENT_VERSION); } catch (e) {}
    setPublicConsentAccepted(true);
    setShowPublicConsentModal(false);
    await savePublicCase(true);
  };

  const loadPublicCase = async (overrideId) => {
    const id = (overrideId || loadCaseIdInput).trim().toUpperCase();
    if (!/^GAP-\d{4}-[A-Z0-9]{4}$/i.test(id)) { showToast("ID inválido. Formato: GAP-AAAA-XXXX", false); return; }
    if (!firebaseEnabled || !db) { showToast("Servicio no disponible", false); return; }
    setLoadingCase(true);
    try {
      const snap = await getDoc(doc(db, "public_cases", id));
      if (!snap.exists()) { showToast("Caso no encontrado", false); setLoadingCase(false); return; }
      const c = snap.data();
      const m = c.mediciones || {};
      setCasoId(id);
      setFechaEstudio(c.fechaEstudio || hoy());
      setFechaCirugia(c.fechaCirugia || "");
      setTipoEvaluacion(c.tipoEvaluacion || "preoperatorio");
      setIniciales(c.iniciales || "");
      setAge(c.edad ?? "");
      setPeso(c.peso ?? "");
      setTalla(c.talla ?? "");
      setCirugias(Array.isArray(c.cirugias) ? c.cirugias.map(x => ({ id: uid(), tipo: x.tipo || "", tipoCustom: x.tipoCustom || "", segmentos: x.segmentos || [] })) : []);
      setPI(m.pi ?? "");
      setSS(m.ss ?? "");
      setPT(m.pt ?? "");
      setL1S1(m.l1s1 ?? "");
      setL4S1(m.l4s1 ?? "");
      setGT(m.gt ?? "");
      setL1PA(m.l1pa ?? "");
      setT4PA(m.t4pa ?? "");
      setC2TiltDirect(m.c2tilt ?? "");
      setCPA(m.cpa ?? "");
      setT1TiltDirect(m.t1tilt ?? "");
      setT1PA(m.t1pa ?? "");
      setL1TiltDirect(m.l1tilt ?? "");
      setLoadCaseIdInput("");
      setSavedPublicCaseId(id);
      showToast(`Caso ${id} cargado ✓`);
    } catch (e) {
      console.error(e);
      showToast("Error cargando caso", false);
    }
    setLoadingCase(false);
  };

  const deleteCaso = async (id) => {
    if (!confirm("¿Eliminar este caso?")) return;
    if (firebaseEnabled && db) {
      try { await deleteDoc(doc(db, "casos", id)); await loadCasos(user); showToast("Caso eliminado"); }
      catch (e) { console.error(e); showToast("Error eliminando caso", false); }
    } else {
      const updated = casosGuardados.filter(c => c.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setCasosGuardados(updated);
      showToast("Caso eliminado");
    }
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(casosGuardados, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `GAP_dataset_${hoy()}.json`; a.click();
    URL.revokeObjectURL(url); showToast(`Dataset JSON exportado (${casosGuardados.length} casos)`);
  };

  const exportCSV = () => {
    const csv = casosToCSV(casosGuardados);
    // BOM for Excel UTF-8
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `GAP_dataset_${hoy()}.csv`; a.click();
    URL.revokeObjectURL(url); showToast(`CSV exportado (${casosGuardados.length} casos)`);
  };

  const clearAll = () => { setAge(""); setPeso(""); setTalla(""); setPI(""); setSS(""); setPT(""); setL1S1(""); setL4S1(""); setGT(""); setL1PA(""); setT4PA(""); setC2TiltDirect(""); setCPA(""); setT1TiltDirect(""); setT1PA(""); setL1TiltDirect(""); setApellidos(""); setNombre(""); setIniciales(""); setCasoId(generarCasoId()); setCirujanoSel(""); setCirujanoCustom(""); setCirugias([]); setFotos([]); setFechaCirugia(""); setFechaEstudio(hoy()); setTipoEvaluacion("preoperatorio"); setSaved(false); setSavedPublicCaseId(null); setMedidorSel(""); setMedidorCustom(""); setMedicoPublic("");};

  const conteos = { todos: casosGuardados.length, preoperatorio: casosGuardados.filter(c => c.tipoEvaluacion === "preoperatorio").length, postoperatorio: casosGuardados.filter(c => c.tipoEvaluacion === "postoperatorio").length };
  const casosFiltrados = filtroTipo === "todos" ? casosGuardados : casosGuardados.filter(c => c.tipoEvaluacion === filtroTipo);

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

      {/* Splash inicial — Etapa 1: VML, luego Etapa 2: Dr. Samano */}
      {splashStage !== "done" && (
        <div
          onClick={() => setSplashStage("done")}
          style={{
            position: "fixed", inset: 0, zIndex: 10001,
            background: COLORS.bg,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            padding: 24, cursor: "pointer"
          }}>
          {splashStage === "vml" && (
            <div key="vml" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, animation: "splashStage 1800ms ease both" }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2.5, textTransform: "uppercase", color: COLORS.textMuted }}>
                Una aplicación de
              </div>
              <img
                src="/vml-logo.png"
                alt="Virtual Medical Learning"
                style={{ width: "min(180px, 45vw)", height: "auto", objectFit: "contain" }} />
            </div>
          )}
          {splashStage === "samano" && (
            <div key="samano" style={{ display: "flex", flexDirection: "column", alignItems: "center", animation: "splashStage 2200ms ease both" }}>
              <img
                src="/samano.jpeg"
                alt="Logo Dr. Iván Samano López"
                style={{ width: "min(220px, 55vw)", height: "auto", objectFit: "contain" }} />
              <div style={{ marginTop: 26, textAlign: "center" }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase", color: COLORS.textMuted, marginBottom: 6 }}>
                  Dr.
                </div>
                <div style={{ fontSize: 30, fontWeight: 600, fontFamily: FONT_SERIF, fontVariationSettings: "'opsz' 96, 'SOFT' 50", color: COLORS.ink, letterSpacing: "-0.015em", lineHeight: 1.05 }}>
                  Iván Samano López
                </div>
              </div>
            </div>
          )}
          <div style={{ position: "absolute", bottom: 22, fontSize: 10, color: COLORS.textMuted, fontWeight: 500, opacity: 0.7 }}>
            Toca para saltar
          </div>
          <style>{`@keyframes splashStage { 0% { opacity: 0; transform: translateY(10px); } 12% { opacity: 1; transform: translateY(0); } 80% { opacity: 1; transform: translateY(0); } 100% { opacity: 0; transform: translateY(-6px); } }`}</style>
        </div>
      )}

      {/* Barra de autenticación */}
      {firebaseEnabled && authReady && (
        <div style={{ maxWidth: 560, margin: "0 auto 16px", display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {user ? (
            <>
              <div style={{ fontSize: 11, color: COLORS.textMuted, textAlign: "right", lineHeight: 1.3 }}>
                <div style={{ fontWeight: 600, color: COLORS.text, fontSize: 12 }}>{user.displayName || user.email}</div>
                <div style={{ fontSize: 10 }}>
                  {canEdit ? <span style={{ color: COLORS.green, fontWeight: 600 }}>✓ Modo clínico activo</span>
                   : allowlisted && !consentAccepted ? <span style={{ color: COLORS.yellow, fontWeight: 600 }}>⏳ Falta aceptar consentimiento</span>
                   : <span style={{ color: COLORS.textMuted }}>Pendiente de autorización</span>}
                </div>
              </div>
              <button onClick={handleLogout} disabled={authBusy} style={{ padding: "6px 12px", borderRadius: 6, border: `1px solid ${COLORS.inputBorder}`, background: "transparent", color: COLORS.textDim, fontSize: 11, cursor: authBusy ? "wait" : "pointer", fontWeight: 600 }}>Salir</button>
            </>
          ) : (
            <>
              <button onClick={() => setShowLoginModal(true)} style={{ padding: "8px 14px", borderRadius: 8, border: `1.5px solid ${COLORS.accent}`, background: COLORS.accent, color: "#fff", fontSize: 12, cursor: "pointer", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 14 }}>🔐</span> Acceso clínico
              </button>
              <button onClick={handleLogin} disabled={authBusy} title="Iniciar sesión con Google (admin)" style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${COLORS.inputBorder}`, background: "transparent", color: COLORS.textDim, fontSize: 11, cursor: authBusy ? "wait" : "pointer", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13 }}>🅖</span> Google
              </button>
            </>
          )}
        </div>
      )}

      {/* Encabezado — composición editorial */}
      <div style={{ maxWidth: 560, margin: "0 auto 36px", textAlign: "center", padding: "0 8px" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <span aria-hidden="true" style={{ width: 22, height: 1, background: COLORS.accent, opacity: 0.7 }} />
          <span style={{ fontSize: 10, fontWeight: 600, color: COLORS.accent, letterSpacing: 3, textTransform: "uppercase", fontFamily: FONT_SANS }}>Cirugía de Columna</span>
          <span aria-hidden="true" style={{ width: 22, height: 1, background: COLORS.accent, opacity: 0.7 }} />
        </div>
        <h1 style={{ fontSize: "clamp(34px, 7vw, 48px)", fontWeight: 600, margin: "0 0 10px", fontFamily: FONT_SERIF, fontVariationSettings: "'opsz' 144, 'SOFT' 30", color: COLORS.ink, letterSpacing: "-0.025em", lineHeight: 1.02 }}>
          Calculadora <em style={{ fontStyle: "italic", fontWeight: 500, color: COLORS.accent, fontVariationSettings: "'opsz' 144, 'SOFT' 100" }}>GAP&nbsp;Score</em>
        </h1>
        <p style={{ fontSize: 13.5, color: COLORS.textDim, lineHeight: 1.55, maxWidth: 440, margin: "0 auto", fontFamily: FONT_SANS }}>
          Alineación global y proporción · análisis espinopélvico individualizado.
        </p>
        {firebaseEnabled && !user && (
          <div style={{ marginTop: 14, display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 12px", borderRadius: 999, background: COLORS.accentDim, border: `1px solid ${COLORS.accent}33`, fontSize: 11, color: COLORS.accentDark, fontWeight: 500 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS.accent }} />
            Calculadora abierta · inicia sesión para guardar
            {usageCount !== null && usageCount > 0 && (
              <span style={{ paddingLeft: 8, marginLeft: 4, borderLeft: `1px solid ${COLORS.accent}33`, fontFamily: FONT_MONO, fontWeight: 700 }}>
                {usageCount.toLocaleString("es-MX")} <span style={{ fontFamily: FONT_SANS, fontWeight: 500, opacity: 0.75 }}>mediciones</span>
              </span>
            )}
          </div>
        )}
      </div>

      <div style={{ maxWidth: 560, margin: "0 auto" }}>

        {/* Datos del caso */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h2 style={{ fontSize: 19, fontWeight: 600, margin: 0, color: COLORS.ink, fontFamily: FONT_SERIF, fontVariationSettings: "'opsz' 36, 'SOFT' 50", letterSpacing: "-0.01em" }}>📋 Datos del caso</h2>
            <button onClick={clearAll} style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${COLORS.inputBorder}`, background: "transparent", color: COLORS.textDim, fontSize: 12, cursor: "pointer" }}>Limpiar</button>
          </div>
          <TipoEvaluacionToggle value={tipoEvaluacion} onChange={setTipoEvaluacion} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <InputField label="Fecha del estudio" value={fechaEstudio} onChange={setFechaEstudio} type="date" unit="" />
            <InputField label="Fecha de cirugía" value={fechaCirugia} onChange={setFechaCirugia} type="date" unit="" />
          </div>
          <DiffInfoBox diffInfo={diffInfo} />
          {canEdit && (
            <>
              <SelectField label="Cirujano responsable" value={cirujanoSel} onChange={setCirujanoSel} options={[...CIRUJANOS, "Otro (especificar)"]} />
              {cirujanoSel === "Otro (especificar)" && <InputField label="Nombre del cirujano" value={cirujanoCustom} onChange={setCirujanoCustom} type="text" unit="" placeholder="DR. APELLIDO, NOMBRE" transform={normalizeName} maxLength={60} />}
              <SelectField label="Medición radiográfica realizada por" value={medidorSel} onChange={setMedidorSel}
                options={[...MEDIDORES, "Otro (especificar)"]} />
              {medidorSel === "Otro (especificar)" && (
                <InputField label="Nombre del medidor" value={medidorCustom} onChange={setMedidorCustom}
                  type="text" unit="" placeholder="APELLIDO NOMBRE" transform={normalizeName} maxLength={60} />
              )}
            </>
          )}
          {canEdit ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <InputField label="Apellidos" value={apellidos} onChange={setApellidos} type="text" unit="" placeholder="EJ: GARCIA LOPEZ" transform={normalizeName} maxLength={50} />
              <InputField label="Nombre" value={nombre} onChange={setNombre} type="text" unit="" placeholder="EJ: JUAN CARLOS" transform={normalizeName} maxLength={50} />
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 12, alignItems: "start" }}>
                <InputField label="Iniciales del paciente" value={iniciales} onChange={setIniciales} type="text" unit="" placeholder="EJ: JCR" transform={normalizeIniciales} maxLength={5} />
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>ID del caso</label>
                    <InfoTooltip text="Identificador auto-generado. Si guardas el caso, podrás recuperarlo después usando este ID desde cualquier dispositivo." />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", background: COLORS.inputBg, borderRadius: 8, border: `1.5px solid ${COLORS.inputBorder}`, overflow: "hidden" }}>
                    <span style={{ flex: 1, padding: "10px 12px", color: COLORS.accentDark, fontSize: 14, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, letterSpacing: 0.5, userSelect: "all" }}>{casoId}</span>
                    <button type="button" onClick={() => setCasoId(generarCasoId())} title="Generar nuevo ID" style={{ padding: "10px 12px", background: COLORS.inputHover, border: "none", borderLeft: `1px solid ${COLORS.inputBorder}`, color: COLORS.textDim, cursor: "pointer", fontSize: 14 }}>↻</button>
                  </div>
                </div>
              </div>
              <InputField label="Nombre del médico (opcional, solo para el reporte)" value={medicoPublic} onChange={setMedicoPublic} type="text" unit="" placeholder="DR. APELLIDO, NOMBRE" transform={normalizeName} maxLength={60} />
              {/* Cargar caso anterior */}
              <div style={{ marginTop: 4, padding: 12, borderRadius: 10, background: COLORS.inputHover, border: `1px dashed ${COLORS.inputBorder}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.textDim, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  🔎 ¿Tienes un ID de un caso anterior?
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text"
                    value={loadCaseIdInput}
                    onChange={e => setLoadCaseIdInput(e.target.value.toUpperCase())}
                    placeholder="GAP-2026-XXXX"
                    maxLength={13}
                    style={{ flex: 1, padding: "10px 12px", background: COLORS.inputBg, border: `1.5px solid ${COLORS.inputBorder}`, borderRadius: 8, color: COLORS.accentDark, fontSize: 14, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, letterSpacing: 0.5, outline: "none" }} />
                  <button onClick={loadPublicCase} disabled={loadingCase || !loadCaseIdInput} style={{ padding: "10px 18px", borderRadius: 8, border: `1.5px solid ${COLORS.accent}`, background: loadingCase || !loadCaseIdInput ? COLORS.inputBg : COLORS.accent, color: loadingCase || !loadCaseIdInput ? COLORS.textMuted : "#fff", fontSize: 13, fontWeight: 700, cursor: loadingCase ? "wait" : !loadCaseIdInput ? "not-allowed" : "pointer" }}>
                    {loadingCase ? "..." : "Cargar"}
                  </button>
                </div>
              </div>
            </>
          )}
          <InputField label="Edad del paciente" value={age} onChange={setAge} unit="años" min={15} max={90} list="ages-list" placeholder="15-90" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <InputField label="Peso" value={peso} onChange={setPeso} unit="kg" min={20} max={300} step="0.1" placeholder="Ej: 72.5" />
            <InputField label="Talla" value={talla} onChange={setTalla} unit="cm" min={100} max={230} placeholder="Ej: 170" />
          </div>
          <IMCBadge imc={imc} />
        </Card>

        {/* Cirugías */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h2 style={{ fontSize: 19, fontWeight: 600, margin: 0, color: COLORS.ink, fontFamily: FONT_SERIF, fontVariationSettings: "'opsz' 36, 'SOFT' 50", letterSpacing: "-0.01em" }}>{tipoEvaluacion === "preoperatorio" ? "🔧 Cirugías planificadas" : "🔧 Cirugías realizadas"}</h2>
            <button onClick={addCirugia} style={{ padding: "6px 14px", borderRadius: 8, border: `1.5px solid ${COLORS.accent}66`, background: COLORS.accentDim, color: COLORS.accentDark, fontSize: 12, cursor: "pointer", fontWeight: 700 }}>+ Agregar</button>
          </div>
          {cirugias.length === 0 && <div style={{ padding: 20, textAlign: "center", color: COLORS.textMuted, fontSize: 13, background: COLORS.inputHover, borderRadius: 10, border: `1px dashed ${COLORS.inputBorder}` }}>Toca <strong style={{ color: COLORS.accentDark }}>+ Agregar</strong> para registrar cirugías con sus segmentos.</div>}
          {cirugias.map((c, i) => <CirugiaCard key={c.id} cirugia={c} index={i} onUpdate={(n) => updateCirugia(c.id, n)} onRemove={() => removeCirugia(c.id)} />)}
        </Card>

        {/* Mediciones */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
            <h2 style={{ fontSize: 19, fontWeight: 600, margin: 0, color: COLORS.ink, fontFamily: FONT_SERIF, fontVariationSettings: "'opsz' 36, 'SOFT' 50", letterSpacing: "-0.01em" }}>📐 Medición GAP</h2>
            <button onClick={() => setShowAnnotator(true)} style={{ padding: "8px 14px", borderRadius: 8, border: `1.5px solid ${COLORS.accent}`, background: COLORS.accent, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 14 }}>📐</span> Medir desde radiografía
            </button>
          </div>
          <p style={{ fontSize: 11, color: COLORS.textMuted, margin: "0 0 14px" }}>
            Ingresa <strong>2 de 3</strong> entre PI · SS · PT y la app calcula el tercero (relación: <strong>PI = PT + SS</strong>).
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            <InputField label="Incidencia Pélvica (PI)" value={pi} onChange={setPI} min={0} max={120}
              placeholder={spinopelvic.derivedKey === "pi" && spinopelvic.effPI !== null ? spinopelvic.effPI.toFixed(1) : ""}
              tooltip="Parámetro morfológico fijo (no cambia con la postura). Ángulo entre la línea perpendicular al platillo superior de S1 en su punto medio y la línea que une ese punto con el centro del eje bicoxofemoral. Normal ≈ 50°. Relación: PI = SS + PT. (Legaye, Duval-Beaupère 1998)"
              tooltipFigure="/landmarks/angulo_pi.png" />
            <InputField label="Pendiente Sacra (SS)" value={ss} onChange={setSS} min={-30} max={90}
              placeholder={spinopelvic.derivedKey === "ss" && spinopelvic.effSS !== null ? spinopelvic.effSS.toFixed(1) : ""}
              tooltip="Parámetro postural. Ángulo entre el platillo superior de S1 y la horizontal. Aumenta con la anteversión pélvica y disminuye con la retroversión. Determina en buena medida la lordosis lumbar."
              tooltipFigure="/landmarks/angulo_ss.png" />
            <InputField label="Versión Pélvica (PT)" value={pt} onChange={setPT} min={-30} max={60}
              placeholder={spinopelvic.derivedKey === "pt" && spinopelvic.effPT !== null ? spinopelvic.effPT.toFixed(1) : ""}
              tooltip="Pelvic Tilt. Parámetro postural. Ángulo entre la vertical y la línea del centro del eje bicoxofemoral al centro del platillo superior de S1. Aumenta en retroversión pélvica (mecanismo compensatorio del desbalance sagital). Relación: PT = PI − SS."
              tooltipFigure="/landmarks/angulo_pt.png" />
          </div>
          {/* Banner de derivación / inconsistencia */}
          {(() => {
            if (spinopelvic.filledCount === 2 && spinopelvic.derivedKey) {
              const labels = { pi: { name: "PI", val: spinopelvic.effPI, formula: "SS + PT" }, ss: { name: "SS", val: spinopelvic.effSS, formula: "PI − PT" }, pt: { name: "PT", val: spinopelvic.effPT, formula: "PI − SS" } };
              const d = labels[spinopelvic.derivedKey];
              return (
                <div style={{ padding: "8px 12px", borderRadius: 8, background: COLORS.accentDim, border: `1px solid ${COLORS.accent}44`, fontSize: 12, color: COLORS.accentDark, marginTop: 4, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span>↻ <strong>{d.name}</strong> derivado automáticamente ({d.formula})</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{d.val.toFixed(1)}°</span>
                </div>
              );
            }
            if (spinopelvic.filledCount === 3 && spinopelvic.inconsistencyDelta !== null && Math.abs(spinopelvic.inconsistencyDelta) > 1) {
              return (
                <div style={{ padding: "8px 12px", borderRadius: 8, background: COLORS.yellowBg, border: `1px solid ${COLORS.yellow}66`, fontSize: 12, color: COLORS.yellow, marginTop: 4, marginBottom: 8, fontWeight: 600 }}>
                  ⚠️ Inconsistencia: PI debería = SS + PT (Δ {spinopelvic.inconsistencyDelta >= 0 ? "+" : ""}{spinopelvic.inconsistencyDelta.toFixed(1)}°). Revisa la medición.
                </div>
              );
            }
            if (spinopelvic.filledCount === 1) {
              return (
                <div style={{ padding: "8px 12px", borderRadius: 8, background: COLORS.inputHover, border: `1px dashed ${COLORS.inputBorder}`, fontSize: 11, color: COLORS.textMuted, marginTop: 4, marginBottom: 8, textAlign: "center" }}>
                  Ingresa al menos 2 de PI / SS / PT para que el GAP Score pueda calcularse.
                </div>
              );
            }
            return null;
          })()}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <InputField label="Lordosis L1-S1" value={l1s1} onChange={setL1S1} min={0} max={120}
              tooltip="Lordosis lumbar total. Ángulo de Cobb entre el platillo superior de L1 y el platillo superior de S1. Valor ideal depende de la PI. Meta GAP: 0.62·PI + 29°."
              tooltipFigure="/landmarks/angulo_l1s1.png" />
            <InputField label="Lordosis L4-S1" value={l4s1} onChange={setL4S1} min={0} max={90}
              tooltip="Lordosis lumbar distal. Ángulo de Cobb entre el platillo superior de L4 y el platillo superior de S1. Aporta ≈ 65% de la lordosis total. Base del Índice de Distribución (ILD = L4-S1 / L1-S1 × 100; normal 50–80%)."
              tooltipFigure="/landmarks/angulo_l4s1.png" />
          </div>
          <InputField label="Inclinación Global (GT)" value={gt} onChange={setGT} min={-30} max={70}
            tooltip="Global Tilt. Ángulo entre la vertical y la línea del centro del cuerpo vertebral de C7 al centro del eje bicoxofemoral. Mide el desbalance sagital global. Meta GAP: 0.48·PI − 15."
            tooltipFigure="/landmarks/angulo_gt.png" />
        </Card>

        {/* Eje T4-L1-Cadera (Hills 2022) — colapsable, opcional */}
        <Card>
          <button
            type="button"
            onClick={() => setHillsOpen(o => !o)}
            aria-expanded={hillsOpen}
            style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, padding: 0, background: "transparent", border: "none", cursor: "pointer", textAlign: "left", color: COLORS.ink }}>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: 19, fontWeight: 600, margin: "0 0 4px", color: COLORS.ink, fontFamily: FONT_SERIF, fontVariationSettings: "'opsz' 36, 'SOFT' 50", letterSpacing: "-0.01em" }}>🎯 Eje T4-L1-Cadera</h2>
              <p style={{ fontSize: 11, color: COLORS.textMuted, margin: 0 }}>
                Hills et al., Spine 2022 · <em>Opcional, complementa al GAP</em>
              </p>
            </div>
            <span aria-hidden="true" style={{ fontSize: 18, color: COLORS.textMuted, fontWeight: 700, transform: hillsOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.18s", lineHeight: 1, paddingTop: 4 }}>⌃</span>
          </button>
          {hillsOpen && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
                <button onClick={() => setShowAnnotator(true)} style={{ padding: "8px 14px", borderRadius: 8, border: `1.5px solid ${COLORS.accent}`, background: COLORS.accent, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 14 }}>📐</span> Medir desde radiografía
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <InputField label="L1 Pelvic Angle (L1PA)" value={l1pa} onChange={setL1PA} min={-30} max={40}
                  tooltip="Ángulo vertebro-pélvico de L1. Subtendido desde el eje bicoxofemoral al centro del platillo de S1 y al centroide del cuerpo de L1. Geométricamente: L1PA = Versión Pélvica + inclinación de L1. Parámetro relativamente fijo que captura magnitud y distribución de la lordosis. Normal ≈ 0.5·PI − 21°. (Hills, Spine 2022)"
                  tooltipFigure="/landmarks/angulo_gt.png" />
                <InputField label="T4 Pelvic Angle (T4PA)" value={t4pa} onChange={setT4PA} min={-30} max={40}
                  tooltip="Ángulo vertebro-pélvico de T4. Análogo al L1PA pero al centroide del cuerpo de T4. En columnas normales se alinea con el L1PA (diferencia < 4°), definiendo el eje T4-L1-cadera. Una diferencia > 4° indica desalineación torácica y activación de mecanismos compensatorios (retroversión pélvica, hipocifosis)."
                  tooltipFigure="/landmarks/cervical_t4.png" />
              </div>
              {hillsResult && (
                <div style={{ marginTop: 8 }}>
                  {/* L1PA ideal */}
                  <div style={{ padding: "10px 14px", borderRadius: 8, background: COLORS.accentDim, border: `1px solid ${COLORS.accent}44`, marginBottom: 10, fontSize: 12, color: COLORS.accentDark, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <span><strong>L1PA ideal</strong> = 0.5·PI − 21</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
                      {hillsResult.idealL1PA.toFixed(1)}°
                      <span style={{ color: Math.abs(hillsResult.l1paDiff) < 4 ? COLORS.green : Math.abs(hillsResult.l1paDiff) < 8 ? COLORS.yellow : COLORS.red, marginLeft: 8 }}>
                        (Δ {hillsResult.l1paDiff >= 0 ? "+" : ""}{hillsResult.l1paDiff.toFixed(1)}°)
                      </span>
                    </span>
                  </div>
                  {/* L1-S1 Hills ideal */}
                  <div style={{ padding: "10px 14px", borderRadius: 8, background: COLORS.purpleBg, border: `1px solid ${COLORS.purple}44`, marginBottom: 10, fontSize: 12, color: COLORS.purple, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <span><strong>L1-S1 ideal (Hills)</strong> = 1.4·PI − 1.7·L1PA − 2</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{hillsResult.idealLL_Hills.toFixed(1)}°</span>
                  </div>
                  {/* Semáforo eje T4-L1-Hip */}
                  {hillsResult.ejeDiff !== null && (() => {
                    const c = hillsResult.ejeStatus === "ok" ? COLORS.green : hillsResult.ejeStatus === "warn" ? COLORS.yellow : COLORS.red;
                    const bg = hillsResult.ejeStatus === "ok" ? COLORS.greenBg : hillsResult.ejeStatus === "warn" ? COLORS.yellowBg : COLORS.redBg;
                    return (
                      <div style={{ padding: "12px 14px", borderRadius: 8, background: bg, border: `1.5px solid ${c}44`, fontSize: 12, color: c, fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <span>🎯 {hillsResult.ejeLabel}</span>
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
                  Ingresa la Incidencia Pélvica (PI) y el L1PA para activar el análisis Hills.
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
              <h2 style={{ fontSize: 19, fontWeight: 600, margin: "0 0 4px", color: COLORS.ink, fontFamily: FONT_SERIF, fontVariationSettings: "'opsz' 36, 'SOFT' 50", letterSpacing: "-0.01em" }}>🦴 Tilts vertebrales</h2>
              <p style={{ fontSize: 11, color: COLORS.textMuted, margin: 0 }}>
                Hills 2022 · IC 80% poblacional · <em>opcional, complementa al GAP</em>
              </p>
            </div>
            <span aria-hidden="true" style={{ fontSize: 18, color: COLORS.textMuted, fontWeight: 700, transform: tiltsOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.18s", lineHeight: 1, paddingTop: 4 }}>⌃</span>
          </button>
          {tiltsOpen && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
                <button onClick={() => setShowAnnotator(true)} style={{ padding: "8px 14px", borderRadius: 8, border: `1.5px solid ${COLORS.accent}`, background: COLORS.accent, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 14 }}>📐</span> Medir desde radiografía
                </button>
              </div>
              <p style={{ fontSize: 11, color: COLORS.textMuted, margin: "0 0 12px" }}>
                Para cada nivel: mide el tilt directo en PACS o ingresa el Pelvic Angle correspondiente; la app deriva tilt = <strong>PA − PT</strong>.
              </p>
              {[
                { key: "c2", titulo: "C2", direct: c2tiltDirect, setDirect: setC2TiltDirect, pa: cpa, setPA: setCPA, paLabel: "C2 Pelvic Angle (CPA)", paTooltip: "Ángulo C2-pélvico: subtendido desde el eje bicoxofemoral al centro del platillo S1 y al centroide del cuerpo de C2. CPA = C2 tilt + PT.", directTooltip: "C2 tilt directo: ángulo entre la línea del eje bicoxofemoral al centroide del cuerpo de C2 y la vertical. Convención: positivo si C2 está anterior a las cabezas femorales, negativo si posterior. Normal: −4.4° a −1.1° (Hills 2022, IC 80%)." },
                { key: "t1", titulo: "T1", direct: t1tiltDirect, setDirect: setT1TiltDirect, pa: t1pa, setPA: setT1PA, paLabel: "T1 Pelvic Angle (T1PA)", paTooltip: "Ángulo T1-pélvico: análogo al CPA pero al centroide de T1. T1PA = T1 tilt + PT.", directTooltip: "T1 tilt directo: ángulo entre el eje bicoxofemoral al centroide de T1 y la vertical (positivo anterior, negativo posterior). Normal: −7.0° a −3.6° (Hills 2022, IC 80%)." },
                { key: "l1", titulo: "L1", direct: l1tiltDirect, setDirect: setL1TiltDirect, pa: l1pa, setPA: setL1PA, paLabel: "L1 Pelvic Angle (L1PA)", paTooltip: "L1PA = L1 tilt + PT. Mismo dato usado en el bloque Eje T4-L1-Cadera.", directTooltip: "L1 tilt directo: ángulo entre el eje bicoxofemoral al centroide de L1 y la vertical (positivo anterior, negativo posterior). Normal: −10.3° a −5.1° (Hills 2022, IC 80%)." }
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
                        label="Tilt directo"
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
                          <span style={{ fontWeight: 700 }}>{row.titulo} tilt · {r.cls.label}</span>
                        </div>
                        <div style={{ display: "flex", gap: 14, marginTop: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: COLORS.text, flexWrap: "wrap" }}>
                          {r.direct !== null && <span><strong>Directo:</strong> {r.direct.toFixed(1)}°</span>}
                          {r.derived !== null && <span><strong>Derivado (PA−PT):</strong> {r.derived.toFixed(1)}°</span>}
                          {r.delta !== null && (
                            <span style={{ color: Math.abs(r.delta) <= 1 ? COLORS.green : Math.abs(r.delta) <= 3 ? COLORS.yellow : COLORS.red }}>
                              <strong>Δ directo−derivado:</strong> {r.delta >= 0 ? "+" : ""}{r.delta.toFixed(1)}°
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
                  PT efectivo = {tiltsResult.pt.toFixed(1)}° {spinopelvic.derivedKey === "pt" ? "(derivado de PI − SS)" : ""}
                </div>
              ) : (
                <div style={{ fontSize: 11, color: COLORS.textMuted, fontStyle: "italic", marginTop: 4, textAlign: "center" }}>
                  Para el cálculo derivado se requieren PI y SS llenos (o PT directo).
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
              <h2 style={{ fontSize: 19, fontWeight: 600, margin: "0 0 4px", color: COLORS.ink, fontFamily: FONT_SERIF, fontVariationSettings: "'opsz' 36, 'SOFT' 50", letterSpacing: "-0.01em" }}>📊 Clasificación SRS-Schwab</h2>
              <p style={{ fontSize: 11, color: COLORS.textMuted, margin: 0 }}>
                Schwab 2012 · modificadores sagitales · <em>opcional, complementa al GAP</em>
              </p>
            </div>
            <span aria-hidden="true" style={{ fontSize: 18, color: COLORS.textMuted, fontWeight: 700, transform: schwabOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.18s", lineHeight: 1, paddingTop: 4 }}>⌃</span>
          </button>
          {schwabOpen && (
            <div style={{ marginTop: 14 }}>
              <p style={{ fontSize: 11, color: COLORS.textMuted, margin: "0 0 12px", lineHeight: 1.5 }}>
                Tres modificadores sagitales (Schwab et al., Spine 2012). <strong>PI−LL</strong> y <strong>PT</strong> se derivan de los parámetros espinopélvicos. <strong>SVA</strong> requiere medición directa en la radiografía (distancia horizontal del plomo desde el centro del cuerpo de C7 hasta el borde posterosuperior de S1).
              </p>
              <InputField
                label="SVA (Sagittal Vertical Axis)"
                value={sva}
                onChange={setSVA}
                unit="cm"
                min={-20} max={30} step={0.1}
                tooltip="Sagittal Vertical Axis: distancia horizontal entre el plomo trazado desde el centro del cuerpo de C7 y el borde posterosuperior de S1. Positivo si C7 está anterior a S1. Mide la alineación sagital global. Normal < 4 cm. (Schwab et al., Spine 2012)"
              />
              {[
                { key: "piLL", titulo: "PI − LL", subtitulo: "Mismatch lumbo-pélvico (deformidad regional)", val: schwabResult.piLLVal, grade: schwabResult.piLL, unit: "°", t0: "< 10°", t1: "10–20°", t2: "> 20°" },
                { key: "pt",   titulo: "PT",       subtitulo: "Pelvic Tilt (mecanismo compensatorio)",        val: schwabResult.ptVal,   grade: schwabResult.pt,   unit: "°", t0: "< 20°", t1: "20–30°", t2: "> 30°" },
                { key: "sva",  titulo: "SVA",      subtitulo: "Sagittal Vertical Axis (alineación global)",   val: schwabResult.svaVal,  grade: schwabResult.sva,  unit: " cm", t0: "< 4 cm", t1: "4–9.5 cm", t2: "> 9.5 cm" },
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
                  <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 4, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>Modificadores sagitales</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.ink, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.04em" }}>
                    PI−LL <span style={{ color: schwabResult.piLL.color }}>{schwabResult.piLL.g}</span> · PT <span style={{ color: schwabResult.pt.color }}>{schwabResult.pt.g}</span> · SVA <span style={{ color: schwabResult.sva.color }}>{schwabResult.sva.g}</span>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 11, color: COLORS.textMuted, fontStyle: "italic", marginTop: 4, textAlign: "center" }}>
                  Llena PI, L1-S1 y SVA para obtener la clasificación completa.
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
              <h2 style={{ fontSize: 19, fontWeight: 600, margin: "0 0 4px", color: COLORS.ink, fontFamily: FONT_SERIF, fontVariationSettings: "'opsz' 36, 'SOFT' 50", letterSpacing: "-0.01em" }}>🧬 Clasificación Roussouly</h2>
              <p style={{ fontSize: 11, color: COLORS.textMuted, margin: 0 }}>
                Laouissat 2017 · Sebaaly 2020 · Bari 2020 · <em>tipo actual, ideal y concordancia con la PI</em>
              </p>
            </div>
            <span aria-hidden="true" style={{ fontSize: 18, color: COLORS.textMuted, fontWeight: 700, transform: roussoulyOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.18s", lineHeight: 1, paddingTop: 4 }}>⌃</span>
          </button>
          {roussoulyOpen && (
            <div style={{ marginTop: 14 }}>
              <p style={{ fontSize: 11, color: COLORS.textMuted, margin: "0 0 12px", lineHeight: 1.5 }}>
                Tipos sagitales según <strong>SS</strong>, número de vértebras lordóticas y <strong>PT</strong> (algoritmo de Bari 2020, Fig. 2). Se calcula además el <strong>tipo ideal</strong> a restaurar (Fig. 3) y la concordancia con la <strong>PI</strong>: no restaurar la forma sagital multiplica ×3 el riesgo de complicación mecánica (Sebaaly 2020).
              </p>
              <InputField
                label="Vértebras lordóticas (NVL)"
                value={nvl}
                onChange={setNvl}
                unit="vért."
                min={0} max={12} step={1}
                tooltip="Número de vértebras incluidas en la lordosis: desde S1 hasta la vértebra del punto de inflexión. Sólo se usa cuando SS < 35°, para separar tipo 1 (≤ 3 vértebras, lordosis corta) de tipo 2 (> 3 vértebras, dorso plano). Media en población normal ≈ 6 (Sebaaly 2020)."
              />
              {roussoulyResult ? (
                <>
                  <div style={{ padding: 14, borderRadius: 10, background: roussoulyResult.bg, border: `1.5px solid ${roussoulyResult.color}66` }}>
                    <div style={{ fontSize: 10, color: COLORS.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Tipo actual</div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
                      <span style={{ fontSize: 28, fontWeight: 800, color: roussoulyResult.color, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.02em" }}>{roussoulyResult.type}</span>
                      <span style={{ fontSize: 15, fontWeight: 700, color: roussoulyResult.color }}>{roussoulyResult.label}</span>
                    </div>
                    <div style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: "'JetBrains Mono', monospace", marginBottom: 8 }}>{roussoulyResult.params}</div>
                    <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.5 }}>{roussoulyResult.desc}</div>
                    {roussoulyResult.uncertain === "nvl" && (
                      <div style={{ marginTop: 8, fontSize: 11, color: COLORS.yellow, lineHeight: 1.45 }}>
                        ⚠ Ingresa el número de vértebras lordóticas para separar tipo 1 de tipo 2.
                      </div>
                    )}
                    {roussoulyResult.uncertain === "piPt" && (
                      <div style={{ marginTop: 8, fontSize: 11, color: COLORS.yellow, lineHeight: 1.45 }}>
                        ⚠ Faltan PI y/o PT: no puede descartarse un tipo 3 anteverted (PI &lt; 50° y PT &lt; 5°).
                      </div>
                    )}
                  </div>

                  {roussoulyResult.ideal && (
                    <div style={{ marginTop: 10, padding: 14, borderRadius: 10, background: COLORS.inputHover, border: `1px solid ${COLORS.inputBorder}` }}>
                      <div style={{ fontSize: 10, color: COLORS.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                        {roussoulyResult.esPost ? "Tipo ideal · referencia orientativa" : "Tipo ideal · objetivo de corrección"}
                      </div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
                        <span style={{ fontSize: 24, fontWeight: 800, color: COLORS.text, fontFamily: "'JetBrains Mono', monospace" }}>{roussoulyResult.ideal.type}</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>{roussoulyResult.ideal.label}</span>
                        {roussoulyResult.ideal.same && (
                          <span style={{ fontSize: 11, color: COLORS.green, fontWeight: 700 }}>= tipo actual, mantener la forma</span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.5 }}>{roussoulyResult.ideal.desc}</div>
                      {roussoulyResult.esPost && (
                        <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 8, background: COLORS.inputBg, border: `1px solid ${COLORS.cardBorder}`, fontSize: 11, color: COLORS.textMuted, lineHeight: 1.45 }}>
                          Estudio <strong>postoperatorio</strong>: el algoritmo de la Fig. 3 parte del tipo <em>preoperatorio</em>, así que este objetivo derivado de la forma post-op es sólo orientativo. Para juzgar si el paciente quedó "restaurado", usa la concordancia con la PI de abajo, que sí se aplica directamente sobre la forma postoperatoria.
                        </div>
                      )}
                      {roussoulyResult.ideal.uncertain === "pt" && (
                        <div style={{ marginTop: 8, fontSize: 11, color: COLORS.yellow, lineHeight: 1.45 }}>
                          ⚠ Falta PT para definir entre tipo 3 (PT &lt; 25°) y tipo 4 (PT ≥ 25°).
                        </div>
                      )}
                      {roussoulyResult.ideal.inferred && (
                        <div style={{ marginTop: 8, fontSize: 11, color: COLORS.textMuted, lineHeight: 1.45 }}>
                          Rama no contemplada en la Fig. 3 de Bari (PI &lt; 50° con PT ≥ 5°): objetivo derivado de la regla por PI de Sebaaly 2020.
                        </div>
                      )}
                    </div>
                  )}

                  {roussoulyResult.piMatch && (
                    <div style={{ marginTop: 10, padding: "12px 14px", borderRadius: 10, background: roussoulyResult.piMatch.level === "ok" ? COLORS.greenBg : roussoulyResult.piMatch.level === "warn" ? COLORS.yellowBg : COLORS.redBg, border: `1.5px solid ${(roussoulyResult.piMatch.level === "ok" ? COLORS.green : roussoulyResult.piMatch.level === "warn" ? COLORS.yellow : COLORS.red)}66` }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: roussoulyResult.piMatch.level === "ok" ? COLORS.green : roussoulyResult.piMatch.level === "warn" ? COLORS.yellow : COLORS.red, marginBottom: 4 }}>
                        {roussoulyResult.piMatch.level === "ok"
                          ? (roussoulyResult.esPost ? "✓ Forma restaurada (concordante con la PI)" : "✓ Forma concordante con la PI")
                          : roussoulyResult.piMatch.level === "warn"
                            ? "⚠ Concordancia con reservas"
                            : (roussoulyResult.esPost ? "✕ Forma NO restaurada (discordante con la PI)" : "✕ Forma NO concordante con la PI")}
                      </div>
                      <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.5 }}>
                        PI {roussoulyResult.piMatch.piLow ? "< 50°" : "≥ 50°"} → se espera <strong>{roussoulyResult.piMatch.esperadoLabel}</strong>.
                        {roussoulyResult.piMatch.level === "bad" && " No restaurar la forma sagital según la PI se asoció a RR 3 (IC 1.5–4.3) de complicación mecánica (46.8% vs 22.5%, Sebaaly 2020) y OR 4.7 de revisión por falla mecánica (Bari 2020)."}
                        {roussoulyResult.piMatch.antevertedWarn && " El tipo 3 anteverted es una variante normal reconocida (Laouissat 2017), pero convertir quirúrgicamente una PI baja en un anteverted es un objetivo desfavorable: se asocia a mayor tasa de PJK."}
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 8, background: COLORS.inputHover, border: `1px solid ${COLORS.inputBorder}`, fontSize: 11, color: COLORS.textMuted, lineHeight: 1.55 }}>
                    <strong style={{ color: COLORS.text }}>Algoritmo de asignación (Bari 2020, Fig. 2):</strong><br/>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>SS &lt; 35° · NVL ≤ 3 → Tipo 1 (lordosis corta, apex L5)</span><br/>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>SS &lt; 35° · NVL &gt; 3 → Tipo 2 (dorso plano)</span><br/>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>35° ≤ SS &lt; 45° · PI &lt; 50° y PT &lt; 5° → Tipo 3-AP</span><br/>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>35° ≤ SS &lt; 45° · PI ≥ 50° ó PT ≥ 5° → Tipo 3</span><br/>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>SS ≥ 45° → Tipo 4</span><br/>
                    <strong style={{ color: COLORS.text }}>Tipo ideal (Fig. 3):</strong><br/>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>Tipo 1/2 · PI &lt; 50° → se mantiene · PI ≥ 50° → Tipo 3 ó 4</span><br/>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>Tipo 3 · PI &lt; 50° y PT &lt; 5° → 3-AP</span><br/>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>Tipo 3 · PI ≥ 50° → PT &lt; 25° = Tipo 3 · PT ≥ 25° = Tipo 4</span><br/>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>Tipo 4 → Tipo 4</span>
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 11, color: COLORS.textMuted, fontStyle: "italic", marginTop: 4, textAlign: "center" }}>
                  Llena SS (o PI + PT) para obtener la clasificación Roussouly.
                </div>
              )}
            </div>
          )}
        </Card>

        {/* GAP-B (Noh 2020) — colapsable, opcional */}
        <Card>
          <button
            type="button"
            onClick={() => setGapbOpen(o => !o)}
            aria-expanded={gapbOpen}
            style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, padding: 0, background: "transparent", border: "none", cursor: "pointer", textAlign: "left", color: COLORS.ink }}>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: 19, fontWeight: 600, margin: "0 0 4px", color: COLORS.ink, fontFamily: FONT_SERIF, fontVariationSettings: "'opsz' 36, 'SOFT' 50", letterSpacing: "-0.01em" }}>🦴 GAP-B</h2>
              <p style={{ fontSize: 11, color: COLORS.textMuted, margin: 0 }}>
                Noh 2020 · GAP + IMC + DMO · <em>predicción de complicaciones mecánicas</em>
              </p>
            </div>
            <span aria-hidden="true" style={{ fontSize: 18, color: COLORS.textMuted, fontWeight: 700, transform: gapbOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.18s", lineHeight: 1, paddingTop: 4 }}>⌃</span>
          </button>
          {gapbOpen && (
            <div style={{ marginTop: 14 }}>
              <p style={{ fontSize: 11, color: COLORS.textMuted, margin: "0 0 12px", lineHeight: 1.5 }}>
                Modificación del GAP score que añade <strong>IMC</strong> y <strong>DMO</strong> (T-score de columna o fémur, lo peor). AUC reportado 0.885 vs 0.798 del GAP original (Noh SH et al., Spine J 2020).
              </p>
              <InputField
                label="DMO (T-score peor de columna/fémur)"
                value={bmdTscore}
                onChange={setBmdTscore}
                unit=""
                min={-5} max={5} step={0.1}
                placeholder="Ej. -2.5"
                tooltip="T-score por DEXA (densitometría). Usar el peor valor entre columna lumbar y fémur. Normal ≥ -1, osteopenia -1 a -2.5, osteoporosis ≤ -2.5. Si no tienes T-score reciente, deja en blanco."
              />
              <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 8, background: COLORS.inputHover, border: `1px solid ${COLORS.inputBorder}`, fontSize: 12, color: COLORS.text }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, fontFamily: "'JetBrains Mono', monospace" }}>
                  <div>
                    <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 2 }}>IMC</div>
                    <div style={{ fontWeight: 700, color: imc && imc.valor ? COLORS.text : COLORS.textMuted }}>{imc && imc.valor ? `${Number(imc.valor).toFixed(1)} kg/m²` : "—"}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 2 }}>GAP</div>
                    <div style={{ fontWeight: 700, color: result ? COLORS.text : COLORS.textMuted }}>{result ? `${result.total} pts` : "—"}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 2 }}>T-score</div>
                    <div style={{ fontWeight: 700, color: bmdTscore !== "" ? COLORS.text : COLORS.textMuted }}>{bmdTscore !== "" ? Number(bmdTscore).toFixed(1) : "—"}</div>
                  </div>
                </div>
                {(!imc || !imc.valor || !result || bmdTscore === "") && (
                  <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 6, fontStyle: "italic" }}>
                    Faltan: {[!imc || !imc.valor ? "peso/talla" : null, !result ? "GAP completo" : null, bmdTscore === "" ? "T-score DMO" : null].filter(Boolean).join(" · ")}
                  </div>
                )}
              </div>
              {gapbResult ? (
                <div style={{ padding: 14, borderRadius: 10, background: gapbResult.cat.bg, border: `1.5px solid ${gapbResult.cat.color}66` }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: 28, fontWeight: 800, color: gapbResult.cat.color, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.02em" }}>{(gapbResult.prob * 100).toFixed(0)}%</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: gapbResult.cat.color }}>{gapbResult.cat.label}</span>
                  </div>
                  <div style={{ fontSize: 11, color: COLORS.textMuted, lineHeight: 1.5 }}>
                    Probabilidad estimada de complicación mecánica postoperatoria (PJK/PJF, fractura de varilla o falla de implante) a 2 años, basada en la regresión logística de Noh 2020.
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 11, color: COLORS.textMuted, fontStyle: "italic", marginTop: 4, textAlign: "center" }}>
                  Llena peso, talla, los parámetros del GAP y el T-score de DMO para obtener la predicción GAP-B.
                </div>
              )}
              <div style={{ marginTop: 10, fontSize: 10, color: COLORS.textMuted, lineHeight: 1.45, fontStyle: "italic" }}>
                ⚠ Aproximación logística derivada de los HR multivariables publicados (BMI 1.284 · BMD 0.277 · GAP 1.457). El nomograma original de Noh 2020 (Fig. 2) es la referencia clínica formal. No sustituye juicio clínico.
              </div>
            </div>
          )}
        </Card>

        {/* Fotos — solo en modo clínico (los datos se asocian a un paciente identificado) */}
        {canEdit && (
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ fontSize: 19, fontWeight: 600, margin: 0, color: COLORS.ink, fontFamily: FONT_SERIF, fontVariationSettings: "'opsz' 36, 'SOFT' 50", letterSpacing: "-0.01em" }}>📸 Imágenes ({fotos.length})</h2>
              <label style={{ padding: "6px 14px", borderRadius: 8, border: `1.5px solid ${COLORS.purple}66`, background: COLORS.purpleBg, color: COLORS.purple, fontSize: 12, cursor: "pointer", fontWeight: 700 }}>
                + Agregar fotos
                <input type="file" accept="image/*" multiple capture="environment" onChange={handleFotos} style={{ display: "none" }} />
              </label>
            </div>
            {fotos.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: COLORS.textMuted, fontSize: 13, background: COLORS.inputHover, borderRadius: 10, border: `1px dashed ${COLORS.inputBorder}` }}>Sube radiografías. Se comprimen automáticamente.</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
                {fotos.map(f => (
                  <div key={f.id} style={{ position: "relative", background: COLORS.inputHover, borderRadius: 10, overflow: "hidden", border: `1px solid ${COLORS.inputBorder}` }}>
                    <img src={f.dataUrl} alt={f.name} style={{ width: "100%", height: 110, objectFit: "cover", display: "block" }} />
                    <button onClick={() => removeFoto(f.id)} style={{ position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: "50%", border: "none", background: "rgba(185,28,28,0.9)", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>×</button>
                    <select value={f.categoria} onChange={e => updateFotoCat(f.id, e.target.value)} style={{ width: "100%", padding: "6px 8px", background: COLORS.card, border: "none", borderTop: `1px solid ${COLORS.inputBorder}`, color: COLORS.text, fontSize: 11, outline: "none", cursor: "pointer" }}>
                      {CATEGORIAS_FOTO.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Mis casos guardados (modo público, desde localStorage) */}
        {!canEdit && myPublicCases.length > 0 && (
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: COLORS.text }}>📂 Mis casos guardados ({myPublicCases.length})</h2>
              <span style={{ fontSize: 10, color: COLORS.textMuted, fontStyle: "italic" }}>solo en este dispositivo</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 240, overflowY: "auto" }}>
              {myPublicCases.map(c => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: COLORS.inputHover, borderRadius: 8, border: `1px solid ${COLORS.inputBorder}` }}>
                  <span style={{ flex: 1, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: COLORS.accentDark }}>{c.id}</span>
                  <span style={{ fontSize: 10, color: COLORS.textMuted }}>{c.fechaCaso ? new Date(c.fechaCaso).toLocaleDateString("es-MX", { day: "2-digit", month: "short" }) : ""}</span>
                  {c.tipoEvaluacion && <MomentoBadge tipo={c.tipoEvaluacion} />}
                  {typeof c.gapTotal === "number" && <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.text }}>{c.gapTotal}/13</span>}
                  <button onClick={() => loadPublicCase(c.id)} style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${COLORS.accent}66`, background: COLORS.accentDim, color: COLORS.accentDark, fontSize: 11, cursor: "pointer", fontWeight: 700 }}>Cargar</button>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Suscripción a actualizaciones — solo modo público */}
        {!canEdit && firebaseEnabled && (
          <Card>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: subDone ? 0 : 14 }}>
              <div style={{ fontSize: 22, lineHeight: 1 }}>📬</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, marginBottom: 4 }}>
                  Recibe avisos de nuevas funciones
                </div>
                <p style={{ fontSize: 12, color: COLORS.textDim, lineHeight: 1.5, margin: 0 }}>
                  Tu correo solo se usará para enviarte actualizaciones de la calculadora. No se comparte con terceros.
                </p>
              </div>
            </div>
            {subDone ? (
              <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, background: COLORS.greenBg, border: `1px solid ${COLORS.green}44`, fontSize: 12, color: COLORS.green, fontWeight: 600, textAlign: "center" }}>
                ✓ Gracias, te avisaremos cuando haya novedades.
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, alignItems: "end" }}>
                <InputField label="Nombre" value={subName} onChange={setSubName} type="text" placeholder="Dr. Apellido" unit="" />
                <InputField label="Correo electrónico" value={subEmail} onChange={setSubEmail} type="text" placeholder="tu@correo.com" unit="" />
                <button
                  onClick={submitSubscribe}
                  disabled={subBusy}
                  style={{ gridColumn: "1 / -1", padding: "10px 16px", borderRadius: 8, border: `1.5px solid ${COLORS.accent}`, background: subBusy ? COLORS.inputHover : COLORS.accent, color: subBusy ? COLORS.textMuted : "#fff", fontSize: 13, fontWeight: 700, cursor: subBusy ? "wait" : "pointer", marginTop: 4 }}>
                  {subBusy ? "Registrando..." : "Suscribirme"}
                </button>
              </div>
            )}
          </Card>
        )}

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
              {result.cat.label}
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: COLORS.textDim, fontFamily: FONT_SANS }}>Riesgo: {result.cat.risk}</div>
          </div>
        )}

        {/* Exportar */}
        <Card style={{ padding: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 4px", color: COLORS.text }}>Exportar y guardar</h2>
          <p style={{ fontSize: 11, color: COLORS.textMuted, margin: "0 0 14px" }}>{result ? "Resultado listo para exportar" : hasAnyMeasurement ? "Mediciones parciales · el PDF incluirá solo lo medido" : "⚠ Ingresa al menos una medición para habilitar exportación"}</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <ShareButton icon="📄" label="PDF" color={COLORS.accent} bg={COLORS.accentDim} onClick={handleDownload} disabled={!hasAnyMeasurement} />
            <ShareButton icon="✉️" label="Correo" color={COLORS.purple} bg={COLORS.purpleBg} onClick={handleEmail} disabled={!hasAnyMeasurement} />
          </div>
          {(() => {
            const isPublic = !canEdit;
            const needsLogin = firebaseEnabled && !user;
            const pendingAuth = firebaseEnabled && user && !allowlisted;
            const pendingConsent = firebaseEnabled && user && allowlisted && !consentAccepted;
            const hardDisabled = !result || saving || (saved && !isPublic) || pendingAuth;
            const onClick = isPublic ? () => savePublicCase() : saveCaso;
            const label = saving ? "⏳ Guardando..."
              : (saved && isPublic && savedPublicCaseId) ? `✅ Guardado · ${savedPublicCaseId}`
              : saved ? "✅ Caso guardado"
              : !firebaseEnabled ? "💾 Guardar localmente"
              : isPublic ? "💾 Guardar caso (recuperable con su ID)"
              : pendingAuth ? "⏳ Cuenta pendiente de autorización"
              : pendingConsent ? "📝 Aceptar consentimiento y guardar"
              : "💾 Guardar caso en Firebase";
            const bgColor = saved ? COLORS.greenBg
              : hardDisabled ? COLORS.inputHover
              : isPublic ? COLORS.accentDim
              : needsLogin ? COLORS.accentDim
              : pendingConsent ? COLORS.yellowBg
              : COLORS.yellowBg;
            const fgColor = saved ? COLORS.green
              : hardDisabled ? COLORS.textMuted
              : isPublic ? COLORS.accentDark
              : needsLogin ? COLORS.accentDark
              : pendingConsent ? COLORS.yellow
              : COLORS.yellow;
            const borderColor = saved ? COLORS.green + "66"
              : hardDisabled ? COLORS.inputBorder
              : isPublic ? COLORS.accent + "66"
              : needsLogin ? COLORS.accent + "66"
              : COLORS.yellow + "66";
            return (
              <>
                <button onClick={onClick} disabled={hardDisabled} style={{
                  width: "100%", padding: "12px", borderRadius: 10,
                  border: `1.5px solid ${borderColor}`,
                  background: bgColor, color: fgColor,
                  fontSize: 14, fontWeight: 700,
                  cursor: hardDisabled ? "not-allowed" : "pointer",
                  opacity: hardDisabled ? 0.55 : 1
                }}>
                  {label}
                </button>
                {isPublic && saved && savedPublicCaseId && (
                  <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 8, background: COLORS.greenBg, border: `1px solid ${COLORS.green}44`, fontSize: 12, color: COLORS.green, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <span>Guarda este ID para recuperar el caso después:</span>
                    <button onClick={() => { try { navigator.clipboard.writeText(savedPublicCaseId); showToast("ID copiado ✓"); } catch (e) {} }} style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${COLORS.green}66`, background: COLORS.card, color: COLORS.green, fontSize: 12, cursor: "pointer", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>📋 {savedPublicCaseId}</button>
                  </div>
                )}
              </>
            );
          })()}
        </Card>

        {/* Encuesta de satisfacción + sugerencias (one-time, requiere haber calculado al menos una vez) */}
        {result && !feedbackDone && firebaseEnabled && (
          <Card>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
              <div style={{ fontSize: 22, lineHeight: 1 }}>💬</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, marginBottom: 4 }}>
                  ¿Qué te pareció la calculadora?
                </div>
                <p style={{ fontSize: 12, color: COLORS.textDim, lineHeight: 1.5, margin: 0 }}>
                  Tu opinión es anónima y nos ayuda a mejorar. Esta encuesta solo aparece una vez.
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
              placeholder="Sugerencias o comentarios (opcional, máx 500 caracteres)"
              maxLength={500}
              style={{ width: "100%", minHeight: 70, padding: "10px 12px", background: COLORS.inputBg, border: `1.5px solid ${COLORS.inputBorder}`, borderRadius: 8, color: COLORS.text, fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: "none", resize: "vertical", boxSizing: "border-box" }} />
            <button
              onClick={submitFeedback}
              disabled={feedbackBusy || !feedbackRating}
              style={{ width: "100%", marginTop: 10, padding: "10px 16px", borderRadius: 8, border: `1.5px solid ${feedbackRating ? COLORS.accent : COLORS.inputBorder}`, background: feedbackBusy ? COLORS.inputHover : feedbackRating ? COLORS.accent : COLORS.inputBg, color: feedbackBusy ? COLORS.textMuted : feedbackRating ? "#fff" : COLORS.textMuted, fontSize: 13, fontWeight: 700, cursor: feedbackBusy ? "wait" : feedbackRating ? "pointer" : "not-allowed", opacity: feedbackBusy ? 0.7 : 1 }}>
              {feedbackBusy ? "Enviando..." : feedbackRating ? `Enviar opinión (${feedbackRating}★)` : "Selecciona una calificación"}
            </button>
          </Card>
        )}

        {/* Parámetros y planificación */}
        {result && (
          <>
            <Card>
              <h2 style={{ fontSize: 19, fontWeight: 600, margin: "0 0 4px", color: COLORS.ink, fontFamily: FONT_SERIF, fontVariationSettings: "'opsz' 36, 'SOFT' 50", letterSpacing: "-0.01em" }}>Parámetros GAP</h2>
              <p style={{ fontSize: 12, color: COLORS.textMuted, margin: "0 0 12px" }}>RPV · RLL · ILD · ASR · FE</p>
              <ParamRow name="RPV" diff={result.rpv.diff} score={result.rpv.score} label={result.rpv.label} sub={result.rpv.sub} maxScore={3} />
              <ParamRow name="RLL" diff={result.rll.diff} score={result.rll.score} label={result.rll.label} sub={result.rll.sub} maxScore={3} />
              <ParamRow name="ILD" diff={undefined} score={result.ldi.score} label={`${result.ldi.value.toFixed(1)}% — ${result.ldi.label}`} sub={result.ldi.sub} maxScore={3} />
              <ParamRow name="ASR" diff={result.rsa.diff} score={result.rsa.score} label={result.rsa.label} sub={result.rsa.sub} maxScore={3} />
              <ParamRow name="FE" diff={undefined} score={result.af.score} label={result.af.label} sub={result.af.sub} maxScore={1} />
            </Card>
            <Card>
              <h2 style={{ fontSize: 19, fontWeight: 600, margin: "0 0 4px", color: COLORS.ink, fontFamily: FONT_SERIF, fontVariationSettings: "'opsz' 36, 'SOFT' 50", letterSpacing: "-0.01em" }}>Planificación Preoperatoria</h2>
              <p style={{ fontSize: 11, color: COLORS.textMuted, margin: "0 0 14px" }}>Valores ideales según Yilgor et al. 2017 · L4-S1 ideal = L1-S1 × 0.65{hillsResult && " · Hills 2022 añade target normativo"}</p>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr style={{ borderBottom: `2px solid ${COLORS.cardBorder}` }}>{["Parámetro", "Actual", "Ideal", "Corrección"].map(h => <th key={h} style={{ padding: "8px 10px", textAlign: h === "Parámetro" ? "left" : "right", fontWeight: 700, color: COLORS.textDim, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>{h}</th>)}</tr></thead>
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

        {/* Casos guardados (solo modo clínico) */}
        {canEdit && (
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ fontSize: 19, fontWeight: 600, margin: 0, color: COLORS.ink, fontFamily: FONT_SERIF, fontVariationSettings: "'opsz' 36, 'SOFT' 50", letterSpacing: "-0.01em" }}>🗄️ Casos guardados</h2>
            <button onClick={() => setShowCasos(!showCasos)} style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${COLORS.inputBorder}`, background: "transparent", color: COLORS.textDim, fontSize: 12, cursor: "pointer" }}>{showCasos ? "Ocultar" : "Ver todos"}</button>
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {[{ v: "todos", l: "Todos", c: conteos.todos }, { v: "preoperatorio", l: "🔵 Pre-op", c: conteos.preoperatorio }, { v: "postoperatorio", l: "🟢 Post-op", c: conteos.postoperatorio }].map(t => (
              <button key={t.v} onClick={() => setFiltroTipo(t.v)} style={{ flex: 1, padding: "6px 8px", borderRadius: 6, border: `1px solid ${filtroTipo === t.v ? COLORS.accent : COLORS.inputBorder}`, background: filtroTipo === t.v ? COLORS.accentDim : "transparent", color: filtroTipo === t.v ? COLORS.accentDark : COLORS.textDim, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                {t.l} ({t.c})
              </button>
            ))}
          </div>
          {showCasos && casosFiltrados.length > 0 && (
            <div style={{ maxHeight: 350, overflowY: "auto", marginBottom: 12 }}>
              {casosFiltrados.map(c => {
                const pacDisplay = c.paciente?.completo || c.paciente || "Sin nombre";
                const fechaDisplay = c.fechaEstudio ? new Date(c.fechaEstudio + "T00:00:00").toLocaleDateString("es-MX") : new Date(c.fecha).toLocaleDateString("es-MX");
                return (
                  <div key={c.id} style={{ padding: 10, background: COLORS.inputHover, borderRadius: 8, marginBottom: 6, border: `1px solid ${COLORS.inputBorder}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div style={{ fontSize: 12, color: COLORS.text, flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2, flexWrap: "wrap" }}>
                          <strong>{pacDisplay}</strong>
                          <span style={{ color: COLORS.textMuted }}>· {c.edad} años</span>
                          {c.imc && <span style={{ color: COLORS.textMuted, fontSize: 11 }}>· IMC {c.imc.valor.toFixed(1)}</span>}
                          {c.tipoEvaluacion && <MomentoBadge tipo={c.tipoEvaluacion} />}
                        </div>
                        <div style={{ color: COLORS.textMuted, fontSize: 11 }}>
                          📅 {fechaDisplay}
                          {c.tiempoCalculado && <> · ⏱️ {c.tiempoCalculado}</>}
                          <> · GAP: <strong style={{ color: COLORS.accentDark }}>{c.resultado.total}/13</strong> · {c.resultado.categoria}</>
                        </div>
                        {((c.fotos?.length || 0) > 0) && <div style={{ fontSize: 11, color: COLORS.purple, marginTop: 2 }}>📸 {c.fotos.length}</div>}
                      </div>
                      <button onClick={() => deleteCaso(c.id)} style={{ padding: "2px 8px", borderRadius: 4, border: `1px solid ${COLORS.red}44`, background: "transparent", color: COLORS.red, fontSize: 10, cursor: "pointer" }}>🗑</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {showCasos && casosFiltrados.length === 0 && <div style={{ padding: 20, textAlign: "center", color: COLORS.textMuted, fontSize: 12, background: COLORS.inputHover, borderRadius: 8 }}>No hay casos en este filtro.</div>}
          {casosGuardados.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
              <button onClick={exportCSV} style={{ padding: "10px", borderRadius: 8, border: `1.5px solid ${COLORS.green}66`, background: COLORS.greenBg, color: COLORS.green, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>📊 Exportar CSV</button>
              <button onClick={exportJSON} style={{ padding: "10px", borderRadius: 8, border: `1.5px solid ${COLORS.accent}66`, background: COLORS.accentDim, color: COLORS.accentDark, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>📥 Exportar JSON</button>
            </div>
          )}
          <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 10, lineHeight: 1.5 }}>
            🔒 Solo tú ves los casos que guardas. Sincronizado con Firebase.
            <br />CSV se abre directo en Numbers o Excel. JSON sirve para entrenamiento de IA.
          </div>
        </Card>
        )}

        {/* Disclaimer — nota editorial */}
        <div style={{ padding: "16px 20px", marginBottom: 16, fontSize: 12, color: COLORS.textDim, lineHeight: 1.6, textAlign: "center", borderTop: `1px solid ${COLORS.rule}`, borderBottom: `1px solid ${COLORS.rule}` }}>
          <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 999, fontSize: 9, fontWeight: 600, letterSpacing: 2.5, textTransform: "uppercase", color: COLORS.secondary, background: COLORS.secondaryDim, marginBottom: 8, fontFamily: FONT_SANS }}>
            Aviso
          </span>
          <div style={{ fontFamily: FONT_SERIF, fontStyle: "italic", fontVariationSettings: "'opsz' 24, 'SOFT' 100", fontSize: 13, color: COLORS.text }}>
            Esta es únicamente una herramienta de cálculo y no representa una recomendación clínica.
          </div>
          <div style={{ marginTop: 4, fontSize: 11, color: COLORS.textMuted }}>
            Su uso es responsabilidad del médico que la utilice.
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
            <span>📚 Bibliografía ({REFERENCIAS.length})</span>
            <span style={{ fontSize: 12, color: COLORS.textMuted, fontWeight: 600 }}>{showBiblio ? "▲ Ocultar" : "▼ Mostrar"}</span>
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
            Una aplicación de
          </span>
          <img
            src="/vml-logo.png"
            alt="Virtual Medical Learning"
            style={{ width: 88, height: "auto", objectFit: "contain" }} />
          <span style={{ fontSize: 11, color: COLORS.textMuted, textAlign: "center", lineHeight: 1.4, fontFamily: FONT_SERIF, fontStyle: "italic", fontVariationSettings: "'opsz' 18" }}>
            vml.solutions
          </span>
        </a>
      </div>

      {showConsentModal && user && (
        <ConsentModal
          onAccept={acceptConsent}
          onReject={rejectConsent}
          userEmail={user.email}
          busy={authBusy}
        />
      )}

      {showPublicConsentModal && (
        <PublicConsentModal
          onAccept={acceptPublicConsent}
          onCancel={() => setShowPublicConsentModal(false)}
          busy={saving}
        />
      )}

      {showPdfSaveModal && (
        <PdfSaveModal
          busy={saving}
          onSaveAndDownload={() => {
            setShowPdfSaveModal(false);
            setPendingDownloadAfterSave(true);
            savePublicCase();
          }}
          onDownloadOnly={() => { setShowPdfSaveModal(false); triggerDownload(); }}
          onCancel={() => setShowPdfSaveModal(false)}
        />
      )}

      {showLoginModal && (
        <EmailLoginModal
          email={loginEmail}
          password={loginPwd}
          onEmailChange={setLoginEmail}
          onPasswordChange={setLoginPwd}
          onSubmit={handleEmailLogin}
          onCancel={() => { setShowLoginModal(false); setLoginError(""); setLoginEmail(""); setLoginPwd(""); }}
          error={loginError}
          busy={authBusy}
        />
      )}

      <LandmarkAnnotator
        open={showAnnotator}
        onClose={() => setShowAnnotator(false)}
        canEdit={canEdit}
        onSaveAnnotated={(dataUrl) => {
          const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
          const foto = { id: uid(), name: `anotada_${stamp}.jpg`, dataUrl, categoria: "Radiografía anotada" };
          setFotos(prev => [...prev, foto]);
          showToast("Imagen anotada agregada al caso ✓");
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
          const count = Object.keys(v).length;
          showToast(`${count} medición${count === 1 ? "" : "es"} aplicada${count === 1 ? "" : "s"} al formulario ✓`);
        }}
      />
      </div>
    </div>
  );
}
