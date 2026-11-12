import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKET, SIGNED_URL_TTL } from "@/lib/constants";
import type { QrCode, QrVersion } from "@/lib/types";

const SLUG_RE = /^[A-Za-z0-9]{6,16}$/;

export type PublicQr = {
  qr: Pick<QrCode, "id" | "slug" | "title" | "is_active">;
  version: QrVersion | null;
};

/** Lee un QR por slug saltando RLS. Devuelve null si no existe. Solo servidor. */
export async function getPublicQr(slug: string): Promise<PublicQr | null> {
  if (!SLUG_RE.test(slug)) return null;
  const db = createAdminClient();
  const { data: qr } = await db
    .from("qr_codes")
    .select("id, slug, title, is_active, current_version_id")
    .eq("slug", slug)
    .maybeSingle();
  if (!qr) return null;

  let version: QrVersion | null = null;
  if (qr.current_version_id) {
    const { data } = await db.from("qr_versions").select("*").eq("id", qr.current_version_id).maybeSingle();
    version = (data as QrVersion) ?? null;
  }
  return { qr, version };
}

export type SignedPage = { url: string; width: number; height: number };

/** URLs firmadas de vida corta para las imágenes de página. Nunca el original. */
export async function signPages(version: QrVersion): Promise<SignedPage[]> {
  if (!version.pages.length) return [];
  const db = createAdminClient();
  const { data, error } = await db.storage
    .from(BUCKET)
    .createSignedUrls(version.pages.map((p) => p.path), SIGNED_URL_TTL);
  if (error || !data) return [];
  return version.pages.flatMap((p, i) =>
    data[i]?.signedUrl ? [{ url: data[i].signedUrl, width: p.width, height: p.height }] : [],
  );
}

export async function logScan(qrId: string, country: string | null, userAgent: string | null) {
  const db = createAdminClient();
  await db.from("qr_scans").insert({
    qr_id: qrId,
    country: country?.slice(0, 8) ?? null,
    user_agent: userAgent?.slice(0, 300) ?? null,
  });
}
