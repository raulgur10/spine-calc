-- ═══════════════════════════════════════════════════════════════════════════
-- SpineCalc — estudio de validación de mediciones manuales
-- ═══════════════════════════════════════════════════════════════════════════
-- Guarda las mediciones que los validadores hacen A MANO en el anotador.
-- Nada asistido por IA: el navegador no ofrece guardar si en esa placa se usó
-- el premarcado, y la función lo rechaza también.
--
-- No se guarda la imagen, ni su nombre de archivo, ni datos del paciente. La
-- placa se identifica por la huella SHA-256 del archivo: dos mediciones con la
-- misma huella son de la misma placa (concordancia inter e intraobservador).
-- El folio es texto libre opcional del validador, sin nombre ni expediente.
--
-- Mediciones en columnas numéricas; landmarks en tabla hija, un renglón por
-- punto. Las filas no se editan ni se borran desde la app (auditoría).
--
-- Se ejecuta entero en el SQL Editor de Supabase. Es idempotente.
-- Los validadores se dan de alta aparte (los correos no van en este archivo
-- porque el repositorio es público):
--   insert into public.validadores (user_id)
--   select id from auth.users where lower(email) in ('correo1', 'correo2')
--   on conflict do nothing;

-- ─── Quién puede guardar ────────────────────────────────────────────────────
create table if not exists public.validadores (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  activo    boolean not null default true,
  creado_en timestamptz not null default now()
);
alter table public.validadores enable row level security;

drop policy if exists validadores_propio on public.validadores;
create policy validadores_propio on public.validadores
  for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.validadores from anon, authenticated;
grant select on public.validadores to authenticated;

-- ─── Una fila por medición ──────────────────────────────────────────────────
create table if not exists public.validacion_medicion (
  id               uuid primary key default gen_random_uuid(),
  creado_en        timestamptz not null default now(),
  user_id          uuid not null default auth.uid() references auth.users(id),
  folio            text check (char_length(folio) <= 40),
  imagen_sha256    text not null check (imagen_sha256 ~ '^[0-9a-f]{64}$'),
  imagen_ancho     integer check (imagen_ancho > 0),
  imagen_alto      integer check (imagen_alto > 0),
  -- Calibración y horizontal de referencia (pixeles de la placa original)
  mm_por_px        numeric check (mm_por_px > 0),
  calib_ref_mm     numeric,
  horiz_p1x numeric, horiz_p1y numeric, horiz_p2x numeric, horiz_p2y numeric,
  -- Lo que emitió el anotador (grados; SVA en cm)
  pi numeric, ss numeric, pt numeric, l1s1 numeric, l4s1 numeric, gt numeric,
  l1pa numeric, t4pa numeric, c2tilt numeric, t1tilt numeric, l1tilt numeric,
  sva_cm numeric,
  -- Segundos entre cargar la placa y aplicar
  duracion_s       integer check (duracion_s >= 0),
  -- El validador corrigió a mano algún valor en el formulario después de aplicar
  editado_en_formulario boolean not null default false,
  anotador_version text,
  app_version      text
);
create index if not exists validacion_medicion_imagen on public.validacion_medicion (imagen_sha256);
create index if not exists validacion_medicion_user on public.validacion_medicion (user_id);

-- ─── Un renglón por landmark ────────────────────────────────────────────────
create table if not exists public.validacion_landmark (
  medicion_id uuid not null references public.validacion_medicion(id) on delete cascade,
  clave       text not null check (clave in ('femL','femR','s1Post','s1Ant','l4Post','l4Ant','l1Post','l1Ant','c7','t4','t1','c2')),
  x           numeric not null,
  y           numeric not null,
  primary key (medicion_id, clave)
);

alter table public.validacion_medicion enable row level security;
alter table public.validacion_landmark enable row level security;

-- Cada validador ve solo lo suyo; el análisis completo se hace desde el panel.
drop policy if exists medicion_ver_propia on public.validacion_medicion;
create policy medicion_ver_propia on public.validacion_medicion
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists medicion_insertar on public.validacion_medicion;
create policy medicion_insertar on public.validacion_medicion
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.validadores v where v.user_id = (select auth.uid()) and v.activo)
  );

drop policy if exists landmark_ver_propio on public.validacion_landmark;
create policy landmark_ver_propio on public.validacion_landmark
  for select to authenticated using (
    exists (select 1 from public.validacion_medicion m where m.id = medicion_id and m.user_id = (select auth.uid()))
  );

drop policy if exists landmark_insertar on public.validacion_landmark;
create policy landmark_insertar on public.validacion_landmark
  for insert to authenticated with check (
    exists (select 1 from public.validacion_medicion m where m.id = medicion_id and m.user_id = (select auth.uid()))
  );

revoke all on public.validacion_medicion, public.validacion_landmark from anon, authenticated;
grant select, insert on public.validacion_medicion, public.validacion_landmark to authenticated;

-- ─── Guardado atómico (medición + landmarks) ────────────────────────────────
-- SECURITY INVOKER: corre con los permisos del usuario, así que las políticas
-- de arriba siguen mandando.
create or replace function public.guardar_medicion_validacion(p jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  nuevo uuid;
  pt_ jsonb;
begin
  if coalesce((p->>'ia_asistida')::boolean, false) then
    raise exception 'Las mediciones asistidas por IA no se guardan en la validación';
  end if;
  if jsonb_typeof(p->'landmarks') is distinct from 'array' or jsonb_array_length(p->'landmarks') = 0 then
    raise exception 'Faltan los landmarks';
  end if;

  insert into public.validacion_medicion (
    folio, imagen_sha256, imagen_ancho, imagen_alto, mm_por_px, calib_ref_mm,
    horiz_p1x, horiz_p1y, horiz_p2x, horiz_p2y,
    pi, ss, pt, l1s1, l4s1, gt, l1pa, t4pa, c2tilt, t1tilt, l1tilt, sva_cm,
    duracion_s, editado_en_formulario, anotador_version, app_version
  ) values (
    nullif(trim(p->>'folio'), ''), p->>'imagen_sha256',
    (p->>'imagen_ancho')::integer, (p->>'imagen_alto')::integer,
    (p->>'mm_por_px')::numeric, (p->>'calib_ref_mm')::numeric,
    (p->>'horiz_p1x')::numeric, (p->>'horiz_p1y')::numeric, (p->>'horiz_p2x')::numeric, (p->>'horiz_p2y')::numeric,
    (p->>'pi')::numeric, (p->>'ss')::numeric, (p->>'pt')::numeric, (p->>'l1s1')::numeric,
    (p->>'l4s1')::numeric, (p->>'gt')::numeric, (p->>'l1pa')::numeric, (p->>'t4pa')::numeric,
    (p->>'c2tilt')::numeric, (p->>'t1tilt')::numeric, (p->>'l1tilt')::numeric, (p->>'sva_cm')::numeric,
    (p->>'duracion_s')::integer, coalesce((p->>'editado_en_formulario')::boolean, false),
    p->>'anotador_version', p->>'app_version'
  ) returning id into nuevo;

  for pt_ in select * from jsonb_array_elements(p->'landmarks') loop
    insert into public.validacion_landmark (medicion_id, clave, x, y)
    values (nuevo, pt_->>'key', (pt_->>'x')::numeric, (pt_->>'y')::numeric);
  end loop;

  return nuevo;
end;
$$;

revoke all on function public.guardar_medicion_validacion(jsonb) from public, anon;
grant execute on function public.guardar_medicion_validacion(jsonb) to authenticated;
