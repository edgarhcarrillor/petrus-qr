"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Image as ImageIcon, Link2, Type, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BUCKET, KIND_LABEL, type ContentKind, type PageRef } from "@/lib/constants";
import { buildPage, type PlanIndex } from "@/lib/plan-index";
import { renderImage, renderPdf } from "@/lib/render-pages";
import { publishVersion, type ActionResult } from "../../actions";

const TABS: { kind: ContentKind; icon: typeof FileText }[] = [
  { kind: "pdf", icon: FileText },
  { kind: "image", icon: ImageIcon },
  { kind: "link", icon: Link2 },
  { kind: "text", icon: Type },
];

const MAX_FILE_MB = 50;
const WATERMARK = `${process.env.NEXT_PUBLIC_WATERMARK_TEXT || "Petrus Tech"} · Confidencial`;

export function ContentEditor({ qrId, ownerId }: { qrId: string; ownerId: string }) {
  const router = useRouter();
  const [kind, setKind] = useState<ContentKind>("pdf");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  async function uploadFile(fd: FormData, versionId: string): Promise<ActionResult> {
    const file = fd.get("file");
    if (!(file instanceof File) || !file.size) throw new Error("Selecciona un archivo");
    if (file.size > MAX_FILE_MB * 1024 * 1024) throw new Error(`El archivo supera ${MAX_FILE_MB} MB`);
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (kind === "pdf" && !isPdf) throw new Error("El archivo no es un PDF");
    if (kind === "image" && !file.type.startsWith("image/")) throw new Error("El archivo no es una imagen");

    setStatus("Procesando…");
    const rendered = isPdf
      ? await renderPdf(file, WATERMARK, (d, t) => setStatus(`Convirtiendo página ${d} de ${t}…`))
      : await renderImage(file, WATERMARK);

    const supabase = createClient();
    const prefix = `${ownerId}/${qrId}/${versionId}`;
    const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
    const originalPath = `${prefix}/original.${ext}`;

    setStatus("Subiendo original…");
    const up = await supabase.storage
      .from(BUCKET)
      .upload(originalPath, file, { contentType: file.type || undefined });
    if (up.error) throw new Error(up.error.message);

    // Índice de texto: nombre de cada hoja y, si es plano eléctrico, el buscador.
    const indexPages = rendered.map((p, i) => buildPage(p.text ?? [], i + 1));
    const searchable = kind === "pdf" && fd.get("searchable") === "on";
    let indexPath: string | undefined;
    if (searchable) {
      setStatus("Indexando marquillas…");
      const index: PlanIndex = { v: 1, pages: indexPages };
      indexPath = `${prefix}/index.json`;
      const r = await supabase.storage
        .from(BUCKET)
        .upload(indexPath, new Blob([JSON.stringify(index)], { type: "application/json" }), {
          contentType: "application/json",
        });
      if (r.error) throw new Error(r.error.message);
    }

    const pages: PageRef[] = [];
    for (const [i, p] of rendered.entries()) {
      setStatus(`Subiendo página ${i + 1} de ${rendered.length}…`);
      const path = `${prefix}/p${String(i + 1).padStart(3, "0")}.${p.ext}`;
      const r = await supabase.storage.from(BUCKET).upload(path, p.blob, { contentType: p.blob.type });
      if (r.error) throw new Error(r.error.message);
      pages.push({ path, width: p.width, height: p.height, name: isPdf ? indexPages[i].name : undefined });
    }

    setStatus("Publicando…");
    const result = await publishVersion({
      qrId,
      versionId,
      kind,
      pages,
      originalPath,
      originalName: file.name,
      body: String(fd.get("note") ?? ""),
      searchable,
      indexPath,
    });
    if (result.ok && searchable) {
      const textCount = indexPages.reduce((n, p) => n + p.items.length, 0);
      const rows = indexPages.reduce((n, p) => n + p.tables.reduce((m, t) => m + t.rows.length, 0), 0);
      const tablePages = indexPages.flatMap((p, i) => (p.tables.length ? [i + 1] : []));
      setSummary(
        !textCount
          ? "Ojo: el PDF no trae texto (parece escaneado o con letras convertidas a dibujo). El buscador no encontrará nada."
          : rows
          ? `Buscador activo: ${rows} filas de marquillas/tags leídas (hoja ${tablePages.join(", ")}).`
          : "Buscador activo, pero no se encontró una tabla de marquillas (columna «Marquilla» o «Tag»). Se buscará solo sobre el dibujo.",
      );
    }
    return result;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSummary(null);
    const fd = new FormData(e.currentTarget);
    const versionId = crypto.randomUUID();
    setBusy(true);
    try {
      const result =
        kind === "link"
          ? await publishVersion({ qrId, versionId, kind, linkUrl: String(fd.get("link") ?? "") })
          : kind === "text"
            ? await publishVersion({ qrId, versionId, kind, body: String(fd.get("body") ?? "") })
            : await uploadFile(fd, versionId);
      if (!result.ok) throw new Error(result.error);
      formRef.current?.reset();
      setStatus("Publicado ✓ El QR ya muestra el contenido nuevo.");
      startTransition(() => router.refresh());
    } catch (err) {
      setStatus(null);
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-5">
      <h2 className="mb-1 font-semibold">Publicar contenido nuevo</h2>
      <p className="mb-4 text-sm text-muted">
        Reemplaza lo que muestra el QR. Las versiones anteriores quedan en el historial.
      </p>

      <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-bg p-1 sm:grid-cols-4">
        {TABS.map(({ kind: k, icon: Icon }) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setKind(k);
              setError(null);
              setStatus(null);
            }}
            className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm ${
              kind === k ? "bg-surface font-medium shadow-sm" : "text-muted"
            }`}
          >
            <Icon size={15} /> {KIND_LABEL[k]}
          </button>
        ))}
      </div>

      <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-4">
        {(kind === "pdf" || kind === "image") && (
          <>
            <label className="field">
              <span>{kind === "pdf" ? "Archivo PDF" : "Imagen (JPG, PNG, WebP…)"}</span>
              <input
                key={kind}
                name="file"
                type="file"
                required
                accept={kind === "pdf" ? "application/pdf,.pdf" : "image/*"}
              />
            </label>
            {kind === "pdf" && (
              <label className="flex items-start gap-3 rounded-lg border border-line p-3 text-sm">
                <input name="searchable" type="checkbox" className="mt-0.5 size-4 accent-brand" />
                <span>
                  <span className="font-medium">Plano eléctrico: activar buscador de marquillas</span>
                  <span className="block text-muted">
                    El electricista podrá buscar una marquilla o tag (ej. 503, Q1) y ver dónde aparece
                    en cada hoja y qué dice la tabla de marquillas. Requiere un PDF con texto (exportado
                    desde CAD, no escaneado).
                  </span>
                </span>
              </label>
            )}
            <label className="field">
              <span>
                Nota visible <span className="font-normal text-muted">(opcional)</span>
              </span>
              <input name="note" maxLength={500} placeholder="Ej: Rev. C — actualizado nov 2026" />
            </label>
            <p className="text-xs text-muted">
              Se convierte a imágenes con la marca de agua «{WATERMARK}». Quien escanee el QR solo ve
              las imágenes; el archivo original queda privado y solo tú puedes descargarlo.
            </p>
          </>
        )}
        {kind === "link" && (
          <label className="field">
            <span>URL de destino</span>
            <input name="link" type="url" required placeholder="https://…" />
          </label>
        )}
        {kind === "text" && (
          <label className="field">
            <span>Texto</span>
            <textarea name="body" rows={6} required maxLength={20000} placeholder="Instrucciones, contactos…" />
          </label>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}
        {status && <p className="text-sm text-ok">{status}</p>}
        {summary && <p className="rounded-lg bg-bg p-3 text-sm">{summary}</p>}

        <button className="btn btn-primary" disabled={busy}>
          <Upload size={16} /> {busy ? "Publicando…" : "Publicar"}
        </button>
      </form>
    </div>
  );
}
