// ═══════════════════════════════════════════════════════════════════════════
// Estudio de validación: guardado de mediciones manuales
// ═══════════════════════════════════════════════════════════════════════════
// Solo para validadores dados de alta en public.validadores (supabase/validacion.sql).
// Se guarda lo que emitió el anotador —puntos y ángulos—, no la imagen: la
// placa se identifica por su huella SHA-256.
import { getClient } from "./auth";
import { APP_VERSION } from "./constants";

export async function esValidador(userId) {
  const sb = await getClient();
  if (!sb || !userId) return false;
  const { data, error } = await sb.from("validadores").select("activo").eq("user_id", userId).maybeSingle();
  if (error) return false;
  return Boolean(data?.activo);
}

// geometry: lo que entregó el anotador al aplicar (makeGeometry + applied).
export async function guardarMedicion({ geometry, folio, editadoEnFormulario }) {
  const sb = await getClient();
  const a = geometry.applied || {};
  const h = geometry.horizontal || {};
  const payload = {
    folio: folio || null,
    imagen_sha256: geometry.imageSha256,
    imagen_ancho: geometry.imageWidth,
    imagen_alto: geometry.imageHeight,
    mm_por_px: geometry.mmPerPx,
    calib_ref_mm: geometry.calibRefMm,
    horiz_p1x: h.p1x ?? null, horiz_p1y: h.p1y ?? null, horiz_p2x: h.p2x ?? null, horiz_p2y: h.p2y ?? null,
    pi: a.pi ?? null, ss: a.ss ?? null, pt: a.pt ?? null, l1s1: a.l1s1 ?? null, l4s1: a.l4s1 ?? null,
    gt: a.gt ?? null, l1pa: a.l1pa ?? null, t4pa: a.t4pa ?? null, c2tilt: a.c2tilt ?? null,
    t1tilt: a.t1tilt ?? null, l1tilt: a.l1tilt ?? null, sva_cm: a.sva ?? null,
    duracion_s: geometry.duracionS,
    editado_en_formulario: Boolean(editadoEnFormulario),
    ia_asistida: Boolean(geometry.iaAsistida),
    anotador_version: geometry.annotatorVersion,
    app_version: APP_VERSION,
    landmarks: geometry.points.map(({ key, x, y }) => ({ key, x, y })),
  };
  const { data, error } = await sb.rpc("guardar_medicion_validacion", { p: payload });
  if (error) throw new Error(error.message);
  return data;
}
