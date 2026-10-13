import { useState, useEffect } from "react";
import { authAvailable, getClient, urlTraeEnlaceDeAcceso } from "./auth";

// Sesión actual y si el usuario llegó por un enlace para fijar contraseña
// (invitación o recuperación).
export function useSession() {
  const [session, setSession] = useState(null);
  // Un enlace de invitación o recuperación obliga a fijar contraseña.
  const [needsPassword, setNeedsPassword] = useState(
    () => authAvailable && urlTraeEnlaceDeAcceso() && /type=(invite|recovery)/.test(window.location.hash)
  );

  useEffect(() => {
    if (!authAvailable) return;
    let unsub = null;
    let cancel = false;
    const conEnlace = urlTraeEnlaceDeAcceso();
    // Sin enlace en la URL y sin rastro de sesión guardada no hace falta cargar
    // el cliente: la calculadora arranca igual de ligera que antes.
    const haySesionGuardada = (() => {
      try { return Object.keys(localStorage).some((k) => k.startsWith("sb-") && k.endsWith("-auth-token")); }
      catch { return false; }
    })();
    if (!conEnlace && !haySesionGuardada) return;
    getClient().then((sb) => {
      if (cancel || !sb) return;
      sb.auth.getSession().then(({ data }) => { if (!cancel) setSession(data.session); });
      const { data } = sb.auth.onAuthStateChange((event, s) => {
        setSession(s);
        if (event === "PASSWORD_RECOVERY") setNeedsPassword(true);
      });
      unsub = () => data.subscription.unsubscribe();
    });
    return () => { cancel = true; unsub?.(); };
  }, []);

  // Tras iniciar sesión desde el modal se vuelve a leer, porque el cliente se
  // pudo haber cargado hasta ese momento.
  const refresh = async () => {
    const sb = await getClient();
    if (!sb) return;
    const { data } = await sb.auth.getSession();
    setSession(data.session);
    sb.auth.onAuthStateChange((_e, s) => setSession(s));
  };

  return { session, needsPassword, setNeedsPassword, refresh };
}

