import { describe, it, expect } from "vitest";
import {
  midpoint, distance, angleBetweenLines, angleAtVertex, angleFromHorizontal,
  angleFromVertical, computeSS, computePT, computePI, computeL1S1, computeL4S1,
  computeGT, computePA, computeVertebralTilt, computeAllAngles,
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
  pi: 50.4, ss: 35, pt: 15.4, l1s1: 46.3, l4s1: 18.3, gt: 14.8,
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
