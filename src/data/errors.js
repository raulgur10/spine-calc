// ═══════════════════════════════════════════════════════════════════════════
// Errores de la capa de datos
// ═══════════════════════════════════════════════════════════════════════════
// La interfaz decide qué mensaje mostrar a partir de un código estable, nunca
// del código del proveedor. Es lo que permite cambiar de motor sin que se
// rompan los mensajes en español: al migrar, el adaptador de Supabase traduce
// sus propios códigos a esta misma lista y la interfaz no se entera.

export const DataErrorCode = {
  AUTH_INVALID_CREDENTIALS: "auth/invalid-credentials",
  AUTH_TOO_MANY_REQUESTS: "auth/too-many-requests",
  AUTH_NETWORK: "auth/network",
  AUTH_POPUP_CANCELLED: "auth/popup-cancelled",
  AUTH_UNKNOWN: "auth/unknown",
  NOT_FOUND: "data/not-found",
  PERMISSION_DENIED: "data/permission-denied",
  UNAVAILABLE: "data/unavailable",
  UNKNOWN: "data/unknown",
};

export class DataError extends Error {
  constructor(code, message, cause) {
    super(message || code);
    this.name = "DataError";
    this.code = code;
    this.cause = cause;
    // Las llamadas de telemetría ignoran sus errores a propósito. Sin esta
    // traza, un adaptador roto fallaría en silencio durante toda la migración.
    if (import.meta.env?.DEV) console.warn(`[data] ${code}`, cause ?? message);
  }
}

// Mensajes en español por código. La interfaz los usa tal cual; si un código
// no está aquí, cae al genérico.
const MESSAGES = {
  [DataErrorCode.AUTH_INVALID_CREDENTIALS]: "Credenciales inválidas.",
  [DataErrorCode.AUTH_TOO_MANY_REQUESTS]: "Demasiados intentos. Espera unos minutos.",
  [DataErrorCode.AUTH_NETWORK]: "Sin conexión. Reintenta.",
  [DataErrorCode.AUTH_POPUP_CANCELLED]: "Inicio de sesión cancelado.",
  [DataErrorCode.NOT_FOUND]: "No encontrado.",
  [DataErrorCode.PERMISSION_DENIED]: "No tienes permiso para esta operación.",
  [DataErrorCode.UNAVAILABLE]: "Servicio no disponible.",
};

export function messageForError(err, fallback = "Ocurrió un error.") {
  return MESSAGES[err?.code] ?? fallback;
}
