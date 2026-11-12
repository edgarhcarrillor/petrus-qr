import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { getOwnerLogo } from "@/lib/brand";
import { LogoForm } from "./logo-form";

export const metadata = { title: "Logo" };

export default function LogoPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/admin" className="text-sm text-muted hover:underline">
        ← Mis QR
      </Link>
      <h1 className="mb-1 mt-2 text-2xl font-semibold">Logo de la empresa</h1>
      <p className="mb-6 text-muted">
        Va en el centro de todos tus QR, dentro de un recuadro blanco. Si no subes un logo, el QR sale
        completo, sin nada al centro.
      </p>
      <Suspense fallback={<p className="text-muted">Cargando…</p>}>
        <Current />
      </Suspense>
    </div>
  );
}

async function Current() {
  const { supabase, user } = await requireUser();
  const logo = await getOwnerLogo(supabase, user.id);
  return <LogoForm ownerId={user.id} current={logo} />;
}
