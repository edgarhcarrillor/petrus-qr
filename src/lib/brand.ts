import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BUCKET } from "@/lib/constants";
import type { QrLogo } from "@/lib/qr-art";

export type OwnerSettings = { logo_path: string | null; logo_aspect: number | null };

export async function getOwnerSettings(supabase: SupabaseClient, ownerId: string): Promise<OwnerSettings | null> {
  const { data } = await supabase
    .from("owner_settings")
    .select("logo_path, logo_aspect")
    .eq("owner_id", ownerId)
    .maybeSingle();
  return data;
}

/** Logo de la empresa como data URI (para incrustarlo en el SVG del QR). */
export async function getOwnerLogo(supabase: SupabaseClient, ownerId: string): Promise<QrLogo | null> {
  const s = await getOwnerSettings(supabase, ownerId);
  if (!s?.logo_path || !s.logo_aspect) return null;
  const { data } = await supabase.storage.from(BUCKET).download(s.logo_path);
  if (!data) return null;
  const b64 = Buffer.from(await data.arrayBuffer()).toString("base64");
  return { dataUrl: `data:image/png;base64,${b64}`, aspect: s.logo_aspect };
}
