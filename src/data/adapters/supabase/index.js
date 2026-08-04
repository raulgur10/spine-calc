// Adaptador de Supabase. Todo lo que sabe de Postgres, Storage y Supabase Auth
// vive bajo este directorio; nada de aquí se filtra a la interfaz.
export { available } from "./client";
export * from "./session";
export * from "./casos";
export * from "./telemetry";
