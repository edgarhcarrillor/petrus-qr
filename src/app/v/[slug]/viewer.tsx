"use client";

import { useEffect, useState } from "react";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import { ChevronLeft, ChevronRight, Maximize, Minus, Plus } from "lucide-react";
import type { SignedPage } from "@/lib/public-qr";

/**
 * Visor de planos: una página a la vez, zoom con pellizco / rueda / doble toque.
 * Solo recibe imágenes con marca de agua y URLs firmadas de pocos minutos.
 * Bloquea clic derecho, arrastrar y la vista previa del toque largo en iOS
 * (disuade la copia casual; un pantallazo siempre es posible).
 */
export function Viewer({ pages, title }: { pages: SignedPage[]; title: string }) {
  const [index, setIndex] = useState(0);
  const total = pages.length;
  const page = pages[index];

  useEffect(() => {
    const block = (e: Event) => e.preventDefault();
    document.addEventListener("contextmenu", block);
    document.addEventListener("dragstart", block);
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ["s", "p"].includes(e.key.toLowerCase())) e.preventDefault();
      if (e.key === "ArrowRight") setIndex((i) => Math.min(total - 1, i + 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("contextmenu", block);
      document.removeEventListener("dragstart", block);
      document.removeEventListener("keydown", onKey);
    };
  }, [total]);

  // Precarga la página siguiente para que el cambio sea instantáneo.
  useEffect(() => {
    const next = pages[index + 1];
    if (next) new Image().src = next.url;
  }, [index, pages]);

  if (!page) return null;

  return (
    <div className="viewer relative flex min-h-0 flex-1 flex-col bg-neutral-800">
      <TransformWrapper
        key={index}
        fitOnInit="contain"
        minScale={0.1}
        maxScale={16}
        centerOnInit
        doubleClick={{ mode: "toggle", step: 2.5 }}
        wheel={{ step: 0.15 }}
      >
        {({ zoomIn, zoomOut, fitToView }) => (
          <>
            <TransformComponent
              wrapperStyle={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada externa, sin optimizador */}
              <img
                src={page.url}
                width={page.width}
                height={page.height}
                alt={`${title} — página ${index + 1}`}
                draggable={false}
                className="max-w-none bg-white shadow-2xl"
                style={{ width: page.width / 2, height: "auto" }}
              />
            </TransformComponent>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-black/75 p-1 text-white shadow-lg backdrop-blur">
                <IconBtn label="Alejar" onClick={() => zoomOut(0.4)}>
                  <Minus size={18} />
                </IconBtn>
                <IconBtn label="Ajustar a pantalla" onClick={() => fitToView()}>
                  <Maximize size={16} />
                </IconBtn>
                <IconBtn label="Acercar" onClick={() => zoomIn(0.4)}>
                  <Plus size={18} />
                </IconBtn>
                {total > 1 && (
                  <>
                    <span className="mx-1 h-5 w-px bg-white/30" />
                    <IconBtn label="Página anterior" disabled={index === 0} onClick={() => setIndex(index - 1)}>
                      <ChevronLeft size={18} />
                    </IconBtn>
                    <span className="min-w-14 text-center text-sm tabular-nums">
                      {index + 1} / {total}
                    </span>
                    <IconBtn
                      label="Página siguiente"
                      disabled={index === total - 1}
                      onClick={() => setIndex(index + 1)}
                    >
                      <ChevronRight size={18} />
                    </IconBtn>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </TransformWrapper>
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="grid size-10 place-items-center rounded-full hover:bg-white/15 disabled:opacity-30"
    >
      {children}
    </button>
  );
}
