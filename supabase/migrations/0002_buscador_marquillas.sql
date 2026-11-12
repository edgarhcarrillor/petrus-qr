-- Petrus QR — buscador de marquillas (planos eléctricos)
-- Ejecutar en Supabase → SQL Editor (después de 0001).
--
-- searchable  la versión es un plano eléctrico con buscador activado.
-- index_path  JSON en Storage con el texto de cada hoja (posiciones) y las
--             tablas de marquillas/tags. Lo genera el navegador del admin al
--             publicar; el visor solo recibe los resultados de cada búsqueda.

alter table public.qr_versions
  add column if not exists searchable boolean not null default false,
  add column if not exists index_path text;
