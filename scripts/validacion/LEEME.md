# Scripts del estudio de validación

Los ejecuta el investigador que **no** mide (GRR). Python de Anaconda con Pillow y numpy:
`/opt/anaconda3/bin/python -I <script>`.

| Script | Para qué |
|---|---|
| `referencia.py` | Implementación independiente (sin código de la app) de los parámetros, el GAP, SRS–Schwab y Roussouly |
| `sinteticas.py` | Genera las 6 radiografías sintéticas de la fase 1 y sus valores esperados |
| `preparar_imagenes.py` | Copia las imágenes anonimizadas con su huella SHA-256 como nombre y escribe el manifiesto |
| `armar_usb.py` | Arma la USB de cada evaluador: una carpeta por ronda y un archivo por caso con su código (R1-07.png) |
| `aleatorizar.py` | Genera el orden aleatorio por evaluador y ronda (SQL para Supabase + CSV de respaldo) |
| `comparar_fase1.py` | Compara lo que guardó la app contra la referencia y contra el diseño |

## Puesta en marcha (una vez)

1. En el SQL Editor de Supabase, ejecutar `supabase/estudio.sql` completo. Crea las rondas, las tablas de
   imágenes y asignaciones, el guardado ligado a cada caso, y amplía la base a los 16 puntos y a la TK.
   **Las imágenes no se suben a Supabase**: viajan en USB.
2. Dar de alta a cada evaluador en *Authentication → Add user* (con «Auto Confirm») y luego:
   ```sql
   insert into public.validadores (user_id)
   select id from auth.users where lower(email) = 'correo@ejemplo.com'
   on conflict do nothing;
   ```

## Fase 1 — verificación del algoritmo

```
python -I sinteticas.py ~/Validacion/fase1
python -I preparar_imagenes.py ~/Validacion/fase1 ~/Validacion/fase1_prep --tipo verificacion
python -I aleatorizar.py --manifiesto ~/Validacion/fase1_prep/manifiesto_verificacion.csv --ronda 9 \
    --evaluadores correo_verificador --semilla 20261020 --salida ~/Validacion/asignaciones_r9
```

- Armar la carpeta de la verificadora y pasársela (USB o en persona; son sintéticas, sin datos de pacientes):
  `python -I armar_usb.py --asignaciones ~/Validacion/asignaciones_r9.csv --imagenes ~/Validacion/fase1_prep/subir --salida ~/Validacion/usb_fase1`
- Ejecutar `asignaciones_r9.sql` en el SQL Editor y abrir la ronda:
  `update public.estudio_ronda set abierta = true where numero = 9;`
- La verificadora entra con su cuenta, abre cada caso, **calibra sobre la regla de 100 mm**, marca las cruces y
  las esquinas de los platillos, y en V6 alinea la horizontal con la línea «HORIZONTAL».
- Al terminar, exportar sus mediciones con la consulta de abajo, guardarlas como `datos.json` y correr
  `python -I comparar_fase1.py ~/Validacion/fase1 datos.json informe_fase1.md`.

Criterios: **A** (algoritmo, con los mismos puntos) ≤ 0.1° y ≤ 0.1 cm; **B** (contra el diseño, incluye el error de
marcado) ≤ 1° y ≤ 0.3 cm, con las mismas categorías GAP, SRS–Schwab y Roussouly.

## Fase 2 — rondas de práctica, 1 y 2

```
python -I preparar_imagenes.py <carpeta_anonimizadas> <prep> --tipo estudio
python -I preparar_imagenes.py <carpeta_practica> <prep> --tipo practica
python -I aleatorizar.py --manifiesto <prep>/manifiesto_practica.csv --ronda 0 --mismo-orden --evaluadores <correos> --semilla <S> --salida <prep>/asig_r0
python -I aleatorizar.py --manifiesto <prep>/manifiesto_estudio.csv  --ronda 1 --evaluadores <correos> --semilla <S> --salida <prep>/asig_r1
python -I aleatorizar.py --manifiesto <prep>/manifiesto_estudio.csv  --ronda 2 --evaluadores <correos> --semilla <S> --salida <prep>/asig_r2
```

Se ejecutan los tres SQL y se arman las USB **por ronda** (la 2 se entrega hasta después del lavado):
```
python -I armar_usb.py --asignaciones <prep>/asig_r0.csv <prep>/asig_r1.csv --imagenes <prep>/subir --salida <usb>
python -I armar_usb.py --asignaciones <prep>/asig_r2.csv --imagenes <prep>/subir --salida <usb_r2>   # tras el lavado
```
Cada carpeta `<usb>/<evaluador>/` va a la USB de ese evaluador. Las rondas se abren una a una
(`update public.estudio_ronda set abierta = … where numero = …`). La ronda 2 se abre tras el lavado; al abrirla
conviene cerrar la 1. **Los manifiestos y los CSV de asignaciones relacionan nombres originales con huellas:
se guardan con las imágenes originales (Mac + USB), nunca en OneDrive ni en el repositorio.**

## Exportar mediciones (SQL Editor → «Download JSON»)

```sql
select m.id, a.codigo as folio, m.imagen_sha256, m.ronda, u.email,
       m.mm_por_px, m.horiz_p1x, m.horiz_p1y, m.horiz_p2x, m.horiz_p2y,
       m.pi, m.ss, m.pt, m.l1s1, m.l4s1, m.gt, m.l1pa, m.t4pa, m.l1tilt, m.t1tilt, m.c2tilt, m.sva_cm, m.tk,
       m.duracion_s, m.editado_en_formulario, m.app_version,
       (select json_agg(json_build_object('clave', l.clave, 'x', l.x, 'y', l.y))
          from public.validacion_landmark l where l.medicion_id = m.id) as landmarks
from public.validacion_medicion m
join public.estudio_asignacion a on a.id = m.asignacion_id
join auth.users u on u.id = m.user_id
where m.ronda = 9
order by u.email, a.orden;
```
