// Casos clínicos y casos públicos sobre Firestore + Storage.
import {
  collection, addDoc, getDocs, deleteDoc, doc, updateDoc,
  query, orderBy, where, getDoc, setDoc, serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../../../firebase";
import { DataError, DataErrorCode, fromFirebaseError } from "../../errors";
import { casoFromDoc } from "./wire";
import { dataURLtoBlob } from "../../../utils";

/**
 * Documento de Firestore a partir del DTO.
 *
 * Escribe la forma nueva (plana, `schemaVersion: 2`) porque los casos que hay
 * en Firestore son ensayos y se descartan: no hay nada que releer con la forma
 * antigua. Quedan en la raíz tres campos heredados, y no por nostalgia:
 *
 *   ownerUid, ownerEmail  los valida `firestore.rules` al crear el documento
 *   fecha                 lo usa el índice compuesto (ownerUid, fecha desc)
 *
 * Cambiarles el nombre no daría un error de validación legible, sino un
 * permission-denied en la escritura y un listado vacío en la lectura.
 */
function casoToDoc(caso) {
  const { photos, id, ...rest } = caso;   // eslint-disable-line no-unused-vars
  return {
    ...rest,
    schemaVersion: 2,
    fecha: caso.createdAt || new Date().toISOString(),
    ownerUid: caso.ownerUid ?? null,
    ownerEmail: caso.ownerEmail ?? null,
    fotos: [],
  };
}

async function uploadCasoPhotos(casoId, photos) {
  const out = [];
  for (const p of photos) {
    if (!p.dataUrl) { out.push({ id: p.id, name: p.name, categoria: p.category, url: p.url ?? null }); continue; }
    const imageRef = ref(storage, `casos/${casoId}/${p.id}.jpg`);
    await uploadBytes(imageRef, dataURLtoBlob(p.dataUrl));
    out.push({ id: p.id, name: p.name, categoria: p.category, url: await getDownloadURL(imageRef) });
  }
  return out;
}

export async function listCasos(ownerUid) {
  if (!db) return [];
  try {
    const q = query(collection(db, "casos"), where("ownerUid", "==", ownerUid), orderBy("fecha", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => casoFromDoc(d.data(), { id: d.id }));
  } catch (err) { throw fromFirebaseError(err); }
}

/**
 * Guarda un caso clínico. Encapsula la secuencia de tres pasos —crear el
 * documento, subir cada imagen a Storage bajo su id, actualizar con las URLs—
 * para que la interfaz no dependa de ese orden: en Supabase es distinto.
 */
export async function saveCaso(caso) {
  if (!db || !storage) throw new DataError(DataErrorCode.UNAVAILABLE);
  try {
    const docRef = await addDoc(collection(db, "casos"), casoToDoc(caso));
    const fotos = await uploadCasoPhotos(docRef.id, caso.photos || []);
    if (fotos.length > 0) await updateDoc(doc(db, "casos", docRef.id), { fotos });
    return { id: docRef.id, photos: fotos };
  } catch (err) { throw fromFirebaseError(err); }
}

export async function deleteCaso(id) {
  if (!db) throw new DataError(DataErrorCode.UNAVAILABLE);
  try { await deleteDoc(doc(db, "casos", id)); }
  catch (err) { throw fromFirebaseError(err); }
}

export async function savePublicCaso(caso) {
  if (!db) throw new DataError(DataErrorCode.UNAVAILABLE);
  const publicId = caso.publicId;
  if (!publicId) throw new DataError(DataErrorCode.UNKNOWN, "El caso público no trae ID.");
  try {
    const { photos, id, ...rest } = caso;   // eslint-disable-line no-unused-vars
    await setDoc(doc(db, "public_cases", publicId), {
      ...rest,
      schemaVersion: 2,
      createdAt: serverTimestamp(),
      consentAcceptedAt: serverTimestamp(),
    });
    return { publicId };
  } catch (err) { throw fromFirebaseError(err); }
}

export async function getPublicCaso(publicId) {
  if (!db) throw new DataError(DataErrorCode.UNAVAILABLE);
  try {
    const snap = await getDoc(doc(db, "public_cases", publicId));
    if (!snap.exists()) return null;
    return casoFromDoc(snap.data(), { id: publicId, visibility: "public" });
  } catch (err) { throw fromFirebaseError(err); }
}
