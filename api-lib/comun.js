// ═══════════════════════════════════════════════════════════════════════════
// Utilidades compartidas de las funciones de Cloudflare Pages (/functions)
// ═══════════════════════════════════════════════════════════════════════════
// Vive fuera de /functions para que Pages no lo convierta en ruta.
//
// Variables del proyecto en Cloudflare Pages (Settings → Variables and Secrets),
// en Production y en Preview:
//   OPENROUTER_API_KEY   secreto — llave dedicada de SpineCalc, con tope de gasto
//   ALLOWED_EMAILS       correos autorizados, separados por coma (no van en el
//                        repo porque el repo es público)
//   SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY   opcionales; por defecto las públicas
//                        del proyecto, que de todos modos viajan en el bundle.

const SUPABASE_URL_DEF = "https://fvrzkckfcqmtywwpyflp.supabase.co";
const SUPABASE_KEY_DEF = "sb_publishable_w3g6gmcC0667KI0z8a1pyg_-PwoI3Cy"; // publicable: va en el bundle por diseño

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

// Verifica el token de Supabase preguntándole a Supabase quién es, y que el
// correo esté en la lista. Devuelve { email } o una Response de error.
export async function usuarioAutorizado(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return json({ error: "Inicia sesión para usar la IA." }, 401);

  const url = env.SUPABASE_URL || SUPABASE_URL_DEF;
  const key = env.SUPABASE_PUBLISHABLE_KEY || SUPABASE_KEY_DEF;
  const headers = { Authorization: `Bearer ${token}`, apikey: key };
  const r = await fetch(`${url}/auth/v1/user`, { headers });
  if (!r.ok) return json({ error: "La sesión expiró. Vuelve a entrar." }, 401);
  const user = await r.json();
  const email = (user.email || "").toLowerCase();

  const permitidos = (env.ALLOWED_EMAILS || "")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!email || !permitidos.includes(email)) {
    return json({ error: "Tu cuenta no tiene habilitadas las funciones de IA." }, 403);
  }
  return { email };
}

// Llamada a OpenRouter. Se pide que ningún proveedor guarde ni entrene con los
// datos (data_collection: "deny").
export async function openrouter(env, body) {
  if (!env.OPENROUTER_API_KEY) throw new Error("Falta OPENROUTER_API_KEY en el proyecto de Cloudflare.");
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://www.spinecalc.app",
      "X-Title": "SpineCalc",
    },
    body: JSON.stringify({ ...body, provider: { data_collection: "deny", ...(body.provider || {}) } }),
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) {
    const msg = data?.error?.message || `OpenRouter HTTP ${r.status}`;
    const err = new Error(msg);
    err.status = r.status;
    throw err;
  }
  return data;
}

// Extrae el primer objeto JSON de un texto (algunos modelos lo envuelven en
// bloques de código aunque se les pida JSON puro).
export function primerJSON(texto) {
  if (!texto) return null;
  try { return JSON.parse(texto); } catch { /* sigue */ }
  const ini = texto.indexOf("{");
  const fin = texto.lastIndexOf("}");
  if (ini < 0 || fin <= ini) return null;
  try { return JSON.parse(texto.slice(ini, fin + 1)); } catch { return null; }
}
