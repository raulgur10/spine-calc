// ═══════════════════════════════════════════════════════════════════════════
// Capa de datos — superficie pública
// ═══════════════════════════════════════════════════════════════════════════
// Lo único que App.jsx importa para hablar con la base. Ninguna función de
// aquí revela qué motor hay debajo.
//
// El motor se elige con la línea de import de abajo y nada más: sustituirla por
// otro adaptador que cumpla esta misma superficie cambia el backend entero.

import * as backend from "./adapters/supabase";

/** ¿Hay backend configurado? Si es false, la app funciona en local y sin login. */
export const dataAvailable = backend.available;

// Sesión y perfil
export const { onSessionChange, signInWithGoogle, signInWithPassword, signOutSession,
  getAccess, acceptConsent } = backend;

// Casos clínicos y casos públicos
export const { listCasos, saveCaso, deleteCaso, savePublicCaso, getPublicCaso } = backend;
// `uploadFoto` no se expone a propósito: la secuencia de crear el documento,
// subir la imagen y adjuntar la URL es un detalle del motor y vive dentro de
// saveCaso. Exponerla obligaría a App.jsx a conocer ese orden, que es
// justamente lo que no debe sobrevivir a la migración.

// Telemetría
export const { getUsageCount, incrementUsage, registerDeviceSession,
  incrementDeviceCalc, subscribeToUpdates, sendFeedback } = backend;

// DTO y mapeadores: agnósticos del motor, se reexportan por comodidad.
export * from "./caso";
export * from "./form";
export { DataError, DataErrorCode, messageForError } from "./errors";
