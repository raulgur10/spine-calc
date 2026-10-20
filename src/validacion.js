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

// ─── Estudio con asignaciones (supabase/estudio.sql) ────────────────────────
// El validador no elige la placa: la app le entrega su siguiente caso pendiente,
// en el orden aleatorio que generó el investigador que no mide.

// Progreso por ronda abierta y el siguiente caso pendiente (o null).
export async function cargarEstudio() {
  const sb = await getClient();
  if (!sb) return null;
  const [prog, sig] = await Promise.all([
    sb.rpc("progreso_estudio"),
    sb.from("estudio_asignacion")
      .select("id, ronda, orden, codigo, imagen_sha256, estudio_imagen(archivo)")
      .order("ronda", { ascending: true })
      .order("orden", { ascending: true })
      .limit(1),
  ]);
  if (prog.error) throw new Error(prog.error.message);
  if (sig.error) throw new Error(sig.error.message);
  return resumirEstudio(prog.data || [], sig.data?.[0] || null);
}

// Pura, para poder probarla: arma lo que muestra el panel.
export function resumirEstudio(progreso, siguiente) {
  const caso = siguiente ? {
    asignacionId: siguiente.id,
    ronda: siguiente.ronda,
    orden: siguiente.orden,
    codigo: siguiente.codigo,
    sha256: siguiente.imagen_sha256,
    archivo: siguiente.estudio_imagen?.archivo || null,
  } : null;
  const ronda = caso ? progreso.find(r => r.ronda === caso.ronda) || null : null;
  return {
    rondas: progreso,
    caso,
    ronda: ronda ? { numero: ronda.ronda, nombre: ronda.nombre, total: ronda.total, completadas: ronda.completadas } : null,
    terminado: progreso.length > 0 && !caso,
  };
}

// Descarga la placa del caso como File. El anotador calcula su huella al
// cargarla; el servidor rechaza el guardado si no coincide con la asignada.
export async function descargarImagenCaso(caso) {
  const sb = await getClient();
  const { data, error } = await sb.storage.from("validacion").download(caso.archivo);
  if (error) throw new Error(error.message);
  const ext = (caso.archivo.split(".").pop() || "png").toLowerCase();
  const tipo = data.type || (ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png");
  return new File([data], `${caso.codigo}.${ext}`, { type: tipo });
}

export async function guardarMedicionAsignada({ asignacionId, geometry, editadoEnFormulario }) {
  const sb = await getClient();
  const a = geometry.applied || {};
  const h = geometry.horizontal || {};
  const payload = {
    asignacion_id: asignacionId,
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
  const { data, error } = await sb.rpc("guardar_medicion_asignada", { p: payload });
  if (error) throw new Error(error.message);
  return data;
}

export async function marcarNoMedible({ asignacionId, motivo }) {
  const sb = await getClient();
  const { error } = await sb.rpc("guardar_medicion_asignada", {
    p: { asignacion_id: asignacionId, no_medible: true, motivo },
  });
  if (error) throw new Error(error.message);
}
