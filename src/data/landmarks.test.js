import { describe, it, expect } from "vitest";
import {
  LANDMARK_KEYS, OPTIONAL_LANDMARK_KEYS, ANNOTATOR_VERSION, MEASUREMENT_KEYS,
  pointsFromArray, pointsToArray, makeGeometry, detectManualEdits,
} from "./landmarks";
import { formToCaso, casoToForm, emptyForm } from "./form";

// Mismo caso sintético que geometry.test.js.
const PUNTOS = [
  { x: 430, y: 1195 }, { x: 450, y: 1205 },
  { x: 350, y: 1020 }, { x: 450, y: 1090 },
  { x: 340, y: 900 }, { x: 440, y: 930 },
  { x: 330, y: 640 }, { x: 430, y: 620 },
  { x: 430, y: 300 },
  null, null, null,                            // T4, T1 y C2 sin marcar
];

const ESTADO_ANOTADOR = {
  landmarks: PUNTOS,
  calibration: { mmPerPx: 0.2841, refSegId: "s1", refMm: 50 },
  horizontalRef: { p1: { x: 200, y: 1408 }, p2: { x: 800, y: 1408 } },
  imageDims: { w: 1000, h: 1600 },
  imageName: "lateral_preop.jpg",
  freePts: [{ id: "p1", x: 10, y: 20 }, { id: "p2", x: 30, y: 40 }],
  freeSegs: [{ id: "s1", aId: "p1", bId: "p2" }],
};

describe("contrato de los landmarks", () => {
  it("son 12 claves y las tres últimas son las opcionales de Hills", () => {
    expect(LANDMARK_KEYS).toHaveLength(12);
    expect(LANDMARK_KEYS.slice(9)).toEqual(OPTIONAL_LANDMARK_KEYS);
    expect(new Set(LANDMARK_KEYS).size).toBe(12);   // sin repetidos
  });

  it("el orden está congelado: los índices se persisten con cada punto", () => {
    // Reordenar esta lista invalidaría los trazos ya guardados.
    expect(LANDMARK_KEYS).toEqual([
      "femL", "femR", "s1Post", "s1Ant", "l4Post", "l4Ant",
      "l1Post", "l1Ant", "c7", "t4", "t1", "c2",
    ]);
  });

  it("MEASUREMENT_KEYS no incluye `geometry`", () => {
    // Es lo que evita que el trazo se cuente como una medición en el aviso.
    expect(MEASUREMENT_KEYS).not.toContain("geometry");
    expect(MEASUREMENT_KEYS).toContain("sva");
  });
});

describe("pointsFromArray / pointsToArray", () => {
  it("omite los puntos sin marcar y conserva el índice", () => {
    const pts = pointsFromArray(PUNTOS);
    expect(pts).toHaveLength(9);
    expect(pts[0]).toEqual({ key: "femL", idx: 0, x: 430, y: 1195 });
    expect(pts.at(-1)).toEqual({ key: "c7", idx: 8, x: 430, y: 300 });
    expect(pts.some(p => OPTIONAL_LANDMARK_KEYS.includes(p.key))).toBe(false);
  });

  it("el ida y vuelta reconstruye el array de 12 con sus huecos", () => {
    const back = pointsToArray(pointsFromArray(PUNTOS));
    expect(back).toHaveLength(12);
    expect(back.slice(0, 9)).toEqual(PUNTOS.slice(0, 9));
    expect(back.slice(9)).toEqual([null, null, null]);
  });

  it("reconstruye también a partir de la clave, sin índice", () => {
    const back = pointsToArray([{ key: "c7", x: 1, y: 2 }]);
    expect(back[8]).toEqual({ x: 1, y: 2 });
  });

  it("tolera entradas basura", () => {
    expect(pointsFromArray(null)).toEqual([]);
    expect(pointsToArray(null)).toHaveLength(12);
  });
});

describe("makeGeometry", () => {
  const g = makeGeometry(ESTADO_ANOTADOR);

  it("empaqueta puntos, calibración y horizontal", () => {
    expect(g.points).toHaveLength(9);
    expect(g.mmPerPx).toBeCloseTo(0.2841, 6);
    expect(g.calibRefMm).toBe(50);
    expect(g.horizontal).toEqual({ p1x: 200, p1y: 1408, p2x: 800, p2y: 1408 });
  });

  it("guarda la identidad y las dimensiones de la imagen", () => {
    // Sin dimensiones no se pueden reproyectar unas coordenadas en píxeles, y
    // sin nombre no se sabe a qué placa pertenecen.
    expect(g.imageWidth).toBe(1000);
    expect(g.imageHeight).toBe(1600);
    expect(g.imageName).toBe("lateral_preop.jpg");
    expect(g.annotatorVersion).toBe(ANNOTATOR_VERSION);
  });

  it("conserva las mediciones libres del usuario", () => {
    expect(g.freePoints).toHaveLength(2);
    expect(g.freeSegments).toEqual([{ id: "s1", aId: "p1", bId: "p2" }]);
  });

  it("sin calibración, mmPerPx queda en null y no inventa una escala", () => {
    const sinCal = makeGeometry({ ...ESTADO_ANOTADOR, calibration: null });
    expect(sinCal.mmPerPx).toBeNull();
    expect(sinCal.calibRefMm).toBeNull();
  });

  it("devuelve null si no se marcó ningún punto", () => {
    // No tiene sentido guardar una calibración huérfana.
    expect(makeGeometry({ ...ESTADO_ANOTADOR, landmarks: Array(12).fill(null) })).toBeNull();
  });

  it("no anida arrays dentro de arrays", () => {
    // Firestore rechaza un array que contenga arrays directamente.
    const anidado = (v) => Array.isArray(v) && v.some(Array.isArray);
    for (const val of Object.values(g)) expect(anidado(val)).toBe(false);
  });
});

describe("detectManualEdits", () => {
  const applied = { pi: 50.4, ss: 35, c2tilt: -0.3, sva: 3.2 };

  it("es falso si el formulario conserva lo que aplicó el anotador", () => {
    expect(detectManualEdits(applied, {
      pi: "50.4", ss: "35", c2tiltDirect: "-0.3", sva: "3.2",
    })).toBe(false);
  });

  it("es verdadero si se corrigió un ángulo a mano", () => {
    expect(detectManualEdits(applied, {
      pi: "52", ss: "35", c2tiltDirect: "-0.3", sva: "3.2",
    })).toBe(true);
  });

  it("detecta la edición en los tilts, cuyo nombre difiere entre formulario y DTO", () => {
    expect(detectManualEdits(applied, {
      pi: "50.4", ss: "35", c2tiltDirect: "-1.9", sva: "3.2",
    })).toBe(true);
  });

  it("sin trazo aplicado no hay nada que comparar", () => {
    expect(detectManualEdits(null, { pi: "99" })).toBe(false);
  });
});

describe("el trazo viaja con el caso", () => {
  const geometry = { ...makeGeometry(ESTADO_ANOTADOR), applied: { pi: 50.4, ss: 35 }, appliedAt: "2026-08-04T12:00:00.000Z" };

  it("formToCaso lo guarda en `landmarks`", () => {
    const caso = formToCaso({ ...emptyForm(), pi: "50.4", ss: "35", geometry }, {});
    expect(caso.landmarks.points).toHaveLength(9);
    expect(caso.landmarks.appliedAt).toBe("2026-08-04T12:00:00.000Z");
    expect(caso.landmarks.editedAfterApply).toBe(false);
  });

  it("marca editedAfterApply si después se tocó una medición", () => {
    const caso = formToCaso({ ...emptyForm(), pi: "55", ss: "35", geometry }, {});
    expect(caso.landmarks.editedAfterApply).toBe(true);
  });

  it("sin trazo, `landmarks` queda en null", () => {
    expect(formToCaso(emptyForm(), {}).landmarks).toBeNull();
  });

  it("sobrevive el ida y vuelta por el DTO", () => {
    const caso = formToCaso({ ...emptyForm(), pi: "50.4", ss: "35", geometry }, {});
    const back = casoToForm(caso);
    expect(back.geometry.points).toEqual(geometry.points);
    expect(back.geometry.mmPerPx).toBeCloseTo(0.2841, 6);
    expect(pointsToArray(back.geometry.points).slice(0, 9)).toEqual(PUNTOS.slice(0, 9));
  });

  it("emptyForm lo declara, así que Limpiar lo borra", () => {
    expect("geometry" in emptyForm()).toBe(true);
    expect(emptyForm().geometry).toBeNull();
  });
});

describe("alineación con el anotador", () => {
  it("LANDMARK_KEYS y LANDMARK_DEFS describen los mismos 12 puntos en el mismo orden", async () => {
    // Es el contrato más frágil de todo el trazo: cada punto se persiste con su
    // índice, así que si alguien añade o reordena un landmark en el anotador y
    // no toca LANDMARK_KEYS, los datos guardados quedan mal etiquetados y nada
    // falla a la vista. Esta prueba es lo que lo impide.
    const { LANDMARK_DEFS } = await import("../landmarkDefs");
    expect(LANDMARK_DEFS).toHaveLength(LANDMARK_KEYS.length);
    LANDMARK_DEFS.forEach((d, i) => {
      expect(d.idx, `landmark ${i} (${d.short})`).toBe(i);
      expect(d.key, `landmark ${i} (${d.short})`).toBe(LANDMARK_KEYS[i]);
    });
    // Los opcionales del anotador tienen que ser exactamente los del contrato.
    const opcionales = LANDMARK_DEFS.filter(d => d.optional).map(d => LANDMARK_KEYS[d.idx]);
    expect(opcionales).toEqual(OPTIONAL_LANDMARK_KEYS);
  });
});
