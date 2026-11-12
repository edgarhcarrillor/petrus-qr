import Link from "next/link";
import { Suspense } from "react";
import { FileText, Image as ImageIcon, Link2, Plus, Type } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { KIND_LABEL, type ContentKind } from "@/lib/constants";
import { fecha } from "@/lib/format";

export const metadata = { title: "Mis QR" };

const ICON: Record<ContentKind, typeof FileText> = {
  pdf: FileText,
  image: ImageIcon,
  link: Link2,
  text: Type,
};

export default function AdminHome() {
  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Mis QR</h1>
        <Link href="/admin/nuevo" className="btn btn-primary">
          <Plus size={16} /> Nuevo QR
        </Link>
      </div>
      <Suspense fallback={<p className="text-muted">Cargando…</p>}>
        <QrList />
      </Suspense>
    </>
  );
}

async function QrList() {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("qr_codes")
    .select("id, slug, title, is_active, updated_at, current:qr_versions!qr_codes_current_version_fk(kind)")
    .order("created_at", { ascending: false });

  if (error) return <p className="text-danger">Error al cargar: {error.message}</p>;
  if (!data?.length) {
    return (
      <div className="card p-10 text-center text-muted">
        Aún no tienes QR. Crea el primero con <strong>Nuevo QR</strong>.
      </div>
    );
  }

  return (
    <ul className="card divide-y divide-line">
      {data.map((qr) => {
        const current = (Array.isArray(qr.current) ? qr.current[0] : qr.current) as
          | { kind: ContentKind }
          | null;
        const Icon = current ? ICON[current.kind] : null;
        return (
          <li key={qr.id}>
            <Link href={`/admin/qr/${qr.id}`} className="flex items-center gap-4 p-4 hover:bg-bg">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-bg text-brand">
                {Icon ? <Icon size={18} /> : <span className="text-xs text-muted">—</span>}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{qr.title}</span>
                <span className="block text-sm text-muted">
                  {current ? KIND_LABEL[current.kind] : "Sin contenido"} · /q/{qr.slug} ·{" "}
                  {fecha(qr.updated_at)}
                </span>
              </span>
              {!qr.is_active && (
                <span className="rounded-full bg-warn-bg px-2 py-0.5 text-xs text-warn-fg">Pausado</span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
