"use client";

import { useState, useTransition } from "react";
import { Download, RotateCcw, Trash2 } from "lucide-react";
import { KIND_LABEL } from "@/lib/constants";
import { fecha } from "@/lib/format";
import type { QrVersion } from "@/lib/types";
import { deleteVersion, originalDownloadUrl, setCurrentVersion } from "../../actions";

export function VersionList({
  qrId,
  currentId,
  versions,
}: {
  qrId: string;
  currentId: string | null;
  versions: QrVersion[];
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Error");
    });
  }

  async function download(path: string) {
    const url = await originalDownloadUrl(path);
    if (url) window.location.assign(url);
  }

  if (!versions.length) return <p className="p-5 text-sm text-muted">Aún no hay contenido publicado.</p>;

  return (
    <>
      {error && <p className="px-5 pt-4 text-sm text-danger">{error}</p>}
      <ul className="divide-y divide-line">
        {versions.map((v) => {
          const isCurrent = v.id === currentId;
          return (
            <li key={v.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {KIND_LABEL[v.kind]}
                  {v.pages.length > 0 && ` · ${v.pages.length} pág.`}
                  {v.searchable && " · 🔎 buscador"}
                  {isCurrent && (
                    <span className="ml-2 rounded-full bg-brand px-2 py-0.5 text-xs text-white">Actual</span>
                  )}
                </p>
                <p className="truncate text-xs text-muted">
                  {fecha(v.created_at)}
                  {v.original_name && ` · ${v.original_name}`}
                  {v.link_url && ` · ${v.link_url}`}
                </p>
              </div>
              <div className="flex gap-1">
                {v.original_path && (
                  <button className="btn px-2" title="Descargar original" onClick={() => download(v.original_path!)}>
                    <Download size={15} />
                  </button>
                )}
                {!isCurrent && (
                  <>
                    <button
                      className="btn px-2"
                      title="Volver a mostrar esta versión"
                      disabled={pending}
                      onClick={() => run(() => setCurrentVersion(qrId, v.id))}
                    >
                      <RotateCcw size={15} />
                    </button>
                    <button
                      className="btn btn-danger px-2"
                      title="Borrar versión"
                      disabled={pending}
                      onClick={() => {
                        if (confirm("¿Borrar esta versión y sus archivos?")) run(() => deleteVersion(qrId, v.id));
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
