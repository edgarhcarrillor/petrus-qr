-- Petrus QR — texto en el centro del QR (marca, ej. «PetrusCore»)
-- Ejecutar en Supabase → SQL Editor (después de 0002).

alter table public.qr_codes
  add column if not exists center_label text
  check (center_label is null or char_length(center_label) <= 12);
