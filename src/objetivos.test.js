import { describe, it, expect } from "vitest";
import {
  DIEBO_SEGMENTOS, DIEBO_TABLA, dieboCategoria, dieboObjetivos,
  mccarthyLL, tpaObjetivo, tpaEvaluacion, TPA_TOL,
} from "./objetivos";

// Los valores esperados salen de los artículos, no del código: casos de las
// figuras y tablas publicadas. Si una prueba falla, el cambio está mal.

describe("Diebo 2024 · Tabla I", () => {
  it("transcribe la tabla tal cual (signos incluidos)", () => {
    expect(DIEBO_SEGMENTOS).toEqual(["T10-L2", "L1-L2", "L2-L3", "L3-L4", "L4-L5", "L5-S1"]);
    expect(DIEBO_TABLA[40]).toEqual([-6.9, 1.7, 4.4, 9.5, 15, 17.5]);
    expect(DIEBO_TABLA[60]).toEqual([-4.3, 3.1, 7.9, 11.2, 15, 20]);
    expect(DIEBO_TABLA[90]).toEqual([2.1, 7.3, 14.6, 12.9, 22, 20]);
  });
  it("categoría más cercana, sin interpolar", () => {
    expect(dieboCategoria(57)).toEqual({ categoria: 60, fueraDeRango: false });
    expect(dieboCategoria(54.9)).toEqual({ categoria: 50, fueraDeRango: false });
    expect(dieboCategoria(45)).toEqual({ categoria: 50, fueraDeRango: false });
    expect(dieboCategoria(36)).toEqual({ categoria: 40, fueraDeRango: false });
  });
  it("fuera de la tabla toma el extremo y avisa", () => {
    expect(dieboCategoria(30)).toEqual({ categoria: 40, fueraDeRango: true });
    expect(dieboCategoria(97)).toEqual({ categoria: 90, fueraDeRango: true });
  });
  it("sin PI no hay objetivos", () => {
    expect(dieboCategoria("")).toBeNull();
    expect(dieboObjetivos("", 50, 30)).toBeNull();
  });
  it("regiones de Pesenti: L1-L4 y L4-S1", () => {
    const r = dieboObjetivos(50, 55, 35);
    expect(r.idealL1L4).toBeCloseTo(18.0, 5);   // 1.7 + 6.2 + 10.1
    expect(r.idealL4S1).toBeCloseTo(35.0, 5);   // 15 + 20
    expect(r.idealL1S1).toBeCloseTo(53.0, 5);
    expect(r.actualL1L4).toBe(20);              // 55 − 35
    expect(r.actualL4S1).toBe(35);
    expect(r.actualPctL4S1).toBeCloseTo(63.64, 2);
  });
  it("sin L1-S1 o L4-S1 da solo ideales", () => {
    const r = dieboObjetivos(70, "", 30);
    expect(r.actualL1L4).toBeNull();
    expect(r.actualL4S1).toBe(30);
    expect(r.actualPctL4S1).toBeNull();
  });
});

describe("McCarthy 2024 · LL = PI + 0.3·TK − 0.5·Edad + 10", () => {
  it("Figura 3: PI 42, TK 14, 46 años → 33.2°", () => {
    expect(mccarthyLL(42, 14, 46)).toBeCloseTo(33.2, 5);
  });
  it("Tabla 4 (PI − LL por TK y edad)", () => {
    const piMenosLL = (tk, age) => 50 - mccarthyLL(50, tk, age);
    expect(piMenosLL(50, 50)).toBeCloseTo(0, 5);
    expect(piMenosLL(60, 50)).toBeCloseTo(-3, 5);
    expect(piMenosLL(20, 40)).toBeCloseTo(4, 5);
    expect(piMenosLL(20, 80)).toBeCloseTo(24, 5);
    expect(piMenosLL(60, 80)).toBeCloseTo(12, 5);
  });
  it("acepta texto del formulario y exige los tres datos", () => {
    expect(mccarthyLL("42", "14", "46")).toBeCloseTo(33.2, 5);
    expect(mccarthyLL(42, "", 46)).toBeNull();
    expect(mccarthyLL(42, 14, "")).toBeNull();
  });
});

describe("TPA objetivo por edad · (Edad − 55)/2 + 16", () => {
  it("valores de referencia", () => {
    expect(tpaObjetivo(55)).toBe(16);
    expect(tpaObjetivo(75)).toBe(26);
    expect(tpaObjetivo(46)).toBe(11.5);
  });
  it("tolerancia de ±5° (McCarthy 2024)", () => {
    expect(TPA_TOL).toBe(5);
    expect(tpaEvaluacion(21, 55).enObjetivo).toBe(true);
    expect(tpaEvaluacion(21.1, 55).enObjetivo).toBe(false);
    expect(tpaEvaluacion(11, 55).enObjetivo).toBe(true);
    expect(tpaEvaluacion(30, 55).diff).toBe(14);
  });
  it("sin TPA o sin edad no evalúa", () => {
    expect(tpaEvaluacion("", 55)).toBeNull();
    expect(tpaEvaluacion(20, "")).toBeNull();
  });
});
