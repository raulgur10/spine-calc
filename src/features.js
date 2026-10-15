// ═══════════════════════════════════════════════════════════════════════════
// Interruptores de funciones
// ═══════════════════════════════════════════════════════════════════════════

// Premarcado con IA. Apagado durante la fase de validación: el estudio solo
// admite mediciones manuales. Para reactivarlo: true aquí Y la variable
// IA_HABILITADA=true en Cloudflare Pages (la función del servidor también la
// revisa, así que apagarlo aquí no basta para encenderlo allá ni al revés).
export const IA_HABILITADA = false;

// Validadores sin correo propio: entran con un usuario corto ("validador01")
// y la app le añade este dominio. Las cuentas existen en Supabase con el
// correo completo (validador01@<dominio>). El dominio no recibe correo: esas
// cuentas no pueden usar "olvidé mi contraseña"; se restablecen desde el panel.
export const DOMINIO_USUARIOS = "validacion.spinecalc.app";

export function usuarioACorreo(texto) {
  const s = (texto || "").trim().toLowerCase();
  return s.includes("@") ? s : `${s}@${DOMINIO_USUARIOS}`;
}
