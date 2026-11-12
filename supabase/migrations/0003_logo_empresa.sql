-- Petrus QR — logo de la empresa en el centro del QR
-- Ejecutar en Supabase → SQL Editor (después de 0002).
--
-- owner_settings  configuración por cuenta (cada cliente su logo).
--                 logo_path: PNG ya recortado y normalizado (fondo blanco),
--                 en Storage <owner_id>/brand/…; logo_aspect = ancho/alto.
-- qr_codes.show_logo  cada QR puede ocultar el logo (por defecto lo muestra).

create table if not exists public.owner_settings (
  owner_id    uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  logo_path   text,
  logo_aspect real check (logo_aspect is null or logo_aspect between 0.1 and 10),
  updated_at  timestamptz not null default now()
);

drop trigger if exists owner_settings_touch on public.owner_settings;
create trigger owner_settings_touch before update on public.owner_settings
  for each row execute function public.touch_updated_at();

alter table public.owner_settings enable row level security;

drop policy if exists "dueño gestiona su configuración" on public.owner_settings;
create policy "dueño gestiona su configuración" on public.owner_settings
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

revoke all on public.owner_settings from anon;
grant select, insert, update, delete on public.owner_settings to authenticated;
grant all on public.owner_settings to service_role;

alter table public.qr_codes
  add column if not exists show_logo boolean not null default true;
