// ═══════════════════════════════════════════════════════════════════════════
// Encuesta de opinión anónima
// ═══════════════════════════════════════════════════════════════════════════
// Es la única llamada de red de la calculadora. Envía una calificación de 1 a 5
// y un comentario opcional: sin cuenta, sin identificador de dispositivo, sin
// mediciones ni datos del paciente. Nada de la radiografía ni del cálculo sale
// del navegador.
//
// Va directo a la API REST de Supabase con la clave publicable. La tabla solo
// admite inserciones anónimas y nadie puede leerla desde el navegador (véase
// supabase/schema.sql). Sin las variables de entorno la encuesta no se muestra.

const URL_BASE = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const feedbackAvailable = Boolean(URL_BASE && KEY);

export async function sendFeedback({ rating, comment }) {
  if (!feedbackAvailable) throw new Error("Encuesta no disponible");
  const res = await fetch(`${URL_BASE}/rest/v1/feedback`, {
    method: "POST",
    headers: {
      apikey: KEY,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ rating, comment }),
  });
  if (!res.ok) throw new Error(`Encuesta: HTTP ${res.status}`);
}
