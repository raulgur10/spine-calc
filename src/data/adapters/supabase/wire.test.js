import { describe, it, expect } from "vitest";
import { casoToRow, casoFromRow, childRows, casoPublicoFromRpc, COLUMNAS_CUBIERTAS } from "./wire";
import { formToCaso, emptyForm } from "../../form";
import { emptyCaso, MEAS_KEYS } from "../../caso";
import { makeGeometry } from "../../landmarks";
import { readFileSync } from "node:fs";

const GEOMETRY = {
  ...makeGeometry({
    landmarks: [
      { x: 430, y: 1195 }, { x: 450, y: 1205 }, { x: 350, y: 1020 }, { x: 450, y: 1090 },
      { x: 340, y: 900 }, { x: 440, y: 930 }, { x: 330, y: 640 }, { x: 430, y: 620 },
      { x: 430, y: 300 }, null, null, null,
    ],
    calibration: { mmPerPx: 0.284, refMm: 50 },
    horizontalRef: { p1: { x: 200, y: 1408 }, p2: { x: 800, y: 1408 } },
    imageDims: { w: 1000, h: 1600 },
    imageName: "preop.jpg",
  }),
  appliedAt: "2026-08-04T12:00:00.000Z",
};

const CASO = formToCaso({
  ...emptyForm({ hoy: "2026-08-04", casoId: "GAP-2026-QK4T" }),
  apellidos: "PEREZ", nombre: "JUAN", iniciales: "JP",
  age: "62", peso: "78.5", talla: "172",
  pi: "50.4", ss: "35", pt: "15.4", l1s1: "46.3", l4s1: "18.3", gt: "14.8",
  l1pa: "9.4", t4pa: "14", c2tiltDirect: "-0.3", cpa: "12",
  t1tiltDirect: "-0.8", t1pa: "14.6", l1tiltDirect: "-6",
  sva: "3.2", nvl: "4", bmdTscore: "-1.8",
  cirugias: [{ id: "a1", tipo: "Instrumentación lumbar posterior", tipoCustom: "", segmentos: ["L4-L5"] }],
  fotos: [{ id: "f1", name: "lat.jpg", categoria: "Radiografía lateral", dataUrl: "data:," }],
  geometry: GEOMETRY,
}, {
  paciente: "PEREZ JUAN", medico: "GALVAN", medidor: "GUILLEN",
  imc: { valor: 26.535, categoria: "Sobrepeso" },
  spinopelvic: { effPI: 50.4, effSS: 35, effPT: 15.4, derivedKey: "pt" },
  result: { total: 2, cat: { label: "Proporcionado" }, rpv: { score: 0 }, rll: { score: 0 }, ldi: { score: 2, value: 39.52 }, rsa: { score: 0 }, af: { score: 0 } },
  hillsResult: { idealL1PA: 4.2, l1paDiff: 5.2, idealLL_Hills: 52.58, ejeDiff: 4.6, ejeStatus: "warn" },
  tiltsResult: { pt: 15.4, c2: { direct: -0.3, derived: -3.4, delta: 3.1, cls: { level: "ok", label: "Normal" } }, t1: null, l1: null },
  schwabResult: { piLLVal: 4.1, piLL: { g: "0" }, pt: { g: "0" }, sva: { g: "0" } },
  roussoulyResult: { cur: { key: "3" }, curDef: { label: "Tipo 3" }, ideal: { key: "4" }, idealDef: { label: "Tipo 4" }, piMatch: { level: "ok" } },
  gapbResult: { bmi: 26.54, tscore: -1.8, gap: 2, prob: 0.0731, cat: { label: "Riesgo bajo" } },
  session: { uid: "u1", email: "m@ejemplo.mx" },
  deviceId: "dev1", consentVersion: "1.0", createdAt: "2026-08-04T12:00:00.000Z",
});

// El esquema real, para comprobar contra él y no contra lo que yo recuerde.
const SQL = readFileSync(new URL("../../../../supabase/schema.sql", import.meta.url), "utf8");
const columnasDeLaTabla = () => {
  const cuerpo = SQL.slice(SQL.indexOf("create table if not exists public.casos ("));
  const fin = cuerpo.indexOf("\n);");
  return new Set(
    cuerpo.slice(0, fin).split("\n").slice(1)
      .map(l => l.trim())
      .filter(l => l && !l.startsWith("--") && !l.startsWith("constraint") && !l.startsWith("check"))
      .map(l => l.split(/\s+/)[0])
      .filter(c => /^[a-z_][a-z0-9_]*$/.test(c))
  );
};

describe("casoToRow", () => {
  const fila = casoToRow(CASO);

  it("aplana las mediciones a columnas", () => {
    expect(fila.pi).toBe(50.4);
    expect(fila.l1s1).toBe(46.3);
    expect(fila.bmd_tscore).toBe(-1.8);   // renombrada
    expect(fila.nvl).toBe(4);
    expect(fila.sva).toBe(3.2);
    expect(fila.derived_key).toBe("pt");
  });

  it("aplana GAP, Hills, tilts, Schwab, Roussouly y GAP-B", () => {
    expect(fila.gap_total).toBe(2);
    expect(fila.gap_ldi_value).toBe(39.52);
    expect(fila.hills_ideal_ll).toBe(52.58);
    expect(fila.tilt_c2_direct).toBe(-0.3);
    expect(fila.tilt_c2_delta).toBe(3.1);
    expect(fila.tilt_c2_level).toBe("ok");
    expect(fila.schwab_pi_ll_grade).toBe("0");
    expect(fila.roussouly_current_key).toBe("3");
    expect(fila.gapb_prob).toBe(0.0731);
  });

  it("aplana los metadatos del trazo", () => {
    expect(fila.lm_image_width).toBe(1000);
    expect(fila.lm_image_name).toBe("preop.jpg");
    expect(fila.lm_mm_per_px).toBe(0.284);
    expect(fila.lm_horiz_p1x).toBe(200);
    expect(fila.lm_edited_after_apply).toBe(false);
  });

  it("no mete objetos anidados en la fila: todo es escalar o jsonb declarado", () => {
    const jsonb = ["lm_free_points", "lm_free_segments"];
    for (const [k, v] of Object.entries(fila)) {
      if (jsonb.includes(k)) continue;
      expect(typeof v === "object" && v !== null, `columna ${k}`).toBe(false);
    }
  });

  it("un caso vacío da una fila entera de null, no de NaN ni de cadenas vacías", () => {
    const fila0 = casoToRow(emptyCaso());
    for (const k of MEAS_KEYS) {
      const col = k === "bmdTscore" ? "bmd_tscore" : k;
      expect(fila0[col], `columna ${col}`).toBeNull();
    }
  });
});

describe("coherencia con supabase/schema.sql", () => {
  const columnas = columnasDeLaTabla();

  it("el esquema declara las columnas que el mapeo espera", () => {
    // Si alguien añade un campo al DTO y olvida la columna, o al revés, esto lo
    // delata antes de que el insert falle en producción.
    expect(columnas.size).toBeGreaterThan(60);
    for (const col of COLUMNAS_CUBIERTAS) {
      expect(columnas.has(col), `falta la columna "${col}" en schema.sql`).toBe(true);
    }
  });

  it("toda columna que produce casoToRow existe en la tabla", () => {
    for (const col of Object.keys(casoToRow(CASO))) {
      expect(columnas.has(col), `casoToRow produce "${col}", que no existe en la tabla`).toBe(true);
    }
  });

  it("las 16 mediciones tienen su columna", () => {
    const fila = casoToRow(CASO);
    expect(MEAS_KEYS).toHaveLength(16);
    for (const k of MEAS_KEYS) {
      const col = k === "bmdTscore" ? "bmd_tscore" : k;
      expect(col in fila, `medición ${k}`).toBe(true);
      expect(columnas.has(col), `columna ${col}`).toBe(true);
    }
  });
});

describe("childRows", () => {
  const hijos = childRows(CASO, "caso-1");

  it("un renglón por landmark, con su clave e índice", () => {
    expect(hijos.landmarks).toHaveLength(9);
    expect(hijos.landmarks[2]).toEqual({ caso_id: "caso-1", point_key: "s1Post", point_idx: 2, x: 350, y: 1020 });
  });

  it("las cirugías conservan el orden", () => {
    expect(hijos.cirugias[0]).toMatchObject({ ord: 0, tipo: "Instrumentación lumbar posterior", segmentos: ["L4-L5"] });
  });

  it("las fotos llevan su ruta de almacenamiento", () => {
    expect(hijos.fotos[0]).toMatchObject({ caso_id: "caso-1", foto_id: "f1", categoria: "Radiografía lateral" });
  });
});

describe("ida y vuelta por Postgres", () => {
  it("el caso sobrevive fila → DTO con las mediciones intactas", () => {
    const fila = { ...casoToRow(CASO), id: "caso-1" };
    const hijos = childRows(CASO, "caso-1");
    const back = casoFromRow(fila, {
      landmarks: hijos.landmarks, cirugias: hijos.cirugias, fotos: hijos.fotos,
    });

    expect(back.meas).toEqual(CASO.meas);
    expect(back.gap).toEqual(CASO.gap);
    expect(back.hills).toEqual(CASO.hills);
    expect(back.schwab).toEqual(CASO.schwab);
    expect(back.age).toBe(62);
    expect(back.patientFullName).toBe("PEREZ JUAN");
    expect(back.derivedKey).toBe("pt");
  });

  it("los landmarks vuelven con su clave, índice y coordenadas", () => {
    const fila = { ...casoToRow(CASO), id: "caso-1" };
    const back = casoFromRow(fila, { landmarks: childRows(CASO, "caso-1").landmarks });
    expect(back.landmarks.points).toEqual(CASO.landmarks.points);
    expect(back.landmarks.mmPerPx).toBe(0.284);
    expect(back.landmarks.horizontal).toEqual({ p1x: 200, p1y: 1408, p2x: 800, p2y: 1408 });
    expect(back.landmarks.imageName).toBe("preop.jpg");
  });

  it("sin puntos, `landmarks` vuelve como null aunque haya calibración en la fila", () => {
    const back = casoFromRow({ ...casoToRow(CASO), id: "x" }, { landmarks: [] });
    expect(back.landmarks).toBeNull();
  });

  it("los bloques que no se calcularon vuelven como null, no como objetos de nulls", () => {
    const back = casoFromRow({ ...casoToRow(emptyCaso()), id: "x" }, {});
    expect(back.gap).toBeNull();
    expect(back.hills).toBeNull();
    expect(back.tilts).toBeNull();
    expect(back.gapb).toBeNull();
  });

  it("Postgres devuelve los numeric como cadena y aun así el trazo sale numérico", () => {
    // El driver entrega numeric como string para no perder precisión.
    const fila = { ...casoToRow(CASO), id: "x", lm_mm_per_px: "0.284000", lm_calib_ref_mm: "50.00" };
    const back = casoFromRow(fila, { landmarks: [{ point_key: "femL", point_idx: 0, x: "430.000", y: "1195.000" }] });
    expect(back.landmarks.mmPerPx).toBeCloseTo(0.284, 6);
    expect(back.landmarks.points[0]).toEqual({ key: "femL", idx: 0, x: 430, y: 1195 });
  });
});

describe("casoPublicoFromRpc", () => {
  it("desanida lo que devuelve obtener_caso_publico", () => {
    const payload = {
      ...casoToRow(CASO), id: "caso-1",
      landmarks: [{ key: "femL", idx: 0, x: 430, y: 1195 }],
      cirugias: [{ tipo: "X", tipoCustom: null, segmentos: ["L4-L5"] }],
    };
    const caso = casoPublicoFromRpc(payload);
    expect(caso.visibility).toBe("public");
    expect(caso.landmarks.points).toEqual([{ key: "femL", idx: 0, x: 430, y: 1195 }]);
    expect(caso.surgeries[0]).toMatchObject({ type: "X", segments: ["L4-L5"] });
    expect(caso.meas.pi).toBe(50.4);
  });

  it("un caso inexistente devuelve null", () => {
    expect(casoPublicoFromRpc(null)).toBeNull();
  });
});
