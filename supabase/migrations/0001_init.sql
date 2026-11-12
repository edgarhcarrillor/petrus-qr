-- Petrus QR — esquema inicial
-- Ejecutar completo en Supabase → SQL Editor.
--
-- Modelo:
--   qr_codes     un QR impreso. Su `slug` NUNCA cambia (es lo que va dentro del QR).
--   qr_versions  cada contenido que se ha publicado en un QR (historial).
--                qr_codes.current_version_id apunta al que se muestra hoy.
--   qr_scans     registro de escaneos (estadísticas).
--
-- Multi-cliente desde el día 1: cada fila tiene owner_id y RLS restringe
-- todo al dueño. El visor público NO usa RLS: lee con la service role
-- desde el servidor y solo entrega URLs firmadas de corta duración.

create extension if not exists pgcrypto;

-- ─── Tablas ────────────────────────────────────────────────────────────────

create table if not exists public.qr_codes (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  slug               text not null unique check (slug ~ '^[A-Za-z0-9]{6,16}$'),
  title              text not null check (char_length(title) between 1 and 120),
  description        text check (char_length(description) <= 1000),
  is_active          boolean not null default true,
  current_version_id uuid,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists public.qr_versions (
  id            uuid primary key default gen_random_uuid(),
  qr_id         uuid not null references public.qr_codes(id) on delete cascade,
  owner_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind          text not null check (kind in ('pdf', 'image', 'link', 'text')),
  link_url      text check (link_url is null or link_url ~* '^https?://'),
  body          text check (char_length(body) <= 20000),
  original_path text,          -- archivo original (privado, solo admin)
  original_name text,
  pages         jsonb not null default '[]'::jsonb,  -- [{ "path": "...", "width": 0, "height": 0 }]
  created_at    timestamptz not null default now(),
  constraint qr_versions_kind_payload check (
    (kind = 'link'  and link_url is not null) or
    (kind = 'text'  and body is not null) or
    (kind in ('pdf', 'image') and jsonb_array_length(pages) > 0)
  )
);

alter table public.qr_codes
  drop constraint if exists qr_codes_current_version_fk;
alter table public.qr_codes
  add constraint qr_codes_current_version_fk
  foreign key (current_version_id) references public.qr_versions(id) on delete set null;

create table if not exists public.qr_scans (
  id         bigint generated always as identity primary key,
  qr_id      uuid not null references public.qr_codes(id) on delete cascade,
  scanned_at timestamptz not null default now(),
  country    text,
  user_agent text
);

create index if not exists qr_codes_owner_idx   on public.qr_codes (owner_id, created_at desc);
create index if not exists qr_versions_qr_idx   on public.qr_versions (qr_id, created_at desc);
create index if not exists qr_scans_qr_idx      on public.qr_scans (qr_id, scanned_at desc);

-- updated_at automático
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists qr_codes_touch on public.qr_codes;
create trigger qr_codes_touch before update on public.qr_codes
  for each row execute function public.touch_updated_at();

-- ─── Permisos de la Data API ───────────────────────────────────────────────
-- Explícitos, para que funcione aunque el proyecto tenga desactivado
-- "Automatically expose new tables". `anon` no recibe nada: el visor público
-- lee desde el servidor con la service role.

revoke all on public.qr_codes, public.qr_versions, public.qr_scans from anon;
grant select, insert, update, delete on public.qr_codes, public.qr_versions to authenticated;
grant select on public.qr_scans to authenticated;
grant all on public.qr_codes, public.qr_versions, public.qr_scans to service_role;
grant usage, select on sequence public.qr_scans_id_seq to service_role;

-- ─── RLS ───────────────────────────────────────────────────────────────────

alter table public.qr_codes    enable row level security;
alter table public.qr_versions enable row level security;
alter table public.qr_scans    enable row level security;

drop policy if exists "dueño gestiona sus QR" on public.qr_codes;
create policy "dueño gestiona sus QR" on public.qr_codes
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "dueño gestiona sus versiones" on public.qr_versions;
create policy "dueño gestiona sus versiones" on public.qr_versions
  for all to authenticated
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and exists (select 1 from public.qr_codes q where q.id = qr_id and q.owner_id = auth.uid())
  );

-- Los escaneos los inserta el servidor (service role). El dueño solo los lee.
drop policy if exists "dueño ve sus escaneos" on public.qr_scans;
create policy "dueño ve sus escaneos" on public.qr_scans
  for select to authenticated
  using (exists (select 1 from public.qr_codes q where q.id = qr_id and q.owner_id = auth.uid()));

-- ─── Storage ───────────────────────────────────────────────────────────────
-- Bucket PRIVADO. Rutas: <owner_id>/<qr_id>/<version_id>/<archivo>
-- Límite 50 MB por archivo (máximo del plan gratis de Supabase).

insert into storage.buckets (id, name, public, file_size_limit)
values ('qr-files', 'qr-files', false, 52428800)
on conflict (id) do update set public = false;

drop policy if exists "qr-files: dueño sube" on storage.objects;
create policy "qr-files: dueño sube" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'qr-files' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "qr-files: dueño lee" on storage.objects;
create policy "qr-files: dueño lee" on storage.objects
  for select to authenticated
  using (bucket_id = 'qr-files' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "qr-files: dueño borra" on storage.objects;
create policy "qr-files: dueño borra" on storage.objects
  for delete to authenticated
  using (bucket_id = 'qr-files' and (storage.foldername(name))[1] = auth.uid()::text);
