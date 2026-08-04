// Contador de uso y encuesta.
//
// No se portan `devices` ni `subscribers`. La primera solo alimentaba un
// contador que la aplicación nunca lee; la segunda es una lista de correo que
// corresponde al proveedor de mailing y no a la base de la aplicación. Las
// funciones siguen existiendo para no cambiar la interfaz, pero no hacen nada.
import { supabase } from "./client";
import { fromSupabaseError } from "./errors";

export async function getUsageCount() {
  if (!supabase) return null;
  const { data } = await supabase.from("stats").select("count").eq("key", "usage").maybeSingle();
  return data?.count ?? null;
}

export async function incrementUsage() {
  if (!supabase) return;
  // Por función y no por update: en Firestore cualquiera podía escribir el
  // contador desde la consola del navegador.
  const { error } = await supabase.rpc("incrementar_uso");
  if (error) fromSupabaseError(error);
}

/* eslint-disable no-unused-vars */
export async function registerDeviceSession(_deviceId) { /* retirada: ver cabecera */ }
export async function incrementDeviceCalc(_deviceId) { /* retirada: ver cabecera */ }
export async function subscribeToUpdates(_datos) { /* retirada: ver cabecera */ }
/* eslint-enable no-unused-vars */

export async function sendFeedback({ rating, comment, deviceId }) {
  if (!supabase) return;
  const { error } = await supabase.from("feedback").insert({ rating, comment, device_id: deviceId });
  if (error) throw fromSupabaseError(error);
}
