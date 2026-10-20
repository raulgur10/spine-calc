import { describe, it, expect } from "vitest";
import { resumirEstudio } from "./validacion";

const prog = [
  { ronda: 0, nombre: "Práctica", total: 3, completadas: 3 },
  { ronda: 1, nombre: "Ronda 1", total: 40, completadas: 7 },
];

describe("resumirEstudio", () => {
  it("entrega el siguiente caso con su ronda y su avance", () => {
    const r = resumirEstudio(prog, { id: "a1", ronda: 1, orden: 8, codigo: "R1-08", imagen_sha256: "f".repeat(64), estudio_imagen: { archivo: "abc.png" } });
    expect(r.caso).toEqual({ asignacionId: "a1", ronda: 1, orden: 8, codigo: "R1-08", sha256: "f".repeat(64), archivo: "abc.png" });
    expect(r.ronda).toEqual({ numero: 1, nombre: "Ronda 1", total: 40, completadas: 7 });
    expect(r.terminado).toBe(false);
  });

  it("sin caso pendiente pero con rondas abiertas, el validador terminó", () => {
    const r = resumirEstudio(prog, null);
    expect(r.caso).toBeNull();
    expect(r.terminado).toBe(true);
  });

  it("sin rondas abiertas no hay casos ni se da por terminado", () => {
    const r = resumirEstudio([], null);
    expect(r.caso).toBeNull();
    expect(r.terminado).toBe(false);
  });

  it("no se rompe si la imagen no viene en la consulta", () => {
    const r = resumirEstudio(prog, { id: "a2", ronda: 1, orden: 1, codigo: "R1-01", imagen_sha256: "0".repeat(64) });
    expect(r.caso.archivo).toBeNull();
  });
});
