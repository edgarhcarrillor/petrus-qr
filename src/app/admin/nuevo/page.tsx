import Link from "next/link";
import { createQr } from "../actions";

export const metadata = { title: "Nuevo QR" };

export default function NuevoQr() {
  return (
    <div className="mx-auto max-w-lg">
      <Link href="/admin" className="text-sm text-muted hover:underline">
        ← Mis QR
      </Link>
      <h1 className="mb-6 mt-2 text-2xl font-semibold">Nuevo QR</h1>
      <form action={createQr} className="card flex flex-col gap-4 p-6">
        <label className="field">
          <span>Nombre</span>
          <input name="title" required maxLength={120} placeholder="Gabinete comunicaciones — Piso 3" />
        </label>
        <label className="field">
          <span>
            Descripción <span className="font-normal text-muted">(opcional, solo la ves tú)</span>
          </span>
          <textarea name="description" rows={3} maxLength={1000} placeholder="Ubicación, cliente, notas…" />
        </label>
        <p className="text-sm text-muted">
          Al crearlo se genera un código fijo. Después le subes el contenido (planos, foto, link o
          texto) y lo puedes cambiar cuando quieras sin reimprimir el QR.
        </p>
        <button className="btn btn-primary">Crear QR</button>
      </form>
    </div>
  );
}
