// POST /api/ia/premarcar
// ═══════════════════════════════════════════════════════════════════════════
// Premarcado SUGERIDO de los 12 puntos del anotador con un modelo de visión.
//
// Entrada: { imagen: "data:image/jpeg;base64,...", modelo?: "luna"|"deepseek"|"gemini"|"grok" }
//   La imagen ya llega recortada y con los datos del paciente tapados: el
//   navegador solo manda el recorte que el usuario aprobó.
// Salida:  { modelo, puntos: { femL: { x, y, confianza } | null, ... }, notas, uso }
//   x, y normalizadas 0-1000 sobre la imagen recibida (origen arriba-izquierda).
//
// Nada se guarda: ni la imagen ni la respuesta.
import { json, usuarioAutorizado, openrouter, primerJSON } from "../../../api-lib/comun.js";

// Lista cerrada: el navegador elige por apodo, nunca manda el slug.
const MODELOS = {
  luna: "openai/gpt-6-luna",
  deepseek: "deepseek/deepseek-v4.1-flash",
  gemini: "google/gemini-3.8-flash",
  grok: "x-ai/grok-4.7",
};
const MODELO_DEF = "gemini";
const MAX_BYTES = 6 * 1024 * 1024;

const CLAVES = ["femL", "femR", "s1Post", "s1Ant", "l4Post", "l4Ant", "l1Post", "l1Ant", "c7", "t4", "t1", "c2"];

const PROMPT = `You are assisting a spine surgeon. The image is a LATERAL (sagittal) standing radiograph of the spine, possibly cropped. Locate these anatomical landmarks and return their pixel positions NORMALIZED to 0-1000 on each axis (x: 0 = left edge, 1000 = right edge; y: 0 = top edge, 1000 = bottom edge of THIS image).

Landmarks:
- femL: center of one femoral head (the more radiopaque / sharper one if superimposed).
- femR: center of the other femoral head. If both heads are perfectly superimposed, give the same circle center for both.
- s1Post: posterior corner of the SUPERIOR endplate of S1 (where the endplate meets the posterior wall, canal side).
- s1Ant: anterior corner of the superior endplate of S1.
- l4Post / l4Ant: posterior / anterior corners of the SUPERIOR endplate of L4. Count up from S1: first vertebra above S1 is L5, next is L4.
- l1Post / l1Ant: posterior / anterior corners of the SUPERIOR endplate of L1 (5 vertebrae above S1). Check against the last rib-bearing vertebra (T12) if visible.
- c7: CENTER of the vertebral BODY of C7 (not the spinous process).
- t4: center of the vertebral body of T4 (4 levels below C7).
- t1: center of the vertebral body of T1.
- c2: center of the vertebral body of C2, below the dens.

Rules:
- Count vertebrae carefully; a wrong level is worse than a missing point.
- If a landmark is outside the image or you cannot identify it with reasonable confidence, return null for it. Do not guess.
- "confianza" is your confidence 0-1 for each point.
- Ignore any text, rulers or markers burned into the image.

Answer with ONLY this JSON, no prose:
{"orientacion":"anterior_izquierda|anterior_derecha","puntos":{"femL":{"x":0,"y":0,"confianza":0.0},"femR":null,"s1Post":null,"s1Ant":null,"l4Post":null,"l4Ant":null,"l1Post":null,"l1Ant":null,"c7":null,"t4":null,"t1":null,"c2":null},"notas":"one short sentence about image quality or doubts, in Spanish"}`;

function sanear(puntos) {
  const out = {};
  for (const k of CLAVES) {
    const p = puntos?.[k];
    const x = Number(p?.x), y = Number(p?.y);
    if (p && Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= 1000 && y >= 0 && y <= 1000) {
      const c = Number(p.confianza);
      out[k] = { x, y, confianza: Number.isFinite(c) ? Math.max(0, Math.min(1, c)) : null };
    } else {
      out[k] = null;
    }
  }
  return out;
}

export async function onRequestPost({ request, env }) {
  // Apagado en la fase de validación (solo mediciones manuales).
  if (env.IA_HABILITADA !== "true") return json({ error: "El premarcado con IA está desactivado durante la fase de validación." }, 503);
  const u = await usuarioAutorizado(request, env);
  if (u instanceof Response) return u;

  const largo = Number(request.headers.get("Content-Length") || 0);
  if (largo > MAX_BYTES) return json({ error: "La imagen es demasiado grande." }, 413);

  let body;
  try { body = await request.json(); } catch { return json({ error: "Solicitud inválida." }, 400); }
  const imagen = body?.imagen;
  if (typeof imagen !== "string" || !/^data:image\/(jpeg|png|webp);base64,/.test(imagen)) {
    return json({ error: "Falta la imagen." }, 400);
  }
  if (imagen.length > MAX_BYTES) return json({ error: "La imagen es demasiado grande." }, 413);
  const apodo = MODELOS[body?.modelo] ? body.modelo : (MODELOS[env.MODELO_PREMARCADO] ? env.MODELO_PREMARCADO : MODELO_DEF);

  try {
    const data = await openrouter(env, {
      model: MODELOS[apodo],
      messages: [{
        role: "user",
        content: [
          { type: "text", text: PROMPT },
          { type: "image_url", image_url: { url: imagen } },
        ],
      }],
      temperature: 0,
      // Holgado a propósito: si el razonamiento se come el tope, el contenido
      // llega vacío sin ningún error.
      max_tokens: 6000,
      reasoning: { effort: "low" },
      response_format: { type: "json_object" },
    });
    const texto = data?.choices?.[0]?.message?.content || "";
    const parsed = primerJSON(texto);
    if (!parsed?.puntos) {
      const fin = data?.choices?.[0]?.finish_reason;
      return json({ error: `El modelo no devolvió puntos utilizables${fin ? ` (${fin})` : ""}.` }, 502);
    }
    return json({
      modelo: apodo,
      slug: MODELOS[apodo],
      puntos: sanear(parsed.puntos),
      orientacion: parsed.orientacion || null,
      notas: typeof parsed.notas === "string" ? parsed.notas.slice(0, 400) : "",
      uso: data.usage ? { entrada: data.usage.prompt_tokens, salida: data.usage.completion_tokens, costo: data.usage.cost ?? null } : null,
    });
  } catch (err) {
    return json({ error: `Error del modelo: ${err.message}` }, err.status === 402 ? 402 : 502);
  }
}
