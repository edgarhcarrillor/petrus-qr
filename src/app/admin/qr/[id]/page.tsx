import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { daysAgoIso } from "@/lib/format";
import type { QrCode, QrVersion } from "@/lib/types";
import { ContentEditor } from "./content-editor";
import { QrCard } from "./qr-card";
import { Settings } from "./settings";
import { VersionList } from "./version-list";

export const metadata = { title: "QR" };

export default function QrPage(props: PageProps<"/admin/qr/[id]">) {
  return (
    <>
      <Link href="/admin" className="text-sm text-muted hover:underline">
        ← Mis QR
      </Link>
      <Suspense fallback={<p className="mt-4 text-muted">Cargando…</p>}>
        <QrDetail params={props.params} />
      </Suspense>
    </>
  );
}

async function QrDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, user } = await requireUser();

  const since = daysAgoIso(30);
  const [qrRes, versionsRes, totalRes, monthRes] = await Promise.all([
    supabase.from("qr_codes").select("*").eq("id", id).maybeSingle(),
    supabase.from("qr_versions").select("*").eq("qr_id", id).order("created_at", { ascending: false }),
    supabase.from("qr_scans").select("id", { count: "exact", head: true }).eq("qr_id", id),
    supabase.from("qr_scans").select("id", { count: "exact", head: true }).eq("qr_id", id).gte("scanned_at", since),
  ]);
  const qr = qrRes.data as QrCode | null;
  if (!qr) notFound();
  const versions = (versionsRes.data ?? []) as QrVersion[];

  return (
    <div className="mt-2">
      <h1 className="mb-1 text-2xl font-semibold">{qr.title}</h1>
      {qr.description && <p className="mb-6 text-muted">{qr.description}</p>}

      <div className="mt-6 grid gap-6 lg:grid-cols-[18rem_1fr]">
        <div className="flex flex-col gap-6">
          <QrCard slug={qr.slug} title={qr.title} label={qr.center_label} />
          <div className="card grid grid-cols-2 divide-x divide-line text-center">
            <div className="p-4">
              <p className="text-2xl font-semibold">{totalRes.count ?? 0}</p>
              <p className="text-xs text-muted">escaneos totales</p>
            </div>
            <div className="p-4">
              <p className="text-2xl font-semibold">{monthRes.count ?? 0}</p>
              <p className="text-xs text-muted">últimos 30 días</p>
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <ContentEditor qrId={qr.id} ownerId={user.id} />
          <div className="card">
            <h2 className="border-b border-line p-5 font-semibold">Historial</h2>
            <VersionList qrId={qr.id} currentId={qr.current_version_id} versions={versions} />
          </div>
          <Settings qrId={qr.id} title={qr.title} description={qr.description}
            centerLabel={qr.center_label}
            isActive={qr.is_active}
          />
        </div>
      </div>
    </div>
  );
}
