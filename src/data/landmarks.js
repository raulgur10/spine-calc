// ═══════════════════════════════════════════════════════════════════════════
// Trazo del anotador
// ═══════════════════════════════════════════════════════════════════════════
// Agnóstico del motor y de React: lo importan el anotador (para emitir el
// trazo) y la capa de datos (para persistirlo).
//
// Hasta ahora el anotador calculaba los ángulos, los volcaba al formulario y
// las coordenadas se perdían al cerrar el modal. Lo único que sobrevivía era un
// JPG rasterizado. Esas coordenadas son la materia prima del dataset y del
// modelo de keypoints, así que a partir de aquí se guardan.

// Códigos de los 12 landmarks, en el orden de LANDMARK_DEFS del anotador.
// Este orden es un contrato: los índices se persisten junto a cada punto y
// reordenar la lista invalidaría los trazos ya guardados.
export const LANDMARK_KEYS = [
  "femL", "femR",         // 0-1  cabezas femorales
  "s1Post", "s1Ant",      // 2-3  platillo superior de S1
  "l4Post", "l4Ant",      // 4-5  platillo superior de L4
  "l1Post", "l1Ant",      // 6-7  platillo superior de L1
  "c7",                   // 8    centroide de C7
  "t4", "t1", "c2",       // 9-11 centroides opcionales (Hills 2022)
];

// Los tres últimos son opcionales: sin ellos se calcula el GAP completo pero no
// T4PA ni los tilts de T1 y C2.
export const OPTIONAL_LANDMARK_KEYS = ["t4", "t1", "c2"];

// Versión de la convención de marcado. Súbela si cambia lo que significa un
// punto; sin ella, un trazo guardado no se puede reinterpretar más adelante.
export const ANNOTATOR_VERSION = "1";

// Escalares que el anotador vuelca al formulario. Se enumeran para poder
// distinguirlos del resto de la carga útil al contar mediciones aplicadas.
export const MEASUREMENT_KEYS = [
  "pi", "ss", "pt", "l1s1", "l4s1", "gt",
  "l1pa", "t4pa", "c2tilt", "t1tilt", "l1tilt", "sva",
];

/** Array de 12 posiciones (con huecos en null) → lista de puntos marcados. */
export function pointsFromArray(landmarks) {
  if (!Array.isArray(landmarks)) return [];
  const out = [];
  landmarks.forEach((p, idx) => {
    if (!p || idx >= LANDMARK_KEYS.length) return;
    out.push({ key: LANDMARK_KEYS[idx], idx, x: p.x, y: p.y });
  });
  return out;
}

/** Camino inverso: lista de puntos → array de 12 posiciones con huecos. */
export function pointsToArray(points) {
  const out = Array(LANDMARK_KEYS.length).fill(null);
  for (const p of points || []) {
    const idx = p.idx ?? LANDMARK_KEYS.indexOf(p.key);
    if (idx >= 0 && idx < out.length) out[idx] = { x: p.x, y: p.y };
  }
  return out;
}

/**
 * Empaqueta el estado del anotador en el trazo que se persiste.
 * Devuelve null si no hay ningún punto marcado: no tiene sentido guardar una
 * calibración huérfana.
 *
 * Se guardan `imageWidth`/`imageHeight` porque las coordenadas están en
 * píxeles del espacio de la imagen: sin las dimensiones no se pueden
 * reproyectar sobre otra copia de la placa. Y se guarda `imageName` porque unas
 * coordenadas sin la identidad de la imagen a la que pertenecen no son
 * reproducibles.
 */
export function makeGeometry({ landmarks, calibration, horizontalRef, imageDims, imageName, freePts, freeSegs }) {
  const points = pointsFromArray(landmarks);
  if (points.length === 0) return null;
  return {
    annotatorVersion: ANNOTATOR_VERSION,
    imageWidth: imageDims?.w ?? null,
    imageHeight: imageDims?.h ?? null,
    imageName: imageName ?? null,
    mmPerPx: calibration?.mmPerPx ?? null,
    calibRefMm: calibration?.refMm ?? null,
    horizontal: horizontalRef ? {
      p1x: horizontalRef.p1.x, p1y: horizontalRef.p1.y,
      p2x: horizontalRef.p2.x, p2y: horizontalRef.p2.y,
    } : null,
    points,
    // Mediciones libres del usuario (distancias y ángulos ad hoc sobre la placa).
    freePoints: (freePts || []).map((p) => ({ id: p.id, x: p.x, y: p.y })),
    freeSegments: (freeSegs || []).map((s) => ({ id: s.id, aId: s.aId, bId: s.bId })),
    appliedAt: null,        // lo sella App.jsx al recibirlo
    editedAfterApply: false, // lo recalcula formToCaso al guardar
    // Escalares que produjo el trazo. Sirven para detectar si el usuario
    // corrigió después un ángulo a mano.
    applied: {},
  };
}

/**
 * ¿Se editaron a mano las mediciones después de aplicar el trazo?
 *
 * Importa para el dataset: si el cirujano aplica los landmarks y luego corrige
 * un ángulo en el formulario, los puntos guardados dejan de explicar los
 * números guardados. Publicar esas filas como si cuadraran sería un error.
 *
 * Se resuelve comparando lo que emitió el anotador contra lo que hay ahora en
 * el formulario, en vez de instrumentar cada onChange de la interfaz.
 */
export function detectManualEdits(applied, formValues) {
  if (!applied) return false;
  const FORM_KEY = {
    c2tilt: "c2tiltDirect", t1tilt: "t1tiltDirect", l1tilt: "l1tiltDirect",
  };
  for (const k of Object.keys(applied)) {
    const campo = FORM_KEY[k] ?? k;
    const actual = formValues?.[campo];
    if (actual === undefined) continue;
    if (Number(actual) !== Number(applied[k])) return true;
  }
  return false;
}
