// Español — idioma de origen. Es el diccionario de referencia: cualquier clave
// que falte en en.js o fr.js cae aquí (véase utils.js).
export default {
  // ── Metadatos ──────────────────────────────────────────────────────────
  'site.description': 'SpineCalc — medición de alineación sagital espinopélvica. GAP score, Roussouly, SRS-Schwab y más.',
  'site.skip': 'Saltar al contenido',

  // ── Navegación ─────────────────────────────────────────────────────────
  'nav.home': 'Inicio',
  'nav.concepts': 'Conceptos',
  'nav.references': 'Referencias',
  'nav.team': 'Equipo',
  'nav.disclaimer': 'Descargo',
  'nav.brandAria': 'SpineCalc — inicio',
  'nav.aria': 'Principal',
  'nav.openCalc': 'Abrir la calculadora',
  'nav.langAria': 'Idioma',

  // ── Pie ────────────────────────────────────────────────────────────────
  'foot.note': '<strong>SpineCalc</strong> es una herramienta de cálculo y apoyo educativo. <strong>No es un dispositivo médico</strong> ni un sistema de apoyo a la decisión clínica. No cuenta con registro sanitario ante COFEPRIS, marcado CE ni autorización de la FDA. La interpretación de los resultados y la responsabilidad de las decisiones clínicas corresponden exclusivamente al médico tratante.',
  'foot.readDisclaimer': 'Leer el descargo completo',
  'foot.source': 'Código fuente',
  'foot.legal': '© 2026 Virtual Medical Learning (VML) · Distribuido bajo la licencia Apache 2.0.',
  'foot.eggAria': 'Columna vertebral',

  // ── Portada ────────────────────────────────────────────────────────────
  'home.hero.h1': 'Mide la alineación sagital de la columna con rigor, sin fricción.',
  'home.hero.lede': 'SpineCalc automatiza el cálculo del GAP score, el eje T4–L1–cadera, la clasificación de Roussouly, los modificadores SRS–Schwab y más, directamente sobre radiografías laterales digitales. Gratis, en el navegador.',
  'home.hero.cta1': 'Probar la calculadora',
  'home.hero.cta2': 'Acceso cirujanos',
  'home.hero.note': 'Herramienta de cálculo y apoyo educativo. No es un dispositivo médico.',
  'home.hero.alt': 'Radiografía lateral con los parámetros espinopélvicos medidos en SpineCalc',
  'home.hero.caption': 'Medición de parámetros espinopélvicos en SpineCalc.',

  'home.why.h2': 'Por qué medir la alineación importa',
  'home.why.p1': 'El desajuste entre la forma de la pelvis y la alineación de la columna es un predictor conocido de <strong>complicaciones mecánicas</strong> tras la cirugía de deformidad espinal del adulto: aflojamiento de tornillos, cifosis proximal de la unión y falta de fusión, entre otras.',
  'home.why.p2': 'El <strong>GAP score</strong> (Yilgor et al., 2017) se desarrolló precisamente para capturar esa proporción global y predecir el riesgo. Ha sido validado de forma externa (Kwan et al., 2021) y reanalizado en meta-análisis recientes (Cho et al., 2024; Ferraz et al., 2025).',
  'home.why.p3': 'Medir bien —y rápido— permite planear la cirugía con un objetivo de alineación basado en evidencia, y comparar el preoperatorio con el postoperatorio con el mismo criterio.',

  'home.what.h2': 'Qué calcula SpineCalc',
  'home.what.lede': 'Una sola carga de la radiografía y un solo marcado de puntos alimentan varios marcos publicados a la vez. Sin transcribir entre calculadoras.',
  'home.what.c1.h': 'GAP score',
  'home.what.c1.p': 'Proporción y alineación global (Yilgor 2017), con sus cinco subcomponentes.',
  'home.what.c2.h': 'Eje T4–L1–cadera',
  'home.what.c2.p': 'Alineación sagital ideal normal (Hills 2022), con tilts vertebrales.',
  'home.what.c3.h': 'Roussouly',
  'home.what.c3.p': 'Morfotipo actual y objetivo, y su concordancia con la incidencia pélvica.',
  'home.what.c4.h': 'SRS–Schwab',
  'home.what.c4.p': 'Modificadores sagitales estándar: PI−LL, PT y SVA.',
  'home.what.c5.h': 'GAP-B',
  'home.what.c5.p': 'Variante del GAP con IMC y densidad mineral ósea (Noh 2020).',
  'home.what.c6.h': 'Parámetros básicos',
  'home.what.c6.p': 'PI, SS, PT, lordosis L1–S1 y L4–S1, global tilt y SVA.',
  'home.what.link': 'Ver todos los conceptos →',

  'home.evidence.h2': 'Basado en evidencia publicada',
  'home.evidence.lede': 'SpineCalc no propone parámetros ni umbrales nuevos: automatiza la aritmética de métodos publicados por terceros, cuyo mérito científico corresponde a sus autores. La bibliografía va de Legaye 1998 a Haddad 2025.',
  'home.evidence.cta': 'Ver las referencias',

  'home.team.h2': 'Quiénes la desarrollamos',
  'home.team.lede': 'Cirujanos de columna del Centro Médico ABC, en la Ciudad de México, junto con Virtual Medical Learning (VML).',
  'home.team.cta': 'Conocer al equipo',

  'home.final.h2': 'Empieza a medir',
  'home.final.lede': 'Carga una radiografía lateral y obtén el análisis completo en minutos.',

  // ── Conceptos ──────────────────────────────────────────────────────────
  'concepts.title': 'Conceptos',
  'concepts.h1': 'Conceptos clave',
  'concepts.lede': 'Los parámetros que mide SpineCalc, explicados brevemente. Para la fuente y el contexto original de cada uno, consulta {link}.',
  'concepts.ledeLink': 'las referencias',

  'concepts.pi.n': 'Incidencia pélvica (PI)',
  'concepts.pi.d': 'Parámetro pélvico fundamental y constante morfológica: el ángulo entre la perpendicular al platillo de S1 y la línea que une su centro con el eje bicoxofemoral. Determina la lordosis lumbar objetivo.',
  'concepts.ss.n': 'Pendiente sacra (SS)',
  'concepts.ss.d': 'Inclinación del platillo superior de S1 respecto de la horizontal. Junto con la versión pélvica, describe la orientación de la pelvis.',
  'concepts.pt.n': 'Versión pélvica (PT)',
  'concepts.pt.d': 'Rotación de la pelvis alrededor del eje bicoxofemoral; se compensa cuando la columna pierde lordosis. Se cumple la identidad PI = PT + SS.',
  'concepts.ll.n': 'Lordosis lumbar (LL)',
  'concepts.ll.d': 'Curvatura lumbar, medida entre L1 y S1. Su valor objetivo depende del morfotipo de Roussouly y de la incidencia pélvica.',
  'concepts.sva.n': 'Eje sagital vertical (SVA)',
  'concepts.sva.d': 'Distancia horizontal entre la plomada de C7 y el borde posterosuperior de S1. Balance global; requiere calibración de escala.',
  'concepts.gt.n': 'Global tilt (GT)',
  'concepts.gt.d': 'Ángulo entre la línea del centro de T1 al centro de S1 y la línea del centro de S1 al eje bicoxofemoral. Medida de balance global.',
  'concepts.gap.n': 'GAP score',
  'concepts.gap.d': 'Global Alignment and Proportion (Yilgor 2017): combina alineación relativa y proporción espinopélvica en una escala que predice complicaciones mecánicas.',
  'concepts.t4l1.n': 'Eje T4–L1–cadera',
  'concepts.t4l1.d': 'Hills 2022: define la alineación sagital normal a partir del ángulo L1PA y la lordosis lumbar ideal. Incluye tilts vertebrales de C2, T1 y L1.',
  'concepts.rous.n': 'Roussouly',
  'concepts.rous.d': 'Clasificación de los morfotipos de alineación sagital normal según la incidencia pélvica y la forma lumbar. Sirve de plantilla objetivo.',
  'concepts.srs.n': 'SRS–Schwab',
  'concepts.srs.d': 'Modificadores sagitales estándar de la Scoliosis Research Society: PI−LL, PT y SVA, con grados de severidad.',
  'concepts.gapb.n': 'GAP-B',
  'concepts.gapb.d': 'Variante del GAP (Noh 2020) que incorpora IMC y densidad mineral ósea para mejorar la predicción de complicaciones.',
  'concepts.pa.n': 'L1PA y T4PA',
  'concepts.pa.d': 'Ángulos vertebropélvicos que relacionan la columna con la pelvis; L1PA es la base del eje T4–L1–cadera.',

  // ── Referencias ────────────────────────────────────────────────────────
  'refs.title': 'Referencias',
  'refs.h1': 'Referencias',
  'refs.lede': 'SpineCalc no propone parámetros, umbrales ni sistemas de clasificación nuevos: automatiza el cálculo de métodos publicados por terceros, cuyo mérito conceptual y científico corresponde íntegramente a sus autores. Esta bibliografía se verificó contra los artículos fuente.',

  // ── Equipo ─────────────────────────────────────────────────────────────
  'team.title': 'Equipo',
  'team.h1': 'Quiénes la desarrollamos',
  'team.lede': 'SpineCalc es un proyecto conjunto de cirujanos de columna del Centro Médico ABC, en la Ciudad de México, con el desarrollo técnico de Virtual Medical Learning.',
  'team.role.corresponding': 'Cirujano de columna · autor de correspondencia',
  'team.role.coordinator': 'Coordinador clínico y de desarrollo',
  'team.role.surgeon': 'Cirujano de columna',
  'team.org.abc': 'Centro Médico ABC, Ciudad de México',
  'team.org.abcSantaFe': 'Centro Médico ABC, Campus Santa Fe',
  'team.vml.h2': 'Virtual Medical Learning (VML)',
  'team.vml.p': 'VML aporta el desarrollo técnico de la aplicación, sin costo para los autores clínicos ni para la institución, y sin participación de la industria de dispositivos médicos o implantes.',
  'team.vml.link': 'Visitar vml.solutions →',
  'team.attr.h2': 'Atribución científica',
  'team.attr.p': 'Los métodos que calcula SpineCalc son obra de sus autores originales y se citan en la interfaz, en la documentación y en el aviso de atribución distribuido con el código. SpineCalc no mantiene relación institucional, contractual ni de respaldo con dichos autores ni con las sociedades o editoriales correspondientes.',

  // ── Descargo ───────────────────────────────────────────────────────────
  'disc.title': 'Descargo de responsabilidad',
  'disc.h1': 'Descargo de responsabilidad',
  'disc.medical.h2': 'Aviso médico',
  'disc.medical.p1': 'SpineCalc es una herramienta de cálculo y apoyo educativo. <strong>No constituye un dispositivo médico</strong> ni un sistema de apoyo a la decisión clínica. No cuenta con registro sanitario ante COFEPRIS, marcado CE ni autorización de la FDA.',
  'disc.medical.p2': 'No debe utilizarse como fundamento único de una indicación quirúrgica. La interpretación de los resultados y la responsabilidad de las decisiones clínicas corresponden <strong>exclusivamente al médico tratante</strong>.',
  'disc.affil.h2': 'Ausencia de afiliación',
  'disc.affil.p1': 'Este software no propone parámetros, umbrales ni sistemas de clasificación nuevos. Automatiza el cálculo de métodos publicados por terceros, cuyo mérito conceptual y científico corresponde íntegramente a sus autores originales. Virtual Medical Learning y los autores de esta implementación <strong>no mantienen relación institucional, contractual ni de respaldo</strong> con dichos autores, ni con la Scoliosis Research Society, el European Spine Study Group o las editoriales de las publicaciones citadas.',
  'disc.affil.p2': 'No se reproduce en este software ninguna figura, tabla, nomograma ni material gráfico protegido por derechos de autor de las publicaciones fuente. Todas las ilustraciones anatómicas y esquemas geométricos de la interfaz son de elaboración propia.',
  'disc.privacy.h2': 'Privacidad y datos',
  'disc.privacy.p': 'El cálculo se ejecuta en el navegador; las imágenes radiográficas no se transmiten a ningún servidor salvo que el usuario active explícitamente el módulo opcional de registro de casos, que requiere consentimiento electrónico y restringe el acceso de cada caso a su propietario. Una implementación clínica institucional debe documentar cifrado, control de acceso, retención, eliminación y cumplimiento de la NOM-024-SSA3.',
  'disc.license.h2': 'Licencia',
  'disc.license.p': 'Se distribuye bajo la {link}, <strong>sin garantía de ningún tipo</strong>, conforme a sus secciones 7 y 8.',
  'disc.license.link': 'licencia Apache 2.0',

  // ── 404 ────────────────────────────────────────────────────────────────
  'nf.title': 'Página no encontrada',
  'nf.h1': 'Página no encontrada',
  'nf.lede': 'La ruta que buscas no existe. La calculadora vive en {link}.',
  'nf.back': 'Volver al inicio',
};
