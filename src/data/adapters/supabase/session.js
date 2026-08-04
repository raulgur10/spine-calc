// Sesión y perfil sobre Supabase Auth.
import { supabase } from "./client";
import { fromSupabaseError } from "./errors";
import { DataError, DataErrorCode } from "../../errors";

// Misma forma neutra que devolvía el adaptador de Firebase: la interfaz no
// distingue `user.uid` de Firebase de `user.id` de Supabase.
function toSession(u) {
  if (!u) return null;
  return {
    uid: u.id,
    email: u.email,
    displayName: u.user_metadata?.full_name || u.user_metadata?.name || null,
    provider: "supabase",
  };
}

export function onSessionChange(cb) {
  if (!supabase) { cb(null); return () => {}; }
  // getSession resuelve la sesión ya persistida; onAuthStateChange no siempre
  // emite al montar, y sin esto la aplicación arrancaría como no autenticada
  // aunque hubiera sesión válida en el almacenamiento.
  supabase.auth.getSession().then(({ data }) => cb(toSession(data?.session?.user)));
  const { data } = supabase.auth.onAuthStateChange((_evt, sesion) => cb(toSession(sesion?.user)));
  return () => data?.subscription?.unsubscribe();
}

export async function signInWithGoogle() {
  if (!supabase) throw new DataError(DataErrorCode.UNAVAILABLE);
  // Con OAuth el navegador se va a Google y vuelve por redirección: no hay
  // sesión que devolver aquí. Quien la entrega es onSessionChange al regresar.
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
  if (error) throw fromSupabaseError(error);
  return null;
}

export async function signInWithPassword(email, password) {
  if (!supabase) throw new DataError(DataErrorCode.UNAVAILABLE);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw fromSupabaseError(error);
  return toSession(data.user);
}

export async function signOutSession() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw fromSupabaseError(error);
}

/**
 * Estado de acceso: si el perfil está autorizado y qué consentimiento aceptó.
 *
 * `activo` sale de `perfiles.activo`, que sustituye a la colección `allowlist`.
 * Aquí solo se lee para decidir qué enseñar; quien lo hace cumplir de verdad
 * son las políticas RLS, así que un cliente manipulado no gana nada mintiendo.
 */
export async function getAccess(session) {
  if (!supabase || !session) return { activo: false, consentVersion: null };
  const { data, error } = await supabase
    .from("perfiles")
    .select("activo, consent_version")
    .eq("id", session.uid)
    .maybeSingle();
  if (error) throw fromSupabaseError(error);
  return {
    activo: data?.activo ?? false,
    consentVersion: data?.consent_version ?? null,
  };
}

export async function acceptConsent(session, consentVersion) {
  if (!supabase || !session) throw new DataError(DataErrorCode.UNAVAILABLE);
  // Solo estas columnas son actualizables por el usuario: `activo` está fuera
  // de su alcance por permisos de columna.
  const { error } = await supabase
    .from("perfiles")
    .update({ consent_version: consentVersion, consent_accepted_at: new Date().toISOString() })
    .eq("id", session.uid);
  if (error) throw fromSupabaseError(error);
}
