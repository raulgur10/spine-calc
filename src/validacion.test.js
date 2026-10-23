import { describe, it, expect } from "vitest";
import { resumirEstudio, puntosDelEstudio, archivoDelCaso } from "./validacion";

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

describe("puntosDelEstudio", () => {
  it("envía los 16 puntos, incluidos T2 y T12 (variables del protocolo)", () => {
    const pts = [
      { key: "femL", idx: 0, x: 1, y: 2 }, { key: "t2Post", idx: 12, x: 5, y: 6 }, { key: "t12Ant", idx: 15, x: 7, y: 8 },
    ];
    expect(puntosDelEstudio(pts)).toEqual([{ key: "femL", x: 1, y: 2 }, { key: "t2Post", x: 5, y: 6 }, { key: "t12Ant", x: 7, y: 8 }]);
  });
  it("descarta claves que el CHECK de la base no admite", () => {
    expect(puntosDelEstudio([{ key: "rodilla", x: 0, y: 0 }])).toEqual([]);
  });
});

describe("archivoDelCaso", () => {
  it("nombra el archivo con el código del caso en la carpeta de su ronda (= armar_usb.py)", () => {
    expect(archivoDelCaso({ ronda: 1, codigo: "R1-07", archivo: "ab.png" })).toEqual({ carpeta: "ronda_1", nombre: "R1-07.png" });
    expect(archivoDelCaso({ ronda: 2, codigo: "R2-15", archivo: "ab.JPG" })).toEqual({ carpeta: "ronda_2", nombre: "R2-15.jpg" });
    expect(archivoDelCaso({ ronda: 0, codigo: "P-01", archivo: null })).toEqual({ carpeta: "practica", nombre: "P-01.png" });
    expect(archivoDelCaso({ ronda: 9, codigo: "V-03", archivo: "x.png" }).carpeta).toBe("verificacion");
  });
});
