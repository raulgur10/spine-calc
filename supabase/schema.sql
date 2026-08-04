-- ═══════════════════════════════════════════════════════════════════════════
-- SpineCalc — esquema inicial
-- ═══════════════════════════════════════════════════════════════════════════
-- Base limpia: no se importa nada de Firebase. Los casos que había allí eran
-- ensayos.
--
-- Se ejecuta entero en el SQL Editor de Supabase. Es idempotente: se puede
-- volver a correr sin romper nada.
--
-- Decisiones que explican la forma de las tablas:
--
--   · Las mediciones son COLUMNAS NUMÉRICAS, no JSON. El dataset del artículo
--     sale con un SELECT, sin desempaquetar nada.
--   · Los landmarks van en tabla hija, un renglón por punto, para poder
--     consultarlos por punto y alimentar el modelo de keypoints.
--   · Una sola tabla `casos` con columna `visibility`: el caso público es la
--     misma fila con los campos identificables en NULL.
--   · Los casos públicos NO se leen con una política abierta, sino con una
--     función que recibe el ID. Con lectura abierta cualquiera podría
--     enumerarlos: el espacio de IDs son 4 caracteres sobre 31 símbolos.

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Perfiles
-- ───────────────────────────────────────────────────────────────────────────
-- Sustituye a la colección `allowlist` de Firestore. `activo` es lo que antes
-- era "estar en la lista"; ahora lo aplican las políticas RLS, no el cliente.

create table if not exists public.perfiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  email                 text not null,
  nombre                text,
  activo                boolean not null default false,
  -- Consentimiento de uso que acepta el MÉDICO dentro de la aplicación.
  -- No confundir con el consentimiento del paciente, que es en papel y se
  -- registra por caso más abajo.
  consent_version       text,
  consent_accepted_at   timestamptz,
  created_at            timestamptz not null default now()
);

comment on column public.perfiles.activo is
  'Autorización para guardar casos clínicos. Se otorga a mano; el alta de un usuario no la concede.';

-- Alta automática del perfil al registrarse, siempre inactivo.
create or replace function public.crear_perfil_al_registrarse()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.perfiles (id, email, nombre, activo)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', false)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.crear_perfil_al_registrarse();

-- ───────────────────────────────────────────────────────────────────────────
-- 2. Casos
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.casos (
  id                    uuid primary key default gen_random_uuid(),
  schema_version        smallint not null default 2,
  public_id             text unique,               -- GAP-AAAA-XXXX
  visibility            text not null default 'private'
                          check (visibility in ('private', 'public')),
  owner_uid             uuid references auth.users(id) on delete set null,
  owner_email           text,
  device_id             text,
  created_at            timestamptz not null default now(),

  -- Consentimiento de uso aceptado en la aplicación (médico o modo público).
  consent_version       text,
  consent_accepted_at   timestamptz,

  -- Consentimiento del PACIENTE: es en papel, firmado y resguardado fuera de
  -- la aplicación. Aquí solo se registra que existe.
  consent_paciente_firmado  boolean,
  consent_paciente_fecha    date,
  consent_paciente_resguardo text,

  -- Estudio
  study_date            date,
  surgery_date          date,
  evaluation_type       text not null default 'preoperatorio'
                          check (evaluation_type in ('preoperatorio', 'postoperatorio')),
  days_diff             integer,
  time_label            text,

  -- Identidad. NULL en los casos públicos.
  patient_last_name     text,
  patient_first_name    text,
  patient_full_name     text,
  patient_initials      text,
  surgeon_name          text,
  measurer_name         text,

  -- Antropometría
  age                   smallint,
  weight_kg             numeric(5,2),
  height_cm             numeric(5,2),
  bmi                   numeric(5,2),
  bmi_category          text,

  -- ── Mediciones ───────────────────────────────────────────────────────────
  -- Una columna por parámetro: es lo que hace que el dataset salga por SQL.
  pi                    numeric(5,2),
  ss                    numeric(5,2),
  pt                    numeric(5,2),
  derived_key           text check (derived_key in ('pi', 'ss', 'pt')),
  l1s1                  numeric(5,2),
  l4s1                  numeric(5,2),
  gt                    numeric(5,2),
  l1pa                  numeric(5,2),
  t4pa                  numeric(5,2),
  c2tilt                numeric(5,2),
  cpa                   numeric(5,2),
  t1tilt                numeric(5,2),
  t1pa                  numeric(5,2),
  l1tilt                numeric(5,2),
  sva                   numeric(5,2),      -- cm, requiere calibración de escala
  bmd_tscore            numeric(4,2),
  nvl                   smallint,          -- vértebras lordóticas (Roussouly)

  -- ── GAP score (Yilgor 2017) ──────────────────────────────────────────────
  gap_total             smallint,
  gap_category          text,
  gap_rpv               smallint,
  gap_rll               smallint,
  gap_ldi               smallint,
  gap_ldi_value         numeric(6,2),
  gap_rsa               smallint,
  gap_af                smallint,

  -- ── Eje T4-L1-cadera (Hills 2022) ────────────────────────────────────────
  hills_ideal_l1pa      numeric(5,2),
  hills_l1pa_diff       numeric(5,2),
  hills_ideal_ll        numeric(5,2),
  hills_axis_diff       numeric(5,2),
  hills_axis_status     text,

  -- ── Tilts vertebrales ────────────────────────────────────────────────────
  tilt_pt               numeric(5,2),
  tilt_c2_direct        numeric(5,2),
  tilt_c2_derived       numeric(5,2),
  tilt_c2_delta         numeric(5,2),
  tilt_c2_level         text,
  tilt_t1_direct        numeric(5,2),
  tilt_t1_derived       numeric(5,2),
  tilt_t1_delta         numeric(5,2),
  tilt_t1_level         text,
  tilt_l1_direct        numeric(5,2),
  tilt_l1_derived       numeric(5,2),
  tilt_l1_delta         numeric(5,2),
  tilt_l1_level         text,

  -- ── SRS-Schwab ───────────────────────────────────────────────────────────
  schwab_pi_ll          numeric(5,2),
  schwab_pi_ll_grade    text,
  schwab_pt_grade       text,
  schwab_sva_grade      text,

  -- ── Roussouly ────────────────────────────────────────────────────────────
  roussouly_current_key text,
  roussouly_ideal_key   text,
  roussouly_pi_match    text,
  roussouly_uncertain   text,

  -- ── GAP-B (Noh 2020) ─────────────────────────────────────────────────────
  -- Ojo: el artículo no publica el intercepto del modelo; el que usa la
  -- aplicación se fijó empíricamente. La probabilidad no es fiable en valor
  -- absoluto, solo como ordenamiento relativo.
  gapb_prob             numeric(6,4),
  gapb_category         text,

  -- ── Trazo del anotador (metadatos; los puntos van en tabla hija) ──────────
  lm_annotator_version  text,
  lm_image_width        integer,
  lm_image_height       integer,
  lm_image_name         text,
  lm_mm_per_px          numeric(10,6),
  lm_calib_ref_mm       numeric(7,2),
  lm_horiz_p1x          numeric(10,3),
  lm_horiz_p1y          numeric(10,3),
  lm_horiz_p2x          numeric(10,3),
  lm_horiz_p2y          numeric(10,3),
  lm_applied_at         timestamptz,
  -- Si es true, el usuario corrigió alguna medición a mano DESPUÉS de aplicar
  -- los landmarks: los puntos ya no explican los números y la fila no debe
  -- entrar tal cual en un análisis ni en el entrenamiento del modelo.
  lm_edited_after_apply boolean not null default false,

  -- Un caso privado siempre tiene dueño; uno público, nunca.
  constraint casos_visibilidad_coherente check (
    (visibility = 'private' and owner_uid is not null) or
    (visibility = 'public'  and owner_uid is null and public_id is not null)
  )
);

-- El listado del médico: equivale al índice compuesto de Firestore.
create index if not exists casos_owner_fecha_idx
  on public.casos (owner_uid, created_at desc)
  where visibility = 'private';

-- Búsqueda del caso público por su ID, sin distinguir mayúsculas.
create unique index if not exists casos_public_id_idx
  on public.casos (upper(public_id))
  where public_id is not null;

-- Consultas del dataset por momento quirúrgico.
create index if not exists casos_evaluation_idx on public.casos (evaluation_type, created_at desc);

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Tablas hijas
-- ───────────────────────────────────────────────────────────────────────────

-- Un renglón por landmark marcado. Las coordenadas están en píxeles del
-- espacio de la imagen, con el eje Y hacia abajo; para reproyectarlas hacen
-- falta lm_image_width / lm_image_height del caso.
create table if not exists public.caso_landmarks (
  caso_id     uuid not null references public.casos(id) on delete cascade,
  point_key   text not null,
  point_idx   smallint not null,
  x           numeric(10,3) not null,
  y           numeric(10,3) not null,
  primary key (caso_id, point_key)
);

create table if not exists public.caso_cirugias (
  caso_id     uuid not null references public.casos(id) on delete cascade,
  ord         smallint not null,
  tipo        text,
  tipo_custom text,
  segmentos   text[] not null default '{}',
  primary key (caso_id, ord)
);

create table if not exists public.caso_fotos (
  caso_id      uuid not null references public.casos(id) on delete cascade,
  foto_id      text not null,
  nombre       text,
  categoria    text,
  storage_path text,
  primary key (caso_id, foto_id)
);

-- ───────────────────────────────────────────────────────────────────────────
-- 4. Seguridad a nivel de fila
-- ───────────────────────────────────────────────────────────────────────────

alter table public.perfiles       enable row level security;
alter table public.casos          enable row level security;
alter table public.caso_landmarks enable row level security;
alter table public.caso_cirugias  enable row level security;
alter table public.caso_fotos     enable row level security;

-- ── Perfiles: cada quien ve y edita el suyo ──────────────────────────────
drop policy if exists perfiles_propio_select on public.perfiles;
create policy perfiles_propio_select on public.perfiles
  for select to authenticated using (id = auth.uid());

-- Solo el consentimiento y el nombre son editables por el usuario. `activo` NO:
-- se otorga desde el panel de Supabase. Si el usuario pudiera cambiarlo, la
-- autorización sería decorativa.
--
-- Se restringe con permisos POR COLUMNA y no dentro de la política: una
-- política sobre `perfiles` que consultara `perfiles` volvería a dispararse a
-- sí misma y entraría en recursión infinita.
drop policy if exists perfiles_propio_update on public.perfiles;
create policy perfiles_propio_update on public.perfiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

revoke update on public.perfiles from authenticated;
grant update (nombre, consent_version, consent_accepted_at) on public.perfiles to authenticated;

-- ── Casos clínicos: solo el dueño, y solo si está autorizado ──────────────
create or replace function public.perfil_activo()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select activo from public.perfiles where id = auth.uid()), false);
$$;

drop policy if exists casos_propios_select on public.casos;
create policy casos_propios_select on public.casos
  for select to authenticated
  using (visibility = 'private' and owner_uid = auth.uid());

drop policy if exists casos_propios_insert on public.casos;
create policy casos_propios_insert on public.casos
  for insert to authenticated
  with check (visibility = 'private' and owner_uid = auth.uid() and public.perfil_activo());

drop policy if exists casos_propios_update on public.casos;
create policy casos_propios_update on public.casos
  for update to authenticated
  using (owner_uid = auth.uid() and public.perfil_activo())
  with check (owner_uid = auth.uid());

drop policy if exists casos_propios_delete on public.casos;
create policy casos_propios_delete on public.casos
  for delete to authenticated using (owner_uid = auth.uid());

-- Los casos PÚBLICOS no tienen política de lectura a propósito: se leen con
-- obtener_caso_publico(), que exige el ID completo. Sin eso, un `select *`
-- desde el navegador los devolvería todos.

-- ── Tablas hijas: heredan el permiso del caso padre ───────────────────────
do $$
declare t text;
begin
  foreach t in array array['caso_landmarks', 'caso_cirugias', 'caso_fotos'] loop
    execute format('drop policy if exists %I_por_caso on public.%I', t, t);
    execute format($f$
      create policy %I_por_caso on public.%I
        for all to authenticated
        using (exists (select 1 from public.casos c where c.id = caso_id and c.owner_uid = auth.uid()))
        with check (exists (select 1 from public.casos c where c.id = caso_id and c.owner_uid = auth.uid()))
    $f$, t, t);
  end loop;
end $$;

-- ───────────────────────────────────────────────────────────────────────────
-- 5. Casos públicos: guardar y recuperar por ID
-- ───────────────────────────────────────────────────────────────────────────
-- Ambas funciones son SECURITY DEFINER y son la única puerta de entrada de los
-- usuarios anónimos. Guardar e insertar los hijos ocurre en una transacción, y
-- la lectura exige el ID completo.

create or replace function public.obtener_caso_publico(p_public_id text)
returns jsonb
language sql stable security definer set search_path = public
as $$
  -- Se quita device_id: es un identificador de seguimiento y no tiene por qué
  -- salir a cualquiera que conozca el ID del caso.
  select (to_jsonb(c) - 'device_id') || jsonb_build_object(
    'landmarks', coalesce((select jsonb_agg(jsonb_build_object('key', l.point_key, 'idx', l.point_idx, 'x', l.x, 'y', l.y) order by l.point_idx)
                           from public.caso_landmarks l where l.caso_id = c.id), '[]'::jsonb),
    'cirugias',  coalesce((select jsonb_agg(jsonb_build_object('tipo', s.tipo, 'tipoCustom', s.tipo_custom, 'segmentos', s.segmentos) order by s.ord)
                           from public.caso_cirugias s where s.caso_id = c.id), '[]'::jsonb)
  )
  from public.casos c
  where c.visibility = 'public' and upper(c.public_id) = upper(trim(p_public_id));
$$;

grant execute on function public.obtener_caso_publico(text) to anon, authenticated;

create or replace function public.guardar_caso_publico(p_caso jsonb, p_landmarks jsonb default '[]', p_cirugias jsonb default '[]')
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid := gen_random_uuid();
  v_public_id text := upper(trim(p_caso->>'public_id'));
  v_fila jsonb;
begin
  if v_public_id !~ '^GAP-[0-9]{4}-[A-Z0-9]{4}$' then
    raise exception 'ID de caso público con formato inválido: %', v_public_id;
  end if;

  -- jsonb_populate_record rellena con NULL toda columna ausente del payload, lo
  -- que ANULA los DEFAULT y viola los NOT NULL. Por eso los valores obligatorios
  -- se anteponen y los forzados se posponen: payload en medio.
  v_fila := jsonb_build_object(
              'schema_version', 2,
              'created_at', now(),
              'evaluation_type', 'preoperatorio',
              'lm_edited_after_apply', false
            ) || p_caso || jsonb_build_object(
              'id', v_id,
              'public_id', v_public_id,
              'visibility', 'public',
              'owner_uid', null,
              'owner_email', null
            );

  -- Volver a guardar el mismo ID sobrescribe: es intencional, el usuario puede
  -- corregir un caso y reguardarlo. El borrado arrastra las tablas hijas por
  -- ON DELETE CASCADE.
  delete from public.casos where upper(public_id) = v_public_id and visibility = 'public';

  insert into public.casos select * from jsonb_populate_record(null::public.casos, v_fila);

  insert into public.caso_landmarks (caso_id, point_key, point_idx, x, y)
  select v_id, e->>'key', (e->>'idx')::smallint, (e->>'x')::numeric, (e->>'y')::numeric
  from jsonb_array_elements(coalesce(p_landmarks, '[]'::jsonb)) e;

  insert into public.caso_cirugias (caso_id, ord, tipo, tipo_custom, segmentos)
  select v_id, (ord - 1)::smallint, e->>'tipo', e->>'tipoCustom',
         coalesce(array(select jsonb_array_elements_text(e->'segmentos')), '{}')
  from jsonb_array_elements(coalesce(p_cirugias, '[]'::jsonb)) with ordinality as t(e, ord);

  return v_public_id;
end;
$$;

grant execute on function public.guardar_caso_publico(jsonb, jsonb, jsonb) to anon, authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- 6. Telemetría
-- ───────────────────────────────────────────────────────────────────────────
-- El contador se incrementa con una función, no con un update desde el cliente:
-- en Firestore cualquiera podía escribirlo desde la consola del navegador.
--
-- No se traen `devices` ni `subscribers`. La primera solo alimentaba un
-- contador que la aplicación nunca lee; la segunda es una lista de correo que
-- corresponde al proveedor de mailing, no a la base de la aplicación.

create table if not exists public.stats (
  key   text primary key,
  count bigint not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.stats (key, count) values ('usage', 0) on conflict (key) do nothing;

alter table public.stats enable row level security;

drop policy if exists stats_lectura on public.stats;
create policy stats_lectura on public.stats for select to anon, authenticated using (true);

create or replace function public.incrementar_uso()
returns bigint
language sql security definer set search_path = public
as $$
  insert into public.stats (key, count, updated_at) values ('usage', 1, now())
  on conflict (key) do update set count = public.stats.count + 1, updated_at = now()
  returning count;
$$;

grant execute on function public.incrementar_uso() to anon, authenticated;

create table if not exists public.feedback (
  id         uuid primary key default gen_random_uuid(),
  rating     smallint check (rating between 1 and 5),
  comment    text,
  device_id  text,
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

-- Solo escritura: nadie puede leer las opiniones desde el navegador.
drop policy if exists feedback_insert on public.feedback;
create policy feedback_insert on public.feedback
  for insert to anon, authenticated with check (true);

-- ───────────────────────────────────────────────────────────────────────────
-- 7. Almacenamiento de radiografías
-- ───────────────────────────────────────────────────────────────────────────
-- Bucket privado. En Firebase, cualquier usuario de la allowlist podía leer y
-- escribir las imágenes de CUALQUIER caso: la propiedad no se validaba. Aquí sí.

insert into storage.buckets (id, name, public)
values ('casos', 'casos', false)
on conflict (id) do nothing;

drop policy if exists casos_imagenes_propias on storage.objects;
create policy casos_imagenes_propias on storage.objects
  for all to authenticated
  using (
    bucket_id = 'casos'
    and exists (select 1 from public.casos c
                where c.id::text = (storage.foldername(name))[1] and c.owner_uid = auth.uid())
  )
  with check (
    bucket_id = 'casos'
    and exists (select 1 from public.casos c
                where c.id::text = (storage.foldername(name))[1] and c.owner_uid = auth.uid())
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- Después de correr esto
-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Crear los usuarios de los cirujanos en Authentication → Users.
-- 2. Activarlos:  update public.perfiles set activo = true where email = '...';
--    El alta por sí sola NO autoriza a guardar casos.
-- 3. El dataset del artículo sale con un select sobre `casos`; los landmarks
--    para entrenar salen de `caso_landmarks` filtrando lm_edited_after_apply.
