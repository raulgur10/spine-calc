// Traduce los errores de Supabase a los códigos estables de la capa de datos.
// Traduce los errores del motor al código propio: la interfaz no distingue cuál
// motor produjo el error.
import { DataError, DataErrorCode } from "../../errors";

export function fromSupabaseError(err) {
  if (!err) return new DataError(DataErrorCode.UNKNOWN);
  const msg = String(err.message || "").toLowerCase();
  const code = err.code;

  if (msg.includes("invalid login credentials") || msg.includes("invalid grant")) {
    return new DataError(DataErrorCode.AUTH_INVALID_CREDENTIALS, null, err);
  }
  if (err.status === 429 || msg.includes("rate limit") || msg.includes("too many")) {
    return new DataError(DataErrorCode.AUTH_TOO_MANY_REQUESTS, null, err);
  }
  if (msg.includes("failed to fetch") || msg.includes("network")) {
    return new DataError(DataErrorCode.AUTH_NETWORK, null, err);
  }
  if (msg.includes("popup") || msg.includes("cancel")) {
    return new DataError(DataErrorCode.AUTH_POPUP_CANCELLED, null, err);
  }
  // 42501 = insufficient_privilege; PGRST301 = fila bloqueada por RLS.
  if (code === "42501" || code === "PGRST301" || err.status === 403) {
    return new DataError(DataErrorCode.PERMISSION_DENIED, null, err);
  }
  if (code === "PGRST116") return new DataError(DataErrorCode.NOT_FOUND, null, err);
  if (err.status >= 500) return new DataError(DataErrorCode.UNAVAILABLE, null, err);
  return new DataError(DataErrorCode.UNKNOWN, err.message, err);
}
