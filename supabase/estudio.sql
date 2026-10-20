-- ═══════════════════════════════════════════════════════════════════════════
-- SpineCalc — estudio de validación: rondas, imágenes y asignaciones
-- ═══════════════════════════════════════════════════════════════════════════
-- Requiere supabase/validacion.sql ya ejecutado (validadores, validacion_medicion,
-- validacion_landmark). Se ejecuta entero en el SQL Editor de Supabase y es
-- idempotente.
--
-- Cómo funciona:
--   · Cada radiografía anonimizada se sube al bucket privado «validacion» con
--     el nombre <sha256>.<ext>. La huella SHA-256 del archivo es su identidad.
--   · estudio_asignacion dice qué placa mide cada validador, en qué ronda y en
--     qué orden. La genera el investigador que no mide (scripts/validacion).
--   · El validador solo ve sus casos PENDIENTES de las rondas ABIERTAS, y solo
--     puede descargar la imagen de un caso pendiente suyo.
--   · El guardado pasa por guardar_medicion_asignada(), que comprueba que la
--     huella de la imagen marcada sea la de la asignación y cierra el caso.
--   · Cegamiento: el validador ya no puede leer mediciones guardadas (ni las
--     suyas). El análisis se hace desde el panel o con la llave de servicio.
--
-- Rondas: 0 = práctica · 1 y 2 = estudio · 9 = verificación del algoritmo
-- (fase 1, imágenes sintéticas). Se abren y cierran a mano:
--   update public.estudio_ronda set abierta = true where numero = 0;

-- ─── Rondas ─────────────────────────────────────────────────────────────────
create table if not exists public.estudio_ronda (
  numero  integer primary key,
  nombre  text not null,
  abierta boolean not null default false
);
insert into public.estudio_ronda (numero, nombre) values
  (0, 'Práctica'), (1, 'Ronda 1'), (2, 'Ronda 2'), (9, 'Verificación del algoritmo')
on conflict (numero) do nothing;

alter table public.estudio_ronda enable row level security;
drop policy if exists ronda_ver on public.estudio_ronda;
create policy ronda_ver on public.estudio_ronda for select to authenticated using (true);
revoke all on public.estudio_ronda from anon, authenticated;
grant select on public.estudio_ronda to authenticated;

-- ─── Imágenes ───────────────────────────────────────────────────────────────
create table if not exists public.estudio_imagen (
  sha256    text primary key check (sha256 ~ '^[0-9a-f]{64}$'),
  archivo   text not null unique,            -- nombre del objeto en el bucket
  tipo      text not null check (tipo in ('estudio', 'practica', 'verificacion')),
  creado_en timestamptz not null default now()
);
alter table public.estudio_imagen enable row level security;

-- ─── Asignaciones ───────────────────────────────────────────────────────────
create table if not exists public.estudio_asignacion (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  ronda         integer not null references public.estudio_ronda(numero),
  orden         integer not null check (orden > 0),
  imagen_sha256 text not null references public.estudio_imagen(sha256),
  codigo        text not null check (char_length(codigo) <= 20),  -- lo que ve el validador
  medicion_id   uuid references public.validacion_medicion(id),
  no_medible    boolean not null default false,
  motivo        text check (char_length(motivo) <= 200),
  completada_en timestamptz,
  unique (user_id, ronda, orden),
  unique (user_id, ronda, imagen_sha256)
);
create index if not exists estudio_asignacion_user on public.estudio_asignacion (user_id, ronda, orden);
alter table public.estudio_asignacion enable row level security;

-- La medición se liga a su asignación (nula en las guardadas fuera del estudio).
alter table public.validacion_medicion add column if not exists asignacion_id uuid
  references public.estudio_asignacion(id);
alter table public.validacion_medicion add column if not exists ronda integer;

-- El validador ve sus casos pendientes de rondas abiertas, y nada más.
drop policy if exists asignacion_ver_pendiente on public.estudio_asignacion;
create policy asignacion_ver_pendiente on public.estudio_asignacion
  for select to authenticated using (
    user_id = (select auth.uid())
    and completada_en is null
    and exists (select 1 from public.estudio_ronda r where r.numero = ronda and r.abierta)
  );

drop policy if exists imagen_ver_asignada on public.estudio_imagen;
create policy imagen_ver_asignada on public.estudio_imagen
  for select to authenticated using (
    exists (select 1 from public.estudio_asignacion a
            join public.estudio_ronda r on r.numero = a.ronda and r.abierta
            where a.imagen_sha256 = sha256 and a.user_id = (select auth.uid()) and a.completada_en is null)
  );

revoke all on public.estudio_imagen, public.estudio_asignacion from anon, authenticated;
grant select on public.estudio_imagen, public.estudio_asignacion to authenticated;

-- ─── Progreso (sin revelar qué placas ya se midieron) ───────────────────────
create or replace function public.progreso_estudio()
returns table (ronda integer, nombre text, total integer, completadas integer)
language sql
security definer
set search_path = ''
stable
as $$
  select a.ronda, r.nombre, count(*)::integer, count(a.completada_en)::integer
  from public.estudio_asignacion a
  join public.estudio_ronda r on r.numero = a.ronda and r.abierta
  where a.user_id = (select auth.uid())
  group by a.ronda, r.nombre
  order by a.ronda;
$$;
revoke all on function public.progreso_estudio() from public, anon;
grant execute on function public.progreso_estudio() to authenticated;

-- ─── Bucket privado de imágenes ─────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('validacion', 'validacion', false)
on conflict (id) do update set public = false;

drop policy if exists validacion_descargar_asignada on storage.objects;
create policy validacion_descargar_asignada on storage.objects
  for select to authenticated using (
    bucket_id = 'validacion'
    and exists (select 1 from public.estudio_asignacion a
                join public.estudio_imagen i on i.sha256 = a.imagen_sha256
                join public.estudio_ronda r on r.numero = a.ronda and r.abierta
                where i.archivo = objects.name and a.user_id = (select auth.uid()) and a.completada_en is null)
  );

-- ─── Cegamiento: los validadores ya no leen mediciones guardadas ────────────
drop policy if exists medicion_ver_propia on public.validacion_medicion;
drop policy if exists landmark_ver_propio on public.validacion_landmark;
revoke select on public.validacion_medicion, public.validacion_landmark from authenticated;
-- El guardado libre (sin asignación) queda retirado durante el estudio.
revoke execute on function public.guardar_medicion_validacion(jsonb) from authenticated;

-- ─── Guardado ligado a una asignación ───────────────────────────────────────
-- SECURITY DEFINER porque debe cerrar la asignación, que el validador no puede
-- modificar; por eso repite aquí, de forma explícita, todas las comprobaciones.
create or replace function public.guardar_medicion_asignada(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid  uuid := (select auth.uid());
  asg  public.estudio_asignacion%rowtype;
  nuevo uuid;
  pt_  jsonb;
begin
  if uid is null or not exists (select 1 from public.validadores v where v.user_id = uid and v.activo) then
    raise exception 'La cuenta no está dada de alta como validador';
  end if;

  select * into asg from public.estudio_asignacion
   where id = (p->>'asignacion_id')::uuid and user_id = uid
   for update;
  if not found then raise exception 'Asignación inexistente'; end if;
  if asg.completada_en is not null then raise exception 'Este caso ya se guardó'; end if;
  if not exists (select 1 from public.estudio_ronda r where r.numero = asg.ronda and r.abierta) then
    raise exception 'La ronda está cerrada';
  end if;

  -- Caso no medible: se cierra sin medición, con su motivo.
  if coalesce((p->>'no_medible')::boolean, false) then
    if coalesce(trim(p->>'motivo'), '') = '' then raise exception 'Indica el motivo'; end if;
    update public.estudio_asignacion
       set no_medible = true, motivo = left(trim(p->>'motivo'), 200), completada_en = now()
     where id = asg.id;
    return null;
  end if;

  if coalesce((p->>'ia_asistida')::boolean, false) then
    raise exception 'Las mediciones asistidas por IA no se guardan en la validación';
  end if;
  if p->>'imagen_sha256' is distinct from asg.imagen_sha256 then
    raise exception 'La imagen marcada no es la del caso asignado';
  end if;
  if jsonb_typeof(p->'landmarks') is distinct from 'array' or jsonb_array_length(p->'landmarks') = 0 then
    raise exception 'Faltan los landmarks';
  end if;

  insert into public.validacion_medicion (
    user_id, asignacion_id, ronda, folio, imagen_sha256, imagen_ancho, imagen_alto, mm_por_px, calib_ref_mm,
    horiz_p1x, horiz_p1y, horiz_p2x, horiz_p2y,
    pi, ss, pt, l1s1, l4s1, gt, l1pa, t4pa, c2tilt, t1tilt, l1tilt, sva_cm,
    duracion_s, editado_en_formulario, anotador_version, app_version
  ) values (
    uid, asg.id, asg.ronda, asg.codigo, asg.imagen_sha256,
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

  update public.estudio_asignacion set medicion_id = nuevo, completada_en = now() where id = asg.id;
  return nuevo;
end;
$$;

revoke all on function public.guardar_medicion_asignada(jsonb) from public, anon;
grant execute on function public.guardar_medicion_asignada(jsonb) to authenticated;
