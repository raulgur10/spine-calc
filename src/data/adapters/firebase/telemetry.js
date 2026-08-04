// Contadores de uso, dispositivos, suscripciones y encuesta.
//
// Nota para la migración: de las cuatro colecciones que toca este archivo,
// `devices` es candidata a retirarse —su `calcCount` y `sessions` no se leen en
// ninguna parte de la aplicación— y `subscribers` debería vivir en el proveedor
// de correo, no en la base de la aplicación. Ninguna de las cuatro aparece hoy
// en firestore.rules pese a recibir escrituras anónimas; hay que resolverlo
// antes de escribir el RLS de Supabase.
import { doc, getDoc, setDoc, updateDoc, addDoc, collection, increment, serverTimestamp } from "firebase/firestore";
import { db } from "../../../firebase";
import { fromFirebaseError } from "../../errors";

export async function getUsageCount() {
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, "stats", "usage"));
    return snap.exists() ? (snap.data().count ?? 0) : null;
  } catch { return null; }
}

export async function incrementUsage() {
  if (!db) return;
  try {
    await setDoc(doc(db, "stats", "usage"),
      { count: increment(1), lastUpdated: serverTimestamp() }, { merge: true });
  } catch (err) { fromFirebaseError(err); }
}

export async function registerDeviceSession(deviceId) {
  if (!db || !deviceId) return;
  try {
    const devRef = doc(db, "devices", deviceId);
    const snap = await getDoc(devRef);
    if (snap.exists()) {
      await updateDoc(devRef, { lastSeen: serverTimestamp(), sessions: increment(1) });
    } else {
      await setDoc(devRef, {
        firstSeen: serverTimestamp(), lastSeen: serverTimestamp(),
        sessions: 1, calcCount: 0,
      });
    }
  } catch (err) { fromFirebaseError(err); }
}

export async function incrementDeviceCalc(deviceId) {
  if (!db || !deviceId) return;
  try {
    await updateDoc(doc(db, "devices", deviceId),
      { calcCount: increment(1), lastCalcAt: serverTimestamp() });
  } catch (err) { fromFirebaseError(err); }
}

export async function subscribeToUpdates({ email, name, deviceId }) {
  if (!db) return;
  try {
    await setDoc(doc(db, "subscribers", email), {
      email, name, addedAt: serverTimestamp(), source: "public", deviceId,
    }, { merge: true });
  } catch (err) { throw fromFirebaseError(err); }
}

export async function sendFeedback({ rating, comment, deviceId }) {
  if (!db) return;
  try {
    await addDoc(collection(db, "feedback"), {
      rating, comment, deviceId, createdAt: serverTimestamp(),
    });
  } catch (err) { throw fromFirebaseError(err); }
}
