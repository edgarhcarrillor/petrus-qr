import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente con service role: salta RLS. SOLO servidor.
 * Lo usa el visor público (/q y /v) para leer el QR y firmar URLs temporales.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
