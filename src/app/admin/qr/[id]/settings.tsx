"use client";

import { useState, useTransition } from "react";
import { deleteQr, setQrActive, updateQrMeta } from "../../actions";

export function Settings({
  qrId,
  title,
  description,
  showLogo,
  hasLogo,
  isActive,
}: {
  qrId: string;
  title: string;
  description: string | null;
  showLogo: boolean;
  hasLogo: boolean;
  isActive: boolean;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <div className="card flex flex-col gap-5 p-5">
      <form
        action={(fd) =>
          start(async () => {
            const r = await updateQrMeta(qrId, fd);
            setMsg(r.ok ? { ok: true, text: "Guardado" } : { ok: false, text: r.error });
          })
        }
        className="flex flex-col gap-3"
      >
        <h2 className="font-semibold">Datos del QR</h2>
        <label className="field">
          <span>Nombre</span>
          <input name="title" defaultValue={title} required maxLength={120} />
        </label>
        <label className="field">
          <span>Descripción interna</span>
          <textarea name="description" defaultValue={description ?? ""} rows={2} maxLength={1000} />
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input name="show_logo" type="checkbox" defaultChecked={showLogo} className="mt-0.5 size-4 accent-brand" />
          <span>
            <span className="font-medium">Mostrar el logo en el centro del QR</span>
            <span className="block text-muted">
              {hasLogo ? "Usa el logo de la empresa." : "Aún no hay logo: súbelo en «Logo»."}
            </span>
          </span>
        </label>
        {msg && <p className={`text-sm ${msg.ok ? "text-ok" : "text-danger"}`}>{msg.text}</p>}
        <button className="btn self-start" disabled={pending}>
          Guardar
        </button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <div>
          <p className="text-sm font-medium">{isActive ? "QR activo" : "QR pausado"}</p>
          <p className="text-xs text-muted">
            {isActive ? "Muestra su contenido al escanearlo." : "Al escanearlo dice «no disponible»."}
          </p>
        </div>
        <button className="btn" disabled={pending} onClick={() => start(async () => void (await setQrActive(qrId, !isActive)))}>
          {isActive ? "Pausar" : "Activar"}
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="text-xs text-muted">Borrar elimina el QR, su historial y archivos. Los QR impresos dejarán de funcionar.</p>
        <button
          className="btn btn-danger"
          disabled={pending}
          onClick={() => {
            if (confirm(`¿Borrar «${title}» para siempre? Los QR impresos dejarán de funcionar.`)) {
              start(() => deleteQr(qrId));
            }
          }}
        >
          Borrar QR
        </button>
      </div>
    </div>
  );
}
