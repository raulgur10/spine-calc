"""Fase 1: compara lo que guardó la aplicación contra la referencia independiente.

Dos comparaciones por caso:
  A. Algoritmo: con los MISMOS puntos que marcó el evaluador (guardados en la base),
     referencia.py recalcula cada parámetro. La app debe coincidir dentro del
     redondeo a un decimal (≤ 0.1°; ≤ 0.1 cm en el SVA).
  B. Flujo completo: lo que devolvió la app frente al valor de diseño del caso. Aquí
     entra el error de marcado del evaluador (pixeles), así que la tolerancia es
     mayor (1° y 0.3 cm) y además se exige la misma categoría GAP, SRS-Schwab y
     Roussouly que el diseño (los casos están a ≥ 1° de cualquier corte).

Entradas:
  carpeta de sinteticas.py (V1.png … V6.png y esperado.json)
  datos.json: resultado de la consulta SQL que está en LEEME.md

Uso:  python -I comparar_fase1.py <carpeta_fase1> <datos.json> [informe.md]
"""
import hashlib
import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import referencia as R  # noqa: E402

ANGULOS = ["pi", "ss", "pt", "l1s1", "l4s1", "gt", "l1pa", "t4pa", "l1tilt", "t1tilt", "c2tilt"]


def main(carpeta, datos, informe=None):
    carpeta = Path(carpeta)
    esperado = json.loads((carpeta / "esperado.json").read_text())
    sha_caso = {hashlib.sha256((carpeta / f"{n}.png").read_bytes()).hexdigest(): n for n in esperado}
    filas = json.loads(Path(datos).read_text())
    L, fallos = [], 0
    L.append("# Fase 1 — verificación del algoritmo con imágenes sintéticas\n")
    for m in sorted(filas, key=lambda r: sha_caso.get(r["imagen_sha256"], "zz")):
        caso = sha_caso.get(m["imagen_sha256"])
        if not caso:
            L.append(f"- Medición {m['id']}: la huella no corresponde a ningún caso sintético.\n")
            continue
        e = esperado[caso]
        pts = {lm["clave"]: {"x": float(lm["x"]), "y": float(lm["y"])} for lm in m["landmarks"]}
        ref_h = None
        if m.get("horiz_p1x") is not None:
            ref_h = [{"x": float(m["horiz_p1x"]), "y": float(m["horiz_p1y"])},
                     {"x": float(m["horiz_p2x"]), "y": float(m["horiz_p2y"])}]
        mm = float(m["mm_por_px"]) if m.get("mm_por_px") else None
        rec = R.parametros(pts, mm_por_px=mm, ref_h=ref_h)
        L.append(f"## {caso} ({m.get('folio') or ''}) — {e['base']}{' en espejo' if e['espejo'] else ''}{' girado ' + str(e['giro_grados']) + '°' if e['giro_grados'] else ''}\n")
        L.append("| Parámetro | App | Referencia con sus puntos (A) | Δ A | Diseño (B) | Δ B |")
        L.append("|---|---|---|---|---|---|")
        for k in ANGULOS + ["sva_cm"]:
            app = m.get(k)
            if app is None:
                L.append(f"| {k} | — | {rec.get(k, float('nan')):.2f} | | {e['parametros'].get(k, float('nan')):.1f} | |")
                continue
            app = float(app)
            ra, di = rec.get(k), e["parametros"].get(k)
            da = abs(app - ra) if ra is not None else float("nan")
            db = abs(app - di) if di is not None else float("nan")
            tol_a, tol_b = (0.1, 0.3) if k == "sva_cm" else (0.1, 1.0)
            ok_a, ok_b = da <= tol_a + 1e-9, db <= tol_b
            fallos += (not ok_a) + (not ok_b)
            L.append(f"| {k} | {app:.1f} | {ra:.2f} | {da:.2f}{'' if ok_a else ' ❌'} | {di:.1f} | {db:.2f}{'' if ok_b else ' ❌'} |")
        g = lambda v: float(m[v]) if m.get(v) is not None else None
        gap = R.gap(g("pi"), g("ss"), g("l1s1"), g("l4s1"), g("gt"), e["edad"])
        sch = R.schwab(g("pi"), g("l1s1"), g("pt"), g("sva_cm"))
        rou = R.roussouly(g("ss"), g("pi"), g("pt"))
        cats = [("GAP", gap["categoria"], e["gap"]["categoria"]), ("GAP total", gap["total"], e["gap"]["total"]),
                ("SRS-Schwab", sch, e["schwab"]), ("Roussouly", rou, e["roussouly"])]
        for nom, obt, esp in cats:
            ok = obt == esp
            fallos += not ok
            L.append(f"\n{nom}: {obt} (diseño: {esp}){'' if ok else ' ❌'}")
        dist = [math.dist((pts[k]["x"], pts[k]["y"]), (e["puntos_px"][k]["x"], e["puntos_px"][k]["y"])) for k in pts if k in e["puntos_px"]]
        L.append(f"\nError de marcado: mediana {sorted(dist)[len(dist)//2]:.1f} px, máximo {max(dist):.1f} px "
                 f"(escala del diseño 3 px/mm). Calibración: {mm and round(mm, 4)} mm/px (diseño {e['mm_por_px']:.4f}).\n")
    L.insert(1, f"**Resultado: {'SIN discrepancias' if fallos == 0 else f'{fallos} discrepancias (❌)'}** · {len(filas)} mediciones\n")
    texto = "\n".join(L)
    if informe:
        Path(informe).write_text(texto)
    print(texto)
    return 1 if fallos else 0


if __name__ == "__main__":
    sys.exit(main(*sys.argv[1:4]))
