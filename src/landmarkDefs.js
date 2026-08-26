// ═══════════════════════════════════════════════════════════════════════════
// Definiciones de los 12 landmarks
// ═══════════════════════════════════════════════════════════════════════════
// Qué es cada punto, dónde se marca y con qué figura se ilustra. Vive fuera del
// componente para que el anotador siga siendo solo componentes (fast refresh) y
// para que la prueba de alineación pueda leerlo.
//
// La clave de cada definición NO se escribe a mano: se toma de LANDMARK_KEYS
// por posición. Así el orden del anotador y el orden que se persiste no pueden
// separarse, que es el error que corrompería los trazos sin dar ninguna señal.
import { LANDMARK_KEYS } from "./data/landmarks";

const DEFS = [
  {
    idx: 0, short: "Fem. izq.", color: "#e11d48",
    label: "Centro de la cabeza femoral izquierda",
    que: "Uno de los dos puntos que definen el eje bicoxofemoral. Su punto medio con la cabeza derecha es el centro de rotación de la pelvis (base de PI, PT y GT).",
    donde: "Marca el centro del círculo formado por la cabeza femoral. Si las dos cabezas se proyectan superpuestas en la lateral, marca el centro de la cabeza más radiopaca (la más cercana al detector se ve más nítida).",
    figureSrc: `${import.meta.env.BASE_URL}landmarks/eje_femoral_lumbar.png`
  },
  {
    idx: 1, short: "Fem. der.", color: "#e11d48",
    label: "Centro de la cabeza femoral derecha",
    que: "Segundo punto del eje bicoxofemoral. Junto con el anterior define la línea de las cabezas femorales.",
    donde: "Misma técnica que la izquierda, lado opuesto. Si están perfectamente superpuestas, marca este punto sobre la cabeza menos radiopaca (la más alejada del detector). El punto medio de los dos cae igual en el centro de rotación.",
    figureSrc: `${import.meta.env.BASE_URL}landmarks/eje_femoral_lumbar_derecho.png`
  },
  {
    idx: 2, short: "S1 post.", color: "#0891b2",
    label: "Esquina posterior del platillo superior de S1",
    que: "Define el límite dorsal del platillo superior de S1. La línea S1 post → S1 ant determina la pendiente sacra (SS).",
    donde: "Esquina trasera del platillo superior de S1: donde el platillo se encuentra con el muro posterior del cuerpo de S1 (el lado que mira al canal raquídeo).",
    figureSrc: `${import.meta.env.BASE_URL}landmarks/s1_post_lumbar.png`
  },
  {
    idx: 3, short: "S1 ant.", color: "#0891b2",
    label: "Esquina anterior del platillo superior de S1",
    que: "Cierra la línea del platillo superior de S1. La inclinación del segmento entre S1 post y S1 ant es la SS.",
    donde: "Esquina delantera del platillo de S1: donde el platillo se encuentra con el muro anterior del cuerpo de S1. La línea entre los dos puntos S1 debe seguir el borde superior de la primera vértebra sacra.",
    figureSrc: `${import.meta.env.BASE_URL}landmarks/s1_ant_lumbar.png`
  },
  {
    idx: 4, short: "L4 post.", color: "#16a34a",
    label: "Esquina posterior del platillo superior de L4",
    que: "Define el platillo superior de L4, plano de referencia para la lordosis distal L4-S1.",
    donde: "Identifica L4 contando desde S1: la primera vértebra sobre S1 es L5, la siguiente es L4. Marca la esquina trasera del platillo superior de L4.",
    figureSrc: `${import.meta.env.BASE_URL}landmarks/l4_post_lumbar.png`
  },
  {
    idx: 5, short: "L4 ant.", color: "#16a34a",
    label: "Esquina anterior del platillo superior de L4",
    que: "Cierra el plano del platillo superior de L4.",
    donde: "Esquina delantera del platillo superior de L4. La línea entre L4 post y L4 ant debe seguir el borde superior del cuerpo vertebral.",
    figureSrc: `${import.meta.env.BASE_URL}landmarks/l4_ant_lumbar.png`
  },
  {
    idx: 6, short: "L1 post.", color: "#7c3aed",
    label: "Esquina posterior del platillo superior de L1",
    que: "Define el platillo superior de L1, plano superior de la lordosis lumbar total (L1-S1).",
    donde: "Cuenta 5 vértebras desde S1 hacia arriba (L5 → L4 → L3 → L2 → L1). Marca la esquina trasera del platillo superior de L1.",
    figureSrc: `${import.meta.env.BASE_URL}landmarks/l1_post_lumbar.png`
  },
  {
    idx: 7, short: "L1 ant.", color: "#7c3aed",
    label: "Esquina anterior del platillo superior de L1",
    que: "Cierra el plano del platillo superior de L1.",
    donde: "Esquina delantera del platillo superior de L1. La línea entre los dos puntos L1 debe coincidir con el borde superior del cuerpo de L1.",
    figureSrc: `${import.meta.env.BASE_URL}landmarks/l1_ant_lumbar.png`
  },
  {
    idx: 8, short: "C7", color: "#ea580c",
    label: "Centro del cuerpo vertebral de C7",
    que: "Punto de referencia más alto del eje espinal. Junto con el centro de S1 y el eje femoral define el Global Tilt (GT).",
    donde: "Centro del cuerpo vertebral de C7 (NO la apófisis espinosa). C7 es la última cervical y tiene la apófisis más prominente del cuello. Marca el centro del cuadrilátero del cuerpo vertebral.",
    figureSrc: `${import.meta.env.BASE_URL}landmarks/c7_columna.png`
  },
  // ── Hills 2022 (opcionales): T4 centroide para T4PA, T1 y C2 centroides para tilts ──
  {
    idx: 9, short: "T4 (opc.)", color: "#3b82f6", optional: true,
    label: "Centro del cuerpo vertebral de T4",
    que: "Centroide del cuerpo de T4 (Hills 2022). Define el T4 Pelvic Angle (T4PA) y, junto con el L1PA, el eje T4-L1-cadera. Opcional — solo si quieres T4PA.",
    donde: "Cuenta 4 vértebras desde C7 hacia abajo (C7 → T1 → T2 → T3 → T4). Marca el centro del cuadrilátero del cuerpo vertebral de T4 (NO la apófisis espinosa).",
    figureSrc: `${import.meta.env.BASE_URL}landmarks/columna_completa.png`
  },
  {
    idx: 10, short: "T1 (opc.)", color: "#1d4ed8", optional: true,
    label: "Centro del cuerpo vertebral de T1",
    que: "Centroide del cuerpo de T1 (Hills 2022). Necesario para calcular el T1 tilt directo desde la radiografía. Opcional — solo si quieres T1 tilt.",
    donde: "T1 es la primera vértebra torácica, justo debajo de C7. Marca el centro del cuadrilátero del cuerpo vertebral (NO la apófisis espinosa).",
    figureSrc: `${import.meta.env.BASE_URL}landmarks/columna_completa.png`
  },
  {
    idx: 11, short: "C2 (opc.)", color: "#1e3a8a", optional: true,
    label: "Centro del cuerpo vertebral de C2",
    que: "Centroide del cuerpo de C2 (Hills 2022). Necesario para calcular el C2 tilt directo desde la radiografía. Opcional — solo si quieres C2 tilt.",
    donde: "C2 es la segunda vértebra cervical (axis), debajo del atlas. Tiene una apófisis odontoides característica. Marca el centro del cuadrilátero del cuerpo vertebral por debajo de la odontoides.",
    figureSrc: `${import.meta.env.BASE_URL}landmarks/columna_completa.png`
  }
];

// Se adjunta la clave persistida a cada definición y se comprueba que las dos
// listas tienen la misma longitud.
if (DEFS.length !== LANDMARK_KEYS.length) {
  throw new Error(`LANDMARK_DEFS (${DEFS.length}) y LANDMARK_KEYS (${LANDMARK_KEYS.length}) no coinciden`);
}
// Además de la clave persistida se derivan las claves i18n de los textos
// visibles. Los campos en español se conservan como fuente del diccionario y
// como respaldo fuera de la interfaz.
export const LANDMARK_DEFS = DEFS.map((d, i) => {
  const key = LANDMARK_KEYS[i];
  return {
    ...d,
    key,
    shortKey: `landmark.${key}.short`,
    labelKey: `landmark.${key}.label`,
    queKey: `landmark.${key}.que`,
    dondeKey: `landmark.${key}.donde`,
  };
});
