// ═══════════════════════════════════════════════════════════════════════════
// Capa de datos — superficie pública
// ═══════════════════════════════════════════════════════════════════════════
// Lo único que App.jsx importa para hablar con la base. Ninguna función de
// aquí revela qué motor hay debajo.
//
// PARA MIGRAR A SUPABASE: escribir src/data/adapters/supabase/ con la misma
// interfaz y cambiar las tres líneas de import de abajo. App.jsx no se toca.
// Si al llegar a ese punto hace falta editar App.jsx, es que algo se quedó
// filtrado y hay que devolverlo al adaptador.

import * as backend from "./adapters/firebase";   // ← migrar: "./adapters/supabase"

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
