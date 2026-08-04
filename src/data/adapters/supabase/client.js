// Cliente de Supabase. Las dos credenciales son públicas por diseño: viajan en
// el bundle del navegador. Lo que protege los datos es el RLS del esquema, no
// el secreto de estas cadenas.
import { createClient } from "@supabase/supabase-js";

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/** Sin credenciales la aplicación sigue funcionando: calcula, anota y exporta. */
export const available = !!(URL && KEY);

export const supabase = available ? createClient(URL, KEY) : null;

if (!available && import.meta.env.DEV) {
  console.warn(
    "[data] Sin credenciales de Supabase: la aplicación corre sin backend.\n" +
    "       Copia .env.example a .env.local y rellena VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY."
  );
}
