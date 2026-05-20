import { useState, useRef, useEffect, useMemo } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { midpoint, distance, angleAtVertex, computePI, computeSS, computePT, computeL1S1, computeL4S1, computeGT, computePA, computeVertebralTilt } from "./geometry";

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

const LANDMARK_DEFS = [
  {
    idx: 0, short: "Fem. izq.", color: "#e11d48",
    label: "Centro de la cabeza femoral izquierda",
    que: "Uno de los dos puntos que definen el eje bicoxofemoral. Su punto medio con la cabeza derecha es el centro de rotación de la pelvis (base de PI, PT y GT).",
    donde: "Marca el centro del círculo formado por la cabeza femoral. Si las dos cabezas se proyectan superpuestas en la lateral, marca el centro de la cabeza más radiopaca (la más cercana al detector se ve más nítida)."
  },
  {
    idx: 1, short: "Fem. der.", color: "#e11d48",
    label: "Centro de la cabeza femoral derecha",
    que: "Segundo punto del eje bicoxofemoral. Junto con el anterior define la línea de las cabezas femorales.",
    donde: "Misma técnica que la izquierda, lado opuesto. Si están perfectamente superpuestas, marca este punto sobre la cabeza menos radiopaca (la más alejada del detector). El punto medio de los dos cae igual en el centro de rotación."
  },
  {
    idx: 2, short: "S1 post.", color: "#0891b2",
    label: "Esquina posterior del platillo superior de S1",
    que: "Define el límite dorsal del platillo superior de S1. La línea S1 post → S1 ant determina la pendiente sacra (SS).",
    donde: "Esquina trasera del platillo superior de S1: donde el platillo se encuentra con el muro posterior del cuerpo de S1 (el lado que mira al canal raquídeo)."
  },
  {
    idx: 3, short: "S1 ant.", color: "#0891b2",
    label: "Esquina anterior del platillo superior de S1",
    que: "Cierra la línea del platillo superior de S1. La inclinación del segmento entre S1 post y S1 ant es la SS.",
    donde: "Esquina delantera del platillo de S1: donde el platillo se encuentra con el muro anterior del cuerpo de S1. La línea entre los dos puntos S1 debe seguir el borde superior de la primera vértebra sacra."
  },
  {
    idx: 4, short: "L4 post.", color: "#16a34a",
    label: "Esquina posterior del platillo superior de L4",
    que: "Define el platillo superior de L4, plano de referencia para la lordosis distal L4-S1.",
    donde: "Identifica L4 contando desde S1: la primera vértebra sobre S1 es L5, la siguiente es L4. Marca la esquina trasera del platillo superior de L4."
  },
  {
    idx: 5, short: "L4 ant.", color: "#16a34a",
    label: "Esquina anterior del platillo superior de L4",
    que: "Cierra el plano del platillo superior de L4.",
    donde: "Esquina delantera del platillo superior de L4. La línea entre L4 post y L4 ant debe seguir el borde superior del cuerpo vertebral."
  },
  {
    idx: 6, short: "L1 post.", color: "#7c3aed",
    label: "Esquina posterior del platillo superior de L1",
    que: "Define el platillo superior de L1, plano superior de la lordosis lumbar total (L1-S1).",
    donde: "Cuenta 5 vértebras desde S1 hacia arriba (L5 → L4 → L3 → L2 → L1). Marca la esquina trasera del platillo superior de L1."
  },
  {
    idx: 7, short: "L1 ant.", color: "#7c3aed",
    label: "Esquina anterior del platillo superior de L1",
    que: "Cierra el plano del platillo superior de L1.",
    donde: "Esquina delantera del platillo superior de L1. La línea entre los dos puntos L1 debe coincidir con el borde superior del cuerpo de L1."
  },
  {
    idx: 8, short: "C7", color: "#ea580c",
    label: "Centro del cuerpo vertebral de C7",
    que: "Punto de referencia más alto del eje espinal. Junto con el centro de S1 y el eje femoral define el Global Tilt (GT).",
    donde: "Centro del cuerpo vertebral de C7 (NO la apófisis espinosa). C7 es la última cervical y tiene la apófisis más prominente del cuello. Marca el centro del cuadrilátero del cuerpo vertebral."
  },
  // ── Hills 2022 (opcionales): T4 centroide para T4PA, T1 y C2 centroides para tilts ──
  {
    idx: 9, short: "T4 (opc.)", color: "#3b82f6", optional: true,
    label: "Centro del cuerpo vertebral de T4",
    que: "Centroide del cuerpo de T4 (Hills 2022). Define el T4 Pelvic Angle (T4PA) y, junto con el L1PA, el eje T4-L1-cadera. Opcional — solo si quieres T4PA.",
    donde: "Cuenta 4 vértebras desde C7 hacia abajo (C7 → T1 → T2 → T3 → T4). Marca el centro del cuadrilátero del cuerpo vertebral de T4 (NO la apófisis espinosa)."
  },
  {
    idx: 10, short: "T1 (opc.)", color: "#1d4ed8", optional: true,
    label: "Centro del cuerpo vertebral de T1",
    que: "Centroide del cuerpo de T1 (Hills 2022). Necesario para calcular el T1 tilt directo desde la radiografía. Opcional — solo si quieres T1 tilt.",
    donde: "T1 es la primera vértebra torácica, justo debajo de C7. Marca el centro del cuadrilátero del cuerpo vertebral (NO la apófisis espinosa)."
  },
  {
    idx: 11, short: "C2 (opc.)", color: "#1e3a8a", optional: true,
    label: "Centro del cuerpo vertebral de C2",
    que: "Centroide del cuerpo de C2 (Hills 2022). Necesario para calcular el C2 tilt directo desde la radiografía. Opcional — solo si quieres C2 tilt.",
    donde: "C2 es la segunda vértebra cervical (axis), debajo del atlas. Tiene una apófisis odontoides característica. Marca el centro del cuadrilátero del cuerpo vertebral por debajo de la odontoides."
  }
];

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const round1 = (n) => Math.round(n * 10) / 10;

export default function LandmarkAnnotator({ open, onClose, onApply, canEdit, onSaveAnnotated }) {
  const [imageSrc, setImageSrc] = useState(null);
  const [imageDims, setImageDims] = useState({ w: 0, h: 0 });

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
  const [tool, setTool] = useState("gap"); // gap | line | calibrate | pan
  const [gapMode, setGapMode] = useState("wizard"); // wizard | free

  // Calibración
  const [calibration, setCalibration] = useState(null); // { mmPerPx, refSegId, refMm }
  const [calibratePending, setCalibratePending] = useState(null); // { aId, bId } esperando entrada de mm
  const [calibrateInput, setCalibrateInput] = useState("");

  // Horizontal real (cuando la radiografía no está alineada)
  const [horizontalRef, setHorizontalRef] = useState(null); // { p1: {x,y}, p2: {x,y} } o null
  const [horizontalPending, setHorizontalPending] = useState(null); // primer click en modo horizontal
  const [draggingHorizEnd, setDraggingHorizEnd] = useState(null); // "p1" | "p2" | null

  // Selección (para borrar con tecla)
  const [selectedSegId, setSelectedSegId] = useState(null);
  const [selectedLandmarkIdx, setSelectedLandmarkIdx] = useState(null);

  // Guardado de imagen anotada
  const [savingAnnotated, setSavingAnnotated] = useState(false);

  // Detección click-vs-drag (umbral de movimiento en pantalla, en pixeles)
  const dragCandidateRef = useRef(null); // { type: "freept"|"landmark", id, startX, startY, started, pointerId, target }
  const DRAG_THRESHOLD = 4;

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
    }
  }, [open]);

  // Deselecciona si el segmento seleccionado deja de existir
  useEffect(() => {
    if (selectedSegId && !freeSegs.some(s => s.id === selectedSegId)) {
      setSelectedSegId(null);
    }
  }, [freeSegs, selectedSegId]);

  // Atajos de teclado: Delete/Backspace para borrar segmento seleccionado, Escape para cancelar
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      // Si hay input enfocado (calibración), no procesar
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;
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
  }, [open, selectedSegId, selectedLandmarkIdx, pendingPtId, freeSegs, landmarks, step]);

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
    return out;
  }, [landmarks, horizontalRef]);

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
      out.push({ ptId, vertex, oA, oB, angle: angleAtVertex(vertex, oA, oB) });
    }
    return out;
  }, [freePts, freeSegs]);

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
        setLandmarks(Array(LANDMARK_DEFS.length).fill(null));
        setStep(0);
        setFreePts([]);
        setFreeSegs([]);
        setPendingPtId(null);
        setCalibration(null);
        setCalibratePending(null);
        // Horizontal por defecto: línea horizontal centrada (eje X de la imagen).
        // El usuario puede arrastrar los endpoints para alinearla con la placa si está rotada.
        setHorizontalRef({
          p1: { x: w * 0.20, y: h * 0.50 },
          p2: { x: w * 0.80, y: h * 0.50 }
        });
        setHorizontalPending(null);
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

  const radius = imageDims.w > 0 ? Math.max(8, imageDims.w / 200) : 8;
  const strokeWidth = imageDims.w > 0 ? Math.max(2, imageDims.w / 600) : 2;
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

  // Borrar segmento individual + limpiar puntos huérfanos
  const deleteSeg = (segId) => {
    const newSegs = freeSegs.filter(s => s.id !== segId);
    setFreeSegs(newSegs);
    // Limpiar puntos que no quedan referenciados ni están pendientes
    const usedIds = new Set();
    newSegs.forEach(s => { usedIds.add(s.aId); usedIds.add(s.bId); });
    if (pendingPtId) usedIds.add(pendingPtId);
    setFreePts(prev => prev.filter(p => usedIds.has(p.id)));
    // Si era el segmento de calibración, borrar calibración
    if (calibration && calibration.refSegId === segId) setCalibration(null);
  };

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

  const handleUndo = () => {
    if (calibratePending) { cancelCalibration(); return; }
    if (pendingPtId !== null) {
      // Limpiar punto pendiente si no es referenciado por otro segmento
      const refed = freeSegs.some(s => s.aId === pendingPtId || s.bId === pendingPtId);
      if (!refed) setFreePts(prev => prev.filter(p => p.id !== pendingPtId));
      setPendingPtId(null);
      return;
    }
    if (tool === "line" && freeSegs.length > 0) {
      const last = freeSegs[freeSegs.length - 1];
      deleteSeg(last.id);
      return;
    }
    // GAP undo: borra el último landmark colocado
    const lastFilledIdx = [...landmarks].map((p, i) => p ? i : -1).filter(i => i >= 0).pop();
    if (lastFilledIdx === undefined) return;
    const newLm = [...landmarks];
    newLm[lastFilledIdx] = null;
    setLandmarks(newLm);
    setStep(lastFilledIdx);
  };

  const handleResetGAP = () => {
    setLandmarks(Array(9).fill(null));
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
    setLandmarks(Array(9).fill(null));
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
    if (Object.keys(out).length === 0) return;
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
              <button onClick={handleUndo} style={btnSecondary(false)}>↶ Deshacer</button>
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
          <button onClick={() => { setTool("horizontal"); setPendingPtId(null); setHorizontalPending(null); }} style={btnTool(tool === "horizontal", "#fbbf24")}>📏 Horizontal</button>
          <button onClick={() => { setTool("pan"); setPendingPtId(null); }} style={btnTool(tool === "pan", "#888")}>🤚 Pan/Zoom</button>
          {tool === "gap" && (
            <button onClick={() => setGapMode(gapMode === "free" ? "wizard" : "free")} style={{ ...btnTool(gapMode === "free", COLORS.yellow), marginLeft: 12 }}>
              {gapMode === "free" ? "✓ Solo arrastrar" : "Solo arrastrar"}
            </button>
          )}
        </div>
      )}

      {/* Hint contextual */}
      {imageSrc && tool === "gap" && currentDef && gapMode === "wizard" && (
        <div style={{ padding: "10px 16px", background: COLORS.panelLight, borderBottom: `1px solid ${COLORS.panelLight}`, color: COLORS.text, fontSize: 12, lineHeight: 1.55 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: currentDef.color, fontSize: 13 }}>Punto {step + 1}/{LANDMARK_DEFS.length}{currentDef.optional ? " · opc." : ""}</span>
            <span style={{ fontWeight: 700, color: COLORS.text }}>{currentDef.label}</span>
          </div>
          <div style={{ color: COLORS.textDim, marginBottom: 3 }}><strong style={{ color: COLORS.text }}>Qué medir:</strong> {currentDef.que}</div>
          <div style={{ color: COLORS.textDim }}><strong style={{ color: COLORS.text }}>Dónde colocarlo:</strong> {currentDef.donde}</div>
          <div style={{ marginTop: 6, color: COLORS.textDim, fontSize: 11, fontStyle: "italic" }}>
            Tip: en el panel derecho puedes saltarte al punto que quieras (no es obligatorio seguir el orden).
            Click sobre un punto colocado para seleccionarlo · <kbd style={{ background: COLORS.panel, padding: "0 4px", borderRadius: 3, fontFamily: "monospace", fontSize: 10 }}>Delete</kbd> lo borra.
          </div>
        </div>
      )}
      {imageSrc && tool === "gap" && gapMode === "free" && (
        <div style={{ padding: "10px 16px", background: COLORS.panelLight, borderBottom: `1px solid ${COLORS.panelLight}`, color: COLORS.text, fontSize: 12 }}>
          Modo "solo arrastrar": clicks en la imagen no colocan puntos nuevos. Arrastra los puntos GAP existentes para reposicionarlos. Cambia a "GAP" wizard si quieres seguir colocando puntos.
        </div>
      )}
      {imageSrc && tool === "line" && (
        <div style={{ padding: "10px 16px", background: COLORS.panelLight, borderBottom: `1px solid ${COLORS.panelLight}`, color: COLORS.text, fontSize: 12, lineHeight: 1.55 }}>
          <strong>Línea / ángulo:</strong> click 2 puntos para crear una línea.
          Si haces click sobre un endpoint que ya existe, la nueva línea sale desde ahí compartiendo vértice → el ángulo aparece automáticamente.
          Arrastra cualquier endpoint para ajustar (la distancia y el ángulo se actualizan en vivo).
          Para fusionar dos endpoints en uno, arrastra uno encima del otro.
          Click sobre una línea para seleccionarla; <kbd style={{ background: COLORS.panel, padding: "1px 5px", borderRadius: 4, border: `1px solid ${COLORS.panelLight}`, fontFamily: "monospace", fontSize: 11 }}>Delete</kbd>/<kbd style={{ background: COLORS.panel, padding: "1px 5px", borderRadius: 4, border: `1px solid ${COLORS.panelLight}`, fontFamily: "monospace", fontSize: 11 }}>Backspace</kbd> la borra. <kbd style={{ background: COLORS.panel, padding: "1px 5px", borderRadius: 4, border: `1px solid ${COLORS.panelLight}`, fontFamily: "monospace", fontSize: 11 }}>Esc</kbd> cancela.
          <span style={{ color: COLORS.textDim, fontStyle: "italic", marginLeft: 6 }}>{pendingPtId ? "Click siguiente punto…" : (selectedSegId ? "Línea seleccionada (Delete para borrar)" : "Click primer punto.")}</span>
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
          <strong>Definir horizontal real:</strong> click 2 puntos sobre algo que sabes está horizontal (borde de mesa, plomo, marcador, suelo). Se usa para corregir SS y PT cuando la radiografía no está bien alineada. PI y los Cobb (L1-S1, L4-S1) no necesitan esto — son geométricos.
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
              pinch={{ disabled: tool !== "pan" }}>
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
                        <text x={mid.x} y={mid.y - radius * 0.8} fill="#fff" stroke="#000" strokeWidth={strokeWidth * 0.4}
                          paintOrder="stroke" fontSize={radius * 1.5} fontWeight="700" textAnchor="middle" pointerEvents="none">
                          {fmtDist(distance(a, b))}
                        </text>
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
                    return (
                      <g>
                        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#fbbf24" strokeWidth={strokeWidth * 0.7} strokeOpacity="0.4" strokeDasharray={`${strokeWidth * 4},${strokeWidth * 3}`} pointerEvents="none" />
                        <line x1={horizontalRef.p1.x} y1={horizontalRef.p1.y} x2={horizontalRef.p2.x} y2={horizontalRef.p2.y} stroke="#fbbf24" strokeWidth={strokeWidth * 1.2} strokeOpacity="0.85" pointerEvents="none" />
                        <text x={(horizontalRef.p1.x + horizontalRef.p2.x) / 2} y={(horizontalRef.p1.y + horizontalRef.p2.y) / 2 - radius * 0.8} fill="#fff" stroke="#000" strokeWidth={strokeWidth * 0.4} paintOrder="stroke" fontSize={radius * 1.4} fontWeight="700" textAnchor="middle" pointerEvents="none">horizontal · arrastra ⇄</text>
                        {["p1", "p2"].map(key => (
                          <circle key={key} cx={horizontalRef[key].x} cy={horizontalRef[key].y} r={radius * 1.1} fill="#fbbf24" stroke="#000" strokeWidth={strokeWidth * 0.6}
                            style={{ cursor: "grab" }}
                            onPointerDown={(e) => { e.stopPropagation(); try { e.target.setPointerCapture?.(e.pointerId); } catch (err) {} setDraggingHorizEnd(key); }} />
                        ))}
                      </g>
                    );
                  })()}
                  {/* Marcador del primer click pendiente en modo horizontal */}
                  {horizontalPending && (
                    <circle cx={horizontalPending.x} cy={horizontalPending.y} r={radius * 0.7} fill="#fbbf24" stroke="#000" strokeWidth={strokeWidth * 0.5} pointerEvents="none" />
                  )}

                  {/* Etiquetas de ángulo en vértices compartidos */}
                  {vertexAngles.map(va => (
                    <g key={`va-${va.ptId}`}>
                      <text x={va.vertex.x} y={va.vertex.y + radius * 2.5} fill="#fff" stroke="#000" strokeWidth={strokeWidth * 0.4}
                        paintOrder="stroke" fontSize={radius * 1.6} fontWeight="700" textAnchor="middle" pointerEvents="none">
                        ∠ {va.angle.toFixed(1)}°
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
          </div>

          {/* Resultados parciales */}
          <div style={{ paddingTop: 10, borderTop: `1px solid ${COLORS.panelLight}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Cálculos GAP (en vivo)</div>
            {[
              { key: "pi", label: "PI" }, { key: "ss", label: "SS" }, { key: "pt", label: "PT" },
              { key: "l1s1", label: "L1-S1" }, { key: "l4s1", label: "L4-S1" }, { key: "gt", label: "GT" }
            ].map(r => {
              const v = partial[r.key];
              return (
                <div key={r.key} style={{ display: "flex", justifyContent: "space-between", padding: "5px 8px", fontSize: 12, fontFamily: "'JetBrains Mono', monospace", borderBottom: `1px solid ${COLORS.panelLight}`, opacity: v === undefined ? 0.4 : 1 }}>
                  <span style={{ color: COLORS.textDim }}>{r.label}</span>
                  <span style={{ fontWeight: 700, color: v === undefined ? COLORS.textDim : COLORS.text }}>{v === undefined ? "—" : `${v.toFixed(1)}°`}</span>
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
                <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Hills 2022 (en vivo)</div>
                {[
                  { key: "l1pa", label: "L1PA" }, { key: "t4pa", label: "T4PA" },
                  { key: "c2tilt", label: "C2 tilt" }, { key: "t1tilt", label: "T1 tilt" }, { key: "l1tilt", label: "L1 tilt" }
                ].map(r => {
                  const v = partial[r.key];
                  if (v === undefined) return null;
                  return (
                    <div key={r.key} style={{ display: "flex", justifyContent: "space-between", padding: "4px 8px", fontSize: 12, fontFamily: "'JetBrains Mono', monospace", borderBottom: `1px solid ${COLORS.panelLight}` }}>
                      <span style={{ color: COLORS.textDim }}>{r.label}</span>
                      <span style={{ fontWeight: 700, color: COLORS.text }}>{v >= 0 ? "+" : ""}{v.toFixed(1)}°</span>
                    </div>
                  );
                })}
              </div>
            )}
            <button onClick={handleApply} disabled={!anyAngle} style={{ marginTop: 12, width: "100%", padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${anyAngle ? COLORS.green : COLORS.panelLight}`, background: anyAngle ? COLORS.green : "transparent", color: anyAngle ? "#fff" : COLORS.textDim, fontSize: 13, fontWeight: 700, cursor: anyAngle ? "pointer" : "not-allowed", opacity: anyAngle ? 1 : 0.5 }}>
              Aplicar valores disponibles al formulario
            </button>
            {!anyAngle && <div style={{ fontSize: 10, color: COLORS.textDim, fontStyle: "italic", marginTop: 6, textAlign: "center" }}>Coloca al menos los puntos S1 (post + ant) para empezar a obtener valores.</div>}
          </div>

          {/* Mediciones libres */}
          <div style={{ paddingTop: 10, borderTop: `1px solid ${COLORS.panelLight}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
              Mediciones libres {freeSegs.length > 0 ? `(${freeSegs.length} línea${freeSegs.length === 1 ? "" : "s"}, ${vertexAngles.length} ángulo${vertexAngles.length === 1 ? "" : "s"})` : ""}
            </div>
            {freeSegs.length === 0 ? (
              <div style={{ fontSize: 11, color: COLORS.textDim, fontStyle: "italic", lineHeight: 1.5 }}>
                Cambia a "📐 Medir (línea/ángulo)" arriba. Cada línea muestra su distancia. Si dos líneas comparten un endpoint (click sobre un punto existente), el ángulo aparece automáticamente.
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
                  📏 Línea horizontal activa<br/>
                  <span style={{ fontSize: 10, opacity: 0.85 }}>Arrastra los círculos amarillos para alinearla con la placa si está rotada. SS y PT se corrigen en vivo.</span>
                </div>
                <button onClick={() => { const w = imageDims.w, h = imageDims.h; if (w && h) setHorizontalRef({ p1: { x: w*0.20, y: h*0.50 }, p2: { x: w*0.80, y: h*0.50 } }); }} style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: `1px solid ${COLORS.panelLight}`, background: "transparent", color: COLORS.textDim, fontSize: 11, fontWeight: 600, cursor: "pointer", marginBottom: 4 }}>
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
