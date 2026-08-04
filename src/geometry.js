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

// Pelvic Angle (Hills 2022): ángulo subtendido en femMid entre las rectas
// femMid→s1Mid y femMid→centroid. Signed: positivo si el centroide queda en
// el semiplano anterior del eje femMid–s1Mid. La dirección anterior se define
// como el vector p3→p4 (esquina posterior → esquina anterior del platillo S1).
// Caso típico sano: L1PA ≈ +5°, T4PA cercano al L1PA.
export function computePA(centroid, s1Mid, femMid, p3, p4) {
  if (!centroid || !s1Mid || !femMid || !p3 || !p4) return null;
  const ang = angleAtVertex(femMid, centroid, s1Mid); // 0–180°, sin signo
  // Producto cruz 2D para determinar el lado del centroide respecto al eje
  // femMid–s1Mid; lo comparamos con el lado en el que cae la dirección anterior.
  const refDir = { x: s1Mid.x - femMid.x, y: s1Mid.y - femMid.y };
  const v = { x: centroid.x - femMid.x, y: centroid.y - femMid.y };
  const ant = { x: p4.x - p3.x, y: p4.y - p3.y };
  const cross_v = refDir.x * v.y - refDir.y * v.x;
  const cross_ant = refDir.x * ant.y - refDir.y * ant.x;
  // Mismo signo de cruz ⇒ centroide en el semiplano anterior ⇒ PA positivo.
  return (cross_v * cross_ant >= 0) ? ang : -ang;
}

// Tilt vertebral signed (Hills 2022): ángulo desde la vertical real de la recta
// femMid→centroid. Positivo si el centroide queda anterior al femMid (anterior
// definido por p3→p4). Caso sano: tilts negativos (C2, T1, L1 levemente
// posteriores al eje bicoxofemoral).
export function computeVertebralTilt(centroid, femMid, p3, p4, refH = null) {
  if (!centroid || !femMid || !p3 || !p4) return null;
  const ang = angleFromVertical(femMid, centroid, refH); // 0–90°, sin signo
  const v = { x: centroid.x - femMid.x, y: centroid.y - femMid.y };
  const ant = { x: p4.x - p3.x, y: p4.y - p3.y };
  return ((v.x * ant.x + v.y * ant.y) >= 0) ? ang : -ang;
}

// Compute all GAP + Hills angles from los landmarks ordenados.
// Landmarks 0–8: 2 cabezas femorales, S1 post/ant, L4 post/ant, L1 post/ant, C7 (GAP).
// Landmarks 9–11 (opcionales, Hills 2022): centroides T4, T1, C2.
// `refH` (opcional) define la horizontal real; afecta SS, PT y los tilts.
// Returns null si los landmarks GAP (0–8) no están todos presentes.
export function computeAllAngles(landmarks, refH = null) {
  if (!Array.isArray(landmarks) || landmarks.length < 9) return null;
  const [p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12] = landmarks;
  if (!p1 || !p2 || !p3 || !p4 || !p5 || !p6 || !p7 || !p8 || !p9) return null;
  const femMid = midpoint(p1, p2);
  const s1Mid = midpoint(p3, p4);
  const l1Mid = midpoint(p7, p8); // centroide L1 derivado de las esquinas del platillo
  const pi = computePI(p3, p4, femMid);
  const ss = computeSS(p3, p4, refH);
  const pt = computePT(femMid, s1Mid, refH);
  const l1s1 = computeL1S1(p7, p8, p3, p4);
  const l4s1 = computeL4S1(p5, p6, p3, p4);
  const gt = computeGT(p9, s1Mid, femMid);
  const out = {
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
  // Hills opcionales — se llenan solo si los landmarks adicionales existen.
  // L1PA y L1 tilt no requieren landmarks extra (L1 centroide = midpoint L1 corners).
  out.l1pa = round1(computePA(l1Mid, s1Mid, femMid, p3, p4));
  out.l1tilt = round1(computeVertebralTilt(l1Mid, femMid, p3, p4, refH));
  if (p10) out.t4pa = round1(computePA(p10, s1Mid, femMid, p3, p4));
  if (p11) out.t1tilt = round1(computeVertebralTilt(p11, femMid, p3, p4, refH));
  if (p12) out.c2tilt = round1(computeVertebralTilt(p12, femMid, p3, p4, refH));
  return out;
}

// Ángulo entre dos rectas independientes, con la construcción que se dibuja.
//
// El vértice NO es el cruce de las dos rectas sino el de sus PERPENDICULARES.
// Dos platillos vertebrales son casi paralelos: su cruce cae a una distancia
// enorme, fuera de la placa, donde no se puede dibujar ni leer nada. Las
// perpendiculares se cortan entre las dos líneas, que es donde está mirando
// quien mide. El ángulo es el mismo: girar ambas rectas 90° no cambia lo que
// las separa.
//
// Devuelve el ángulo (0–180°, con 0° para rectas paralelas), los centros de
// cada línea, las normales orientadas la una hacia la otra, y el vértice —o
// null cuando no hay uno que dibujar honestamente: rectas casi paralelas, corte
// más allá de `maxDim`, o corte que cae fuera del espacio entre las dos líneas.
// En esos casos quien dibuja debe rotular el valor entre ambas en lugar de en
// un vértice que sugeriría una geometría distinta de la medida.
export function linePairAngle(a1, b1, a2, b2, maxDim = Infinity) {
  const d1 = vec(a1, b1), d2 = vec(a2, b2);
  const l1 = mag(d1), l2 = mag(d2);
  if (l1 === 0 || l2 === 0) return null;

  // Dirección canónica (apuntando a la derecha) para que dos rectas paralelas
  // den 0° y el valor crezca con la convergencia, igual que en un PACS.
  const canon = (d, len) => {
    let x = d.x / len, y = d.y / len;
    if (x < 0 || (x === 0 && y < 0)) { x = -x; y = -y; }
    return { x, y };
  };
  const u1 = canon(d1, l1), u2 = canon(d2, l2);
  let angle = Math.abs(Math.atan2(u1.y, u1.x) - Math.atan2(u2.y, u2.x)) * RAD2DEG;
  if (angle > 180) angle = 360 - angle;

  const m1 = midpoint(a1, b1), m2 = midpoint(a2, b2);
  // Normal a cada recta, orientada hacia la otra línea para que el vértice
  // caiga entre las dos y no del lado opuesto.
  const orientar = (u, desde, hacia) => {
    const n = { x: -u.y, y: u.x };
    return ((hacia.x - desde.x) * n.x + (hacia.y - desde.y) * n.y) < 0 ? { x: -n.x, y: -n.y } : n;
  };
  const n1 = orientar(u1, m1, m2), n2 = orientar(u2, m2, m1);

  // El determinante es el seno del ángulo entre las normales, que es el mismo
  // ángulo que separa las rectas. Con rectas casi paralelas el corte de las
  // perpendiculares es numéricamente inestable: puede aterrizar sobre una de
  // las líneas y dibujar un vértice de patas nulas. Por debajo de ~1.2° no se
  // propone vértice y quien dibuja rotula el valor entre las dos líneas.
  const den = n1.x * n2.y - n1.y * n2.x;
  let vertex = null, leg1 = 0, leg2 = 0;
  if (Math.abs(den) > 0.02) {
    const t = ((m2.x - m1.x) * n2.y - (m2.y - m1.y) * n2.x) / den;
    const s = ((m2.x - m1.x) * n1.y - (m2.y - m1.y) * n1.x) / den;
    // Solo vale como vértice si queda ENTRE las dos líneas, es decir si ambas
    // patas avanzan en el sentido en que su normal apunta a la otra. Con rectas
    // poco divergentes el corte se produce más allá de una de ellas: dibujar ahí
    // un ángulo sugiere una geometría que no es la que se está midiendo.
    if (t > 0 && s > 0 && t < maxDim && s < maxDim) {
      vertex = { x: m1.x + n1.x * t, y: m1.y + n1.y * t };
      leg1 = t; leg2 = s;
    }
  }
  return { angle: round1(angle), m1, m2, n1, n2, vertex, leg1, leg2 };
}
