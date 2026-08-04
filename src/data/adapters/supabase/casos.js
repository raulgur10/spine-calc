// Casos clínicos y públicos sobre Postgres + Supabase Storage.
import { supabase } from "./client";
import { fromSupabaseError } from "./errors";
import { DataError, DataErrorCode } from "../../errors";
import { casoToRow, childRows, casoFromRow, casoPublicoFromRpc } from "./wire";
import { dataURLtoBlob } from "../../../utils";

const BUCKET = "casos";

/** Sube las imágenes a casos/<caso_id>/<foto_id>.jpg y devuelve sus rutas. */
async function subirFotos(casoId, photos) {
  const out = [];
  for (const p of photos || []) {
    if (!p.dataUrl) { out.push({ ...p, storagePath: p.storagePath ?? null }); continue; }
    const path = `${casoId}/${p.id}.jpg`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, dataURLtoBlob(p.dataUrl), { contentType: "image/jpeg", upsert: true });
    if (error) throw fromSupabaseError(error);
    out.push({ id: p.id, name: p.name, category: p.category, storagePath: path });
  }
  return out;
}

export async function listCasos(ownerUid) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("casos")
    .select("*, caso_landmarks(*), caso_cirugias(*), caso_fotos(*)")
    .eq("owner_uid", ownerUid)
    .eq("visibility", "private")
    .order("created_at", { ascending: false });
  if (error) throw fromSupabaseError(error);
  return (data || []).map((fila) => casoFromRow(fila, {
    landmarks: fila.caso_landmarks,
    cirugias: [...(fila.caso_cirugias || [])].sort((a, b) => a.ord - b.ord),
    fotos: fila.caso_fotos,
  }));
}

/**
 * Guarda un caso clínico con sus hijas. Igual que en Firebase, la interfaz no
 * ve la secuencia: primero la fila (que es quien genera el id), luego las
 * imágenes bajo ese id, luego los hijos.
 */
export async function saveCaso(caso) {
  if (!supabase) throw new DataError(DataErrorCode.UNAVAILABLE);

  const fila = casoToRow(caso);
  delete fila.id;   // lo genera la tabla
  const { data, error } = await supabase.from("casos").insert(fila).select("id").single();
  if (error) throw fromSupabaseError(error);
  const casoId = data.id;

  const photos = await subirFotos(casoId, caso.photos);
  const hijos = childRows({ ...caso, photos }, casoId);

  for (const [tabla, filas] of [
    ["caso_landmarks", hijos.landmarks],
    ["caso_cirugias", hijos.cirugias],
    ["caso_fotos", hijos.fotos],
  ]) {
    if (filas.length === 0) continue;
    const { error: e } = await supabase.from(tabla).insert(filas);
    if (e) throw fromSupabaseError(e);
  }

  return { id: casoId, photos };
}

export async function deleteCaso(id) {
  if (!supabase) throw new DataError(DataErrorCode.UNAVAILABLE);
  // Las tablas hijas caen por ON DELETE CASCADE; las imágenes hay que quitarlas
  // a mano porque Storage no participa de la integridad referencial.
  const { data: fotos } = await supabase.from("caso_fotos").select("storage_path").eq("caso_id", id);
  const rutas = (fotos || []).map((f) => f.storage_path).filter(Boolean);
  if (rutas.length > 0) await supabase.storage.from(BUCKET).remove(rutas);

  const { error } = await supabase.from("casos").delete().eq("id", id);
  if (error) throw fromSupabaseError(error);
}

/**
 * Guardar un caso público pasa por una función de la base, no por un insert
 * directo: así el caso y sus hijas entran en una sola transacción y el usuario
 * anónimo no necesita permiso de escritura sobre las tablas.
 */
export async function savePublicCaso(caso) {
  if (!supabase) throw new DataError(DataErrorCode.UNAVAILABLE);
  if (!caso.publicId) throw new DataError(DataErrorCode.UNKNOWN, "El caso público no trae ID.");

  const fila = casoToRow(caso);
  delete fila.id;
  const { landmarks } = childRows(caso, null);
  const { data, error } = await supabase.rpc("guardar_caso_publico", {
    p_caso: fila,
    p_landmarks: (caso.landmarks?.points || []),
    p_cirugias: (caso.surgeries || []).map((s) => ({
      tipo: s.type, tipoCustom: s.typeCustom, segmentos: s.segments,
    })),
  });
  if (error) throw fromSupabaseError(error);
  void landmarks;
  return { publicId: data };
}

/**
 * Recuperar por ID también pasa por función. No hay política de lectura sobre
 * los casos públicos a propósito: con una, cualquiera podría enumerarlos, y el
 * espacio de IDs son cuatro caracteres sobre treinta y un símbolos.
 */
export async function getPublicCaso(publicId) {
  if (!supabase) throw new DataError(DataErrorCode.UNAVAILABLE);
  const { data, error } = await supabase.rpc("obtener_caso_publico", { p_public_id: publicId });
  if (error) throw fromSupabaseError(error);
  return casoPublicoFromRpc(data);
}
