// ═══════════════════════════════════════════════════════════════════════════
// Sesión de usuarios autorizados
// ═══════════════════════════════════════════════════════════════════════════
// La calculadora nunca pide cuenta. La sesión solo habilita las funciones de IA
// (premarcado y chat de bibliografía), que gastan créditos de OpenRouter.
//
// Las cuentas no se crean desde la app: el registro libre está apagado en
// Supabase y cada usuario se da de alta desde el panel (invitación o alta
// directa). Tener cuenta tampoco basta: la función de Cloudflare comprueba que
// el correo esté en ALLOWED_EMAILS antes de llamar al modelo.
//
// El cliente de Supabase se carga bajo demanda para no engordar la calculadora
// de quien nunca inicia sesión.

import { usuarioACorreo } from "./features";

const URL_BASE = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const authAvailable = Boolean(URL_BASE && KEY);

let clientPromise = null;
export function getClient() {
  if (!authAvailable) return Promise.resolve(null);
  if (!clientPromise) {
    clientPromise = import("@supabase/supabase-js").then(({ createClient }) =>
      createClient(URL_BASE, KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    );
  }
  return clientPromise;
}

// Si la URL trae un enlace de invitación o de recuperación, hay que cargar el
// cliente de inmediato para que consuma el token antes de que se pierda.
export function urlTraeEnlaceDeAcceso() {
  const h = typeof window !== "undefined" ? window.location.hash : "";
  return /type=(invite|recovery|magiclink|signup)/.test(h) || /access_token=/.test(h);
}

export async function signIn(email, password) {
  const sb = await getClient();
  const { data, error } = await sb.auth.signInWithPassword({ email: usuarioACorreo(email), password });
  if (error) throw error;
  return data.session;
}

export async function signOut() {
  const sb = await getClient();
  await sb?.auth.signOut();
}

export async function sendPasswordReset(email) {
  const sb = await getClient();
  const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}`;
  const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo });
  if (error) throw error;
}

export async function setPassword(password) {
  const sb = await getClient();
  const { error } = await sb.auth.updateUser({ password });
  if (error) throw error;
}

export async function accessToken() {
  const sb = await getClient();
  const { data } = (await sb?.auth.getSession()) || { data: {} };
  return data?.session?.access_token || null;
}

// Llamada autenticada a las funciones de /api. Las funciones viven en la raíz
// del sitio (no bajo /calc).
export async function apiPost(path, body) {
  const token = await accessToken();
  if (!token) throw new Error("Sin sesión");
  const res = await fetch(`/api/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* respuesta sin cuerpo */ }
  if (!res.ok) {
    const err = new Error(json?.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return json;
}
