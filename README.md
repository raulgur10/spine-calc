# SpineCalc

Aplicación web de uso libre y gratuito para la medición de parámetros espinopélvicos
directamente sobre radiografías laterales digitales y su análisis mediante múltiples marcos
publicados, en un flujo de trabajo único.

**Aplicación:** https://spinecalc.app/calc
**Plataformas:** web (navegador de escritorio y móvil); versiones para iOS y Android en preparación.
**Repositorio:** https://github.com/raulgur10/spine-calc
**Licencia:** Apache 2.0 · © 2026 Virtual Medical Learning (VML)
**Estado:** versión beta — no validada. Véase [Limitaciones conocidas](#limitaciones-conocidas-de-la-implementación).

---

## ⚠️ Aviso médico

Esta es **una herramienta de cálculo y apoyo educativo**. **No es un dispositivo médico** ni un
sistema de apoyo a la decisión clínica. No cuenta con registro sanitario ante COFEPRIS, marcado
CE ni autorización de la FDA, y **no debe utilizarse como fundamento único de una indicación
quirúrgica**.

La interpretación de los resultados y la responsabilidad de las decisiones clínicas corresponden
exclusivamente al médico tratante. El software se distribuye **sin garantía de ningún tipo**,
conforme a las secciones 7 y 8 de la Licencia Apache 2.0.

---

## Qué hace

- **Anotación radiográfica.** Carga una radiografía lateral (JPG/PNG) y marca hasta 12
  referencias anatómicas; la aplicación deriva los parámetros angulares automáticamente.
- **Captura manual.** Permite introducir mediciones ya existentes sin necesidad de imagen.
- **Cálculo integrado.** Reutiliza las mismas entradas para alimentar simultáneamente varios
  marcos de análisis, evitando la transcripción entre calculadoras separadas.
- **Comparación temporal.** Distingue evaluaciones preoperatorias de postoperatorias.
- **Exportación.** Reporte en PDF e imagen anotada, generados y descargados en el propio
  dispositivo.

Es **solo una herramienta de medición**: gratuita, sin registro y **sin almacenamiento**. Todo el
cálculo se ejecuta en el navegador; ni las imágenes ni las mediciones se transmiten a ningún
servidor, y se pierden al cerrar la página. Véase [Privacidad y datos](#privacidad-y-datos).

### Parámetros calculados

| Dominio | Salidas |
|---|---|
| Pélvicos | PI, SS, PT, con derivación del tercero y control `PI = PT + SS` |
| Regionales | Lordosis L1–S1, L4–S1, índice de distribución (LDI) |
| Globales | Global tilt (GT); SVA (requiere calibración de escala) |
| Vertebropélvicos | L1PA, T4PA; tilts de C2, T1 y L1 (con signo) |
| Compuestos | GAP score y categoría; eje T4–L1–cadera; modificadores SRS–Schwab; morfotipo de Roussouly actual y objetivo; estimación GAP-B |

---

## Métodos implementados y su fuente

Este software **no propone parámetros, umbrales ni clasificaciones nuevas**. Automatiza el
cálculo de métodos publicados por terceros. Todo el mérito científico corresponde a sus autores
originales.

| Módulo | Publicación de origen |
|---|---|
| Incidencia pélvica; identidad `PI = PT + SS` | Legaye J, et al. *Eur Spine J.* 1998;7(2):99-103. doi:10.1007/s005860050038 |
| Clasificación de Roussouly | Roussouly P, et al. *Spine.* 2005;30(3):346-353. doi:10.1097/01.brs.0000152379.54463.65 |
| Subtipo 3 antevertido | Laouissat F, et al. *Eur Spine J.* 2018;27(8):2002-2011. doi:10.1007/s00586-017-5111-x |
| Morfotipo objetivo / restauración | Sebaaly A, et al. *Eur Spine J.* 2020;29(4):904-913 · Bari TJ, et al. *Spine Deform.* 2020;8(5):1027-1037 |
| Modificadores SRS–Schwab | Schwab F, et al. *Spine.* 2012;37(12):1077-1082 · Schwab FJ, et al. *Spine.* 2013;38(13):E803-E812 |
| GAP score | Yilgor C, et al. *J Bone Joint Surg Am.* 2017;99(19):1661-1672. doi:10.2106/JBJS.16.01594 |
| Eje T4–L1–cadera, L1PA, tilts vertebrales | Hills J, et al. *Spine.* 2022;47(19):1399-1406. doi:10.1097/BRS.0000000000004414 |
| Modelo GAP-B | Noh SH, et al. *Spine J.* 2020;20(5):776-784. doi:10.1016/j.spinee.2019.11.006 |

La bibliografía completa está también disponible dentro de la propia aplicación, enlazada desde
cada módulo.

### Ausencia de afiliación

Virtual Medical Learning y los autores de esta implementación **no mantienen relación
institucional, contractual ni de respaldo** con los autores de los métodos implementados, ni con
la Scoliosis Research Society, el European Spine Study Group o las editoriales de las
publicaciones citadas. Este software **no ha sido avalado, revisado ni certificado** por ninguna
de esas entidades.

**No se reproduce aquí ninguna figura, tabla, nomograma ni material gráfico protegido por
derechos de autor** de las publicaciones fuente. Todas las ilustraciones anatómicas y esquemas
geométricos de la interfaz son de elaboración propia.

---

## Limitaciones conocidas de la implementación

Se declaran de forma explícita para permitir su verificación independiente. **Ninguna ha sido
corregida ni validada en la versión actual.**

1. **Centroide de L1.** El L1PA y el tilt de L1 se derivan del punto medio del platillo superior
   de L1, mientras que Hills et al. los definen sobre el **centro del cuerpo vertebral**. Esto
   introduce un sesgo sistemático de dirección constante. Los centroides de T4, T1 y C2 sí se
   marcan sobre el cuerpo vertebral. *(Pendiente de corrección.)*

2. **GAP-B no está calibrado.** Los coeficientes son correctos —el logaritmo natural de las
   razones publicadas por Noh et al.: IMC 1.284, DMO 0.277, GAP 1.457— pero **el artículo
   original no publica el intercepto** del modelo; aquí se fijó empíricamente en −11.0. Además,
   la tabla fuente rotula las estimaciones como *hazard ratios* dentro de un análisis descrito
   como de regresión logística. En consecuencia, **la probabilidad absoluta mostrada no es
   fiable**: úsese solo como ordenamiento relativo. El nomograma original es la referencia formal.

3. **Umbrales operacionalizados.** Laouissat et al. describen el subtipo 3 antevertido mediante
   valores promedio (PI 48 ± 6°, PT 4 ± 3°), no mediante puntos de corte —los propios autores
   señalan que los límites de la versión pélvica no están claros—. Los umbrales `PI < 50 && PT < 5`
   son **una definición propia**. Lo mismo aplica a las categorías del eje T4–L1–cadera: solo el
   umbral de ≤ 4° está publicado; las categorías 4–8° y > 8° son propias.

4. **Lordosis ideal «de Hills».** La fórmula `LL = 1.4·PI − 1.7·L1PA − 2` **no aparece publicada
   en Hills 2022**, que solo publica `L1PA = 0.5·PI − 21` y el R² = 0.74 de la regresión
   multivariable. Su origen debe documentarse o la salida debe retirarse. *(Pendiente de
   resolución.)*

5. **Verificación no independiente.** Existe una batería de pruebas unitarias (`npm test`) sobre la
   geometría, la puntuación y el contrato de los landmarks, pero la escribió el propio equipo de
   desarrollo. La verificación frente a casos calculados de forma independiente, primera fase de
   la ruta de validación propuesta, sigue pendiente.

6. **Roussouly incompleto sin ápice.** La clasificación basada únicamente en la pendiente sacra
   debe considerarse incompleta cuando no se dispone de la posición del ápice lumbar ni del
   número de vértebras lordóticas.

7. **Medición 2D.** No corrige deformidad axial, magnificación desigual ni variaciones de
   proyección. Las distancias (incluido el SVA) requieren calibración de escala; los parámetros
   angulares no.

---

## Privacidad y datos

- **No se guarda nada.** No hay cuentas de usuario, registro de casos, consentimientos, historial
  ni base de datos de mediciones. La aplicación no pide nombre, iniciales ni expediente del
  paciente.
- **Todo ocurre en el navegador.** La radiografía, los puntos marcados, las mediciones y el
  reporte PDF se procesan y generan en el dispositivo; nada de ello se transmite a ningún
  servidor, y se pierde al cerrar o recargar la página.
- **Sin telemetría.** No hay contador de uso, identificador de dispositivo ni analítica.
- **Única transmisión: la encuesta de opinión, opcional y anónima.** Envía solo la calificación
  (1–5) y un comentario libre, sin identificadores. La tabla solo admite inserciones y no puede
  leerse desde el navegador (véase `supabase/schema.sql`).
- El navegador recuerda localmente el idioma elegido y si ya se respondió la encuesta.

---

## Desarrollo

**Requisitos:** Node.js 20 o superior.

```bash
npm install
npm run dev      # servidor de desarrollo
npm run build    # compilación de producción
npm run preview  # previsualización de la compilación
npm run lint     # ESLint
npm test         # pruebas unitarias (Vitest)
```

La aplicación no tiene backend. Las variables `VITE_SUPABASE_URL` y
`VITE_SUPABASE_PUBLISHABLE_KEY` (`.env.local`, plantilla en `.env.example`) son opcionales y solo
habilitan la encuesta anónima; sin ellas la calculadora funciona completa.

### Estructura

```
src/
  geometry.js            Geometría 2D pura, sin estado ni efectos colaterales.
                         Aislada deliberadamente para permitir pruebas unitarias.
  landmarkAnnotator.jsx  Anotador radiográfico: marcado de puntos, calibración,
                         horizontal de referencia, mediciones libres.
  App.jsx                Formulario, cálculo clínico, clasificaciones y reportes.
  scoring.js · pdf.js    Reglas de puntuación y generación del PDF en el cliente.
  data/landmarks.js      Contrato de los 12 landmarks del anotador.
  feedback.js            Encuesta anónima: la única llamada de red.
  i18n.jsx               Idioma de la app (es/en/fr), con locales/ como diccionarios.
site/                    Sitio público (Astro). Se compila con la app montada en /calc.
  src/i18n/              Diccionarios del sitio y resolución de rutas por idioma.
  src/components/pages/  Cada página, una sola vez, servida en los tres idiomas.
supabase/schema.sql      Tabla de la encuesta anónima (solo inserción).
public/landmarks/        Ilustraciones anatómicas de elaboración propia.
```

`scripts/build-site.sh` compila ambas cosas y deja el sitio estático completo en
`site/dist/`, con la calculadora en `site/dist/calc/`. Es lo que ejecuta el CI.

### Idiomas

Tanto el sitio como la aplicación están en **español, inglés y francés**.

El sitio sirve el español en la raíz (`/conceptos`) y los otros idiomas bajo su prefijo
(`/en/concepts`, `/fr/avertissement`), con los slugs traducidos y `hreflang` entre las tres
versiones. Las URLs en español no llevan prefijo a propósito: ya están impresas en el código QR
y citadas en el borrador del artículo.

La aplicación tiene su propio selector y guarda la preferencia en `localStorage`
(`spinecalc_lang`). El sitio escribe esa misma clave y añade `?lang=` al enlace de la
calculadora, de modo que quien venía leyendo en francés abre la app en francés.

Para añadir un idioma: crear `site/src/i18n/<código>.js`, registrarlo en `LANGS` y en `ROUTES`
dentro de `site/src/i18n/utils.js`, y añadir el diccionario equivalente en `src/locales/` para la
aplicación. Una clave sin traducir cae al español en vez de mostrarse cruda.

**Las referencias bibliográficas no se traducen**: son la cita literal del artículo original.

### Convenciones geométricas

Coordenadas cartesianas en el espacio de la imagen, con el eje **Y hacia abajo**. Ángulos en
grados, calculados por producto escalar con acotamiento del argumento del arcocoseno a `[-1, 1]`.
Tres tipos de operación angular:

- **Entre dos rectas** (0–90°, no orientado, independiente del orden de marcado) → Cobb L1–S1,
  L4–S1, PI.
- **En un vértice** (0–180°) → global tilt, ángulos vertebropélvicos.
- **Respecto de la horizontal de referencia** → SS y, por complemento, PT.

El signo de los ángulos vertebropélvicos y de los tilts se determina por producto vectorial 2D
respecto del eje bicoxofemoral–S1, con la dirección anterior definida por el vector
`S1 posterior → S1 anterior`. Esto preserva la convención de signos de Hills con independencia del
lado de adquisición.

La horizontal de referencia es por defecto el eje X de la imagen y puede redefinirse cuando la
placa está rotada; **afecta a SS, PT y tilts, pero no a los parámetros derivados de ángulos entre
rectas**, que son invariantes a la rotación.

---

## Cómo citar

Si utilizas esta herramienta en un trabajo académico, cita el artículo que la describe (en
preparación) y la versión concreta empleada. Véase `CITATION.cff`.

---

## Licencia y titularidad

Copyright © 2026 **Virtual Medical Learning (VML)**, titular de los derechos patrimoniales sobre
el código fuente, liberado con el acuerdo de sus socios.

Distribuido bajo la **Licencia Apache 2.0**. Puedes usar, modificar y redistribuir este software,
incluso con fines comerciales, siempre que conserves el aviso de derechos de autor y la
atribución. La licencia incluye una exención expresa de garantías, una limitación de
responsabilidad y una concesión de patente por parte del titular.

Consulta [`LICENSE`](LICENSE) para el texto completo y [`NOTICE`](NOTICE) para los avisos de
atribución que deben conservarse en cualquier obra derivada.

El desarrollo técnico fue aportado por VML **sin costo** para los autores clínicos ni para la
institución, sin contraprestación económica y sin participación de la industria de dispositivos
médicos o implantes.
