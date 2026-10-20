"""Genera las radiografías sintéticas de la fase 1 (verificación del algoritmo).

Cada imagen muestra, en coordenadas conocidas, los puntos que el evaluador marca en
el anotador: los centros de ambas cabezas femorales, las esquinas de los platillos
superiores de S1, L4 y L1 y los centros de C7, T4, T1 y C2, más una regla de
100 mm para calibrar. Los valores esperados se calculan con referencia.py, que no
comparte código con la aplicación.

Uso:  python -I sinteticas.py <carpeta_salida>
Salida: V1.png … V6.png y esperado.json (coordenadas exactas y valores esperados).

Casos:
  V1  alineación normal
  V2  PI alta, desbalance anterior (C2 y T1 por delante de las caderas, SVA +)
  V3  pelvis antevertida (PT negativa) y SVA negativo
  V4  espalda plana (hipolordosis, PT alta, SVA grande)
  V5  V2 en espejo: paciente mirando a la izquierda; debe dar lo mismo que V2
  V6  V1 con la placa girada 6°: hay que alinear la horizontal con la línea
      «HORIZONTAL» dibujada; debe dar lo mismo que V1
"""
import json
import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
import referencia as R  # noqa: E402

ESCALA = 3.0           # px por mm
W, H = 1200, 2500      # tamaño de la imagen
ORIGEN = (560, 2050)   # posición en px del eje bicoxofemoral (y hacia abajo)

# Diseño de cada caso en mm, +x anterior, +y arriba, eje bicoxofemoral en (0, 0).
# pt, ss, ll (L1-S1), l4 (L4-S1) en grados; el resto son posiciones en mm.
DISENO = {
    "V1": dict(edad=45, pt=13, ss=38, ll=52, l4=34, c7=(-25, 520), t4=(-30, 430), t1=(-28, 500), c2=(-20, 600)),
    "V2": dict(edad=67, pt=18, ss=50, ll=55, l4=36, c7=(70, 520), t4=(30, 430), t1=(40, 500), c2=(55, 600)),
    "V3": dict(edad=38, pt=-4, ss=42, ll=48, l4=32, c7=(-48, 520), t4=(-45, 430), t1=(-50, 500), c2=(-48, 600)),
    "V4": dict(edad=72, pt=33, ss=24, ll=22, l4=16, c7=(105, 500), t4=(60, 420), t1=(80, 485), c2=(95, 580)),
}


def construir(d):
    """Coordenadas en mm (+y arriba) de todos los puntos del caso."""
    r = 100.0
    pt, ss = math.radians(d["pt"]), math.radians(d["ss"])
    m = (-r * math.sin(pt), r * math.cos(pt))                 # punto medio de S1
    def platillo(centro, ang_deg, media=45.0):
        a = math.radians(ang_deg)                              # inclinación respecto a la horizontal
        dx, dy = math.cos(a) * media, -math.sin(a) * media     # anterior más bajo si ang > 0
        return (centro[0] - dx, centro[1] - dy), (centro[0] + dx, centro[1] + dy)
    s1p, s1a = platillo(m, d["ss"])
    l4p, l4a = platillo((m[0] + 6, m[1] + 75), d["ss"] - d["l4"])
    l1p, l1a = platillo((m[0] + 4, m[1] + 200), d["ss"] - d["ll"])
    return {
        "femL": (-5, 3), "femR": (5, -3),
        "s1Post": s1p, "s1Ant": s1a, "l4Post": l4p, "l4Ant": l4a, "l1Post": l1p, "l1Ant": l1a,
        "c7": d["c7"], "t4": d["t4"], "t1": d["t1"], "c2": d["c2"],
    }


def a_px(p, espejo=False, giro=0.0):
    x, y = ORIGEN[0] + p[0] * ESCALA, ORIGEN[1] - p[1] * ESCALA
    if espejo:
        x = W - x
    if giro:
        cx, cy = W / 2, H / 2
        g = math.radians(giro)
        x, y = cx + (x - cx) * math.cos(g) - (y - cy) * math.sin(g), cy + (x - cx) * math.sin(g) + (y - cy) * math.cos(g)
    return (x, y)


def fuente(tam):
    for f in ("/System/Library/Fonts/Supplemental/Arial.ttf", "/Library/Fonts/Arial.ttf"):
        try:
            return ImageFont.truetype(f, tam)
        except OSError:
            pass
    return ImageFont.load_default()


def dibujar(nombre, px, regla, horizontal, salida):
    im = Image.new("L", (W, H), 18)
    dr = ImageDraw.Draw(im)
    f, fp = fuente(26), fuente(20)
    dr.text((30, 25), f"SpineCalc · verificación del algoritmo · {nombre} · imagen sintética", fill=200, font=f)
    def cruz(p, r=9, color=255):
        x, y = p
        dr.line([(x - r, y), (x + r, y)], fill=color, width=2)
        dr.line([(x, y - r), (x, y + r)], fill=color, width=2)
    for k in ("femL", "femR"):
        x, y = px[k]
        dr.ellipse([x - 75, y - 75, x + 75, y + 75], outline=150, width=3)
        cruz(px[k])
    for nivel in ("s1", "l4", "l1"):
        p, a = px[f"{nivel}Post"], px[f"{nivel}Ant"]
        dr.line([p, a], fill=170, width=3)
        for q in (p, a):
            dr.ellipse([q[0] - 6, q[1] - 6, q[0] + 6, q[1] + 6], outline=255, width=2)
        dr.text((a[0] + 14, a[1] - 12), nivel.upper(), fill=220, font=fp)
    for k in ("c7", "t4", "t1", "c2"):
        cruz(px[k], 11)
        dr.text((px[k][0] + 16, px[k][1] - 12), k.upper(), fill=220, font=fp)
    dr.text((px["femR"][0] + 85, px["femR"][1] - 12), "CABEZAS FEMORALES", fill=220, font=fp)
    (x1, y1), (x2, y2) = regla
    dr.line(regla, fill=255, width=3)
    for q in regla:
        cruz(q, 12)
    dr.text(((x1 + x2) / 2 - 50, (y1 + y2) / 2 + 18), "REGLA 100 mm", fill=230, font=fp)
    if horizontal:
        dr.line(horizontal, fill=200, width=2)
        dr.text((horizontal[1][0] - 150, horizontal[1][1] - 34), "HORIZONTAL", fill=230, font=fp)
    im.save(salida, optimize=True)


def main(dir_salida):
    out = Path(dir_salida)
    out.mkdir(parents=True, exist_ok=True)
    variantes = {k: dict(base=k) for k in DISENO}
    variantes["V5"] = dict(base="V2", espejo=True)
    variantes["V6"] = dict(base="V1", giro=6.0)
    esperado = {}
    for nombre, var in variantes.items():
        d = DISENO[var["base"]]
        mm = construir(d)
        esp, giro = var.get("espejo", False), var.get("giro", 0.0)
        px = {k: a_px(v, esp, giro) for k, v in mm.items()}
        regla = (a_px((-150, -40), esp, giro), a_px((-50, -40), esp, giro))
        horizontal = (a_px((-160, -110), esp, giro), a_px((160, -110), esp, giro)) if giro else None
        dibujar(nombre, px, regla, horizontal, out / f"{nombre}.png")
        mm_por_px = 100.0 / math.dist(*regla)
        puntos = {k: {"x": x, "y": y} for k, (x, y) in px.items()}
        ref_h = [{"x": horizontal[0][0], "y": horizontal[0][1]}, {"x": horizontal[1][0], "y": horizontal[1][1]}] if horizontal else None
        par = R.parametros(puntos, mm_por_px=mm_por_px, ref_h=ref_h)
        esperado[nombre] = {
            "base": var["base"], "espejo": esp, "giro_grados": giro, "edad": d["edad"],
            "puntos_px": puntos, "regla_px": [list(q) for q in regla], "mm_por_px": mm_por_px,
            "horizontal_px": ref_h,
            "parametros": par,
            "gap": R.gap(par["pi"], par["ss"], par["l1s1"], par["l4s1"], par["gt"], d["edad"]),
            "schwab": R.schwab(par["pi"], par["l1s1"], par["pt"], par["sva_cm"]),
            "roussouly": R.roussouly(par["ss"], par["pi"], par["pt"]),
        }
    (out / "esperado.json").write_text(json.dumps(esperado, indent=1, ensure_ascii=False))
    for n, e in esperado.items():
        p = e["parametros"]
        print(n, " ".join(f"{k}={v:.1f}" for k, v in p.items()), "| GAP", e["gap"]["total"], e["gap"]["categoria"],
              "| Schwab", e["schwab"], "| R", e["roussouly"])


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "fase1")
