import type { Metadata } from "next";
import { Suspense } from "react";
import { Brand } from "@/components/brand";
import { getPublicQr, signPages } from "@/lib/public-qr";
import { Viewer } from "./viewer";

export const metadata: Metadata = {
  title: "Contenido",
  robots: { index: false, follow: false, nocache: true },
};

/** Visor público: /v/<slug>. Se llega aquí desde /q/<slug> o por link compartido. */
export default function ViewPage(props: PageProps<"/v/[slug]">) {
  return (
    <div className="flex h-dvh flex-col bg-neutral-900 text-white">
      <Suspense fallback={<Message title="Cargando…" />}>
        <Content params={props.params} />
      </Suspense>
    </div>
  );
}

async function Content({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const found = await getPublicQr(slug);

  if (!found) return <Message title="QR no encontrado" text="Este código no existe o fue eliminado." />;
  const { qr, version } = found;
  if (!qr.is_active) return <Message title="No disponible" text="Este contenido está pausado por ahora." />;
  if (!version) return <Message title={qr.title} text="Todavía no hay contenido publicado en este QR." />;

  if (version.kind === "link" && version.link_url) {
    return (
      <Message title={qr.title}>
        <a href={version.link_url} className="btn btn-primary mt-4" rel="noreferrer">
          Abrir enlace
        </a>
      </Message>
    );
  }

  const header = (
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-2.5">
      <div className="min-w-0">
        <h1 className="truncate text-sm font-semibold">{qr.title}</h1>
        {version.body && version.kind !== "text" && (
          <p className="truncate text-xs text-white/60">{version.body}</p>
        )}
      </div>
      <span className="shrink-0 text-xs text-white/50">Petrus QR</span>
    </header>
  );

  if (version.kind === "text") {
    return (
      <>
        {header}
        <main className="flex-1 overflow-y-auto bg-bg text-fg">
          <article className="mx-auto max-w-2xl whitespace-pre-wrap p-6 text-base leading-relaxed">
            {version.body}
          </article>
        </main>
      </>
    );
  }

  const pages = await signPages(version);
  if (!pages.length) return <Message title={qr.title} text="No se pudo cargar el contenido. Intenta de nuevo." />;

  return (
    <>
      {header}
      <Viewer pages={pages} title={qr.title} slug={qr.slug} searchable={version.kind === "pdf" && version.searchable} />
    </>
  );
}

function Message({ title, text, children }: { title: string; text?: string; children?: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
      <div className="mb-6 [&_span]:text-white">
        <Brand />
      </div>
      <h1 className="text-xl font-semibold">{title}</h1>
      {text && <p className="max-w-sm text-white/70">{text}</p>}
      {children}
    </main>
  );
}
