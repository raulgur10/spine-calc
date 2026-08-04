import { describe, it, expect } from "vitest";
import {
  classify, gapIdeals, rpvCalc, rllCalc, ldiCalc, rsaCalc, afCalc,
  TILT_NORMS, TILT_TOL, tiltClass, computeTilt,
  roussoulyCurrentType, roussoulyIdealType,
} from "./scoring";

// Estas pruebas CONGELAN el comportamiento vigente de los métodos publicados
// (Yilgor 2017, Hills 2022, Roussouly/Laouissat, Bari 2020). No validan la
// literatura: si una de ellas falla tras un cambio, el cambio está mal, porque
// alteraría cálculos ya emitidos en reportes previos.
//
// Se prueban los BORDES de cada umbral, que es donde un refactor rompe sin ruido.

describe("GAP · relative pelvic version (RPV)", () => {
  const s = (d) => rpvCalc(100 + d, 100).score;   // d = actual − ideal
  it("umbrales -15 / -7 / 5", () => {
    expect(s(-15.1)).toBe(3);
    expect(s(-15)).toBe(2);     // −15 NO es "< −15"
    expect(s(-7.1)).toBe(2);
    expect(s(-7)).toBe(0);      // −7 NO es "< −7"
    expect(s(0)).toBe(0);
    expect(s(5)).toBe(0);       // 5 sí entra en "alineado"
    expect(s(5.1)).toBe(1);
  });
  it("etiquetas", () => {
    expect(rpvCalc(80, 100).label).toBe("Retroversion Severa");
    expect(rpvCalc(100, 100).label).toBe("Alineado");
    expect(rpvCalc(110, 100).label).toBe("Anteversion");
  });
});

describe("GAP · relative lumbar lordosis (RLL)", () => {
  const s = (d) => rllCalc(100 + d, 100).score;
  it("umbrales -25 / -14 / 11", () => {
    expect(s(-25.1)).toBe(3);
    expect(s(-25)).toBe(2);
    expect(s(-14.1)).toBe(2);
    expect(s(-14)).toBe(0);
    expect(s(11)).toBe(0);
    expect(s(11.1)).toBe(3);    // la hiperlordosis puntúa 3, no 1
  });
});

describe("GAP · lordosis distribution index (LDI)", () => {
  it("umbrales 40 / 50 / 80 por ciento", () => {
    expect(ldiCalc(39.9, 100).score).toBe(2);
    expect(ldiCalc(40, 100).score).toBe(1);
    expect(ldiCalc(49.9, 100).score).toBe(1);
    expect(ldiCalc(50, 100).score).toBe(0);
    expect(ldiCalc(80, 100).score).toBe(0);
    expect(ldiCalc(80.1, 100).score).toBe(3);
  });
  it("L1-S1 = 0 no divide por cero", () => {
    const r = ldiCalc(30, 0);
    expect(r.score).toBe(0);
    expect(r.label).toBe("N/A");
    expect(r.value).toBe(0);
  });
  it("devuelve el porcentaje en `value`", () => {
    expect(ldiCalc(30, 60).value).toBeCloseTo(50, 6);
  });
});

describe("GAP · relative spinopelvic alignment (RSA)", () => {
  const s = (d) => rsaCalc(100 + d, 100).score;
  it("umbrales -7 / 10 / 18", () => {
    expect(s(18.1)).toBe(3);
    expect(s(18)).toBe(1);
    expect(s(10.1)).toBe(1);
    expect(s(10)).toBe(0);
    expect(s(-7)).toBe(0);
    expect(s(-7.1)).toBe(1);    // el desajuste negativo puntúa 1
  });
});

describe("GAP · factor edad", () => {
  it("corte en 60 años", () => {
    expect(afCalc(59).score).toBe(0);
    expect(afCalc(60).score).toBe(1);
    expect(afCalc(61).score).toBe(1);
  });
});

describe("GAP · categoría del total", () => {
  it("cortes en 2 y 6 sobre 13", () => {
    expect(classify(0).label).toBe("Proporcionado");
    expect(classify(2).label).toBe("Proporcionado");
    expect(classify(3).label).toBe("Moderadamente Desproporcionado");
    expect(classify(6).label).toBe("Moderadamente Desproporcionado");
    expect(classify(7).label).toBe("Severamente Desproporcionado");
    expect(classify(13).label).toBe("Severamente Desproporcionado");
  });
});

describe("tilts vertebrales (Hills 2022)", () => {
  it("IC 80% poblacional congelado", () => {
    expect(TILT_NORMS.c2).toMatchObject({ lo: -4.4, hi: -1.1 });
    expect(TILT_NORMS.t1).toMatchObject({ lo: -7.0, hi: -3.6 });
    expect(TILT_NORMS.l1).toMatchObject({ lo: -10.3, hi: -5.1 });
    expect(TILT_TOL).toBe(2);
  });

  it("tiltClass: normal dentro del IC, borderline hasta 2° fuera, alterado más allá", () => {
    const { lo, hi } = TILT_NORMS.c2;
    expect(tiltClass(lo, lo, hi).level).toBe("ok");
    expect(tiltClass(hi, lo, hi).level).toBe("ok");
    expect(tiltClass(lo - 0.1, lo, hi).level).toBe("warn");
    expect(tiltClass(lo - TILT_TOL, lo, hi).level).toBe("warn");
    expect(tiltClass(lo - TILT_TOL - 0.1, lo, hi).level).toBe("bad");
    expect(tiltClass(hi + TILT_TOL, lo, hi).level).toBe("warn");
    expect(tiltClass(hi + TILT_TOL + 0.1, lo, hi).level).toBe("bad");
  });

  it("computeTilt calcula el derivado como PA − PT y el delta contra el directo", () => {
    const r = computeTilt("l1", -6, 9.4, 15.4);
    expect(r.direct).toBe(-6);
    expect(r.derived).toBeCloseTo(-6, 6);
    expect(r.delta).toBeCloseTo(0, 6);
    expect(r.cls.level).toBe("ok");
  });

  it("computeTilt clasifica por el directo cuando existen ambos", () => {
    // directo normal, derivado muy alterado: manda el directo
    const r = computeTilt("c2", -3, 40, 15);
    expect(r.cls.level).toBe("ok");
    expect(r.derived).toBeCloseTo(25, 6);
    expect(r.delta).toBeCloseTo(-28, 6);
  });

  it("computeTilt funciona con solo uno de los dos, y devuelve null sin ninguno", () => {
    expect(computeTilt("c2", -3, "", null)).toMatchObject({ direct: -3, derived: null, delta: null });
    expect(computeTilt("c2", "", 12, 15)).toMatchObject({ direct: null, delta: null });
    expect(computeTilt("c2", "", "", null)).toBeNull();
    expect(computeTilt("c2", null, null, null)).toBeNull();
  });
});

describe("Roussouly · tipo actual", () => {
  it("SS < 35° depende del número de vértebras lordóticas", () => {
    expect(roussoulyCurrentType(30, 45, 10, 3).key).toBe("1");
    expect(roussoulyCurrentType(30, 45, 10, 4).key).toBe("2");
    // sin NVL no se puede diferenciar
    expect(roussoulyCurrentType(30, 45, 10, null)).toMatchObject({ key: "1|2", uncertain: "nvl" });
  });

  it("SS >= 45° es tipo 4", () => {
    expect(roussoulyCurrentType(45, 60, 20, null).key).toBe("4");
    expect(roussoulyCurrentType(44.9, 60, 20, null).key).not.toBe("4");
  });

  it("35° <= SS < 45°: el subtipo anteverted exige PI < 50 Y PT < 5", () => {
    expect(roussoulyCurrentType(40, 49, 4, null).key).toBe("3AP");
    expect(roussoulyCurrentType(40, 50, 4, null).key).toBe("3");   // PI en el límite
    expect(roussoulyCurrentType(40, 49, 5, null).key).toBe("3");   // PT en el límite
    expect(roussoulyCurrentType(40, 60, 20, null).key).toBe("3");
  });

  it("sin PI o PT en la banda intermedia cae a tipo 3 marcado como incierto", () => {
    expect(roussoulyCurrentType(40, null, 4, null)).toMatchObject({ key: "3", uncertain: "piPt" });
  });

  it("sin SS no clasifica", () => {
    expect(roussoulyCurrentType(null, 50, 10, 3)).toBeNull();
    expect(roussoulyCurrentType(NaN, 50, 10, 3)).toBeNull();
  });
});

describe("Roussouly · tipo ideal (Bari 2020)", () => {
  it("el tipo 4 se mantiene", () => {
    expect(roussoulyIdealType("4", 60, 20).key).toBe("4");
  });

  it("tipos 1 y 2 se conservan con PI baja y suben a 3/4 con PI alta", () => {
    expect(roussoulyIdealType("1", 45, 10).key).toBe("1");
    expect(roussoulyIdealType("2", 45, 10).key).toBe("2");
    expect(roussoulyIdealType("1|2", 45, 10).key).toBe("1|2");
    expect(roussoulyIdealType("1", 50, 10).key).toBe("3|4");
    expect(roussoulyIdealType("2", 60, 10).key).toBe("3|4");
  });

  it("tipo 3 con PI >= 50: el PT residual decide entre 3 y 4", () => {
    expect(roussoulyIdealType("3", 60, 24).key).toBe("3");
    expect(roussoulyIdealType("3", 60, 25).key).toBe("4");
    expect(roussoulyIdealType("3", 60, null)).toMatchObject({ key: "3|4", uncertain: "pt" });
  });

  it("tipo 3 con PI < 50 y PT < 5 va a anteverted", () => {
    expect(roussoulyIdealType("3", 45, 4).key).toBe("3AP");
    expect(roussoulyIdealType("3AP", 45, 4).key).toBe("3AP");
  });

  it("PI < 50 con PT >= 5 aplica la regla por PI y se marca como inferido", () => {
    expect(roussoulyIdealType("3", 45, 10)).toMatchObject({ key: "1|2", inferred: true });
  });

  it("sin tipo actual o sin PI no propone objetivo", () => {
    expect(roussoulyIdealType(null, 50, 10)).toBeNull();
    expect(roussoulyIdealType("3", null, 10)).toBeNull();
  });
});

describe("GAP · caso completo de referencia", () => {
  // Mismo caso sintético que geometry.test.js: PI 50.4, SS 35, PT 15.4,
  // L1-S1 46.3, L4-S1 18.3, GT 14.8. Ideales según Yilgor 2017.
  it("los ideales dependientes de la PI están congelados", () => {
    expect(gapIdeals(50)).toEqual({ idealSS: 38.5, idealLL: 60, idealGT: 9 });
    // Idénticos bit a bit a la expresión que vivía inline en App.jsx, en todo el
    // rango de PI fisiológicamente posible.
    for (let pi = 20; pi <= 90; pi += 0.1) {
      expect(gapIdeals(pi)).toEqual({
        idealSS: 0.59 * pi + 9,
        idealLL: 0.62 * pi + 29,
        idealGT: 0.48 * pi - 15,
      });
    }
  });

  it("suma y categoriza de extremo a extremo", () => {
    const { idealSS, idealLL, idealGT } = gapIdeals(50.4);

    const rpv = rpvCalc(35, idealSS);
    const rll = rllCalc(46.3, idealLL);
    const ldi = ldiCalc(18.3, 46.3);
    const rsa = rsaCalc(14.8, idealGT);
    const af = afCalc(58);

    const total = rpv.score + rll.score + ldi.score + rsa.score + af.score;
    expect({ rpv: rpv.score, rll: rll.score, ldi: ldi.score, rsa: rsa.score, af: af.score })
      .toEqual({ rpv: 0, rll: 0, ldi: 2, rsa: 0, af: 0 });
    expect(total).toBe(2);
    expect(classify(total).label).toBe("Proporcionado");
  });

  it("el caso de referencia cae justo dentro del umbral de RLL: es intencional", () => {
    // L1-S1 = 46.3° contra un ideal de 60.25° → diferencia −13.95°, a 0.05° de
    // convertirse en hipolordosis moderada (2 puntos). Si un cambio desplaza este
    // borde, el total del caso pasa de 2 (Proporcionado) a 4 y la prueba anterior
    // lo delata.
    const { idealLL } = gapIdeals(50.4);
    expect(46.3 - idealLL).toBeGreaterThan(-14);
    expect(46.3 - idealLL).toBeLessThan(-13.9);
  });
});
