import { describe, it, expect } from "vitest";
import { emptyForm, formToCaso, casoToForm, FORM_TO_MEAS, MEAS_KEYS_COVERED } from "./form";
import { emptyCaso, toPublicCaso, normalizeCaso, num, round, MEAS_KEYS, PRIVATE_FIELDS, CASO_SCHEMA_VERSION } from "./caso";

// Formulario de ejemplo con todos los campos llenos, para probar el ida y vuelta.
const FORM = {
  ...emptyForm({ hoy: "2026-08-04", casoId: "GAP-2026-QK4T" }),
  tipoEvaluacion: "postoperatorio",
  fechaCirugia: "2026-06-15",
  apellidos: "PEREZ LOPEZ", nombre: "JUAN", iniciales: "JPL",
  age: "62", peso: "78.5", talla: "172",
  cirujanoSel: "Otro (especificar)", cirujanoCustom: "GALVAN",
  medidorSel: "Guillén Rojas Raúl",
  cirugias: [{ id: "a1", tipo: "Instrumentación lumbar posterior", tipoCustom: "", segmentos: ["L4-L5", "L5-S1"] }],
  pi: "50.4", ss: "35", pt: "15.4",
  l1s1: "46.3", l4s1: "18.3", gt: "14.8",
  l1pa: "9.4", t4pa: "14",
  c2tiltDirect: "-0.3", cpa: "12",
  t1tiltDirect: "-0.8", t1pa: "14.6",
  l1tiltDirect: "-6",
  sva: "3.2", nvl: "4", bmdTscore: "-1.8",
};

const DERIVED = {
  paciente: "PEREZ LOPEZ JUAN",
  medico: "GALVAN",
  medidor: "Guillén Rojas Raúl",
  imc: { valor: 26.535964, categoria: "Sobrepeso" },
  diffInfo: { dias: 50, mensaje: "Estudio 50 días después de la cirugía" },
  spinopelvic: { effPI: 50.4, effSS: 35, effPT: 15.4, derivedKey: null },
  session: { uid: "u1", email: "medico@ejemplo.mx" },
  deviceId: "dev-1",
  consentVersion: "1.0",
  createdAt: "2026-08-04T12:00:00.000Z",
};

describe("caso.js · helpers", () => {
  it("num() convierte la cadena vacía a null, no a 0", () => {
    expect(num("")).toBeNull();
    expect(num(null)).toBeNull();
    expect(num(undefined)).toBeNull();
    expect(num("abc")).toBeNull();
    expect(num("0")).toBe(0);
    expect(num("-1.8")).toBe(-1.8);
    expect(num(0)).toBe(0);
  });

  it("round() conserva null en vez de producir NaN", () => {
    expect(round(null)).toBeNull();
    expect(round("")).toBeNull();
    expect(round(1.23456)).toBe(1.23);
    expect(round(1.23456, 4)).toBe(1.2346);
  });

  it("emptyCaso trae todas las claves de medición en null", () => {
    const c = emptyCaso();
    expect(Object.keys(c.meas).sort()).toEqual([...MEAS_KEYS].sort());
    expect(Object.values(c.meas).every((v) => v === null)).toBe(true);
    expect(c.schemaVersion).toBe(CASO_SCHEMA_VERSION);
  });

  it("normalizeCaso rellena huecos sin pisar lo que ya venía", () => {
    const c = normalizeCaso({ meas: { pi: 50 }, age: 62 });
    expect(c.meas.pi).toBe(50);
    expect(c.meas.ss).toBeNull();
    expect(c.age).toBe(62);
    expect(c.photos).toEqual([]);
    expect(normalizeCaso(null)).toBeNull();
  });
});

describe("formToCaso", () => {
  const caso = formToCaso(FORM, DERIVED);

  it("las mediciones pasan de cadena a número", () => {
    expect(caso.meas).toEqual({
      pi: 50.4, ss: 35, pt: 15.4,
      l1s1: 46.3, l4s1: 18.3, gt: 14.8,
      l1pa: 9.4, t4pa: 14,
      c2tilt: -0.3, cpa: 12,
      t1tilt: -0.8, t1pa: 14.6,
      l1tilt: -6,
      sva: 3.2, bmdTscore: -1.8, nvl: 4,
    });
  });

  it("persiste sva, bmdTscore y nvl, que hoy se pierden", () => {
    expect(caso.meas.sva).toBe(3.2);
    expect(caso.meas.bmdTscore).toBe(-1.8);
    expect(caso.meas.nvl).toBe(4);
  });

  it("PI, SS y PT salen de spinopelvic, no de los inputs crudos", () => {
    // Aunque el usuario solo escriba dos de los tres, el tercero derivado es el
    // que se guarda: es el que alimentó el cálculo.
    const c = formToCaso(
      { ...FORM, pt: "" },
      { ...DERIVED, spinopelvic: { effPI: 50.4, effSS: 35, effPT: 15.4, derivedKey: "pt" } }
    );
    expect(c.meas.pt).toBe(15.4);
    expect(c.derivedKey).toBe("pt");
  });

  it("un campo vacío da null, nunca cadena vacía ni NaN", () => {
    const c = formToCaso({ ...emptyForm(), pi: "", sva: "" }, {});
    expect(Object.values(c.meas).every((v) => v === null)).toBe(true);
    expect(c.age).toBeNull();
    expect(c.bmi).toBeNull();
  });

  it("mapea identidad, fechas y antropometría", () => {
    expect(caso.patientFullName).toBe("PEREZ LOPEZ JUAN");
    expect(caso.patientInitials).toBe("JPL");
    expect(caso.surgeonName).toBe("GALVAN");
    expect(caso.measurerName).toBe("Guillén Rojas Raúl");
    expect(caso.studyDate).toBe("2026-08-04");
    expect(caso.surgeryDate).toBe("2026-06-15");
    expect(caso.evaluationType).toBe("postoperatorio");
    expect(caso.daysDiff).toBe(50);
    expect(caso.age).toBe(62);
    expect(caso.bmi).toBe(26.54);          // redondeado a 2 decimales
    expect(caso.bmiCategory).toBe("Sobrepeso");
    expect(caso.ownerUid).toBe("u1");
    expect(caso.ownerEmail).toBe("medico@ejemplo.mx");
  });

  it("traduce las cirugías a la forma del DTO", () => {
    expect(caso.surgeries).toEqual([
      { id: "a1", type: "Instrumentación lumbar posterior", typeCustom: "", segments: ["L4-L5", "L5-S1"] },
    ]);
  });

  it("serializa los tilts sin arrastrar colores del tema", () => {
    const tiltsResult = {
      pt: 15.4,
      c2: { direct: -0.3, derived: -3.4, delta: 3.1, cls: { level: "ok", label: "Normal", color: "#15803D", bg: "#DCFCE7" } },
      t1: null, l1: null,
    };
    const c = formToCaso(FORM, { ...DERIVED, tiltsResult });
    expect(c.tilts.c2).toEqual({ direct: -0.3, derived: -3.4, delta: 3.1, level: "ok", label: "Normal" });
    expect(JSON.stringify(c.tilts)).not.toContain("#");
  });

  it("el delta del tilt se guarda siempre, también en un caso público", () => {
    // En la implementación previa la ruta pública omitía `delta`, lo que obligaba
    // a dos formas distintas de documento. Ahora es una sola.
    const tiltsResult = {
      pt: 15.4,
      c2: { direct: -0.3, derived: -3.4, delta: 3.1, cls: { level: "ok", label: "Normal" } },
      t1: null, l1: null,
    };
    const pub = toPublicCaso(formToCaso(FORM, { ...DERIVED, tiltsResult, visibility: "public" }));
    expect(pub.tilts.c2.delta).toBe(3.1);
  });

  it("serializa GAP, Hills, Schwab, Roussouly y GAP-B sin objetos de estilo", () => {
    const d = {
      ...DERIVED,
      result: {
        total: 2, cat: { label: "Proporcionado" },
        rpv: { score: 0 }, rll: { score: 0 },
        ldi: { score: 2, value: 39.524838 }, rsa: { score: 0 }, af: { score: 0 },
      },
      hillsResult: { idealL1PA: 4.2, l1paDiff: 5.2, idealLL_Hills: 52.58, ejeDiff: 4.6, ejeStatus: "warn" },
      schwabResult: { piLLVal: 4.1, piLL: { g: "0" }, pt: { g: "0" }, sva: { g: "0" } },
      roussoulyResult: {
        cur: { key: "3" }, curDef: { label: "Tipo 3 (armónico)" },
        ideal: { key: "4" }, idealDef: { label: "Tipo 4" },
        piMatch: { level: "ok" },
      },
      gapbResult: { bmi: 26.54, tscore: -1.8, gap: 2, prob: 0.0731234, cat: { label: "Riesgo bajo" } },
    };
    const c = formToCaso(FORM, d);
    expect(c.gap).toEqual({ total: 2, category: "Proporcionado", rpv: 0, rll: 0, ldi: 2, ldiValue: 39.52, rsa: 0, af: 0 });
    expect(c.hills).toEqual({ idealL1PA: 4.2, l1paDiff: 5.2, idealLLHills: 52.58, axisDiff: 4.6, axisStatus: "warn" });
    expect(c.schwab).toEqual({ piLL: 4.1, piLLGrade: "0", ptGrade: "0", svaGrade: "0" });
    expect(c.roussouly).toMatchObject({ currentKey: "3", idealKey: "4", piMatchLevel: "ok" });
    expect(c.gapb).toEqual({ bmi: 26.54, tscore: -1.8, gap: 2, prob: 0.0731, category: "Riesgo bajo" });
  });

  it("los bloques opcionales quedan en null si no se calcularon", () => {
    const c = formToCaso(FORM, DERIVED);
    expect(c.gap).toBeNull();
    expect(c.hills).toBeNull();
    expect(c.schwab).toBeNull();
    expect(c.roussouly).toBeNull();
    expect(c.gapb).toBeNull();
  });
});

describe("casoToForm · ida y vuelta", () => {
  it("recupera todas las mediciones tras pasar por el DTO", () => {
    const back = casoToForm(formToCaso(FORM, DERIVED));
    for (const campo of Object.keys(FORM_TO_MEAS)) {
      expect(back[campo], `medición ${campo}`).toBe(FORM[campo]);
    }
  });

  it("recupera identidad, fechas, antropometría y cirugías", () => {
    const back = casoToForm(formToCaso(FORM, DERIVED));
    for (const campo of ["tipoEvaluacion", "fechaEstudio", "fechaCirugia", "apellidos", "nombre", "iniciales", "age", "peso", "talla"]) {
      expect(back[campo], `campo ${campo}`).toBe(FORM[campo]);
    }
    expect(back.cirugias).toEqual(FORM.cirugias);
    expect(back.casoId).toBe("GAP-2026-QK4T");
  });

  it("los campos vacíos vuelven como cadena vacía, no como null ni 'null'", () => {
    const back = casoToForm(formToCaso(emptyForm(), {}));
    for (const campo of Object.keys(FORM_TO_MEAS)) {
      expect(back[campo], `medición ${campo}`).toBe("");
    }
    expect(back.apellidos).toBe("");
  });

  it("no revienta con un caso vacío o nulo", () => {
    expect(casoToForm(null)).toEqual({});
    expect(casoToForm(emptyCaso()).pi).toBe("");
  });
});

describe("toPublicCaso", () => {
  const pub = toPublicCaso(formToCaso(FORM, DERIVED));

  it("borra todo lo identificable y no deja rastro del propietario", () => {
    for (const f of PRIVATE_FIELDS) {
      const esperado = f === "photos" ? [] : null;
      expect(pub[f], `campo privado ${f}`).toEqual(esperado);
    }
  });

  it("conserva las mediciones, las iniciales y el ID público", () => {
    expect(pub.meas.pi).toBe(50.4);
    expect(pub.meas.sva).toBe(3.2);
    expect(pub.patientInitials).toBe("JPL");
    expect(pub.publicId).toBe("GAP-2026-QK4T");
    expect(pub.visibility).toBe("public");
  });

  it("no modifica el caso original", () => {
    const priv = formToCaso(FORM, DERIVED);
    toPublicCaso(priv);
    expect(priv.patientFullName).toBe("PEREZ LOPEZ JUAN");
    expect(priv.visibility).toBe("private");
  });
});

describe("emptyForm", () => {
  it("incluye sva, nvl y bmdTscore", () => {
    // La versión anterior de clearAll limpiaba 32 campos pero olvidaba estos
    // tres, así que arrastraban al siguiente paciente. Al pasar clearAll por
    // emptyForm, el olvido deja de ser posible.
    const f = emptyForm();
    expect(f.sva).toBe("");
    expect(f.nvl).toBe("");
    expect(f.bmdTscore).toBe("");
  });

  it("cubre todos los campos que casoToForm sabe repoblar", () => {
    const f = emptyForm();
    const repoblables = Object.keys(casoToForm(formToCaso(FORM, DERIVED)));
    for (const k of repoblables) {
      expect(k in f, `emptyForm no declara "${k}"`).toBe(true);
    }
  });

  it("toda clave de medición del DTO tiene origen en el formulario", () => {
    expect(MEAS_KEYS_COVERED).toBe(true);
  });
});
