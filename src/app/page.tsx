import Link from "next/link";
import { Brand } from "@/components/brand";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 p-6">
      <Brand />
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        El QR no cambia.
        <br />
        <span className="text-brand">El contenido sí.</span>
      </h1>
      <p className="max-w-xl text-lg text-muted">
        Imprime un QR una sola vez y actualiza lo que muestra cuando quieras: planos, fotos, links
        o instrucciones. Los planos se ven en el teléfono sin descargar el archivo.
      </p>
      <div>
        <Link href="/admin" className="btn btn-primary">
          Ir al panel
        </Link>
      </div>
    </main>
  );
}
