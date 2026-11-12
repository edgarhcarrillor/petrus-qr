"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { BUCKET, type ContentKind, type PageRef } from "@/lib/constants";
import { newSlug } from "@/lib/slug";

export type ActionResult = { ok: true } | { ok: false; error: string };

function clean(v: FormDataEntryValue | null, max: number) {
  return String(v ?? "").trim().slice(0, max);
}

export async function createQr(formData: FormData) {
  const { supabase, user } = await requireUser();
  const title = clean(formData.get("title"), 120);
  const description = clean(formData.get("description"), 1000) || null;
  if (!title) throw new Error("El nombre es obligatorio");

  // Reintenta ante el improbable choque de slug (unique).
  for (let i = 0; i < 5; i++) {
    const { data, error } = await supabase
      .from("qr_codes")
      .insert({ owner_id: user.id, slug: newSlug(), title, description })
      .select("id")
      .single();
    if (!error && data) {
      revalidatePath("/admin");
      redirect(`/admin/qr/${data.id}`);
    }
    if (error && error.code !== "23505") throw new Error(error.message);
  }
  throw new Error("No se pudo generar un código único, intenta de nuevo");
}

export async function updateQrMeta(qrId: string, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const title = clean(formData.get("title"), 120);
  if (!title) return { ok: false, error: "El nombre es obligatorio" };
  const { error } = await supabase
    .from("qr_codes")
    .update({ title, description: clean(formData.get("description"), 1000) || null })
    .eq("id", qrId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/qr/${qrId}`);
  return { ok: true };
}

export async function setQrActive(qrId: string, active: boolean): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("qr_codes").update({ is_active: active }).eq("id", qrId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/qr/${qrId}`);
  revalidatePath("/admin");
  return { ok: true };
}

export type PublishInput = {
  qrId: string;
  versionId: string;
  kind: ContentKind;
  linkUrl?: string;
  body?: string;
  originalPath?: string;
  originalName?: string;
  pages?: PageRef[];
};

/**
 * Registra una versión nueva y la deja como contenido actual del QR.
 * Los archivos ya fueron subidos por el navegador a <uid>/<qrId>/<versionId>/.
 */
export async function publishVersion(input: PublishInput): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const prefix = `${user.id}/${input.qrId}/${input.versionId}/`;
  const inPrefix = (p?: string) => !p || p.startsWith(prefix);

  if (!/^[0-9a-f-]{36}$/i.test(input.versionId)) return { ok: false, error: "Versión inválida" };
  if (!inPrefix(input.originalPath) || !(input.pages ?? []).every((p) => inPrefix(p.path))) {
    return { ok: false, error: "Ruta de archivo inválida" };
  }

  const row: Record<string, unknown> = {
    id: input.versionId,
    qr_id: input.qrId,
    owner_id: user.id,
    kind: input.kind,
  };
  if (input.kind === "link") {
    const url = (input.linkUrl ?? "").trim();
    try {
      const u = new URL(url);
      if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error();
    } catch {
      return { ok: false, error: "El link debe empezar con https://" };
    }
    row.link_url = url;
  } else if (input.kind === "text") {
    const body = (input.body ?? "").trim();
    if (!body) return { ok: false, error: "El texto está vacío" };
    row.body = body.slice(0, 20000);
  } else {
    if (!input.pages?.length) return { ok: false, error: "No hay páginas" };
    row.pages = input.pages;
    row.original_path = input.originalPath ?? null;
    row.original_name = input.originalName?.slice(0, 200) ?? null;
    row.body = input.body?.trim().slice(0, 20000) || null;
  }

  const { error: insErr } = await supabase.from("qr_versions").insert(row);
  if (insErr) return { ok: false, error: insErr.message };

  const { error: updErr } = await supabase
    .from("qr_codes")
    .update({ current_version_id: input.versionId })
    .eq("id", input.qrId);
  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath(`/admin/qr/${input.qrId}`);
  revalidatePath("/admin");
  return { ok: true };
}

export async function setCurrentVersion(qrId: string, versionId: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { data: v } = await supabase
    .from("qr_versions")
    .select("id")
    .eq("id", versionId)
    .eq("qr_id", qrId)
    .maybeSingle();
  if (!v) return { ok: false, error: "Versión no encontrada" };
  const { error } = await supabase.from("qr_codes").update({ current_version_id: versionId }).eq("id", qrId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/qr/${qrId}`);
  return { ok: true };
}

async function removeFolder(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], folder: string) {
  // Storage no borra carpetas: lista y borra archivos (y subcarpetas, 1 nivel).
  const { data } = await supabase.storage.from(BUCKET).list(folder, { limit: 1000 });
  if (!data?.length) return;
  const files: string[] = [];
  for (const item of data) {
    if (item.id) files.push(`${folder}/${item.name}`);
    else await removeFolder(supabase, `${folder}/${item.name}`);
  }
  if (files.length) await supabase.storage.from(BUCKET).remove(files);
}

export async function deleteVersion(qrId: string, versionId: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const { data: qr } = await supabase.from("qr_codes").select("current_version_id").eq("id", qrId).single();
  if (qr?.current_version_id === versionId) {
    return { ok: false, error: "No puedes borrar la versión que se está mostrando" };
  }
  const { error } = await supabase.from("qr_versions").delete().eq("id", versionId).eq("qr_id", qrId);
  if (error) return { ok: false, error: error.message };
  await removeFolder(supabase, `${user.id}/${qrId}/${versionId}`);
  revalidatePath(`/admin/qr/${qrId}`);
  return { ok: true };
}

export async function deleteQr(qrId: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("qr_codes").delete().eq("id", qrId);
  if (error) throw new Error(error.message);
  await removeFolder(supabase, `${user.id}/${qrId}`);
  revalidatePath("/admin");
  redirect("/admin");
}

/** URL firmada corta para que el admin descargue el archivo ORIGINAL. */
export async function originalDownloadUrl(path: string): Promise<string | null> {
  const { supabase, user } = await requireUser();
  if (!path.startsWith(`${user.id}/`)) return null;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60, { download: true });
  return data?.signedUrl ?? null;
}

export async function signOut() {
  const { supabase } = await requireUser();
  await supabase.auth.signOut();
  redirect("/login");
}
