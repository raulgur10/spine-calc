import { describe, it, expect } from "vitest";
import { casoFromDocV1, casoFromDoc } from "./wire";
import { casoToForm } from "../../form";
import { CASO_SCHEMA_VERSION } from "../../caso";

// Documento tal y como lo escribió la versión anterior en public_cases.
// Todos los casos emitidos hasta ahora tienen esta forma.
const DOC_PUBLICO_V1 = {
  casoId: "GAP-2026-QK4T",
  fechaCaso: "2026-08-04T12:00:00.000Z",
  fechaEstudio: "2026-08-04",
  fechaCirugia: "2026-06-15",
  tipoEvaluacion: "postoperatorio",
  tiempoCalculado: "Estudio 50 días después de la cirugía",
  diasDiferencia: 50,
  iniciales: "JPL",
  edad: 62, peso: 78.5, talla: 172,
  imc: { valor: 26.54, categoria: "Sobrepeso" },
  cirugias: [{ tipo: "Instrumentación lumbar posterior", tipoCustom: "", segmentos: ["L4-L5", "L5-S1"] }],
  deviceId: "dev-1",
  consentVersion: "1.0",
  mediciones: {
    pi: 50.4, ss: 35, pt: 15.4, derivedKey: null,
    l1s1: 46.3, l4s1: 18.3, gt: 14.8,
    l1pa: 9.4, t4pa: 14,
    c2tilt: -0.3, cpa: 12, t1tilt: -0.8, t1pa: 14.6, l1tilt: -6,
  },
  resultado: { total: 2, categoria: "Proporcionado", rpv: 0, rll: 0, ldi: 2, ldiValor: 39.52, rsa: 0, af: 0 },
  hills: { idealL1PA: 4.2, l1paDiff: 5.2, idealLL_Hills: 52.58, ejeDiff: 4.6, ejeStatus: "warn" },
  // Los casos públicos v1 guardaban los tilts SIN delta.
  tilts: {
    pt: 15.4,
    c2: { direct: -0.3, derived: -3.4, level: "ok", label: "Normal" },
    t1: null, l1: null,
  },
};

// Rehidratación tal y como la hacía la versión anterior de loadPublicCase:
// veinticinco setState leyendo el documento crudo. Es la referencia contra la
// que se compara el camino nuevo.
function rehidratacionAntigua(c) {
  const m = c.mediciones || {};
  return {
    fechaEstudio: c.fechaEstudio || "HOY",
    fechaCirugia: c.fechaCirugia || "",
    tipoEvaluacion: c.tipoEvaluacion || "preoperatorio",
    iniciales: c.iniciales || "",
    age: c.edad ?? "",
    peso: c.peso ?? "",
    talla: c.talla ?? "",
    pi: m.pi ?? "", ss: m.ss ?? "", pt: m.pt ?? "",
    l1s1: m.l1s1 ?? "", l4s1: m.l4s1 ?? "", gt: m.gt ?? "",
    l1pa: m.l1pa ?? "", t4pa: m.t4pa ?? "",
    c2tiltDirect: m.c2tilt ?? "", cpa: m.cpa ?? "",
    t1tiltDirect: m.t1tilt ?? "", t1pa: m.t1pa ?? "",
    l1tiltDirect: m.l1tilt ?? "",
  };
}

describe("casoFromDocV1", () => {
  const caso = casoFromDocV1(DOC_PUBLICO_V1, { id: "GAP-2026-QK4T", visibility: "public" });

  it("desanida las mediciones", () => {
    expect(caso.meas).toMatchObject({
      pi: 50.4, ss: 35, pt: 15.4, l1s1: 46.3, l4s1: 18.3, gt: 14.8,
      l1pa: 9.4, t4pa: 14, c2tilt: -0.3, cpa: 12, t1tilt: -0.8, t1pa: 14.6, l1tilt: -6,
    });
  });

  it("deja en null las tres mediciones que v1 nunca guardó", () => {
    expect(caso.meas.sva).toBeNull();
    expect(caso.meas.bmdTscore).toBeNull();
    expect(caso.meas.nvl).toBeNull();
  });

  it("traduce resultado, hills y tilts a los nombres del DTO", () => {
    expect(caso.gap).toMatchObject({ total: 2, category: "Proporcionado", ldiValue: 39.52 });
    expect(caso.hills).toMatchObject({ idealLLHills: 52.58, axisStatus: "warn" });
    expect(caso.tilts.c2).toEqual({ direct: -0.3, derived: -3.4, delta: null, level: "ok", label: "Normal" });
  });

  it("se marca como v1 para no reescribirlo con la forma nueva", () => {
    expect(caso.schemaVersion).toBe(1);
  });

  it("acepta `paciente` como objeto y como cadena suelta", () => {
    const obj = casoFromDocV1({ paciente: { apellidos: "PEREZ", nombre: "JUAN", completo: "PEREZ JUAN" } });
    expect(obj.patientFullName).toBe("PEREZ JUAN");
    expect(obj.patientLastName).toBe("PEREZ");
    const str = casoFromDocV1({ paciente: "PEREZ JUAN" });
    expect(str.patientFullName).toBe("PEREZ JUAN");
    expect(str.patientLastName).toBeNull();
  });

  it("no revienta con un documento mínimo", () => {
    const c = casoFromDocV1({});
    expect(c.meas.pi).toBeNull();
    expect(c.gap).toBeNull();
    expect(c.surgeries).toEqual([]);
    expect(c.photos).toEqual([]);
    expect(casoFromDocV1(null)).toBeNull();
  });
});

describe("casoFromDoc · detección de versión", () => {
  it("un documento v2 pasa por normalizeCaso, no por el traductor v1", () => {
    const v2 = { schemaVersion: CASO_SCHEMA_VERSION, meas: { pi: 50, sva: 3.2 }, age: 62 };
    const c = casoFromDoc(v2, { id: "x1" });
    expect(c.meas.pi).toBe(50);
    expect(c.meas.sva).toBe(3.2);      // v1 lo habría forzado a null
    expect(c.id).toBe("x1");
  });

  it("un documento sin schemaVersion se trata como v1", () => {
    const c = casoFromDoc(DOC_PUBLICO_V1, { id: "GAP-2026-QK4T" });
    expect(c.schemaVersion).toBe(1);
    expect(c.meas.pi).toBe(50.4);
  });
});

describe("equivalencia con la rehidratación anterior", () => {
  it("carga un caso público v1 exactamente igual que los 25 setState que sustituyó", () => {
    const antes = rehidratacionAntigua(DOC_PUBLICO_V1);
    const ahora = casoToForm(casoFromDoc(DOC_PUBLICO_V1, { id: "GAP-2026-QK4T", visibility: "public" }));

    for (const [campo, valorAntes] of Object.entries(antes)) {
      if (campo === "fechaEstudio" && valorAntes === "HOY") continue;
      // La única diferencia buscada: el camino nuevo entrega cadenas a los
      // <input> en vez de números crudos. El valor mostrado es el mismo.
      expect(String(ahora[campo]), `campo ${campo}`).toBe(String(valorAntes));
    }
  });

  it("las cirugías recuperan una clave de React aunque el documento no la traiga", () => {
    const f = casoToForm(casoFromDoc(DOC_PUBLICO_V1, { visibility: "public" }));
    expect(f.cirugias).toHaveLength(1);
    expect(f.cirugias[0]).toMatchObject({
      tipo: "Instrumentación lumbar posterior", tipoCustom: "", segmentos: ["L4-L5", "L5-S1"],
    });
    expect(f.cirugias[0].id).toBeTruthy();
  });

  it("un documento sin fechaEstudio deja el campo vacío para que la app ponga hoy", () => {
    const sinFecha = { ...DOC_PUBLICO_V1, fechaEstudio: undefined };
    expect(casoToForm(casoFromDoc(sinFecha)).fechaEstudio).toBe("");
  });
});
