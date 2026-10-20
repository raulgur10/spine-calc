"""Prepara las radiografías anonimizadas para subirlas al bucket privado «validacion».

Copia cada imagen a <salida>/subir/<sha256>.<ext> (el nombre ya no dice nada del
paciente) y escribe <salida>/manifiesto_<tipo>.csv con la correspondencia.

El manifiesto relaciona el nombre ORIGINAL con la huella: si los nombres originales
llevan datos del paciente, el manifiesto es tan sensible como las imágenes y se
guarda con ellas (Mac + USB cifrados), nunca en OneDrive ni en el repositorio.

No modifica las imágenes: la huella del archivo subido debe ser la misma que
calcula el navegador al descargarlo. Por eso la anonimización (recortar el texto
que imprime el PACS y exportar sin metadatos) se hace ANTES, y este script solo
avisa si encuentra metadatos.

Uso:  python -I preparar_imagenes.py <carpeta_imagenes> <carpeta_salida> --tipo estudio|practica|verificacion
"""
import argparse
import csv
import hashlib
import shutil
import sys
from pathlib import Path

from PIL import Image

EXT = {".png", ".jpg", ".jpeg"}


def metadatos(ruta):
    """Lista de metadatos presentes que podrían identificar (EXIF, texto PNG)."""
    hallados = []
    with Image.open(ruta) as im:
        if im.getexif():
            hallados.append("EXIF")
        for k in im.info:
            if k.lower() in ("exif", "xmp", "comment", "description", "author", "icc_profile"):
                continue
            if isinstance(im.info[k], (str, bytes)):
                hallados.append(f"texto:{k}")
        tam = im.size
    return hallados, tam


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("entrada")
    ap.add_argument("salida")
    ap.add_argument("--tipo", required=True, choices=["estudio", "practica", "verificacion"])
    a = ap.parse_args()
    entrada, salida = Path(a.entrada), Path(a.salida)
    subir = salida / "subir"
    subir.mkdir(parents=True, exist_ok=True)
    filas, vistos, avisos = [], {}, 0
    for f in sorted(p for p in entrada.iterdir() if p.suffix.lower() in EXT):
        sha = hashlib.sha256(f.read_bytes()).hexdigest()
        if sha in vistos:
            print(f"DUPLICADO: {f.name} es idéntico a {vistos[sha]}; se omite.")
            continue
        vistos[sha] = f.name
        md, (w, h) = metadatos(f)
        if md:
            avisos += 1
            print(f"AVISO {f.name}: trae metadatos {md}. Expórtala de nuevo sin metadatos antes de subirla.")
        ext = ".jpg" if f.suffix.lower() == ".jpeg" else f.suffix.lower()
        destino = f"{sha}{ext}"
        shutil.copy2(f, subir / destino)
        filas.append({"archivo_original": f.name, "sha256": sha, "archivo_bucket": destino,
                      "ancho": w, "alto": h, "tipo": a.tipo})
    man = salida / f"manifiesto_{a.tipo}.csv"
    with open(man, "w", newline="") as fh:
        wr = csv.DictWriter(fh, fieldnames=list(filas[0].keys()) if filas else ["sha256"])
        wr.writeheader()
        wr.writerows(filas)
    print(f"{len(filas)} imágenes listas en {subir} · manifiesto: {man}" + (f" · {avisos} con metadatos" if avisos else ""))
    return 1 if avisos else 0


if __name__ == "__main__":
    sys.exit(main())
