"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImageUp, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BUCKET } from "@/lib/constants";
import { buildQrSvg, processLogo, type QrLogo } from "@/lib/qr-art";
import { removeLogo, saveLogo } from "../actions";

const SAMPLE_URL = "https://qr.petrustechgroup.com/q/Ab3dEf7";

export function LogoForm({ ownerId, current }: { ownerId: string; current: QrLogo | null }) {
  const router = useRouter();
  const [draft, setDraft] = useState<{ logo: QrLogo; blob: Blob } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, start] = useTransition();

  const shown = draft?.logo ?? current;
  const preview = useMemo(() => buildQrSvg(SAMPLE_URL, shown), [shown]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    setMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { blob, aspect, dataUrl } = await processLogo(file);
      setDraft({ logo: { dataUrl, aspect }, blob });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo leer el logo");
    }
  }

  async function save() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const path = `${ownerId}/brand/logo-${Date.now()}.png`;
      const up = await createClient().storage.from(BUCKET).upload(path, draft.blob, { contentType: "image/png" });
      if (up.error) throw new Error(up.error.message);
      const r = await saveLogo(path, draft.logo.aspect);
      if (!r.ok) throw new Error(r.error);
      setDraft(null);
      setMsg("Logo guardado. Ya aparece en tus QR.");
      start(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("¿Quitar el logo? Los QR volverán a salir sin nada al centro.")) return;
    setBusy(true);
    const r = await removeLogo();
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setDraft(null);
    setMsg("Logo quitado.");
    start(() => router.refresh());
  }

  return (
    <div className="grid gap-6 sm:grid-cols-[1fr_15rem]">
      <div className="card flex flex-col gap-4 p-5">
        <label className="field">
          <span>Archivo del logo (SVG, PNG o JPG)</span>
          <input type="file" accept=".svg,.png,.jpg,.jpeg,image/svg+xml,image/png,image/jpeg" onChange={onFile} />
        </label>
        <ul className="list-disc pl-5 text-sm text-muted">
          <li>
            Ideal: <strong>SVG</strong>, o PNG de al menos 512 px.
          </li>
          <li>Fondo blanco o transparente, logo oscuro. El margen sobrante se recorta solo.</li>
          <li>Versión simple (ícono o nombre), sin letra chica: dentro del QR mide ~1 cm.</li>
        </ul>

        {draft && (
          <p className="rounded-lg bg-bg p-3 text-sm">
            Mira la vista previa. Si te gusta, guárdalo: se aplica a todos tus QR.
          </p>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
        {msg && <p className="text-sm text-ok">{msg}</p>}

        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={save} disabled={!draft || busy}>
            <ImageUp size={16} /> {busy ? "Guardando…" : "Guardar logo"}
          </button>
          {current && !draft && (
            <button className="btn btn-danger" onClick={remove} disabled={busy}>
              <Trash2 size={16} /> Quitar logo
            </button>
          )}
          {draft && (
            <button className="btn" onClick={() => setDraft(null)} disabled={busy}>
              Cancelar
            </button>
          )}
        </div>
      </div>

      <div className="card p-4">
        <p className="mb-2 text-center text-xs font-medium uppercase tracking-wide text-muted">
          {draft ? "Vista previa" : current ? "Logo actual" : "Sin logo"}
        </p>
        <div
          className="aspect-square w-full [&>svg]:h-full [&>svg]:w-full"
          // SVG generado localmente; el logo va como data URI PNG ya procesado.
          dangerouslySetInnerHTML={{ __html: preview }}
        />
        <p className="mt-2 text-center text-xs text-muted">QR de ejemplo</p>
      </div>
    </div>
  );
}
