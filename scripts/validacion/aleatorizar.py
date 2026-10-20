"""Genera las asignaciones del estudio de validación con orden aleatorio reproducible.

Para cada evaluador y cada ronda se baraja la lista de imágenes con un generador
sembrado; las rondas son independientes entre sí. La práctica (ronda 0) usa el
mismo orden para todos. El código que ve el evaluador (R1-07, P-02…) es nuevo en
cada ronda, de modo que no delata qué placa midió antes; el análisis empareja las
rondas por la huella SHA-256.

Lo ejecuta el investigador que NO mide. La semilla y el CSV de salida documentan la
aleatorización (GRRAS) y no se comparten con los evaluadores.

Uso:
  python -I aleatorizar.py --manifiesto manifiesto_estudio.csv --ronda 1 \
      --evaluadores correo1 correo2 ... --semilla 20261020 --salida asignaciones_r1
  python -I aleatorizar.py --manifiesto manifiesto_practica.csv --ronda 0 --mismo-orden ...
  python -I aleatorizar.py --manifiesto manifiesto_verificacion.csv --ronda 9 ...

Salida: <salida>.sql (pegar en el SQL Editor de Supabase) y <salida>.csv.
"""
import argparse
import csv
import random

PREFIJO = {0: "P", 1: "R1", 2: "R2", 9: "V"}


def leer_manifiesto(ruta):
    with open(ruta, newline="") as fh:
        return list(csv.DictReader(fh))


def asignar(imagenes, evaluadores, ronda, semilla, mismo_orden=False):
    """Lista de asignaciones {evaluador, ronda, orden, sha256, codigo}. Pura y reproducible."""
    base = sorted(imagenes, key=lambda r: r["sha256"])  # el orden de entrada no influye
    filas = []
    for i, ev in enumerate(evaluadores):
        rng = random.Random(f"{semilla}-{ronda}-{'todos' if mismo_orden else ev}")
        orden = base[:]
        rng.shuffle(orden)
        for n, img in enumerate(orden, start=1):
            filas.append({"evaluador": ev, "ronda": ronda, "orden": n, "sha256": img["sha256"],
                          "archivo_bucket": img["archivo_bucket"], "tipo": img["tipo"],
                          "codigo": f"{PREFIJO.get(ronda, f'X{ronda}')}-{n:02d}"})
    return filas


def sql(filas, imagenes):
    q = lambda s: "'" + str(s).replace("'", "''") + "'"
    out = ["-- Generado por scripts/validacion/aleatorizar.py. Ejecutar una sola vez.", "begin;"]
    out.append("insert into public.estudio_imagen (sha256, archivo, tipo) values")
    out.append(",\n".join(f"  ({q(i['sha256'])}, {q(i['archivo_bucket'])}, {q(i['tipo'])})" for i in imagenes))
    out.append("on conflict (sha256) do nothing;")
    out.append("insert into public.estudio_asignacion (user_id, ronda, orden, imagen_sha256, codigo)")
    out.append("select u.id, v.ronda, v.orden, v.sha, v.codigo from (values")
    out.append(",\n".join(f"  ({q(f['evaluador'].lower())}, {f['ronda']}, {f['orden']}, {q(f['sha256'])}, {q(f['codigo'])})" for f in filas))
    out.append(") as v(correo, ronda, orden, sha, codigo)")
    out.append("join auth.users u on lower(u.email) = v.correo;")
    out.append("-- Comprobación: debe dar una fila por evaluador con el número de imágenes.")
    rondas = sorted({f["ronda"] for f in filas})
    out.append(f"select u.email, a.ronda, count(*) from public.estudio_asignacion a join auth.users u on u.id = a.user_id where a.ronda in ({', '.join(map(str, rondas))}) group by 1, 2 order by 1, 2;")
    out.append("commit;")
    return "\n".join(out) + "\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifiesto", required=True)
    ap.add_argument("--ronda", type=int, required=True)
    ap.add_argument("--evaluadores", nargs="+", required=True, help="correos de las cuentas")
    ap.add_argument("--semilla", required=True)
    ap.add_argument("--mismo-orden", action="store_true", help="mismo orden para todos (práctica)")
    ap.add_argument("--salida", required=True)
    a = ap.parse_args()
    imagenes = leer_manifiesto(a.manifiesto)
    filas = asignar(imagenes, a.evaluadores, a.ronda, a.semilla, a.mismo_orden)
    with open(f"{a.salida}.csv", "w", newline="") as fh:
        wr = csv.DictWriter(fh, fieldnames=list(filas[0].keys()))
        wr.writeheader()
        wr.writerows(filas)
    with open(f"{a.salida}.sql", "w") as fh:
        fh.write(sql(filas, imagenes))
    print(f"{len(filas)} asignaciones ({len(a.evaluadores)} evaluadores × {len(imagenes)} imágenes, ronda {a.ronda}, semilla {a.semilla})")
    print(f"→ {a.salida}.sql y {a.salida}.csv")


if __name__ == "__main__":
    main()
