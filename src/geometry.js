// Pure 2D geometry for spinopelvic landmark measurements.
// Coordinate convention: {x, y} in image/screen pixels with y pointing DOWN.
// All angles returned in degrees.

const RAD2DEG = 180 / Math.PI;

export function midpoint(p1, p2) {
  return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
}

function vec(a, b) { return { x: b.x - a.x, y: b.y - a.y }; }
function dot(a, b) { return a.x * b.x + a.y * b.y; }
function mag(v) { return Math.sqrt(v.x * v.x + v.y * v.y); }
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
function round1(n) { return Math.round(n * 10) / 10; }

// Distancia euclidiana entre dos puntos (en pixeles).
export function distance(p1, p2) {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

// Smallest angle (0–90°) between two lines defined by point pairs.
// Lines are unoriented, so a→b and b→a give the same result.
export function angleBetweenLines(a1, a2, b1, b2) {
  const va = vec(a1, a2), vb = vec(b1, b2);
  const m = mag(va) * mag(vb);
  if (m === 0) return 0;
  const cos = Math.abs(dot(va, vb)) / m;
  return Math.acos(clamp(cos, -1, 1)) * RAD2DEG;
}

// Angle (0–180°) at `vertex` between rays vertex→a and vertex→b.
export function angleAtVertex(vertex, a, b) {
  const va = vec(vertex, a), vb = vec(vertex, b);
  const m = mag(va) * mag(vb);
  if (m === 0) return 0;
  const cos = dot(va, vb) / m;
  return Math.acos(clamp(cos, -1, 1)) * RAD2DEG;
}

// Ángulo (0–90°, unsigned) del segmento p1→p2 respecto a la horizontal.
// Si refH se proporciona como { p1, p2 }, esa línea define la horizontal real;
// de lo contrario se usa el eje X de la imagen.
export function angleFromHorizontal(p1, p2, refH = null) {
  const lineAng = Math.atan2(p2.y - p1.y, p2.x - p1.x);
  const refAng = refH ? Math.atan2(refH.p2.y - refH.p1.y, refH.p2.x - refH.p1.x) : 0;
  let diff = lineAng - refAng;
  while (diff > Math.PI / 2) diff -= Math.PI;
  while (diff <= -Math.PI / 2) diff += Math.PI;
  return Math.abs(diff) * RAD2DEG;
}

export function angleFromVertical(p1, p2, refH = null) {
  return 90 - angleFromHorizontal(p1, p2, refH);
}

// Sacral Slope: pendiente del platillo superior de S1 desde la horizontal real
// (definida por refH si existe, o el eje X de la imagen si no).
export function computeSS(p3, p4, refH = null) {
  return angleFromHorizontal(p3, p4, refH);
}

// Pelvic Tilt: ángulo del segmento femMid→s1Mid desde la vertical real.
export function computePT(femMid, s1Mid, refH = null) {
  return angleFromVertical(femMid, s1Mid, refH);
}

// Pelvic Incidence: angle between perpendicular to S1 endplate (at s1Mid) and
// line s1Mid→femMid. Geometric identity: PI = PT + SS in upright posture.
export function computePI(p3, p4, femMid) {
  const s1Mid = midpoint(p3, p4);
  return 90 - angleBetweenLines(p3, p4, femMid, s1Mid);
}

// L1-S1 lordosis (Cobb angle).
export function computeL1S1(p7, p8, p3, p4) {
  return angleBetweenLines(p7, p8, p3, p4);
}

// L4-S1 lordosis (Cobb angle).
export function computeL4S1(p5, p6, p3, p4) {
  return angleBetweenLines(p5, p6, p3, p4);
}

// Global Tilt: angle at femMid between (femMid→C7) and (femMid→s1Mid).
// 0° when C7, S1, and bicoxofemoral axis are collinear (Yilgor 2017).
export function computeGT(p9, s1Mid, femMid) {
  return angleAtVertex(femMid, p9, s1Mid);
}

// Compute all 6 GAP angles from the 9 ordered landmarks.
// `refH` (optional) define la horizontal real; afecta SS y PT (PI/Cobb/GT son geométricos).
// Returns null if any landmark is missing.
export function computeAllAngles(landmarks, refH = null) {
  if (!Array.isArray(landmarks) || landmarks.length < 9) return null;
  const [p1, p2, p3, p4, p5, p6, p7, p8, p9] = landmarks;
  if (!p1 || !p2 || !p3 || !p4 || !p5 || !p6 || !p7 || !p8 || !p9) return null;
  const femMid = midpoint(p1, p2);
  const s1Mid = midpoint(p3, p4);
  const pi = computePI(p3, p4, femMid);
  const ss = computeSS(p3, p4, refH);
  const pt = computePT(femMid, s1Mid, refH);
  const l1s1 = computeL1S1(p7, p8, p3, p4);
  const l4s1 = computeL4S1(p5, p6, p3, p4);
  const gt = computeGT(p9, s1Mid, femMid);
  return {
    pi: round1(pi),
    ss: round1(ss),
    pt: round1(pt),
    l1s1: round1(l1s1),
    l4s1: round1(l4s1),
    gt: round1(gt),
    femMid,
    s1Mid,
    consistencyDelta: round1(pi - (pt + ss))
  };
}
