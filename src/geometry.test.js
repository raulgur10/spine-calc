import { describe, it, expect } from "vitest";
import {
  midpoint, distance, angleBetweenLines, angleAtVertex, angleFromHorizontal,
  angleFromVertical, computeSS, computePT, computePI, computeL1S1, computeL4S1,
  computeGT, computePA, computeVertebralTilt, computeAllAngles, linePairAngle,
} from "./geometry";

// Convención del módulo: coordenadas en el espacio de la imagen, eje Y HACIA ABAJO.
// Todos los ángulos en grados.

// Caso sintético de referencia: radiografía lateral con el paciente mirando a la
// derecha (anterior = +x). Los valores esperados están congelados a partir de la
// implementación vigente: son una red de seguridad para el refactor, no una
// validación clínica independiente.
const CASO = [
  { x: 430, y: 1195 }, { x: 450, y: 1205 },   // 0-1  cabezas femorales
  { x: 350, y: 1020 }, { x: 450, y: 1090 },   // 2-3  S1 posterior / anterior
  { x: 340, y: 900 },  { x: 440, y: 930 },    // 4-5  L4 posterior / anterior
  { x: 330, y: 640 },  { x: 430, y: 620 },    // 6-7  L1 posterior / anterior
  { x: 430, y: 300 },                          // 8    C7
  { x: 420, y: 420 },  { x: 428, y: 340 }, { x: 445, y: 180 }, // 9-11 T4, T1, C2
];

const GOLDEN = {
  pi: 50.4, ss: 35, pt: 15.4, l1s1: 46.3, l4s1: 18.3, gt: 17.7,
  l1pa: 9.4, l1tilt: -6, t4pa: 14, t1tilt: -0.8, c2tilt: -0.3,
  consistencyDelta: 0,
};

// Rota un punto alrededor del origen; sirve para comprobar qué parámetros son
// invariantes a la rotación de la placa y cuáles no.
const rotate = (p, deg) => {
  const a = (deg * Math.PI) / 180;
  return { x: p.x * Math.cos(a) - p.y * Math.sin(a), y: p.x * Math.sin(a) + p.y * Math.cos(a) };
};

describe("primitivas", () => {
  it("midpoint y distance", () => {
    expect(midpoint({ x: 0, y: 0 }, { x: 10, y: 20 })).toEqual({ x: 5, y: 10 });
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it("angleBetweenLines devuelve 0–90° y es independiente del orden de marcado", () => {
    const a1 = { x: 0, y: 0 }, a2 = { x: 10, y: 0 };
    const b1 = { x: 0, y: 0 }, b2 = { x: 0, y: 10 };
    expect(angleBetweenLines(a1, a2, b1, b2)).toBeCloseTo(90, 6);
    // invertir cualquiera de las dos rectas no cambia el resultado
    expect(angleBetweenLines(a2, a1, b1, b2)).toBeCloseTo(90, 6);
    expect(angleBetweenLines(a1, a2, b2, b1)).toBeCloseTo(90, 6);
    // rectas paralelas → 0°, también en sentidos opuestos
    expect(angleBetweenLines(a1, a2, { x: 5, y: 5 }, { x: 15, y: 5 })).toBeCloseTo(0, 6);
    expect(angleBetweenLines(a1, a2, { x: 15, y: 5 }, { x: 5, y: 5 })).toBeCloseTo(0, 6);
  });

  it("angleBetweenLines nunca excede 90°", () => {
    for (let d = 0; d < 360; d += 7) {
      const p = rotate({ x: 10, y: 0 }, d);
      const v = angleBetweenLines({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 0 }, p);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(90 + 1e-9);
    }
  });

  it("angleAtVertex cubre 0–180° y sí depende del vértice", () => {
    const v = { x: 0, y: 0 };
    expect(angleAtVertex(v, { x: 10, y: 0 }, { x: -10, y: 0 })).toBeCloseTo(180, 6);
    expect(angleAtVertex(v, { x: 10, y: 0 }, { x: 0, y: 10 })).toBeCloseTo(90, 6);
    expect(angleAtVertex(v, { x: 10, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(0, 6);
  });

  it("segmentos degenerados devuelven 0 en lugar de NaN", () => {
    const p = { x: 5, y: 5 };
    expect(angleBetweenLines(p, p, { x: 0, y: 0 }, { x: 1, y: 1 })).toBe(0);
    expect(angleAtVertex(p, p, { x: 1, y: 1 })).toBe(0);
  });

  it("angleFromHorizontal usa la horizontal de referencia cuando se le da", () => {
    const p1 = { x: 0, y: 0 }, p2 = { x: 100, y: 0 };
    expect(angleFromHorizontal(p1, p2)).toBeCloseTo(0, 6);
    // con una horizontal inclinada 10°, la misma recta queda a 10° de ella
    const refH = { p1: { x: 0, y: 0 }, p2: rotate({ x: 100, y: 0 }, 10) };
    expect(angleFromHorizontal(p1, p2, refH)).toBeCloseTo(10, 6);
  });

  it("angleFromVertical es el complemento de angleFromHorizontal", () => {
    const p1 = { x: 0, y: 0 }, p2 = { x: 30, y: 40 };
    expect(angleFromHorizontal(p1, p2) + angleFromVertical(p1, p2)).toBeCloseTo(90, 6);
  });
});

describe("parámetros espinopélvicos sobre el caso de referencia", () => {
  const [p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12] = CASO;
  const femMid = midpoint(p1, p2);
  const s1Mid = midpoint(p3, p4);
  const l1Mid = midpoint(p7, p8);

  it("SS, PT y PI", () => {
    expect(computeSS(p3, p4)).toBeCloseTo(GOLDEN.ss, 1);
    expect(computePT(femMid, s1Mid)).toBeCloseTo(GOLDEN.pt, 1);
    expect(computePI(p3, p4, femMid)).toBeCloseTo(GOLDEN.pi, 1);
  });

  it("se cumple la identidad PI = PT + SS", () => {
    const pi = computePI(p3, p4, femMid);
    const ss = computeSS(p3, p4);
    const pt = computePT(femMid, s1Mid);
    expect(pi - (pt + ss)).toBeCloseTo(0, 6);
  });

  it("lordosis regional y global tilt", () => {
    expect(computeL1S1(p7, p8, p3, p4)).toBeCloseTo(GOLDEN.l1s1, 1);
    expect(computeL4S1(p5, p6, p3, p4)).toBeCloseTo(GOLDEN.l4s1, 1);
    expect(computeGT(p9, s1Mid, femMid)).toBeCloseTo(GOLDEN.gt, 1);
  });

describe("inclinación global (definición de Obeid 2016)", () => {
  const femMid = { x: 440, y: 1200 }, s1Mid = { x: 400, y: 1055 }, c7 = { x: 430, y: 300 };
  it("vale 0 cuando C7, S1 y el eje bicoxofemoral son colineales", () => {
    expect(computeGT({ x: 360, y: 910 }, s1Mid, femMid)).toBeCloseTo(0, 6);
  });
  it("es el ángulo exterior en S1: suma de los ángulos interiores en el fémur y en C7", () => {
    const enFemur = angleAtVertex(femMid, c7, s1Mid);
    const enC7 = angleAtVertex(c7, s1Mid, femMid);
    expect(computeGT(c7, s1Mid, femMid)).toBeCloseTo(enFemur + enC7, 6);
    expect(computeGT(c7, s1Mid, femMid)).toBeGreaterThan(enFemur);
  });
  it("coincide con el cálculo a mano del caso de referencia (17,7°)", () => {
    const u = { x: s1Mid.x - c7.x, y: s1Mid.y - c7.y };      // C7 → S1
    const v = { x: femMid.x - s1Mid.x, y: femMid.y - s1Mid.y }; // S1 → fémur
    const a = Math.acos((u.x * v.x + u.y * v.y) / (Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y))) * 180 / Math.PI;
    expect(computeGT(c7, s1Mid, femMid)).toBeCloseTo(a, 6);
    expect(computeGT(c7, s1Mid, femMid)).toBeCloseTo(17.7, 1);
  });
});

  it("ángulos vertebropélvicos y tilts con signo (Hills 2022)", () => {
    expect(computePA(l1Mid, s1Mid, femMid, p3, p4)).toBeCloseTo(GOLDEN.l1pa, 1);
    expect(computePA(p10, s1Mid, femMid, p3, p4)).toBeCloseTo(GOLDEN.t4pa, 1);
    expect(computeVertebralTilt(l1Mid, femMid, p3, p4)).toBeCloseTo(GOLDEN.l1tilt, 1);
    expect(computeVertebralTilt(p11, femMid, p3, p4)).toBeCloseTo(GOLDEN.t1tilt, 1);
    expect(computeVertebralTilt(p12, femMid, p3, p4)).toBeCloseTo(GOLDEN.c2tilt, 1);
  });

  it("el signo del tilt se invierte al invertir la dirección anterior", () => {
    // p3→p4 define el anterior; intercambiarlos debe voltear el signo.
    const normal = computeVertebralTilt(p12, femMid, p3, p4);
    const flipped = computeVertebralTilt(p12, femMid, p4, p3);
    expect(flipped).toBeCloseTo(-normal, 6);
  });

  it("computePA y computeVertebralTilt devuelven null si falta un punto", () => {
    expect(computePA(null, s1Mid, femMid, p3, p4)).toBeNull();
    expect(computeVertebralTilt(p12, femMid, null, p4)).toBeNull();
  });
});

describe("computeAllAngles", () => {
  it("reproduce los valores congelados", () => {
    const r = computeAllAngles(CASO);
    for (const [k, v] of Object.entries(GOLDEN)) {
      expect(r[k], `parámetro ${k}`).toBeCloseTo(v, 1);
    }
  });

  it("devuelve null si falta cualquiera de los 9 landmarks GAP", () => {
    expect(computeAllAngles(null)).toBeNull();
    expect(computeAllAngles(CASO.slice(0, 8))).toBeNull();
    for (let i = 0; i < 9; i++) {
      const incompleto = [...CASO];
      incompleto[i] = null;
      expect(computeAllAngles(incompleto), `sin landmark ${i}`).toBeNull();
    }
  });

  it("omite los parámetros de Hills cuyos landmarks opcionales no se marcaron", () => {
    const soloGap = [...CASO.slice(0, 9), null, null, null];
    const r = computeAllAngles(soloGap);
    // L1PA y L1 tilt sí salen: el centroide de L1 se deriva de las esquinas.
    expect(r.l1pa).toBeCloseTo(GOLDEN.l1pa, 1);
    expect(r.l1tilt).toBeCloseTo(GOLDEN.l1tilt, 1);
    expect(r.t4pa).toBeUndefined();
    expect(r.t1tilt).toBeUndefined();
    expect(r.c2tilt).toBeUndefined();
  });

  it("los ángulos entre rectas son invariantes a la rotación de la placa; SS y PT no", () => {
    const rotado = CASO.map((p) => rotate(p, 12));
    const r = computeAllAngles(rotado);
    // Invariantes: dependen solo de ángulos entre rectas.
    expect(r.pi).toBeCloseTo(GOLDEN.pi, 1);
    expect(r.l1s1).toBeCloseTo(GOLDEN.l1s1, 1);
    expect(r.l4s1).toBeCloseTo(GOLDEN.l4s1, 1);
    expect(r.gt).toBeCloseTo(GOLDEN.gt, 1);
    // No invariantes: se miden contra la horizontal de la imagen.
    expect(Math.abs(r.ss - GOLDEN.ss)).toBeGreaterThan(1);
  });

  it("al rotar la placa Y la horizontal de referencia, SS y PT se recuperan", () => {
    const rotado = CASO.map((p) => rotate(p, 12));
    const refH = { p1: rotate({ x: 0, y: 0 }, 12), p2: rotate({ x: 100, y: 0 }, 12) };
    const r = computeAllAngles(rotado, refH);
    expect(r.ss).toBeCloseTo(GOLDEN.ss, 1);
    expect(r.pt).toBeCloseTo(GOLDEN.pt, 1);
    expect(r.consistencyDelta).toBeCloseTo(0, 1);
  });
});

describe("linePairAngle · ángulo entre dos rectas independientes", () => {
  // Aproximación al caso de la captura: dos platillos lumbares casi paralelos.
  // Es el que fallaba: el cruce de las dos RECTAS cae a miles de píxeles a la
  // derecha, así que las prolongaciones se salían de la placa y el número
  // quedaba fuera de la vista.
  const SUP_A = { x: 176, y: 156 }, SUP_B = { x: 289, y: 191 };   // ~17.2°
  const INF_A = { x: 137, y: 290 }, INF_B = { x: 243, y: 299 };   // ~4.9°

  it("mide el ángulo entre las dos líneas", () => {
    const r = linePairAngle(SUP_A, SUP_B, INF_A, INF_B, 10000);
    expect(r.angle).toBeCloseTo(12.4, 0);
  });

  it("el cruce de las RECTAS cae fuera de la placa: por eso no se usa", () => {
    // Intersección directa de las dos rectas, que es lo que se dibujaba antes.
    const d1 = { x: SUP_B.x - SUP_A.x, y: SUP_B.y - SUP_A.y };
    const d2 = { x: INF_B.x - INF_A.x, y: INF_B.y - INF_A.y };
    const den = d1.x * d2.y - d1.y * d2.x;
    const t = ((INF_A.x - SUP_A.x) * d2.y - (INF_A.y - SUP_A.y) * d2.x) / den;
    const cruce = { x: SUP_A.x + d1.x * t, y: SUP_A.y + d1.y * t };
    expect(cruce.x).toBeGreaterThan(700);   // la imagen mide 760 px de ancho
  });

  it("con estos platillos el corte cae más allá de la línea inferior, así que no se propone vértice", () => {
    // El corte existe, pero queda fuera del espacio entre las dos líneas.
    // Dibujar un ángulo ahí sugeriría una geometría distinta de la medida;
    // quien dibuja rotula el valor entre ambas.
    const r = linePairAngle(SUP_A, SUP_B, INF_A, INF_B, 10000);
    expect(r.vertex).toBeNull();
    expect(r.angle).toBeCloseTo(12.4, 0);   // el valor no depende de eso
  });

  it("el Cobb clásico —platillos inclinados uno hacia el otro— sí da vértice entre las dos", () => {
    // Es la configuración de una curva escoliótica y la del dibujo de
    // referencia: las dos perpendiculares se cortan entre los dos platillos.
    const r = linePairAngle(
      { x: 100, y: 100 }, { x: 260, y: 160 },
      { x: 120, y: 400 }, { x: 280, y: 340 }, 10000);
    expect(r.vertex).not.toBeNull();
    expect(r.leg1).toBeGreaterThan(0);
    expect(r.leg2).toBeGreaterThan(0);
    // Entre los dos platillos y dentro de la placa.
    expect(r.vertex.y).toBeGreaterThan(150);
    expect(r.vertex.y).toBeLessThan(400);
    expect(r.vertex.x).toBeGreaterThan(0);
    expect(r.vertex.x).toBeLessThan(760);
  });

  it("las normales apuntan la una hacia la otra", () => {
    const r = linePairAngle(SUP_A, SUP_B, INF_A, INF_B, 10000);
    // La de la línea superior apunta hacia abajo (+y) y la inferior hacia arriba.
    expect(r.n1.y).toBeGreaterThan(0);
    expect(r.n2.y).toBeLessThan(0);
  });

  it("dos rectas paralelas dan 0° y no producen vértice", () => {
    const r = linePairAngle({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 50 }, { x: 100, y: 50 }, 1000);
    expect(r.angle).toBe(0);
    expect(r.vertex).toBeNull();   // quien dibuja rotula el valor entre las dos
  });

  it("el ángulo es el mismo que entre las perpendiculares", () => {
    const r = linePairAngle({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 100 }, { x: 100, y: 40 }, 10000);
    const entreNormales = Math.acos(
      Math.max(-1, Math.min(1, r.n1.x * r.n2.x + r.n1.y * r.n2.y))
    ) * 180 / Math.PI;
    // Girar ambas rectas 90° no cambia lo que las separa.
    expect(Math.min(entreNormales, 180 - entreNormales)).toBeCloseTo(Math.min(r.angle, 180 - r.angle), 1);
  });

  it("es independiente del orden en que se marcó cada línea", () => {
    const a = linePairAngle(SUP_A, SUP_B, INF_A, INF_B, 10000).angle;
    expect(linePairAngle(SUP_B, SUP_A, INF_A, INF_B, 10000).angle).toBeCloseTo(a, 6);
    expect(linePairAngle(SUP_A, SUP_B, INF_B, INF_A, 10000).angle).toBeCloseTo(a, 6);
    expect(linePairAngle(INF_A, INF_B, SUP_A, SUP_B, 10000).angle).toBeCloseTo(a, 6);
  });

  it("no propone vértice con rectas casi paralelas, donde el corte es inestable", () => {
    // 0.57° de separación: el cruce de las perpendiculares puede aterrizar
    // sobre una de las propias líneas y dibujar un vértice de patas nulas.
    const r = linePairAngle({ x: 0, y: 0 }, { x: 100, y: 1 }, { x: 0, y: 50 }, { x: 100, y: 50 }, 10000);
    expect(r.vertex).toBeNull();
    expect(r.angle).toBeGreaterThan(0);   // pero el valor sigue existiendo
  });

  it("suelta el vértice si el corte se iría más allá del límite dado", () => {
    const r = linePairAngle({ x: 0, y: 0 }, { x: 100, y: 6 }, { x: 0, y: 400 }, { x: 100, y: 400 }, 40);
    expect(r.vertex).toBeNull();
    expect(r.angle).toBeGreaterThan(0);
  });

  it("cuando sí hay vértice, sus patas no son degeneradas", () => {
    const r = linePairAngle(
      { x: 100, y: 100 }, { x: 260, y: 160 },
      { x: 120, y: 400 }, { x: 280, y: 340 }, 10000);
    // Un vértice pegado a una de las líneas no dibujaría ángulo alguno.
    expect(r.leg1).toBeGreaterThan(1);
    expect(r.leg2).toBeGreaterThan(1);
  });

  it("un segmento degenerado no produce medición", () => {
    expect(linePairAngle({ x: 5, y: 5 }, { x: 5, y: 5 }, { x: 0, y: 0 }, { x: 1, y: 1 })).toBeNull();
  });
});
