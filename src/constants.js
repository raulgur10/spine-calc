// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════════════════════
export const CIRUJANOS = [
  "Dr. Eduardo Galván Hernández",
  "Dr. Iván Sámano López",
  "Dr. Rafael Avendaño Pradel",
];
export const MEDIDORES = [
  "Avendaño Pradel Rafael",
  "Galván Hernández Eduardo",
  "Guillén Rojas Raúl",
  "Sámano López Iván",
];
export const TIPOS_CIRUGIA = ["Instrumentación lumbar anterior", "Instrumentación lumbar posterior"];
export const SEGMENTOS = ["L1-L2", "L2-L3", "L3-L4", "L4-L5", "L5-S1"];
export const CATEGORIAS_FOTO = ["Radiografía lateral", "Radiografía AP", "Radiografía anotada", "Planificación", "Otra"];
export const STORAGE_KEY = "gap_calculator_casos";

export const REFERENCIAS = [
  { year: 1998, cite: "Legaye J, Duval-Beaupère G, Hecquet J, Marty C. Pelvic incidence: a fundamental pelvic parameter for three-dimensional regulation of spinal sagittal curves. Eur Spine J. 1998;7:99-103." },
  { year: 2005, cite: "Roussouly P, Gollogly S, Berthonnaud E, Dimnet J. Classification of the Normal Variation in the Sagittal Alignment of the Human Lumbar Spine and Pelvis in the Standing Position. Spine. 2005;30:346-353." },
  { year: 2012, cite: "Schwab F, Ungar B, Blondel B, Buchowski J, Coe J, Deinlein D, et al. Scoliosis Research Society-Schwab Adult Spinal Deformity Classification: A Validation Study. Spine. 2012;37(12):1077-1082. doi:10.1097/BRS.0b013e31823e15e2" },
  { year: 2013, cite: "Schwab FJ, Blondel B, Bess S, Hostin R, Shaffrey CI, Smith JS, et al. Radiographical spinopelvic parameters and disability in the setting of adult spinal deformity: a prospective multicenter analysis. Spine. 2013;38(13):E803-E812. doi:10.1097/BRS.0b013e318292b7b9" },
  { year: 2017, cite: "Yilgor C, Sogunmez N, Boissiere L, Yavuz Y, Obeid I, et al. Global Alignment and Proportion (GAP) Score: Development and Validation of a New Method of Analyzing Spinopelvic Alignment to Predict Mechanical Complications After Adult Spinal Deformity Surgery. J Bone Joint Surg Am. 2017;99:1661-1672. doi:10.2106/JBJS.16.01594" },
  { year: 2018, cite: "Laouissat F, Sebaaly A, Gehrchen M, Roussouly P. Classification of normal sagittal spine alignment: refounding the Roussouly classification. Eur Spine J. 2018;27(8):2002-2011. doi:10.1007/s00586-017-5111-x" },
  { year: 2018, cite: "Sebaaly A, Grobost P, Mallam L, Roussouly P. Description of the sagittal alignment of the degenerative human spine. Eur Spine J. 2018;27:489-496. doi:10.1007/s00586-017-5404-0" },
  { year: 2019, cite: "Bari TJ, Ohrt-Nissen S, Hansen LV, Dahl B, Gehrchen M. Ability of the Global Alignment and Proportion Score to Predict Mechanical Failure Following Adult Spinal Deformity Surgery—Validation in 149 Patients With Two-Year Follow-up. Spine Deformity. 2019;7:331-337." },
  { year: 2019, cite: "Le Huec JC, Thompson W, Mohsinaly Y, Barrey C, Faundez A. Sagittal balance of the spine. Eur Spine J. 2019;28:1958-1968. doi:10.1007/s00586-019-06083-1" },
  { year: 2020, cite: "Noh SH, Ha Y, Obeid I, Park JY, Kuh SU, Chin DK, et al. Modified Global Alignment and Proportion Scoring With Body Mass Index and Bone Mineral Density (GAPB) for improving Predictions of Mechanical Complications After Adult Spinal Deformity Surgery. Spine J. 2020;20(5):776-784. doi:10.1016/j.spinee.2019.11.006" },
  { year: 2020, cite: "Sebaaly A, Gehrchen M, Silvestre C, Kharrat K, Bari TJ, Kreichati G, et al. Mechanical complications in adult spinal deformity and the effect of restoring the spinal shapes according to the Roussouly classification: a multicentric study. Eur Spine J. 2020;29:904-913. doi:10.1007/s00586-019-06253-1" },
  { year: 2020, cite: "Bari TJ, Hansen LV, Gehrchen M. Surgical correction of Adult Spinal Deformity in accordance to the Roussouly classification: effect on postoperative mechanical complications. Spine Deform. 2020;8:1027-1037. doi:10.1007/s43390-020-00112-6" },
  { year: 2021, cite: "Kwan KYH, Shaffrey CI, Cheung KMC, et al. Are Higher Global Alignment and Proportion Scores Associated With Increased Risks of Mechanical Complications After Adult Spinal Deformity Surgery? An External Validation. Clin Orthop Relat Res. 2021;479:312-320. doi:10.1097/CORR.0000000000001521" },
  { year: 2022, cite: "Hills J, Lenke LG, Sardar ZM, Le Huec JC, Bourret S, Hasegawa K, et al. The T4-L1-Hip Axis: Defining a Normal Sagittal Spinal Alignment. Spine. 2022;47:1399-1406." },
  { year: 2024, cite: "Cho M, Lee S, Kim HJ. Assessing the predictive power of the GAP score on mechanical complications: a comprehensive systematic review and meta-analysis. Eur Spine J. 2024;33:1311-1319. doi:10.1007/s00586-024-08135-7" },
  { year: 2025, cite: "Ferraz VR, Piedade GS, Goulart CR, Souza MF, Furlan MD, Mercier PA, et al. The predictive value of the global alignment and proportion (GAP) score for mechanical complications following adult spinal deformity surgery: A systematic review and meta-analysis. N Am Spine Soc J. 2025;24:100816. doi:10.1016/j.xnsj.2025.100816" },
  { year: 2025, cite: "Haddad S, Yilgor C, Jacobs E, Vila L, Nuñez-Pereira S, Ramirez Valencia M, et al. Long-term mechanical failure in well aligned adult spinal deformity patients. Spine J. 2025;25:337-346." }
];
// Version del algoritmo, inyectada por Vite desde package.json (vite.config.js).
// Se imprime en el pie de cada reporte PDF y junto al aviso de la interfaz.
export const APP_VERSION = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";

export const CONSENT_VERSION = "1.0";
export const CONSENT_CONTACT = "raulguillen@cardioanestesia.com.mx";
export const PUBLIC_CONSENT_VERSION = "1.0";
export const PUBLIC_CONSENT_LS_KEY = "gap_public_consent";
export const PUBLIC_CASES_LS_KEY = "gap_my_public_cases";
// Feature flag: en modo simplificado solo se muestra C2 tilt directo en la sección de tilts.
// Cambia a true para reactivar CPA, T1 tilt directo, T1PA, L1 tilt directo (Hills 2022 completo).
export const TILTS_FULL_MODE = true;
export const PUBLIC_CONSENT_TEXT = `Acepto que se guarden los datos de este cálculo (parámetros radiográficos, resultados, edad y antropometría) en una base de datos en la nube, con dos fines:

1) Asistencia propia: poder recuperar el caso después usando el ID generado (formato GAP-AAAA-XXXX) desde cualquier dispositivo, y volver a generar el reporte.

2) Estadística agregada anonimizada: análisis de cohorte para validar GAP Score, eje T4-L1-cadera y tilts vertebrales en una población más amplia.

NO se guardarán datos identificables del paciente (nombre, apellidos, expediente, fotografías) ni datos del médico que realiza la medición. El nombre del médico, si lo capturas, se usa solo para imprimirlo en el PDF y no se persiste en la base de datos.`;
export const CONSENT_TEXT = `Al guardar casos en esta aplicación acepto que los datos clínicos y radiográficos capturados (identificadores del paciente, parámetros espinopélvicos, diagnóstico, tipo de cirugía y resultados calculados) se almacenen de forma segura en Firebase y sean utilizados con dos fines:

1) Asistencia clínica propia: consulta y seguimiento de los casos que yo mismo registro como cirujano responsable o medidor. Solo yo puedo ver los casos que yo guardo.

2) Investigación y desarrollo de modelos de IA: análisis agregado de la cohorte para estudios de variabilidad interobservador, validación del GAP Score (Yilgor 2017) y del eje T4-L1-cadera (Hills 2022), y entrenamiento de modelos predictivos de alineación espinopélvica. Los resultados publicados serán siempre anónimos y agregados; no se divulgarán datos identificables del paciente.

Entiendo que soy responsable de obtener el consentimiento correspondiente de cada paciente cuyos datos capture, conforme a la NOM-024-SSA3 y buenas prácticas del Centro Médico ABC. Puedo solicitar en cualquier momento la eliminación de los casos que yo haya registrado escribiendo a ${CONSENT_CONTACT}.`;
