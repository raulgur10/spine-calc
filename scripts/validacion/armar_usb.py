"""Arma el contenido de la USB de cada evaluador a partir de las asignaciones.

Las radiografías no se suben a ningún servidor: cada evaluador recibe las suyas en
una USB, una carpeta por ronda y un archivo por caso, nombrado con el código que le
muestra la app (R1-07.png, R2-15.png…). Así la imagen no sale de dispositivos que
controlan los investigadores, y la app comprueba la huella SHA-256 del archivo
antes de cargarlo.

Entrega la ronda 2 DESPUÉS del lavado: arma cada ronda por separado y no copies
ronda_2 a la USB hasta que toque.

Entrada:
  --asignaciones  uno o más CSV de aleatorizar.py (asignaciones_r1.csv …)
  --imagenes      carpeta con los archivos <sha256>.<ext> (la carpeta «subir»
                  de preparar_imagenes.py)
  --salida        carpeta donde se crea <evaluador>/<ronda>/<codigo>.<ext>

Los nombres de salida no contienen nada del paciente. Lo ejecuta el investigador
que NO mide.

Uso:
  python -I armar_usb.py --asignaciones asig_r0.csv asig_r1.csv \
      --imagenes prep/subir --salida usb
"""
import argparse
import csv
import hashlib
import re
import shutil
from pathlib import Path

CARPETA_RONDA = {0: "practica", 1: "ronda_1", 2: "ronda_2", 9: "verificacion"}  # = src/validacion.js


def carpeta_evaluador(correo):
    """Nombre de carpeta legible a partir de la cuenta (parte antes de la @)."""
    return re.sub(r"[^a-z0-9._-]", "_", correo.lower().split("@")[0]) or "evaluador"


def sha256(ruta):
    return hashlib.sha256(Path(ruta).read_bytes()).hexdigest()


def armar(filas, imagenes, salida):
    """Copia cada imagen asignada a su destino y verifica la huella. Devuelve los destinos."""
    hechos = []
    for f in filas:
        origen = imagenes / f["archivo_bucket"]
        if not origen.exists():
            raise SystemExit(f"Falta {origen} (asignación {f['evaluador']} {f['codigo']})")
        ext = origen.suffix.lower()
        ronda = int(f["ronda"])
        destino = salida / carpeta_evaluador(f["evaluador"]) / CARPETA_RONDA.get(ronda, f"ronda_{ronda}") / f"{f['codigo']}{ext}"
        destino.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(origen, destino)  # copia byte a byte: la huella no cambia
        if sha256(destino) != f["sha256"]:
            raise SystemExit(f"La huella de {destino} no coincide con la asignada")
        hechos.append(destino)
    return hechos


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--asignaciones", nargs="+", required=True)
    ap.add_argument("--imagenes", required=True)
    ap.add_argument("--salida", required=True)
    a = ap.parse_args()
    filas = []
    for ruta in a.asignaciones:
        with open(ruta, newline="") as fh:
            filas.extend(csv.DictReader(fh))
    hechos = armar(filas, Path(a.imagenes), Path(a.salida))
    por_carpeta = {}
    for d in hechos:
        clave = f"{d.parent.parent.name}/{d.parent.name}"
        por_carpeta[clave] = por_carpeta.get(clave, 0) + 1
    for clave, n in sorted(por_carpeta.items()):
        print(f"{clave}: {n} imágenes")
    print(f"→ {a.salida}  (huellas verificadas; copia cada carpeta de evaluador a su USB)")


if __name__ == "__main__":
    main()
