// Sesión y perfil sobre Firebase Auth + Firestore.
import { onAuthStateChanged, signInWithPopup, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, auth, googleProvider } from "../../../firebase";
import { DataError, DataErrorCode, fromFirebaseError } from "../../errors";

// Forma neutra de la sesión. Firebase la expone como `user.uid`; Supabase como
// `user.id` con el nombre en `user_metadata`. La interfaz solo ve esto.
function toSession(u) {
  if (!u) return null;
  return { uid: u.uid, email: u.email, displayName: u.displayName || null, provider: "firebase" };
}

/** Escucha los cambios de sesión. Devuelve la función para dejar de escuchar. */
export function onSessionChange(cb) {
  if (!auth) { cb(null); return () => {}; }
  return onAuthStateChanged(auth, (u) => cb(toSession(u)));
}

export async function signInWithGoogle() {
  if (!auth) throw new DataError(DataErrorCode.UNAVAILABLE);
  try {
    const res = await signInWithPopup(auth, googleProvider);
    return toSession(res.user);
  } catch (err) { throw fromFirebaseError(err); }
}

export async function signInWithPassword(email, password) {
  if (!auth) throw new DataError(DataErrorCode.UNAVAILABLE);
  try {
    const res = await signInWithEmailAndPassword(auth, email, password);
    return toSession(res.user);
  } catch (err) { throw fromFirebaseError(err); }
}

export async function signOutSession() {
  if (!auth) return;
  try { await signOut(auth); }
  catch (err) { throw fromFirebaseError(err); }
}

/**
 * Estado de acceso del usuario: si está autorizado y qué versión del
 * consentimiento aceptó.
 *
 * `activo` sale hoy de la colección `allowlist` (un documento por correo). En
 * Supabase será la columna `perfiles.activo`, por eso la interfaz recibe ya un
 * booleano y no sabe de dónde salió.
 *
 * La comparación con la versión vigente del consentimiento la hace la interfaz:
 * esta capa no conoce CONSENT_VERSION.
 */
export async function getAccess(session) {
  if (!db || !session) return { activo: false, consentVersion: null };
  try {
    const [allow, perfil] = await Promise.all([
      getDoc(doc(db, "allowlist", session.email)),
      getDoc(doc(db, "users", session.uid)),
    ]);
    return {
      activo: allow.exists(),
      consentVersion: perfil.exists() ? (perfil.data().consentVersion ?? null) : null,
    };
  } catch (err) { throw fromFirebaseError(err); }
}

export async function acceptConsent(session, consentVersion) {
  if (!db || !session) throw new DataError(DataErrorCode.UNAVAILABLE);
  try {
    await setDoc(doc(db, "users", session.uid), {
      email: session.email,
      displayName: session.displayName || "",
      consentVersion,
      consentAcceptedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err) { throw fromFirebaseError(err); }
}
