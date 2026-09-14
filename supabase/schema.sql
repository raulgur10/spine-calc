-- ═══════════════════════════════════════════════════════════════════════════
-- SpineCalc — esquema
-- ═══════════════════════════════════════════════════════════════════════════
-- SpineCalc es una herramienta de medición: NO guarda casos, mediciones,
-- imágenes, cuentas de usuario ni consentimientos. Todo el cálculo ocurre en el
-- navegador y se pierde al cerrar la página.
--
-- Lo único que existe en la base es la encuesta de opinión, anónima:
-- calificación (1-5) y comentario opcional, sin identificador de dispositivo,
-- sin sesión y sin ningún dato del cálculo. Se escribe desde src/feedback.js.
--
-- Se ejecuta entero en el SQL Editor de Supabase. Es idempotente.

create table if not exists public.feedback (
  id         uuid primary key default gen_random_uuid(),
  rating     smallint not null check (rating between 1 and 5),
  comment    text check (char_length(comment) <= 500),
  created_at timestamptz not null default now()
);

-- Versiones anteriores guardaban un identificador de dispositivo con cada
-- opinión. Se retira para que la encuesta sea anónima de verdad.
alter table public.feedback drop column if exists device_id;

alter table public.feedback enable row level security;

-- Solo inserción. Sin política de lectura: nadie puede leer las opiniones desde
-- el navegador; se consultan desde el panel de Supabase.
drop policy if exists feedback_insert on public.feedback;
create policy feedback_insert on public.feedback
  for insert to anon, authenticated with check (true);

revoke select, update, delete on public.feedback from anon, authenticated;
grant insert (rating, comment) on public.feedback to anon, authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- Limpieza de la versión anterior (registro de casos, cuentas y telemetría)
-- ═══════════════════════════════════════════════════════════════════════════
-- La versión 1.0.0-beta.1 tenía registro de casos, perfiles de usuario,
-- consentimientos y contador de uso. Nada de eso existe ya en la aplicación.
--
-- El bloque siguiente BORRA esas tablas, sus funciones y el bucket de
-- radiografías, CON TODO SU CONTENIDO, y no se puede deshacer. Está comentado a
-- propósito: revisa antes qué contienen y, si hace falta conservar algo,
-- expórtalo. Después descoméntalo y ejecútalo.
--
-- drop function if exists public.guardar_caso_publico(jsonb, jsonb, jsonb);
-- drop function if exists public.obtener_caso_publico(text);
-- drop function if exists public.incrementar_uso();
-- drop function if exists public.actualizar_record_juego(bigint);
-- drop table if exists public.caso_landmarks, public.caso_cirugias, public.caso_fotos cascade;
-- drop table if exists public.casos cascade;
-- drop table if exists public.stats cascade;
-- drop trigger if exists on_auth_user_created on auth.users;
-- drop function if exists public.crear_perfil_al_registrarse();
-- drop function if exists public.perfil_activo() cascade;
-- drop table if exists public.perfiles cascade;
-- drop policy if exists casos_imagenes_propias on storage.objects;
-- -- El bucket debe vaciarse antes desde el panel (Storage → casos).
-- delete from storage.buckets where id = 'casos';
