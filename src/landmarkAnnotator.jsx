import { useState, useRef, useEffect, useMemo } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { midpoint, distance, angleAtVertex, computePI, computeSS, computePT, computeL1S1, computeL4S1, computeGT, computePA, computeVertebralTilt, linePairAngle } from "./geometry";
import { makeGeometry, MEASUREMENT_KEYS } from "./data/landmarks";
import { LANDMARK_DEFS } from "./landmarkDefs";

const COLORS = {
  bg: "#1a1a1a",
  panel: "#262626",
  panelLight: "#333",
  text: "#f1f5f9",
  textDim: "#94a3b8",
  accent: "#a8927a",
  green: "#10b981",
  yellow: "#f59e0b",
  red: "#ef4444",
  cyan: "#22d3ee",
  pink: "#f472b6"
};

// Definiciones de ángulos calculados — explicación + esquema para el desplegable
// "¿Cómo se calcula?" en el panel derecho.
const ANGLE_DEFS = {
  pi: {
    label: "PI",
    fullName: "Pelvic Incidence · Incidencia Pélvica",
    explicacion: "Ángulo entre la perpendicular al platillo superior de S1 (en su punto medio) y la línea S1 mid → centro bicoxofemoral. Es una constante anatómica de cada persona: no cambia con la postura. Por identidad geométrica, PI = PT + SS siempre.",
    figureSrc: "/landmarks/angulo_pi.png"
  },
  ss: {
    label: "SS",
    fullName: "Sacral Slope · Pendiente Sacra",
    explicacion: "Inclinación del platillo superior de S1 respecto a la horizontal real. Valor típico 30–50°. Refleja la posición postural del sacro: aumenta al inclinar la pelvis hacia adelante.",
    figureSrc: "/landmarks/angulo_ss.png"
  },
  pt: {
    label: "PT",
    fullName: "Pelvic Tilt · Versión Pélvica",
    explicacion: "Ángulo entre la vertical y la línea fémur mid → S1 mid. Valor típico 5–20°. Refleja la rotación pélvica: aumenta como mecanismo compensador frente a desbalance sagital.",
    figureSrc: "/landmarks/angulo_pt.png"
  },
  l1s1: {
    label: "L1–S1",
    fullName: "Lordosis Lumbar Total",
    explicacion: "Ángulo de Cobb entre el platillo superior de L1 y el platillo superior de S1. Es la lordosis lumbar total. El target ideal individual depende de la PI (≈ 0.62·PI + 29).",
    figureSrc: "/landmarks/angulo_l1s1.png"
  },
  l4s1: {
    label: "L4–S1",
    fullName: "Lordosis Distal",
    explicacion: "Ángulo de Cobb entre el platillo superior de L4 y el platillo superior de S1. Captura los segmentos lumbares más caudales, donde reside ≈65% de la lordosis total en una columna fisiológica.",
    figureSrc: "/landmarks/angulo_l4s1.png"
  },
  gt: {
    label: "GT",
    fullName: "Global Tilt · Inclinación Global",
    explicacion: "Ángulo en fémur mid entre las rectas fémur mid → C7 y fémur mid → S1 mid. Mide el desbalance global del tronco respecto a la pelvis. 0° cuando C7, S1 mid y eje bicoxofemoral son colineales.",
    figureSrc: "/landmarks/angulo_gt.png"
  }
};

const HILLS_DEFS = {
  l1pa: {
    label: "L1PA",
    fullName: "L1 Pelvic Angle (Hills 2022)",
    explicacion: "Ángulo en fémur mid entre la línea al centroide de L1 y la línea a S1 mid, con signo (positivo si L1 cae anterior al eje fémur–S1). Es el target normativo propuesto por Hills 2022: L1PA ideal ≈ 0.5·PI − 21.",
    figureSrc: "/landmarks/angulo_gt.png"
  },
  t4pa: {
    label: "T4PA",
    fullName: "T4 Pelvic Angle (Hills 2022)",
    explicacion: "Análogo a L1PA pero usando el centroide de T4. En una columna alineada T4PA ≈ L1PA (eje T4–L1–cadera alineado). Una diferencia |T4PA − L1PA| > 4° sugiere desalineación cefálica.",
    figureSrc: "/landmarks/cervical_t4.png"
  },
  c2tilt: {
    label: "C2 tilt",
    fullName: "Tilt vertebral C2 (Hills 2022)",
    explicacion: "Ángulo desde la vertical real de la línea fémur mid → centroide C2. Rango normal: −4.4° a −1.1° (ligeramente posterior al eje bicoxofemoral). Fuera del intervalo indica compensación cervical.",
    figureSrc: "/landmarks/cervical_t4.png"
  },
  t1tilt: {
    label: "T1 tilt",
    fullName: "Tilt vertebral T1 (Hills 2022)",
    explicacion: "Ángulo desde la vertical real de la línea fémur mid → centroide T1. Rango normal: −7.0° a −3.6°. Valores positivos sugieren desbalance torácico anterior.",
    figureSrc: "/landmarks/cervical_t4.png"
  },
  l1tilt: {
    label: "L1 tilt",
    fullName: "Tilt vertebral L1 (Hills 2022)",
    explicacion: "Ángulo desde la vertical real de la línea fémur mid → centroide L1. Rango normal: −10.3° a −5.1°. Útil como complemento al L1PA para evaluar la posición del ápex lordótico.",
    figureSrc: "/landmarks/angulo_l1s1.png"
  }
};

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const round1 = (n) => Math.round(n * 10) / 10;

export default function LandmarkAnnotator({ open, onClose, onApply, canEdit, onSaveAnnotated }) {
  const [imageSrc, setImageSrc] = useState(null);
  const [imageDims, setImageDims] = useState({ w: 0, h: 0 });
  // Identidad del archivo cargado. Sin ella, unas coordenadas en píxeles no se
  // pueden asociar después a la placa de la que salieron.
  const [imageName, setImageName] = useState(null);

  // GAP + Hills landmarks (9 obligatorios + 3 opcionales = 12).
  const [landmarks, setLandmarks] = useState(Array(LANDMARK_DEFS.length).fill(null));
  const [step, setStep] = useState(0);
  const [draggingLandmarkIdx, setDraggingLandmarkIdx] = useState(null);

  // Mediciones libres: puntos compartibles + segmentos que los conectan
  const [freePts, setFreePts] = useState([]); // { id, x, y }
  const [freeSegs, setFreeSegs] = useState([]); // { id, aId, bId }
  const [pendingPtId, setPendingPtId] = useState(null); // primer endpoint del segmento en construcción
  const [draggingFreePtId, setDraggingFreePtId] = useState(null);

  // Tool actual
  const [tool, setTool] = useState("gap"); // gap | line | calibrate | horizontal | pan
  const [gapMode, setGapMode] = useState("wizard"); // wizard | free

  // Calibración
  const [calibration, setCalibration] = useState(null); // { mmPerPx, refSegId, refMm }
  const [calibratePending, setCalibratePending] = useState(null); // { aId, bId } esperando entrada de mm
  const [calibrateInput, setCalibrateInput] = useState("");

  // Horizontal real (cuando la radiografía no está alineada)
  const [horizontalRef, setHorizontalRef] = useState(null); // { p1: {x,y}, p2: {x,y} } o null
  const [horizontalPending, setHorizontalPending] = useState(null); // primer click en modo horizontal
  const [draggingHorizEnd, setDraggingHorizEnd] = useState(null); // "p1" | "p2" | null
  const [showHowTo, setShowHowTo] = useState(true); // "¿Cómo medir?" desplegable en panel derecho
  const [expandedAngle, setExpandedAngle] = useState(null); // key de ángulo expandido en "Cálculos GAP"

  // Selección (para borrar con tecla)
  const [selectedSegId, setSelectedSegId] = useState(null);
  const [selectedLandmarkIdx, setSelectedLandmarkIdx] = useState(null);

  // Guardado de imagen anotada
  const [savingAnnotated, setSavingAnnotated] = useState(false);

  // Zoom actual del canvas. Los marcadores se dibujan en coordenadas de imagen,
  // así que su tamaño se divide entre el zoom para que en pantalla se vean
  // siempre iguales por más que se acerque la radiografía.
  const [zoomScale, setZoomScale] = useState(1);
  const [markerScale, setMarkerScale] = useState(1); // multiplicador manual (control en la barra)
  const [exporting, setExporting] = useState(false); // al rasterizar se ignora el zoom de pantalla

  // Ángulo automático entre pares de líneas de la herramienta "Medir"
  const [showPairAngles, setShowPairAngles] = useState(true);

  // Aviso de alineación que aparece al cargar la imagen
  const [showAlignPrompt, setShowAlignPrompt] = useState(false);
  const [horizontalTouched, setHorizontalTouched] = useState(false);

  // Detección click-vs-drag (umbral de movimiento en pantalla, en pixeles)
  const dragCandidateRef = useRef(null); // { type: "freept"|"landmark", id, startX, startY, started, pointerId, target }
  const DRAG_THRESHOLD = 4;

  // ─── Historial para deshacer/rehacer (Cmd/Ctrl+Z) ────────────────────────
  // Se guardan snapshots del estado editable. Como cada setState reemplaza el
  // objeto/array completo, comparar por referencia basta para detectar cambios.
  const pastRef = useRef([]);
  const futureRef = useRef([]);
  const presentRef = useRef(null);
  const restoringRef = useRef(false); // un undo/redo no debe generar una entrada nueva
  const HISTORY_LIMIT = 120;

  const svgRef = useRef(null);
  const fileInputRef = useRef(null);
  const transformRef = useRef(null);

  useEffect(() => {
    if (open) {
      setImageSrc(null);
      setImageDims({ w: 0, h: 0 });
      setLandmarks(Array(LANDMARK_DEFS.length).fill(null));
      setStep(0);
      setFreePts([]);
      setFreeSegs([]);
      setPendingPtId(null);
      setTool("gap");
      setGapMode("wizard");
      setCalibration(null);
      setCalibratePending(null);
      setCalibrateInput("");
      setHorizontalRef(null);
      setHorizontalPending(null);
      setHorizontalTouched(false);
      setShowAlignPrompt(false);
      setZoomScale(1);
      pastRef.current = [];
      futureRef.current = [];
      presentRef.current = null;
    }
  }, [open]);

  // Deselecciona si el segmento seleccionado deja de existir
  useEffect(() => {
    if (selectedSegId && !freeSegs.some(s => s.id === selectedSegId)) {
      setSelectedSegId(null);
    }
  }, [freeSegs, selectedSegId]);

  const isDragging = draggingLandmarkIdx !== null || draggingFreePtId !== null || draggingHorizEnd !== null;

  // Apila una entrada de historial cada vez que cambia el estado editable.
  useEffect(() => {
    if (!open) return;
    const cur = { landmarks, freePts, freeSegs, pendingPtId, horizontalRef, calibration, step };
    if (presentRef.current === null) { presentRef.current = cur; return; }
    if (restoringRef.current) { presentRef.current = cur; restoringRef.current = false; return; }
    // Durante un arrastre no se apila nada: al soltar, el estado previo a todo
    // el arrastre queda como una sola entrada en vez de una por cada pixel.
    if (isDragging) return;
    const prev = presentRef.current;
    if (prev.landmarks === cur.landmarks && prev.freePts === cur.freePts &&
        prev.freeSegs === cur.freeSegs && prev.pendingPtId === cur.pendingPtId &&
        prev.horizontalRef === cur.horizontalRef && prev.calibration === cur.calibration &&
        prev.step === cur.step) return;
    pastRef.current.push(prev);
    if (pastRef.current.length > HISTORY_LIMIT) pastRef.current.shift();
    futureRef.current = [];
    presentRef.current = cur;
  }, [open, isDragging, landmarks, freePts, freeSegs, pendingPtId, horizontalRef, calibration, step]);

  // Atajos de teclado: Delete/Backspace para borrar segmento seleccionado, Escape para cancelar
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      // Si hay input enfocado (calibración), no procesar
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      // Deshacer / rehacer: Cmd+Z (Mac) o Ctrl+Z (Windows); Cmd/Ctrl+Shift+Z o Ctrl+Y para rehacer
      if ((e.metaKey || e.ctrlKey) && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) handleRedo(); else handleUndo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        handleRedo();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedSegId) {
          e.preventDefault();
          deleteSeg(selectedSegId);
          setSelectedSegId(null);
        } else if (selectedLandmarkIdx !== null) {
          e.preventDefault();
          const newLm = [...landmarks];
          newLm[selectedLandmarkIdx] = null;
          setLandmarks(newLm);
          if (step > selectedLandmarkIdx) setStep(selectedLandmarkIdx);
          setSelectedLandmarkIdx(null);
        }
      } else if (e.key === "Escape") {
        if (pendingPtId !== null) {
          const refed = freeSegs.some(s => s.aId === pendingPtId || s.bId === pendingPtId);
          if (!refed) setFreePts(prev => prev.filter(p => p.id !== pendingPtId));
          setPendingPtId(null);
        }
        setSelectedSegId(null);
        setSelectedLandmarkIdx(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, selectedSegId, selectedLandmarkIdx, pendingPtId, freeSegs, landmarks, step, calibratePending]);

  // ─── Hooks de cálculo (deben ir antes de cualquier early return para
  // respetar Rules of Hooks) ──────────────────────────────────────────────
  const partial = useMemo(() => {
    const [p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12] = landmarks;
    const out = {};
    if (p1 && p2) out.femMid = midpoint(p1, p2);
    if (p3 && p4) {
      out.s1Mid = midpoint(p3, p4);
      out.ss = computeSS(p3, p4, horizontalRef);
    }
    if (p1 && p2 && p3 && p4) {
      out.pi = computePI(p3, p4, out.femMid);
      out.pt = computePT(out.femMid, out.s1Mid, horizontalRef);
      out.consistencyDelta = (out.pi !== undefined && out.pt !== undefined && out.ss !== undefined)
        ? out.pi - (out.pt + out.ss) : null;
    }
    if (p3 && p4 && p7 && p8) out.l1s1 = computeL1S1(p7, p8, p3, p4);
    if (p3 && p4 && p5 && p6) out.l4s1 = computeL4S1(p5, p6, p3, p4);
    if (p1 && p2 && p3 && p4 && p9) out.gt = computeGT(p9, out.s1Mid, out.femMid);

    // ── Hills 2022: L1 centroide derivado del platillo de L1; T4/T1/C2 directos ──
    // L1PA y L1 tilt ya se obtienen sin landmarks adicionales (midpoint de p7-p8).
    if (p1 && p2 && p3 && p4 && p7 && p8) {
      const l1Mid = midpoint(p7, p8);
      out.l1Mid = l1Mid;
      out.l1pa = computePA(l1Mid, out.s1Mid, out.femMid, p3, p4);
      out.l1tilt = computeVertebralTilt(l1Mid, out.femMid, p3, p4, horizontalRef);
    }
    // T4PA — requiere centroide de T4 (p10).
    if (p1 && p2 && p3 && p4 && p10) {
      out.t4pa = computePA(p10, out.s1Mid, out.femMid, p3, p4);
    }
    // T1 tilt — requiere centroide de T1 (p11).
    if (p1 && p2 && p3 && p4 && p11) {
      out.t1tilt = computeVertebralTilt(p11, out.femMid, p3, p4, horizontalRef);
    }
    // C2 tilt — requiere centroide de C2 (p12).
    if (p1 && p2 && p3 && p4 && p12) {
      out.c2tilt = computeVertebralTilt(p12, out.femMid, p3, p4, horizontalRef);
    }

    // SRS-Schwab — SVA: distancia horizontal entre C7 (p9) y esquina posterosuperior de S1 (p3).
    // Si hay línea horizontal definida, se proyecta sobre ella; si no, se usa el eje X de la imagen.
    if (p9 && p3) {
      const dx = p9.x - p3.x;
      const dy = p9.y - p3.y;
      if (horizontalRef) {
        const hx = horizontalRef.p2.x - horizontalRef.p1.x;
        const hy = horizontalRef.p2.y - horizontalRef.p1.y;
        const hlen = Math.sqrt(hx * hx + hy * hy);
        out.svaPx = hlen > 0 ? Math.abs((dx * hx + dy * hy) / hlen) : Math.abs(dx);
      } else {
        out.svaPx = Math.abs(dx);
      }
    }
    // SRS-Schwab — PI-LL mismatch
    if (out.pi !== undefined && out.l1s1 !== undefined) {
      out.piLL = out.pi - out.l1s1;
    }
    return out;
  }, [landmarks, horizontalRef]);

  // Grade helper for Schwab thresholds
  const schwabGrade = (v, t0, t1) => {
    if (v === null || v === undefined || Number.isNaN(v)) return null;
    if (v < t0)  return { g: "0",  color: COLORS.green };
    if (v <= t1) return { g: "+",  color: COLORS.yellow };
    return       { g: "++", color: COLORS.red };
  };

  // Ángulo de la línea horizontal respecto al eje X de la imagen.
  // Positivo = línea inclinada hacia abajo a la derecha (en convención y↓).
  // Rango [-90°, 90°]; 0° = paralela al eje X de la imagen.
  const horizontalAngle = useMemo(() => {
    if (!horizontalRef) return null;
    const dx = horizontalRef.p2.x - horizontalRef.p1.x;
    const dy = horizontalRef.p2.y - horizontalRef.p1.y;
    if (dx === 0 && dy === 0) return 0;
    let a = Math.atan2(dy, dx) * 180 / Math.PI;
    while (a > 90) a -= 180;
    while (a <= -90) a += 180;
    return a;
  }, [horizontalRef]);

  const vertexAngles = useMemo(() => {
    const ptToSegs = {};
    freeSegs.forEach(s => {
      (ptToSegs[s.aId] = ptToSegs[s.aId] || []).push(s);
      (ptToSegs[s.bId] = ptToSegs[s.bId] || []).push(s);
    });
    const out = [];
    for (const ptId in ptToSegs) {
      const ss = ptToSegs[ptId];
      if (ss.length !== 2) continue;
      const vertex = freePts.find(p => p.id === ptId);
      const oA = freePts.find(p => p.id === (ss[0].aId === ptId ? ss[0].bId : ss[0].aId));
      const oB = freePts.find(p => p.id === (ss[1].aId === ptId ? ss[1].bId : ss[1].aId));
      if (!vertex || !oA || !oB) continue;
      out.push({ ptId, vertex, oA, oB, s1: ss[0].id, s2: ss[1].id, angle: angleAtVertex(vertex, oA, oB) });
    }
    return out;
  }, [freePts, freeSegs]);

  // ─── Ángulo entre pares de líneas (herramienta "Medir") ─────────────────
  // Las líneas se emparejan en el orden en que se trazaron (1ª+2ª, 3ª+4ª, …) y
  // se mide el ángulo entre ellas.
  //
  // El ángulo se construye con las PERPENDICULARES a cada recta, no prolongando
  // las rectas hasta su cruce. Dos platillos vertebrales son casi paralelos: su
  // cruce cae a una distancia enorme, fuera de la placa, y allí no se puede
  // dibujar nada ni leer el valor. Las perpendiculares, en cambio, se cortan
  // entre las dos líneas, que es donde el lector está mirando. El ángulo entre
  // las perpendiculares es el mismo que el ángulo entre las rectas: girar
  // ambas 90° no cambia lo que las separa.
  //
  // Cada perpendicular se orienta hacia la otra línea para que el vértice caiga
  // entre las dos. Se orientan además las rectas canónicamente (apuntando a la
  // derecha) para que dos líneas paralelas den 0° y el valor crezca con la
  // convergencia, igual que en un PACS.
  //
  // No participa la línea de calibración. Los puntos GAP tampoco: sus ángulos
  // se calculan aparte.
  const linePairs = useMemo(() => {
    if (!showPairAngles) return [];
    const elegibles = freeSegs.filter(s => !(calibration && calibration.refSegId === s.id));
    const pt = (id) => freePts.find(p => p.id === id);
    const maxDim = Math.max(imageDims.w, imageDims.h) || 1;
    const out = [];
    for (let i = 0; i + 1 < elegibles.length; i += 2) {
      const s1 = elegibles[i], s2 = elegibles[i + 1];
      // Si las dos comparten un extremo, el ángulo ya lo rotula vertexAngles
      // con el vértice real; duplicarlo aquí solo confunde.
      if (s1.aId === s2.aId || s1.aId === s2.bId || s1.bId === s2.aId || s1.bId === s2.bId) continue;
      const a1 = pt(s1.aId), b1 = pt(s1.bId), a2 = pt(s2.aId), b2 = pt(s2.bId);
      if (!a1 || !b1 || !a2 || !b2) continue;
      const par = linePairAngle(a1, b1, a2, b2, maxDim * 0.9);
      if (!par) continue;
      const { angle, m1, m2, n1, n2, vertex, leg1, leg2 } = par;
      out.push({ id: `${s1.id}|${s2.id}`, s1: s1.id, s2: s2.id, a1, b1, a2, b2, m1, m2, n1, n2, vertex, leg1, leg2, angle });
    }
    return out;
  }, [showPairAngles, freeSegs, freePts, calibration, imageDims]);

  // Líneas que ya forman parte de un ángulo: se les oculta la etiqueta de
  // distancia para que en pantalla quede únicamente la medición del ángulo.
  const pairedSegIds = useMemo(() => {
    const s = new Set();
    linePairs.forEach(p => { s.add(p.s1); s.add(p.s2); });
    vertexAngles.forEach(v => { s.add(v.s1); s.add(v.s2); });
    return s;
  }, [linePairs, vertexAngles]);

  if (!open) return null;

  const loadFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = e => {
      const url = e.target.result;
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth, h = img.naturalHeight;
        setImageSrc(url);
        setImageDims({ w, h });
        setImageName(file.name || null);
        setLandmarks(Array(LANDMARK_DEFS.length).fill(null));
        setStep(0);
        setFreePts([]);
        setFreeSegs([]);
        setPendingPtId(null);
        setCalibration(null);
        setCalibratePending(null);
        // Horizontal por defecto: paralela al eje X de la imagen y colocada
        // abajo, fuera de la zona de trabajo — en el centro los usuarios la
        // confundían con una medición. El usuario arrastra los extremos para
        // alinearla con la placa si está rotada.
        setHorizontalRef({
          p1: { x: w * 0.20, y: h * 0.88 },
          p2: { x: w * 0.80, y: h * 0.88 }
        });
        setHorizontalPending(null);
        setHorizontalTouched(false);
        setShowAlignPrompt(true);
        setZoomScale(1);
        pastRef.current = [];
        futureRef.current = [];
        presentRef.current = null;
      };
      img.src = url;
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) loadFile(f);
  };

  const screenToSvg = (clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const sp = pt.matrixTransform(ctm.inverse());
    return { x: sp.x, y: sp.y };
  };

  // Tamaño de marcadores y trazos. Se dibujan en coordenadas de imagen dentro
  // de un SVG que el zoom escala completo, así que hay que dividir entre el
  // factor de zoom para que en pantalla se vean del mismo tamaño siempre.
  // Al exportar la imagen anotada se ignora el zoom (se rasteriza a escala 1).
  const zoomComp = exporting ? 1 : Math.min(Math.max(zoomScale, 0.25), 8);
  const baseRadius = imageDims.w > 0 ? Math.max(8, imageDims.w / 200) : 8;
  const baseStroke = imageDims.w > 0 ? Math.max(2, imageDims.w / 600) : 2;
  const radius = (baseRadius * markerScale) / zoomComp;
  const strokeWidth = (baseStroke * markerScale) / zoomComp;
  const snapRadius = radius * 2.2;

  // Snap o crea un punto libre
  const snapOrCreatePt = (coord) => {
    for (const p of freePts) {
      if (Math.hypot(p.x - coord.x, p.y - coord.y) < snapRadius) return { id: p.id, created: false };
    }
    const id = uid();
    setFreePts(prev => [...prev, { id, x: coord.x, y: coord.y }]);
    return { id, created: true };
  };

  // ─── Click en canvas (espacio vacío) ────────────────────────────────────
  const handleSvgPointerDown = (e) => {
    if (tool === "pan") return;
    if (calibratePending) return;
    if (e.target?.dataset?.landmark !== undefined) return;
    if (e.target?.dataset?.freept !== undefined) return;
    if (e.target?.dataset?.segment !== undefined) return;
    // Click en canvas vacío deselecciona
    setSelectedSegId(null);
    setSelectedLandmarkIdx(null);
    const coord = screenToSvg(e.clientX, e.clientY);
    if (!coord) return;

    if (tool === "gap") {
      if (gapMode !== "wizard") return;
      if (step >= LANDMARK_DEFS.length) return;
      const newLm = [...landmarks];
      newLm[step] = coord;
      setLandmarks(newLm);
      const next = newLm.findIndex((p, i) => p === null && i > step);
      if (next !== -1) setStep(next);
      else {
        const firstEmpty = newLm.findIndex(p => p === null);
        setStep(firstEmpty === -1 ? LANDMARK_DEFS.length : firstEmpty);
      }
      return;
    }
    if (tool === "line" || tool === "calibrate") {
      handleLineToolClick(coord, null);
      return;
    }
    if (tool === "horizontal") {
      if (horizontalPending === null) {
        setHorizontalPending(coord);
      } else {
        setHorizontalRef({ p1: horizontalPending, p2: coord });
        setHorizontalPending(null);
        setHorizontalTouched(true);
        setTool("gap");
      }
      return;
    }
  };

  // Lógica unificada de click en línea/calibrate: id puede ser de un endpoint existente (snap)
  const handleLineToolClick = (coord, snappedToId) => {
    let firstId = snappedToId;
    if (firstId === null) {
      const { id } = snapOrCreatePt(coord);
      firstId = id;
    }
    if (pendingPtId === null) {
      setPendingPtId(firstId);
    } else if (firstId !== pendingPtId) {
      if (tool === "line") {
        setFreeSegs(prev => [...prev, { id: uid(), aId: pendingPtId, bId: firstId }]);
      } else {
        const segId = uid();
        setFreeSegs(prev => [...prev, { id: segId, aId: pendingPtId, bId: firstId }]);
        setCalibratePending({ aId: pendingPtId, bId: firstId, segId });
        setCalibrateInput("");
      }
      setPendingPtId(null);
    } else {
      // Doble click sobre el mismo endpoint → cancela
      setPendingPtId(null);
    }
  };

  const jumpToLandmark = (idx) => {
    if (tool !== "gap") setTool("gap");
    if (gapMode !== "wizard") setGapMode("wizard");
    setStep(idx);
  };

  // ─── Pointer down sobre landmark / free pt: candidato a drag o click ─────
  const handleLandmarkPointerDown = (idx) => (e) => {
    if (tool === "pan") return;
    e.stopPropagation();
    e.preventDefault();
    dragCandidateRef.current = { type: "landmark", id: idx, startX: e.clientX, startY: e.clientY, started: false, pointerId: e.pointerId, target: e.currentTarget };
  };

  const handleFreePtPointerDown = (id) => (e) => {
    if (tool === "pan") return;
    if (calibratePending) return;
    e.stopPropagation();
    e.preventDefault();
    dragCandidateRef.current = { type: "freept", id, startX: e.clientX, startY: e.clientY, started: false, pointerId: e.pointerId, target: e.currentTarget };
  };

  const handleSegmentPointerDown = (segId) => (e) => {
    e.stopPropagation();
    setSelectedSegId(segId);
  };

  // Pointer move sobre SVG: actualiza drag o detecta inicio de drag
  const handleSvgPointerMove = (e) => {
    const dc = dragCandidateRef.current;
    if (dc && !dc.started) {
      const moved = Math.hypot(e.clientX - dc.startX, e.clientY - dc.startY);
      if (moved > DRAG_THRESHOLD) {
        dc.started = true;
        try { dc.target.setPointerCapture?.(dc.pointerId); } catch (err) {}
        if (dc.type === "freept") setDraggingFreePtId(dc.id);
        else setDraggingLandmarkIdx(dc.id);
      }
    }
    if (draggingLandmarkIdx !== null) {
      const c = screenToSvg(e.clientX, e.clientY);
      if (!c) return;
      const newLm = [...landmarks];
      newLm[draggingLandmarkIdx] = c;
      setLandmarks(newLm);
      return;
    }
    if (draggingFreePtId) {
      const c = screenToSvg(e.clientX, e.clientY);
      if (!c) return;
      setFreePts(prev => prev.map(p => p.id === draggingFreePtId ? { ...p, x: c.x, y: c.y } : p));
      return;
    }
    if (draggingHorizEnd && horizontalRef) {
      const c = screenToSvg(e.clientX, e.clientY);
      if (!c) return;
      setHorizontalRef({ ...horizontalRef, [draggingHorizEnd]: c });
    }
  };

  // Pointer up: si fue click (sin movimiento) → snap; si fue drag → fin de drag (con merge)
  const handleSvgPointerUp = (e) => {
    const dc = dragCandidateRef.current;
    if (dc && !dc.started) {
      // Click sin drag
      dragCandidateRef.current = null;
      if (dc.type === "freept") {
        if (tool === "line" || tool === "calibrate") {
          const pt = freePts.find(p => p.id === dc.id);
          if (pt) handleLineToolClick(pt, dc.id);
          return;
        }
        // En modo GAP/pan: click en free pt no hace nada extra
      }
      if (dc.type === "landmark") {
        // Click sobre landmark sin drag → selecciona
        setSelectedLandmarkIdx(dc.id);
        setSelectedSegId(null);
      }
      return;
    }
    if (draggingLandmarkIdx !== null) {
      try { e.target?.releasePointerCapture?.(e.pointerId); } catch (err) {}
      setDraggingLandmarkIdx(null);
      dragCandidateRef.current = null;
      return;
    }
    if (draggingFreePtId) {
      // Detectar merge con otro endpoint cercano
      const dragged = freePts.find(p => p.id === draggingFreePtId);
      if (dragged) {
        const target = freePts.find(p => p.id !== dragged.id && Math.hypot(p.x - dragged.x, p.y - dragged.y) < snapRadius);
        if (target) {
          // Reescribe segmentos que usaban dragged.id → target.id, descarta self-loops
          setFreeSegs(prev => prev.map(s => ({
            ...s,
            aId: s.aId === dragged.id ? target.id : s.aId,
            bId: s.bId === dragged.id ? target.id : s.bId
          })).filter(s => s.aId !== s.bId));
          setFreePts(prev => prev.filter(p => p.id !== dragged.id));
          if (pendingPtId === dragged.id) setPendingPtId(target.id);
          if (selectedSegId) {
            // El segmento seleccionado puede haber sido removido por el self-loop filter
            setSelectedSegId(null);
          }
        }
      }
      try { e.target?.releasePointerCapture?.(e.pointerId); } catch (err) {}
      setDraggingFreePtId(null);
      dragCandidateRef.current = null;
      return;
    }
    if (draggingHorizEnd) {
      try { e.target?.releasePointerCapture?.(e.pointerId); } catch (err) {}
      setDraggingHorizEnd(null);
    }
  };

  // Borrar uno o varios segmentos + limpiar puntos huérfanos. Los ids se
  // resuelven en una sola pasada: dos llamadas encadenadas leerían el mismo
  // freeSegs y la segunda reviviría lo que borró la primera.
  const deleteSegs = (segIds) => {
    const kill = new Set(segIds);
    const newSegs = freeSegs.filter(s => !kill.has(s.id));
    setFreeSegs(newSegs);
    // Limpiar puntos que no quedan referenciados ni están pendientes
    const usedIds = new Set();
    newSegs.forEach(s => { usedIds.add(s.aId); usedIds.add(s.bId); });
    if (pendingPtId) usedIds.add(pendingPtId);
    setFreePts(prev => prev.filter(p => usedIds.has(p.id)));
    // Si alguno era el segmento de calibración, borrar calibración
    if (calibration && kill.has(calibration.refSegId)) setCalibration(null);
    if (kill.has(selectedSegId)) setSelectedSegId(null);
  };
  const deleteSeg = (segId) => deleteSegs([segId]);

  // Aplicar mm a calibración
  const applyCalibration = () => {
    const mm = Number(calibrateInput);
    if (!Number.isFinite(mm) || mm <= 0 || !calibratePending) {
      setCalibratePending(null);
      setCalibrateInput("");
      return;
    }
    const a = freePts.find(p => p.id === calibratePending.aId);
    const b = freePts.find(p => p.id === calibratePending.bId);
    if (!a || !b) { setCalibratePending(null); setCalibrateInput(""); return; }
    const px = distance(a, b);
    if (px <= 0) { setCalibratePending(null); setCalibrateInput(""); return; }
    setCalibration({ mmPerPx: mm / px, refSegId: calibratePending.segId, refMm: mm });
    setCalibratePending(null);
    setCalibrateInput("");
    setTool("line");
  };
  const cancelCalibration = () => {
    if (calibratePending) deleteSeg(calibratePending.segId);
    setCalibratePending(null);
    setCalibrateInput("");
  };

  // ─── Deshacer / rehacer sobre el historial de snapshots ─────────────────
  const applySnapshot = (s) => {
    restoringRef.current = true;
    setLandmarks(s.landmarks);
    setFreePts(s.freePts);
    setFreeSegs(s.freeSegs);
    setPendingPtId(s.pendingPtId);
    setHorizontalRef(s.horizontalRef);
    setCalibration(s.calibration);
    setStep(s.step);
    setSelectedSegId(null);
    setSelectedLandmarkIdx(null);
  };

  const handleUndo = () => {
    // Una calibración a medias se cancela antes de tocar el historial
    if (calibratePending) { cancelCalibration(); return; }
    const prev = pastRef.current.pop();
    if (!prev) return;
    if (presentRef.current) futureRef.current.push(presentRef.current);
    applySnapshot(prev);
  };

  const handleRedo = () => {
    if (calibratePending) return;
    const next = futureRef.current.pop();
    if (!next) return;
    if (presentRef.current) pastRef.current.push(presentRef.current);
    applySnapshot(next);
  };

  const handleResetGAP = () => {
    setLandmarks(Array(LANDMARK_DEFS.length).fill(null));
    setStep(0);
    setSelectedLandmarkIdx(null);
  };

  const clearFreeMeasurements = () => {
    setFreeSegs([]);
    setFreePts([]);
    setPendingPtId(null);
    setCalibration(null);
    setCalibratePending(null);
    setCalibrateInput("");
    setSelectedSegId(null);
  };
  const handleClearImage = () => {
    setImageSrc(null);
    setImageDims({ w: 0, h: 0 });
    setLandmarks(Array(LANDMARK_DEFS.length).fill(null));
    setStep(0);
    setFreePts([]);
    setFreeSegs([]);
    setPendingPtId(null);
    setCalibration(null);
    setCalibratePending(null);
  };

  const handleApply = () => {
    const out = {};
    if (partial.pi !== undefined) out.pi = round1(partial.pi);
    if (partial.ss !== undefined) out.ss = round1(partial.ss);
    if (partial.pt !== undefined) out.pt = round1(partial.pt);
    if (partial.l1s1 !== undefined) out.l1s1 = round1(partial.l1s1);
    if (partial.l4s1 !== undefined) out.l4s1 = round1(partial.l4s1);
    if (partial.gt !== undefined) out.gt = round1(partial.gt);
    // Hills 2022 — solo se emiten si los landmarks correspondientes existen.
    if (partial.l1pa !== undefined) out.l1pa = round1(partial.l1pa);
    if (partial.t4pa !== undefined) out.t4pa = round1(partial.t4pa);
    if (partial.c2tilt !== undefined) out.c2tilt = round1(partial.c2tilt);
    if (partial.t1tilt !== undefined) out.t1tilt = round1(partial.t1tilt);
    if (partial.l1tilt !== undefined) out.l1tilt = round1(partial.l1tilt);
    // SRS-Schwab: SVA en cm (requiere calibración)
    if (partial.svaPx !== undefined && calibration) {
      out.sva = round1(partial.svaPx * calibration.mmPerPx / 10);
    }
    // El trazo viaja junto a los escalares, no en lugar de ellos: el contrato
    // de "escalar presente → aplicar al formulario" no cambia.
    const geometry = makeGeometry({
      landmarks, calibration, horizontalRef, imageDims, imageName, freePts, freeSegs,
    });
    const medidas = MEASUREMENT_KEYS.filter(k => out[k] !== undefined).length;
    if (medidas === 0 && !geometry) return;
    if (geometry) {
      geometry.applied = { ...out };
      out.geometry = geometry;
    }
    onApply(out);
    onClose();
  };
  const anyAngle = ["pi", "ss", "pt", "l1s1", "l4s1", "gt", "l1pa", "t4pa", "c2tilt", "t1tilt", "l1tilt"].some(k => partial[k] !== undefined);

  const fmtDist = (px) => calibration ? `${(px * calibration.mmPerPx).toFixed(1)} mm` : `${Math.round(px)} px`;

  // Serializa el SVG actual y lo rasteriza a JPG redimensionado, luego lo
  // pasa al callback del padre como dataURL.
  const handleSaveAnnotated = async () => {
    if (!svgRef.current || !imageDims.w || !onSaveAnnotated) return;
    setSavingAnnotated(true);
    // Los marcadores se dibujan compensando el zoom de pantalla; para el
    // export hay que volver a escala 1 y esperar a que React repinte el SVG.
    setExporting(true);
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    try {
      const xml = new XMLSerializer().serializeToString(svgRef.current);
      const svgBlob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
      const blobUrl = URL.createObjectURL(svgBlob);
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = blobUrl;
      });
      const MAX_DIM = 1400;
      const scale = Math.min(1, MAX_DIM / Math.max(imageDims.w, imageDims.h));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(imageDims.w * scale);
      canvas.height = Math.round(imageDims.h * scale);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(blobUrl);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      onSaveAnnotated(dataUrl);
    } catch (e) {
      console.error("Error al guardar imagen anotada:", e);
    } finally {
      setExporting(false);
      setSavingAnnotated(false);
    }
  };

  // ─── Líneas de overlay GAP ───────────────────────────────────────────────
  const gapLines = [];
  if (landmarks[0] && landmarks[1]) gapLines.push({ p1: landmarks[0], p2: landmarks[1], color: "#e11d48" });
  if (landmarks[2] && landmarks[3]) gapLines.push({ p1: landmarks[2], p2: landmarks[3], color: "#0891b2" });
  if (landmarks[4] && landmarks[5]) gapLines.push({ p1: landmarks[4], p2: landmarks[5], color: "#16a34a" });
  if (landmarks[6] && landmarks[7]) gapLines.push({ p1: landmarks[6], p2: landmarks[7], color: "#7c3aed" });
  let ptOverlay = null;
  if (partial.femMid && partial.s1Mid) ptOverlay = { p1: partial.femMid, p2: partial.s1Mid };
  let gtOverlay = null;
  if (landmarks[8] && partial.femMid) gtOverlay = { p1: landmarks[8], p2: partial.femMid };

  const currentDef = step < LANDMARK_DEFS.length ? LANDMARK_DEFS[step] : null;

  const cursor = tool === "pan" ? "grab" : (tool === "gap" && gapMode === "free") ? "default" : "crosshair";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 11000, background: COLORS.bg, display: "flex", flexDirection: "column" }}>
      {/* Top bar */}
      <div style={{ padding: "10px 16px", background: COLORS.panel, borderBottom: `1px solid ${COLORS.panelLight}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>📐 Anotador de radiografía</span>
          {imageSrc && <span style={{ fontSize: 11, color: COLORS.textDim, fontFamily: "'JetBrains Mono', monospace" }}>{imageDims.w} × {imageDims.h} px</span>}
          {calibration && <span style={{ fontSize: 11, color: COLORS.green, fontFamily: "'JetBrains Mono', monospace" }}>· {(1 / calibration.mmPerPx).toFixed(2)} px/mm</span>}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {imageSrc && (
            <>
              <button onClick={handleUndo} title="Deshacer (⌘Z / Ctrl+Z)" style={btnSecondary(false)}>↶ Deshacer</button>
              <button onClick={handleRedo} title="Rehacer (⇧⌘Z / Ctrl+Y)" style={btnSecondary(false)}>↷ Rehacer</button>
              <button onClick={handleResetGAP} style={btnSecondary(false)}>Reiniciar GAP</button>
              <button onClick={clearFreeMeasurements} style={btnSecondary(false)}>Limpiar mediciones libres</button>
              <button onClick={handleClearImage} style={btnSecondary(false)}>Cambiar imagen</button>
            </>
          )}
          <button onClick={onClose} style={{ ...btnSecondary(false), borderColor: COLORS.red, color: COLORS.red }}>✕ Cerrar</button>
        </div>
      </div>

      {/* Tool selector */}
      {imageSrc && (
        <div style={{ padding: "8px 16px", background: COLORS.panel, borderBottom: `1px solid ${COLORS.panelLight}`, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, color: COLORS.textDim, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginRight: 4 }}>Herramienta</span>
          <button onClick={() => { setTool("gap"); setPendingPtId(null); }} style={btnTool(tool === "gap", "#a8927a")}>🎯 GAP</button>
          <button onClick={() => { setTool("line"); setPendingPtId(null); }} style={btnTool(tool === "line", COLORS.cyan)}>📐 Medir (línea/ángulo)</button>
          <button onClick={() => { setTool("calibrate"); setPendingPtId(null); }} style={btnTool(tool === "calibrate", COLORS.green)}>⚖ Calibrar</button>
          {/* Interruptor: prende y apaga la línea horizontal amarilla. Sin
              línea, SS y PT se calculan contra el eje X de la imagen. */}
          <button onClick={() => {
            if (horizontalRef) {
              setHorizontalRef(null);
              setHorizontalPending(null);
              if (tool === "horizontal") setTool("gap");
            } else {
              setHorizontalRef({
                p1: { x: imageDims.w * 0.20, y: imageDims.h * 0.88 },
                p2: { x: imageDims.w * 0.80, y: imageDims.h * 0.88 }
              });
              setHorizontalTouched(true);
              setHorizontalPending(null);
              setPendingPtId(null);
              setTool("horizontal");
            }
          }} title={horizontalRef ? "Ocultar la línea horizontal" : "Mostrar la línea horizontal"}
            style={btnTool(!!horizontalRef, "#fbbf24")}>
            {horizontalRef ? "✓ 📏 Horizontal" : "📏 Horizontal"}
          </button>
          <button onClick={() => { setTool("pan"); setPendingPtId(null); }} style={btnTool(tool === "pan", "#888")}>🤚 Pan/Zoom</button>
          {tool === "gap" && (
            <button onClick={() => setGapMode(gapMode === "free" ? "wizard" : "free")} style={{ ...btnTool(gapMode === "free", COLORS.yellow), marginLeft: 12 }}>
              {gapMode === "free" ? "✓ Solo arrastrar" : "Solo arrastrar"}
            </button>
          )}
          {/* Tamaño de los marcadores. El zoom ya no los agranda, pero el
              tamaño base depende de la resolución de la placa. */}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, marginLeft: 12, padding: "3px 10px", borderRadius: 6, background: COLORS.panelLight }}
            title="Tamaño de los puntos, líneas y etiquetas (no cambia con el zoom)">
            <span style={{ fontSize: 10, color: COLORS.textDim, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>⬤ Tamaño</span>
            <input type="range" min="0.4" max="2.5" step="0.1" value={markerScale}
              onChange={e => setMarkerScale(Number(e.target.value))}
              style={{ width: 84, accentColor: COLORS.accent, cursor: "pointer" }} />
            <span style={{ fontSize: 10, color: COLORS.textDim, fontFamily: "'JetBrains Mono', monospace", width: 30, textAlign: "right" }}>{Math.round(markerScale * 100)}%</span>
          </span>
          {/* SRS-Schwab live summary */}
          {(() => {
            const svaCm = (partial.svaPx !== undefined && calibration) ? partial.svaPx * calibration.mmPerPx / 10 : null;
            const gPiLL = schwabGrade(partial.piLL, 10, 20);
            const gPt   = schwabGrade(partial.pt,   20, 30);
            const gSva  = schwabGrade(svaCm,        4,  9.5);
            const hasAny = partial.piLL !== undefined || partial.pt !== undefined || partial.svaPx !== undefined;
            if (!hasAny) return null;
            const chip = (label, val, unit, grade, hint) => (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 8px", borderRadius: 6, background: COLORS.panelLight, border: `1px solid ${grade ? grade.color + "66" : COLORS.panelLight}`, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
                <span style={{ color: COLORS.textDim, fontWeight: 700 }}>{label}</span>
                {val !== null && val !== undefined ? (
                  <span style={{ color: COLORS.text, fontWeight: 700 }}>{val.toFixed(1)}{unit}</span>
                ) : (
                  <span style={{ color: COLORS.textDim, fontStyle: "italic", fontSize: 10 }}>{hint || "—"}</span>
                )}
                {grade && (
                  <span style={{ padding: "0 6px", borderRadius: 4, background: grade.color + "22", color: grade.color, border: `1px solid ${grade.color}66`, fontSize: 11, fontWeight: 800 }}>{grade.g}</span>
                )}
              </span>
            );
            // Roussouly classification (Bari 2020, Fig. 2). El tipo 1 vs 2 requiere
            // el nº de vértebras lordóticas, que se captura en el formulario.
            let roussouly = null;
            if (partial.ss !== undefined) {
              if (partial.ss < 35) {
                roussouly = { type: "1/2", color: COLORS.cyan };
              } else if (partial.ss >= 45) {
                roussouly = { type: "4", color: COLORS.red };
              } else if (partial.pi !== undefined && partial.pi < 50 && partial.pt !== undefined && partial.pt < 5) {
                roussouly = { type: "3-AP", color: COLORS.pink };
              } else {
                roussouly = { type: "3", color: COLORS.green };
              }
            }
            return (
              <>
                <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 10, color: COLORS.textDim, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>SRS-Schwab</span>
                  {chip("PI−LL", partial.piLL, "°", gPiLL)}
                  {chip("PT", partial.pt, "°", gPt)}
                  {chip("SVA", svaCm, " cm", gSva, partial.svaPx !== undefined && !calibration ? "calibra →" : null)}
                </span>
                {roussouly && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 10, color: COLORS.textDim, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Roussouly</span>
                    <span style={{ padding: "4px 10px", borderRadius: 6, background: roussouly.color + "22", color: roussouly.color, border: `1px solid ${roussouly.color}66`, fontSize: 12, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace" }}>
                      Tipo {roussouly.type}
                    </span>
                  </span>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Hint compacto: solo nombre del punto activo. Detalle completo vive en el panel derecho. */}
      {imageSrc && tool === "gap" && currentDef && gapMode === "wizard" && (
        <div style={{ padding: "8px 16px", background: COLORS.panelLight, borderBottom: `1px solid ${COLORS.panelLight}`, color: COLORS.text, fontSize: 12, display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: currentDef.color, fontSize: 13 }}>Punto {step + 1}/{LANDMARK_DEFS.length}{currentDef.optional ? " · opc." : ""}</span>
          <span style={{ fontWeight: 700, color: COLORS.text }}>{currentDef.label}</span>
          <span style={{ color: COLORS.textDim, marginLeft: "auto", fontSize: 11, fontStyle: "italic" }}>Detalles → panel derecho · "¿Cómo medir?"</span>
        </div>
      )}
      {imageSrc && tool === "gap" && gapMode === "free" && (
        <div style={{ padding: "10px 16px", background: COLORS.panelLight, borderBottom: `1px solid ${COLORS.panelLight}`, color: COLORS.text, fontSize: 12 }}>
          Modo "solo arrastrar": clicks en la imagen no colocan puntos nuevos. Arrastra los puntos GAP existentes para reposicionarlos. Cambia a "GAP" wizard si quieres seguir colocando puntos.
        </div>
      )}
      {imageSrc && tool === "line" && (
        <div style={{ padding: "10px 16px", background: COLORS.panelLight, borderBottom: `1px solid ${COLORS.panelLight}`, color: COLORS.text, fontSize: 12, lineHeight: 1.55 }}>
          <strong>Línea / ángulo:</strong> click 2 puntos para crear una línea. Sola, muestra su distancia.
          Al trazar la <strong>segunda</strong>, las dos se emparejan (1ª+2ª, 3ª+4ª…) y se rotula el <strong>ángulo entre ellas</strong>.
          Arrastra cualquier endpoint para ajustar: el ángulo se recalcula en vivo.
          Para fusionar dos endpoints en uno, arrastra uno encima del otro.
          Click sobre una línea para seleccionarla; <kbd style={{ background: COLORS.panel, padding: "1px 5px", borderRadius: 4, border: `1px solid ${COLORS.panelLight}`, fontFamily: "monospace", fontSize: 11 }}>Delete</kbd>/<kbd style={{ background: COLORS.panel, padding: "1px 5px", borderRadius: 4, border: `1px solid ${COLORS.panelLight}`, fontFamily: "monospace", fontSize: 11 }}>Backspace</kbd> la borra. <kbd style={{ background: COLORS.panel, padding: "1px 5px", borderRadius: 4, border: `1px solid ${COLORS.panelLight}`, fontFamily: "monospace", fontSize: 11 }}>Esc</kbd> cancela.
          <span style={{ color: COLORS.textDim, fontStyle: "italic", marginLeft: 6 }}>{pendingPtId ? "Click siguiente punto…" : (selectedSegId ? "Línea seleccionada (Delete para borrar)" : "Click primer punto.")}</span>
          <button onClick={() => setShowPairAngles(v => !v)}
            title="Mostrar u ocultar el ángulo entre cada par de líneas"
            style={{ ...btnTool(showPairAngles, COLORS.cyan), marginLeft: 10, padding: "3px 9px", fontSize: 10 }}>
            {showPairAngles ? "✓ ∠ entre pares" : "∠ entre pares"}
          </button>
        </div>
      )}
      {imageSrc && tool === "calibrate" && !calibratePending && (
        <div style={{ padding: "10px 16px", background: COLORS.panelLight, borderBottom: `1px solid ${COLORS.panelLight}`, color: COLORS.text, fontSize: 12 }}>
          Click 2 puntos sobre una distancia conocida (regla en la radiografía, marcador esférico, altura típica de un cuerpo vertebral). Después podrás ingresar a cuántos mm corresponde.
          <span style={{ color: COLORS.textDim, fontStyle: "italic", marginLeft: 6 }}>{pendingPtId ? "Click segundo punto…" : "Click primer punto."}</span>
        </div>
      )}
      {imageSrc && tool === "horizontal" && (
        <div style={{ padding: "10px 16px", background: "#fbbf24" + "22", borderBottom: `1px solid #fbbf2466`, color: "#fbbf24", fontSize: 12, lineHeight: 1.55 }}>
          <strong>Definir horizontal real:</strong> arrastra los dos extremos amarillos de la línea que ya está abajo, o click 2 puntos sobre algo que sabes está horizontal (borde de mesa, plomo, marcador, suelo). Se usa para corregir SS y PT cuando la radiografía no está bien alineada. PI y los Cobb (L1-S1, L4-S1) no necesitan esto — son geométricos.
          <span style={{ color: COLORS.textDim, fontStyle: "italic", marginLeft: 6 }}>{horizontalPending ? "Click segundo punto…" : "Click primer punto."}</span>
        </div>
      )}
      {imageSrc && tool === "pan" && (
        <div style={{ padding: "10px 16px", background: COLORS.panelLight, borderBottom: `1px solid ${COLORS.panelLight}`, color: COLORS.text, fontSize: 12 }}>
          Pan/Zoom activo: rueda del ratón para zoom, arrastra para mover la imagen.
        </div>
      )}

      {/* Calibrate input bar */}
      {calibratePending && (() => {
        const a = freePts.find(p => p.id === calibratePending.aId);
        const b = freePts.find(p => p.id === calibratePending.bId);
        const px = a && b ? distance(a, b) : 0;
        return (
          <div style={{ padding: "10px 16px", background: COLORS.green + "22", borderBottom: `1px solid ${COLORS.green}66`, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: COLORS.green, fontWeight: 700 }}>⚖ Línea de calibración: {Math.round(px)} px =</span>
            <input
              type="number"
              autoFocus
              value={calibrateInput}
              onChange={e => setCalibrateInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") applyCalibration(); if (e.key === "Escape") cancelCalibration(); }}
              placeholder="mm"
              style={{ width: 100, padding: "6px 8px", borderRadius: 6, border: `1.5px solid ${COLORS.green}`, background: COLORS.panel, color: COLORS.text, fontSize: 13, fontFamily: "'JetBrains Mono', monospace", outline: "none" }} />
            <span style={{ fontSize: 12, color: COLORS.green, fontWeight: 700 }}>mm</span>
            <button onClick={applyCalibration} style={{ padding: "6px 12px", borderRadius: 6, border: `1.5px solid ${COLORS.green}`, background: COLORS.green, color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Aplicar calibración</button>
            <button onClick={cancelCalibration} style={btnSecondary(false)}>Cancelar</button>
          </div>
        );
      })()}

      {/* Canvas + side panel */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", flexDirection: "row" }}>
        <div style={{ flex: 1, position: "relative", background: "#000", overflow: "hidden" }}
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}>
          {!imageSrc ? (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
              <div style={{ textAlign: "center", color: COLORS.textDim, maxWidth: 480 }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📷</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: COLORS.text, marginBottom: 8 }}>Carga una radiografía lateral</div>
                <div style={{ fontSize: 12, color: COLORS.textDim, lineHeight: 1.6, marginBottom: 20 }}>
                  Arrastra y suelta una imagen aquí o usa el botón. JPG/PNG. Idealmente teleradiografía completa de columna en bipedestación.
                </div>
                <button onClick={() => fileInputRef.current?.click()} style={{ padding: "12px 22px", borderRadius: 10, border: `1.5px solid ${COLORS.accent}`, background: COLORS.accent, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Elegir archivo</button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={e => loadFile(e.target.files?.[0])} style={{ display: "none" }} />
              </div>
            </div>
          ) : (
            <TransformWrapper ref={transformRef} minScale={0.2} maxScale={8} initialScale={1} centerOnInit
              wheel={{ step: 0.15 }} doubleClick={{ disabled: true }}
              panning={{ disabled: tool !== "pan", velocityDisabled: true }}
              pinch={{ disabled: tool !== "pan" }}
              onTransform={(_ref, state) => setZoomScale(state?.scale || 1)}>
              <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }} contentStyle={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg ref={svgRef} viewBox={`0 0 ${imageDims.w} ${imageDims.h}`}
                  style={{ width: "auto", height: "100%", maxWidth: "100%", maxHeight: "100%", touchAction: "none", cursor, userSelect: "none" }}
                  onPointerDown={handleSvgPointerDown}
                  onPointerMove={handleSvgPointerMove}
                  onPointerUp={handleSvgPointerUp}>
                  <image href={imageSrc} x="0" y="0" width={imageDims.w} height={imageDims.h} style={{ pointerEvents: "none" }} />

                  {/* Líneas GAP */}
                  {gapLines.map((ln, i) => (
                    <line key={`gl-${i}`} x1={ln.p1.x} y1={ln.p1.y} x2={ln.p2.x} y2={ln.p2.y}
                      stroke={ln.color} strokeWidth={strokeWidth} strokeOpacity="0.85" strokeLinecap="round" pointerEvents="none" />
                  ))}
                  {ptOverlay && (
                    <line x1={ptOverlay.p1.x} y1={ptOverlay.p1.y} x2={ptOverlay.p2.x} y2={ptOverlay.p2.y}
                      stroke="#fbbf24" strokeWidth={strokeWidth} strokeOpacity="0.7" strokeDasharray={`${strokeWidth * 3},${strokeWidth * 2}`} pointerEvents="none" />
                  )}
                  {gtOverlay && (
                    <line x1={gtOverlay.p1.x} y1={gtOverlay.p1.y} x2={gtOverlay.p2.x} y2={gtOverlay.p2.y}
                      stroke="#ea580c" strokeWidth={strokeWidth} strokeOpacity="0.7" strokeDasharray={`${strokeWidth * 3},${strokeWidth * 2}`} pointerEvents="none" />
                  )}

                  {/* Segmentos libres */}
                  {freeSegs.map(seg => {
                    const a = freePts.find(p => p.id === seg.aId);
                    const b = freePts.find(p => p.id === seg.bId);
                    if (!a || !b) return null;
                    const isCal = calibration && calibration.refSegId === seg.id;
                    const isSelected = selectedSegId === seg.id;
                    // Si la línea ya forma un ángulo, su distancia estorba: en
                    // pantalla debe quedar únicamente la medición del ángulo.
                    const inPair = pairedSegIds.has(seg.id);
                    const color = isCal ? COLORS.green : (isSelected ? COLORS.yellow : COLORS.cyan);
                    const mid = midpoint(a, b);
                    return (
                      <g key={seg.id}>
                        {/* Hitbox invisible (más grueso) para facilitar selección con click */}
                        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                          stroke="transparent" strokeWidth={radius * 2.5} strokeLinecap="round"
                          data-segment={seg.id}
                          onPointerDown={handleSegmentPointerDown(seg.id)}
                          style={{ cursor: "pointer" }} />
                        {/* Línea visible */}
                        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                          stroke={color} strokeWidth={isSelected ? strokeWidth * 1.6 : strokeWidth}
                          strokeOpacity={isCal ? 0.6 : 0.9} strokeLinecap="round"
                          strokeDasharray={isCal ? `${strokeWidth * 2},${strokeWidth * 2}` : "none"}
                          pointerEvents="none" />
                        {(!inPair || isCal) && (
                          <text x={mid.x} y={mid.y - radius * 0.8} fill="#fff" stroke="#000" strokeWidth={strokeWidth * 0.4}
                            paintOrder="stroke" fontSize={radius * 1.5} fontWeight="700" textAnchor="middle" pointerEvents="none">
                            {fmtDist(distance(a, b))}
                          </text>
                        )}
                      </g>
                    );
                  })}

                  {/* Línea de horizontal real (extendida para que se vea claramente) */}
                  {horizontalRef && (() => {
                    const dx = horizontalRef.p2.x - horizontalRef.p1.x;
                    const dy = horizontalRef.p2.y - horizontalRef.p1.y;
                    const len = Math.hypot(dx, dy);
                    if (len === 0) return null;
                    const ux = dx / len, uy = dy / len;
                    const ext = imageDims.w * 0.5;
                    const a = { x: horizontalRef.p1.x - ux * ext, y: horizontalRef.p1.y - uy * ext };
                    const b = { x: horizontalRef.p2.x + ux * ext, y: horizontalRef.p2.y + uy * ext };
                    // Mientras nadie la haya tocado se dibuja atenuada, para que
                    // no se confunda con una medición del estudio.
                    const dim = !horizontalTouched && tool !== "horizontal";
                    return (
                      <g opacity={dim ? 0.55 : 1}>
                        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#fbbf24" strokeWidth={strokeWidth * 0.7} strokeOpacity="0.4" strokeDasharray={`${strokeWidth * 4},${strokeWidth * 3}`} pointerEvents="none" />
                        <line x1={horizontalRef.p1.x} y1={horizontalRef.p1.y} x2={horizontalRef.p2.x} y2={horizontalRef.p2.y} stroke="#fbbf24" strokeWidth={dim ? strokeWidth * 0.9 : strokeWidth * 1.2} strokeOpacity={dim ? 0.7 : 0.85} pointerEvents="none" />
                        <text x={(horizontalRef.p1.x + horizontalRef.p2.x) / 2} y={(horizontalRef.p1.y + horizontalRef.p2.y) / 2 - radius * 0.8} fill={dim ? "#fbbf24" : "#fff"} stroke="#000" strokeWidth={strokeWidth * 0.4} paintOrder="stroke" fontSize={dim ? radius * 1.0 : radius * 1.4} fontWeight="700" textAnchor="middle" pointerEvents="none">
                          {dim
                            ? "referencia horizontal — arrastra solo si la placa está inclinada"
                            : `horizontal · ${horizontalAngle !== null ? `${horizontalAngle >= 0 ? "+" : ""}${horizontalAngle.toFixed(1)}°` : ""} · arrastra ⇄`}
                        </text>
                        {["p1", "p2"].map(key => (
                          <circle key={key} cx={horizontalRef[key].x} cy={horizontalRef[key].y} r={dim ? radius * 0.8 : radius * 1.1} fill="#fbbf24" stroke="#000" strokeWidth={strokeWidth * 0.6}
                            style={{ cursor: "grab" }}
                            onPointerDown={(e) => { e.stopPropagation(); try { e.target.setPointerCapture?.(e.pointerId); } catch (err) {} setDraggingHorizEnd(key); setHorizontalTouched(true); }} />
                        ))}
                      </g>
                    );
                  })()}
                  {/* Marcador del primer click pendiente en modo horizontal */}
                  {horizontalPending && (
                    <circle cx={horizontalPending.x} cy={horizontalPending.y} r={radius * 0.7} fill="#fbbf24" stroke="#000" strokeWidth={strokeWidth * 0.5} pointerEvents="none" />
                  )}

                  {/* Ángulo entre pares de líneas: perpendicular punteada desde el
                      centro de cada línea hasta donde ambas se cortan, con el valor
                      en el vértice. Si las líneas son casi paralelas el corte se va
                      lejos: entonces se dibujan muñones cortos y el valor se rotula
                      entre las dos, para que nunca quede fuera de la vista. */}
                  {linePairs.map(pr => {
                    const isSel = selectedSegId === pr.s1 || selectedSegId === pr.s2;
                    const col = isSel ? COLORS.yellow : COLORS.cyan;
                    const dash = `${strokeWidth * 3},${strokeWidth * 2.5}`;
                    const etiqueta = (x, y) => (
                      <text x={x} y={y} fill="#fff" stroke="#000" strokeWidth={strokeWidth * 0.6}
                        paintOrder="stroke" fontSize={radius * 1.9} fontWeight="800"
                        textAnchor="middle" dominantBaseline="middle">
                        {pr.angle.toFixed(1)}°
                      </text>
                    );

                    if (!pr.vertex) {
                      // Sin vértice dibujable, cada línea saca un muñón hacia la
                      // otra y el valor va en medio: los dos muñones apuntan al
                      // número, que es lo que hace legible la medición.
                      const sep = Math.hypot(pr.m2.x - pr.m1.x, pr.m2.y - pr.m1.y);
                      const stub = Math.min(sep * 0.38, Math.max(imageDims.w, imageDims.h) * 0.15);
                      const medio = midpoint(pr.m1, pr.m2);
                      return (
                        <g key={`pa-${pr.id}`} pointerEvents="none">
                          <line x1={pr.m1.x} y1={pr.m1.y} x2={pr.m1.x + pr.n1.x * stub} y2={pr.m1.y + pr.n1.y * stub}
                            stroke={col} strokeWidth={strokeWidth * 0.8} strokeOpacity="0.75" strokeDasharray={dash} />
                          <line x1={pr.m2.x} y1={pr.m2.y} x2={pr.m2.x + pr.n2.x * stub} y2={pr.m2.y + pr.n2.y * stub}
                            stroke={col} strokeWidth={strokeWidth * 0.8} strokeOpacity="0.75" strokeDasharray={dash} />
                          {etiqueta(medio.x, medio.y)}
                        </g>
                      );
                    }

                    // El valor va dentro del ángulo, sobre la bisectriz: es donde
                    // se lee sin taparlo con las propias líneas.
                    const haciaM1 = { x: pr.m1.x - pr.vertex.x, y: pr.m1.y - pr.vertex.y };
                    const haciaM2 = { x: pr.m2.x - pr.vertex.x, y: pr.m2.y - pr.vertex.y };
                    const nor = (v) => { const l = Math.hypot(v.x, v.y) || 1; return { x: v.x / l, y: v.y / l }; };
                    const w1 = nor(haciaM1), w2 = nor(haciaM2);
                    let bis = { x: w1.x + w2.x, y: w1.y + w2.y };
                    const lb = Math.hypot(bis.x, bis.y);
                    // Ángulo de 180°: la bisectriz se anula y hay que elegir un lado.
                    bis = lb < 1e-6 ? { x: -w1.y, y: w1.x } : { x: bis.x / lb, y: bis.y / lb };
                    const lx = pr.vertex.x + bis.x * radius * 3;
                    const ly = pr.vertex.y + bis.y * radius * 3;

                    return (
                      <g key={`pa-${pr.id}`} pointerEvents="none">
                        <line x1={pr.m1.x} y1={pr.m1.y} x2={pr.vertex.x} y2={pr.vertex.y}
                          stroke={col} strokeWidth={strokeWidth * 0.8} strokeOpacity="0.75" strokeDasharray={dash} />
                        <line x1={pr.m2.x} y1={pr.m2.y} x2={pr.vertex.x} y2={pr.vertex.y}
                          stroke={col} strokeWidth={strokeWidth * 0.8} strokeOpacity="0.75" strokeDasharray={dash} />
                        <circle cx={pr.vertex.x} cy={pr.vertex.y} r={radius * 0.35} fill={col}
                          stroke="#000" strokeWidth={strokeWidth * 0.4} />
                        {etiqueta(lx, ly)}
                      </g>
                    );
                  })}

                  {/* Etiquetas de ángulo en vértices compartidos */}
                  {vertexAngles.map(va => (
                    <g key={`va-${va.ptId}`}>
                      <text x={va.vertex.x} y={va.vertex.y + radius * 2.5} fill="#fff" stroke="#000" strokeWidth={strokeWidth * 0.4}
                        paintOrder="stroke" fontSize={radius * 1.8} fontWeight="800" textAnchor="middle" pointerEvents="none">
                        {va.angle.toFixed(1)}°
                      </text>
                    </g>
                  ))}

                  {/* Puntos libres (drag handles) */}
                  {freePts.map(p => (
                    <circle key={p.id} cx={p.x} cy={p.y} r={radius * 0.75}
                      fill={pendingPtId === p.id ? "#fff" : COLORS.cyan}
                      stroke="#000" strokeWidth={strokeWidth * 0.5}
                      data-freept={p.id}
                      onPointerDown={handleFreePtPointerDown(p.id)}
                      style={{ cursor: tool === "pan" ? "grab" : "move" }} />
                  ))}

                  {/* Landmarks GAP */}
                  {landmarks.map((p, i) => p ? (
                    <g key={i}>
                      {selectedLandmarkIdx === i && (
                        <circle cx={p.x} cy={p.y} r={radius * 1.7} fill="none" stroke={COLORS.yellow} strokeWidth={strokeWidth * 1.2} pointerEvents="none" />
                      )}
                      <circle cx={p.x} cy={p.y} r={radius} fill={LANDMARK_DEFS[i].color} stroke="#fff" strokeWidth={strokeWidth}
                        data-landmark={i} onPointerDown={handleLandmarkPointerDown(i)}
                        style={{ cursor: tool === "pan" ? "grab" : "move" }} />
                      <text x={p.x} y={p.y} dx={radius + 4} dy={radius / 2}
                        fill="#fff" fontSize={radius * 1.6} fontWeight="700" fontFamily="monospace"
                        stroke="#000" strokeWidth={strokeWidth * 0.4} paintOrder="stroke" pointerEvents="none">
                        {i + 1}
                      </text>
                    </g>
                  ) : null)}
                </svg>
              </TransformComponent>
            </TransformWrapper>
          )}

          {/* Controles flotantes de zoom */}
          {imageSrc && (
            <div style={{ position: "absolute", right: 14, bottom: 14, display: "flex", flexDirection: "column", gap: 4, zIndex: 20 }}>
              <button onClick={() => transformRef.current?.zoomIn(0.3)} title="Acercar (zoom +)" style={zoomBtnStyle}>+</button>
              <button onClick={() => transformRef.current?.zoomOut(0.3)} title="Alejar (zoom −)" style={zoomBtnStyle}>−</button>
              <button onClick={() => transformRef.current?.resetTransform()} title="Restablecer zoom" style={{ ...zoomBtnStyle, fontSize: 14 }}>⊕</button>
              <button onClick={() => transformRef.current?.centerView()} title="Centrar imagen" style={{ ...zoomBtnStyle, fontSize: 13 }}>◯</button>
            </div>
          )}

          {/* Aviso de alineación al cargar la placa. La horizontal vive abajo y
              atenuada; este mensaje explica para qué sirve, de modo que nadie
              la interprete como parte de la medición. */}
          {imageSrc && showAlignPrompt && (
            <div style={{ position: "absolute", inset: 0, zIndex: 30, background: "rgba(0,0,0,0.62)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
              <div style={{ maxWidth: 420, background: COLORS.panel, border: `1.5px solid #fbbf2466`, borderRadius: 12, padding: "22px 24px", boxShadow: "0 12px 40px rgba(0,0,0,0.6)", textAlign: "center" }}>
                <div style={{ fontSize: 30, marginBottom: 10 }}>📏</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: COLORS.text, marginBottom: 10 }}>¿La placa está bien alineada?</div>
                <div style={{ fontSize: 12.5, color: COLORS.textDim, lineHeight: 1.6, marginBottom: 18 }}>
                  Si está desalineada, ajusta la <strong style={{ color: "#fbbf24" }}>línea horizontal amarilla</strong> que aparece abajo para corregir <strong style={{ color: COLORS.text }}>SS</strong> y <strong style={{ color: COLORS.text }}>PT</strong>.
                  <br />
                  El PI y los Cobb (L1-S1, L4-S1) no la necesitan: son geométricos.
                  <br />
                  Si eliges que está bien, la línea no se dibuja; puedes prenderla después con el botón 📏 Horizontal.
                </div>
                <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                  <button onClick={() => { setShowAlignPrompt(false); setTool("horizontal"); setHorizontalPending(null); setHorizontalTouched(true); }}
                    style={{ padding: "10px 18px", borderRadius: 8, border: "1.5px solid #fbbf24", background: "#fbbf24", color: "#1a1a1a", fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}>
                    Ajustar horizontal
                  </button>
                  <button onClick={() => { setShowAlignPrompt(false); setHorizontalRef(null); setHorizontalPending(null); }}
                    style={{ ...btnSecondary(false), padding: "10px 18px", fontSize: 12.5 }}>
                    Está bien así
                  </button>
                </div>
                <div style={{ fontSize: 10.5, color: COLORS.textDim, fontStyle: "italic", marginTop: 14, lineHeight: 1.5 }}>
                  Puedes cambiarla en cualquier momento con el botón 📏 Horizontal de la barra.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Side panel */}
        <div style={{ width: 320, background: COLORS.panel, borderLeft: `1px solid ${COLORS.panelLight}`, padding: 14, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* GAP landmarks (clickeables para saltar) */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Puntos GAP — click para elegir</div>
            {LANDMARK_DEFS.map(d => {
              const placed = landmarks[d.idx] !== null;
              const isCurrent = step === d.idx && tool === "gap" && gapMode === "wizard";
              return (
                <button key={d.idx} onClick={() => jumpToLandmark(d.idx)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 6, background: isCurrent ? COLORS.accent + "33" : "transparent", marginBottom: 2, fontSize: 11, border: "none", cursor: "pointer", color: COLORS.text, textAlign: "left" }}>
                  <span style={{ width: 18, height: 18, borderRadius: "50%", background: placed ? d.color : "transparent", border: `2px solid ${d.color}`, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, fontFamily: "monospace", flexShrink: 0 }}>
                    {placed ? "✓" : d.idx + 1}
                  </span>
                  <span style={{ color: placed ? COLORS.text : COLORS.textDim, lineHeight: 1.3, flex: 1 }}>{d.short}</span>
                  {placed && (
                    <span onClick={(e) => { e.stopPropagation(); const newLm = [...landmarks]; newLm[d.idx] = null; setLandmarks(newLm); if (step > d.idx) setStep(d.idx); }}
                      style={{ color: COLORS.textDim, fontSize: 14, padding: "0 4px", lineHeight: 1, cursor: "pointer" }} title="Borrar este punto">×</span>
                  )}
                </button>
              );
            })}

            {/* Desplegable "¿Cómo medir?" con detalles del landmark activo */}
            {currentDef && tool === "gap" && gapMode === "wizard" && (
              <div style={{ marginTop: 8, border: `1px solid ${COLORS.panelLight}`, borderRadius: 6, overflow: "hidden" }}>
                <button onClick={() => setShowHowTo(s => !s)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", background: showHowTo ? COLORS.panelLight : "transparent", border: "none", color: COLORS.text, fontSize: 12, fontWeight: 700, cursor: "pointer", textAlign: "left" }}>
                  <span>¿Cómo medir <span style={{ color: currentDef.color }}>{currentDef.short}</span>?</span>
                  <span style={{ color: COLORS.textDim, fontSize: 14 }}>{showHowTo ? "▾" : "▸"}</span>
                </button>
                {showHowTo && (
                  <div style={{ padding: "10px 12px", fontSize: 11.5, lineHeight: 1.5, background: COLORS.panel, borderTop: `1px solid ${COLORS.panelLight}` }}>
                    <div style={{ fontWeight: 700, color: currentDef.color, marginBottom: 6, fontSize: 12 }}>{currentDef.label}</div>
                    <div style={{ color: COLORS.textDim, marginBottom: 6 }}><strong style={{ color: COLORS.text }}>Qué medir:</strong> {currentDef.que}</div>
                    <div style={{ color: COLORS.textDim, marginBottom: 8 }}><strong style={{ color: COLORS.text }}>Dónde colocarlo:</strong> {currentDef.donde}</div>
                    {/* Figura esquemática (placeholder hasta que se agreguen los dibujos definitivos) */}
                    <div style={{ background: "#0f172a", borderRadius: 4, padding: 8, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 120, border: `1px dashed ${COLORS.panelLight}` }}>
                      {currentDef.figureSrc ? (
                        <img src={currentDef.figureSrc} alt={currentDef.label} style={{ maxWidth: "100%", maxHeight: 180, objectFit: "contain" }} />
                      ) : (
                        <div style={{ color: COLORS.textDim, fontSize: 10, fontStyle: "italic", textAlign: "center" }}>
                          (esquema pendiente)<br/>
                          <span style={{ fontSize: 9 }}>colocar en <code style={{ fontFamily: "monospace" }}>public/landmarks/{currentDef.short.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.png</code></span>
                        </div>
                      )}
                    </div>
                    <div style={{ marginTop: 6, color: COLORS.textDim, fontSize: 10, fontStyle: "italic" }}>
                      Tip: <kbd style={{ background: COLORS.panel, padding: "0 4px", borderRadius: 3, fontFamily: "monospace", fontSize: 10, border: `1px solid ${COLORS.panelLight}` }}>Delete</kbd> borra el punto seleccionado · no es obligatorio seguir el orden.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Resultados parciales */}
          <div style={{ paddingTop: 10, borderTop: `1px solid ${COLORS.panelLight}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Cálculos GAP</div>
            {["pi", "ss", "pt", "l1s1", "l4s1", "gt"].map(key => {
              const v = partial[key];
              const def = ANGLE_DEFS[key];
              const isOpen = expandedAngle === key;
              return (
                <div key={key} style={{ borderBottom: `1px solid ${COLORS.panelLight}` }}>
                  <button onClick={() => setExpandedAngle(isOpen ? null : key)}
                    style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 8px", fontSize: 12, fontFamily: "'JetBrains Mono', monospace", background: isOpen ? COLORS.panelLight : "transparent", border: "none", cursor: "pointer", opacity: v === undefined ? 0.55 : 1, textAlign: "left", color: COLORS.text }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6, color: COLORS.textDim }}>
                      <span style={{ color: COLORS.textDim, fontSize: 10 }}>{isOpen ? "▾" : "▸"}</span>
                      {def.label}
                    </span>
                    <span style={{ fontWeight: 700, color: v === undefined ? COLORS.textDim : COLORS.text }}>{v === undefined ? "—" : `${v.toFixed(1)}°`}</span>
                  </button>
                  {isOpen && (
                    <div style={{ padding: "8px 10px 10px", fontSize: 11, lineHeight: 1.5, color: COLORS.textDim, background: COLORS.panel, borderTop: `1px dashed ${COLORS.panelLight}` }}>
                      <div style={{ fontWeight: 700, color: COLORS.text, marginBottom: 6, fontSize: 11.5 }}>{def.fullName}</div>
                      <div style={{ marginBottom: 8 }}>{def.explicacion}</div>
                      {def.figureSrc && (
                        <div style={{ background: "#0f172a", borderRadius: 4, padding: 6, display: "flex", justifyContent: "center", border: `1px solid ${COLORS.panelLight}` }}>
                          <img src={def.figureSrc} alt={def.fullName} style={{ maxWidth: "100%", maxHeight: 160, objectFit: "contain" }} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {partial.consistencyDelta !== undefined && partial.consistencyDelta !== null && Math.abs(partial.consistencyDelta) > 3 && (
              <div style={{ marginTop: 8, padding: 8, borderRadius: 6, background: COLORS.yellow + "22", border: `1px solid ${COLORS.yellow}66`, color: COLORS.yellow, fontSize: 11, fontWeight: 600, lineHeight: 1.45 }}>
                ⚠ PI ≠ PT + SS (Δ {partial.consistencyDelta >= 0 ? "+" : ""}{partial.consistencyDelta.toFixed(1)}°).
                <br />
                Si la placa está rotada, ajusta la línea horizontal amarilla 📏 arrastrando sus extremos. Si no, revisa los puntos del platillo S1 y las cabezas femorales.
              </div>
            )}
            {/* Hills 2022 — opcionales (L1PA y L1 tilt salen "gratis" del platillo L1) */}
            {(partial.l1pa !== undefined || partial.t4pa !== undefined || partial.c2tilt !== undefined || partial.t1tilt !== undefined || partial.l1tilt !== undefined) && (
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px dashed ${COLORS.panelLight}` }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Hills 2022</div>
                {["l1pa", "t4pa", "c2tilt", "t1tilt", "l1tilt"].map(key => {
                  const v = partial[key];
                  if (v === undefined) return null;
                  const def = HILLS_DEFS[key];
                  const isOpen = expandedAngle === key;
                  return (
                    <div key={key} style={{ borderBottom: `1px solid ${COLORS.panelLight}` }}>
                      <button onClick={() => setExpandedAngle(isOpen ? null : key)}
                        style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 8px", fontSize: 12, fontFamily: "'JetBrains Mono', monospace", background: isOpen ? COLORS.panelLight : "transparent", border: "none", cursor: "pointer", textAlign: "left", color: COLORS.text }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 6, color: COLORS.textDim }}>
                          <span style={{ color: COLORS.textDim, fontSize: 10 }}>{isOpen ? "▾" : "▸"}</span>
                          {def.label}
                        </span>
                        <span style={{ fontWeight: 700, color: COLORS.text }}>{v >= 0 ? "+" : ""}{v.toFixed(1)}°</span>
                      </button>
                      {isOpen && (
                        <div style={{ padding: "8px 10px 10px", fontSize: 11, lineHeight: 1.5, color: COLORS.textDim, background: COLORS.panel, borderTop: `1px dashed ${COLORS.panelLight}` }}>
                          <div style={{ fontWeight: 700, color: COLORS.text, marginBottom: 6, fontSize: 11.5 }}>{def.fullName}</div>
                          <div style={{ marginBottom: 8 }}>{def.explicacion}</div>
                          {def.figureSrc && (
                            <div style={{ background: "#0f172a", borderRadius: 4, padding: 6, display: "flex", justifyContent: "center", border: `1px solid ${COLORS.panelLight}` }}>
                              <img src={def.figureSrc} alt={def.fullName} style={{ maxWidth: "100%", maxHeight: 160, objectFit: "contain" }} />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {/* SRS-Schwab — clasificación sagital (Schwab 2012) */}
            {(partial.piLL !== undefined || partial.pt !== undefined || partial.svaPx !== undefined) && (() => {
              const svaCm = (partial.svaPx !== undefined && calibration) ? partial.svaPx * calibration.mmPerPx / 10 : null;
              const gPiLL = schwabGrade(partial.piLL, 10, 20);
              const gPt   = schwabGrade(partial.pt,   20, 30);
              const gSva  = schwabGrade(svaCm,        4,  9.5);
              return (
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px dashed ${COLORS.panelLight}` }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>SRS-Schwab</div>
                  {[
                    { key: "piLL", label: "PI − LL",  val: partial.piLL, unit: "°",  grade: gPiLL, t: "0:<10° · +:10-20° · ++:>20°" },
                    { key: "pt",   label: "PT",        val: partial.pt,    unit: "°",  grade: gPt,   t: "0:<20° · +:20-30° · ++:>30°" },
                    { key: "sva",  label: "SVA",       val: svaCm,         unit: " cm", grade: gSva,  t: "0:<4cm · +:4-9.5cm · ++:>9.5cm",
                      altText: partial.svaPx !== undefined && !calibration ? `${Math.round(partial.svaPx)} px (calibra para cm)` : null },
                  ].map(row => (
                    <div key={row.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 8px", fontSize: 12, fontFamily: "'JetBrains Mono', monospace", borderBottom: `1px solid ${COLORS.panelLight}` }}>
                      <span style={{ color: COLORS.textDim }}>{row.label}</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {row.val !== null && row.val !== undefined ? (
                          <span style={{ fontWeight: 700, color: COLORS.text }}>{row.val.toFixed(1)}{row.unit}</span>
                        ) : row.altText ? (
                          <span style={{ fontSize: 10, color: COLORS.textDim, fontStyle: "italic" }}>{row.altText}</span>
                        ) : (
                          <span style={{ color: COLORS.textDim }}>—</span>
                        )}
                        {row.grade && (
                          <span style={{ padding: "1px 7px", borderRadius: 5, background: row.grade.color + "22", color: row.grade.color, border: `1px solid ${row.grade.color}66`, fontSize: 11, fontWeight: 800, minWidth: 28, textAlign: "center" }}>{row.grade.g}</span>
                        )}
                      </span>
                    </div>
                  ))}
                  {partial.svaPx !== undefined && !calibration && (
                    <div style={{ marginTop: 6, fontSize: 10, color: COLORS.textDim, fontStyle: "italic", lineHeight: 1.4 }}>
                      Para gradar SVA usa ⚖ Calibrar (longitud conocida en mm) o ingresa el valor manualmente en el formulario.
                    </div>
                  )}
                </div>
              );
            })()}

            <button onClick={handleApply} disabled={!anyAngle} style={{ marginTop: 12, width: "100%", padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${anyAngle ? COLORS.green : COLORS.panelLight}`, background: anyAngle ? COLORS.green : "transparent", color: anyAngle ? "#fff" : COLORS.textDim, fontSize: 13, fontWeight: 700, cursor: anyAngle ? "pointer" : "not-allowed", opacity: anyAngle ? 1 : 0.5 }}>
              Aplicar valores disponibles al formulario
            </button>
            {!anyAngle && <div style={{ fontSize: 10, color: COLORS.textDim, fontStyle: "italic", marginTop: 6, textAlign: "center" }}>Coloca al menos los puntos S1 (post + ant) para empezar a obtener valores.</div>}
          </div>

          {/* Mediciones libres */}
          <div style={{ paddingTop: 10, borderTop: `1px solid ${COLORS.panelLight}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
              Mediciones libres {freeSegs.length > 0 ? `(${freeSegs.length} línea${freeSegs.length === 1 ? "" : "s"}, ${vertexAngles.length + linePairs.length} ángulo${vertexAngles.length + linePairs.length === 1 ? "" : "s"})` : ""}
            </div>
            {freeSegs.length === 0 ? (
              <div style={{ fontSize: 11, color: COLORS.textDim, fontStyle: "italic", lineHeight: 1.5 }}>
                Cambia a "📐 Medir (línea/ángulo)" arriba. Una línea sola muestra su distancia; al trazar la segunda, las dos se emparejan y queda el ángulo entre ellas.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {freeSegs.map((s, i) => {
                  const a = freePts.find(p => p.id === s.aId);
                  const b = freePts.find(p => p.id === s.bId);
                  if (!a || !b) return null;
                  const isCal = calibration && calibration.refSegId === s.id;
                  const isSelected = selectedSegId === s.id;
                  return (
                    <div key={s.id} onClick={() => setSelectedSegId(s.id)}
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", borderRadius: 6,
                        background: isSelected ? COLORS.yellow + "33" : COLORS.panelLight,
                        border: isSelected ? `1px solid ${COLORS.yellow}` : "1px solid transparent",
                        fontSize: 12, cursor: "pointer" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: COLORS.text }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: isCal ? COLORS.green : (isSelected ? COLORS.yellow : COLORS.cyan) }} />
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{fmtDist(distance(a, b))}</span>
                        <span style={{ color: COLORS.textDim, fontSize: 10 }}>{isCal ? "calib" : `línea ${i + 1}`}</span>
                      </span>
                      <button onClick={(e) => { e.stopPropagation(); deleteSeg(s.id); }} title="Borrar esta línea"
                        style={{ background: "transparent", border: "none", color: COLORS.textDim, cursor: "pointer", fontSize: 14, padding: "0 4px", lineHeight: 1 }}>×</button>
                    </div>
                  );
                })}
                {linePairs.map((pr, i) => (
                  <div key={`pair-row-${pr.id}`} onClick={() => setSelectedSegId(pr.s1)}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", borderRadius: 6, background: COLORS.cyan + "22", border: `1px solid ${COLORS.cyan}55`, fontSize: 12, cursor: "pointer" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: COLORS.text }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.cyan }} />
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{pr.angle.toFixed(1)}°</span>
                      <span style={{ color: COLORS.textDim, fontSize: 10 }}>ángulo {i + 1}</span>
                    </span>
                    <button onClick={(e) => { e.stopPropagation(); deleteSegs([pr.s1, pr.s2]); }} title="Borrar las dos líneas de este ángulo"
                      style={{ background: "transparent", border: "none", color: COLORS.textDim, cursor: "pointer", fontSize: 14, padding: "0 4px", lineHeight: 1 }}>×</button>
                  </div>
                ))}
                {vertexAngles.map((va, i) => (
                  <div key={`va-${va.ptId}`} style={{ display: "flex", alignItems: "center", padding: "6px 8px", borderRadius: 6, background: COLORS.panelLight, fontSize: 12 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: COLORS.text }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.pink }} />
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{va.angle.toFixed(1)}°</span>
                      <span style={{ color: COLORS.textDim, fontSize: 10 }}>ángulo {i + 1} (auto)</span>
                    </span>
                  </div>
                ))}
                <button onClick={clearFreeMeasurements} style={{ marginTop: 4, padding: "5px 8px", borderRadius: 6, border: `1px solid ${COLORS.panelLight}`, background: "transparent", color: COLORS.textDim, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                  Borrar todas las mediciones libres
                </button>
              </div>
            )}
          </div>

          {/* Horizontal real */}
          <div style={{ paddingTop: 10, borderTop: `1px solid ${COLORS.panelLight}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Referencia horizontal</div>
            {horizontalRef ? (
              <div style={{ fontSize: 12, color: COLORS.text }}>
                <div style={{ padding: "6px 8px", borderRadius: 6, background: "#fbbf24" + "22", border: `1px solid #fbbf2444`, color: "#fbbf24", marginBottom: 8, lineHeight: 1.45 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span>📏 Línea horizontal</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700 }}>{horizontalAngle !== null ? `${horizontalAngle >= 0 ? "+" : ""}${horizontalAngle.toFixed(1)}°` : "—"}</span>
                  </div>
                  <span style={{ fontSize: 10, opacity: 0.85 }}>Arrastra los círculos amarillos para alinearla con la placa. 0.0° = paralela al eje X de la imagen.</span>
                </div>
                <button onClick={() => { const w = imageDims.w, h = imageDims.h; if (w && h) setHorizontalRef({ p1: { x: w*0.20, y: h*0.88 }, p2: { x: w*0.80, y: h*0.88 } }); }} style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: `1px solid ${COLORS.panelLight}`, background: "transparent", color: COLORS.textDim, fontSize: 11, fontWeight: 600, cursor: "pointer", marginBottom: 4 }}>
                  Resetear al eje X de la imagen
                </button>
                <button onClick={() => setHorizontalRef(null)} style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: `1px solid ${COLORS.panelLight}`, background: "transparent", color: COLORS.textDim, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                  Ocultar línea horizontal
                </button>
              </div>
            ) : (
              <div style={{ fontSize: 11, color: COLORS.textDim, fontStyle: "italic", lineHeight: 1.55 }}>
                Sin línea horizontal: SS y PT se miden respecto al eje X de la imagen. Usa <strong style={{ color: "#fbbf24" }}>📏 Horizontal</strong> arriba para definirla si la placa está rotada.
              </div>
            )}
          </div>

          {/* Calibración */}
          <div style={{ paddingTop: 10, borderTop: `1px solid ${COLORS.panelLight}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Calibración (distancias)</div>
            {calibration ? (
              <div style={{ fontSize: 12, color: COLORS.text }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", padding: "6px 8px", borderRadius: 6, background: COLORS.green + "22", border: `1px solid ${COLORS.green}44`, color: COLORS.green, marginBottom: 8 }}>
                  ✓ {calibration.refMm.toFixed(1)} mm = línea de referencia<br/>
                  <span style={{ fontSize: 10, opacity: 0.85 }}>{(1 / calibration.mmPerPx).toFixed(2)} px/mm · {calibration.mmPerPx.toFixed(4)} mm/px</span>
                </div>
                <button onClick={() => setCalibration(null)} style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: `1px solid ${COLORS.panelLight}`, background: "transparent", color: COLORS.textDim, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                  Borrar calibración
                </button>
              </div>
            ) : (
              <div style={{ fontSize: 11, color: COLORS.textDim, fontStyle: "italic", lineHeight: 1.55 }}>
                Sin calibrar → distancias en píxeles. Para mostrar en mm: usa <strong style={{ color: COLORS.green }}>⚖ Calibrar</strong> arriba sobre una distancia conocida.
              </div>
            )}
          </div>

          {/* Guardar imagen anotada (solo modo clínico) */}
          {canEdit && (
            <div style={{ paddingTop: 10, borderTop: `1px solid ${COLORS.panelLight}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Imagen anotada</div>
              <button onClick={handleSaveAnnotated} disabled={!imageSrc || savingAnnotated}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${COLORS.cyan}`, background: COLORS.cyan, color: "#000", fontSize: 12, fontWeight: 700, cursor: !imageSrc || savingAnnotated ? "not-allowed" : "pointer", opacity: !imageSrc || savingAnnotated ? 0.5 : 1 }}>
                {savingAnnotated ? "Generando…" : "💾 Guardar imagen anotada al caso"}
              </button>
              <div style={{ fontSize: 10, color: COLORS.textDim, fontStyle: "italic", marginTop: 6, lineHeight: 1.5 }}>
                Captura la radiografía con todas las líneas, ángulos y referencias dibujados encima. La imagen se agrega a las fotos del caso (categoría "Radiografía anotada"). Subirá a Firebase cuando guardes el caso desde el formulario principal.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function btnSecondary(disabled) {
  return {
    padding: "6px 12px", borderRadius: 6, border: `1px solid ${COLORS.panelLight}`,
    background: "transparent", color: disabled ? COLORS.textDim : COLORS.text,
    fontSize: 11, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1
  };
}

function btnTool(active, color) {
  return {
    padding: "6px 12px", borderRadius: 6,
    border: `1.5px solid ${active ? color : COLORS.panelLight}`,
    background: active ? color + "33" : "transparent",
    color: active ? color : COLORS.text,
    fontSize: 11, fontWeight: 700, cursor: "pointer"
  };
}

const zoomBtnStyle = {
  width: 36, height: 36,
  borderRadius: 8,
  border: `1px solid ${COLORS.panelLight}`,
  background: COLORS.panel + "ee",
  color: COLORS.text,
  fontSize: 18, fontWeight: 700,
  cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
  boxShadow: "0 2px 8px rgba(0,0,0,0.4)"
};
