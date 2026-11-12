import "server-only";
import { cacheLife } from "next/cache";
import { searchIndex, type PlanIndex, type SearchResult } from "@/lib/plan-index";
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

export type SignedPage = { url: string; width: number; height: number; name?: string };

/** URLs firmadas de vida corta para las imágenes de página. Nunca el original. */
export async function signPages(version: QrVersion): Promise<SignedPage[]> {
  if (!version.pages.length) return [];
  const db = createAdminClient();
  const { data, error } = await db.storage
    .from(BUCKET)
    .createSignedUrls(version.pages.map((p) => p.path), SIGNED_URL_TTL);
  if (error || !data) return [];
  return version.pages.flatMap((p, i) =>
    data[i]?.signedUrl ? [{ url: data[i].signedUrl, width: p.width, height: p.height, name: p.name }] : [],
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

/**
 * Índice de texto de una versión. Es inmutable (cada versión tiene su propio
 * archivo), así que se cachea en el servidor sin vencimiento.
 */
async function loadIndex(path: string): Promise<PlanIndex> {
  "use cache";
  cacheLife("max");
  // Errores se lanzan (no se cachean) para reintentar en la próxima búsqueda.
  const db = createAdminClient();
  const { data, error } = await db.storage.from(BUCKET).download(path);
  if (error || !data) throw new Error(`No se pudo leer el índice: ${error?.message}`);
  const json = JSON.parse(await data.text()) as PlanIndex;
  if (json?.v !== 1 || !Array.isArray(json.pages)) throw new Error("Índice inválido");
  return json;
}

/** Busca en el plano actual de un QR. null = QR sin buscador o inexistente. */
export async function searchPlan(slug: string, q: string): Promise<SearchResult | null> {
  const found = await getPublicQr(slug);
  const v = found?.version;
  if (!found?.qr.is_active || !v?.searchable || !v.index_path) return null;
  try {
    return searchIndex(await loadIndex(v.index_path), q, 120);
  } catch {
    return null;
  }
}
