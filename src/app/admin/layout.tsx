import Link from "next/link";
import { ImageIcon, LogOut } from "lucide-react";
import { Brand } from "@/components/brand";
import { signOut } from "./actions";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
          <Link href="/admin">
            <Brand />
          </Link>
          <div className="flex items-center gap-1">
            <Link href="/admin/logo" className="btn border-transparent px-2 text-muted" title="Logo de la empresa">
              <ImageIcon size={16} />
              <span className="hidden sm:inline">Logo</span>
            </Link>
            <form action={signOut}>
              <button className="btn border-transparent px-2 text-muted" title="Cerrar sesión">
                <LogOut size={16} />
                <span className="hidden sm:inline">Salir</span>
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
