"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TransformComponent, TransformWrapper, type ReactZoomPanPinchRef } from "react-zoom-pan-pinch";
import { ChevronLeft, ChevronRight, Maximize, Minus, Plus, RefreshCw } from "lucide-react";
import type { Box } from "@/lib/plan-index";
import type { SignedPage } from "@/lib/public-qr";
import { PlanSearch } from "./plan-search";

type Focus = { page: number; box: Box; seq: number };

/** Margen superior que ocupa la barra del buscador mientras se navega. */
const SEARCH_BAR = 64;

/**
 * Visor de planos: una página a la vez, zoom con pellizco / rueda / doble toque.
 * Solo recibe imágenes con marca de agua y URLs firmadas temporales.
 * Bloquea clic derecho, arrastrar y la vista previa del toque largo en iOS
 * (disuade la copia casual; un pantallazo siempre es posible).
 *
 * Con `searchable`, muestra el buscador de marquillas y hace zoom a cada
 * ubicación encontrada, resaltándola.
 */
export function Viewer({
  pages,
  title,
  slug,
  searchable,
}: {
  pages: SignedPage[];
  title: string;
  slug: string;
  searchable: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [expired, setExpired] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const boxRef = useRef<HTMLDivElement>(null);
  const twRef = useRef<ReactZoomPanPinchRef>(null);
  const total = pages.length;
  const page = pages[index];

  // Tamaño del área visible (para calcular el zoom a una marquilla).
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const block = (e: Event) => e.preventDefault();
    document.addEventListener("contextmenu", block);
    document.addEventListener("dragstart", block);
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ["s", "p"].includes(e.key.toLowerCase())) e.preventDefault();
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
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

  /** Posición y escala para centrar una caja de la página en pantalla. */
  const transformFor = useCallback(
    (p: SignedPage, box: Box) => {
      const W = size.w || window.innerWidth;
      const H = (size.h || window.innerHeight) - SEARCH_BAR;
      const cw = p.width / 2, ch = p.height / 2; // tamaño CSS de la página a escala 1
      const bw = box.w * cw, bh = box.h * ch;
      const scale = Math.min(6, Math.max(0.3, Math.min(W / (bw + 220), H / (bh + 160))));
      const cx = (box.x + box.w / 2) * cw;
      const cy = (box.y + box.h / 2) * ch;
      return { x: W / 2 - cx * scale, y: SEARCH_BAR + H / 2 - cy * scale, scale };
    },
    [size],
  );

  const onSearchFocus = useCallback(
    (p: number, box: Box) => {
      setFocus((f) => ({ page: p, box, seq: (f?.seq ?? 0) + 1 }));
      if (p === index) {
        const t = transformFor(pages[p], box);
        twRef.current?.setTransform(t.x, t.y, t.scale, 450, "easeOut");
      } else {
        setIndex(p); // al montar la hoja nueva, arranca ya enfocada (initial*)
      }
    },
    [index, pages, transformFor],
  );

  if (!page) return null;

  const initial = focus && focus.page === index ? transformFor(page, focus.box) : null;
  const pad = 0.004;

  return (
    <div ref={boxRef} className="viewer relative flex min-h-0 flex-1 flex-col overflow-hidden bg-neutral-800">
      {searchable && (
        <PlanSearch slug={slug} pages={pages} onFocus={onSearchFocus} onClear={() => setFocus(null)} />
      )}

      <TransformWrapper
        key={index}
        ref={twRef}
        minScale={0.1}
        maxScale={16}
        limitToBounds={false}
        doubleClick={{ mode: "toggle", step: 2.5 }}
        wheel={{ step: 0.15 }}
        {...(initial
          ? { initialScale: initial.scale, initialPositionX: initial.x, initialPositionY: initial.y }
          : { fitOnInit: "contain" as const, centerOnInit: true })}
      >
        {({ zoomIn, zoomOut, fitToView }) => (
          <>
            <TransformComponent
              wrapperStyle={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}
            >
              <div className="relative bg-white shadow-2xl" style={{ width: page.width / 2, height: page.height / 2 }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada externa, sin optimizador */}
                <img
                  src={page.url}
                  width={page.width}
                  height={page.height}
                  alt={`${title} — ${page.name ?? `página ${index + 1}`}`}
                  draggable={false}
                  onError={() => setExpired(true)}
                  className="block h-full w-full max-w-none"
                />
                {focus && focus.page === index && (
                  <div
                    key={focus.seq}
                    className="pointer-events-none absolute animate-[pulse_1.2s_ease-in-out_3] rounded-sm border-[3px] border-red-500 bg-red-500/10 shadow-[0_0_0_4px_rgba(239,68,68,0.25)]"
                    style={{
                      left: `${(focus.box.x - pad) * 100}%`,
                      top: `${(focus.box.y - pad) * 100}%`,
                      width: `${(focus.box.w + pad * 2) * 100}%`,
                      height: `${(focus.box.h + pad * 2) * 100}%`,
                    }}
                  />
                )}
              </div>
            </TransformComponent>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {page.name && total > 1 && (
                <span className="max-w-full truncate rounded-full bg-black/60 px-3 py-1 text-xs text-white/90">
                  {page.name}
                </span>
              )}
              <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-black/75 p-1 text-white shadow-lg backdrop-blur">
                <IconBtn label="Alejar" onClick={() => zoomOut(0.4)}>
                  <Minus size={18} />
                </IconBtn>
                <IconBtn label="Ver hoja completa" onClick={() => fitToView()}>
                  <Maximize size={16} />
                </IconBtn>
                <IconBtn label="Acercar" onClick={() => zoomIn(0.4)}>
                  <Plus size={18} />
                </IconBtn>
                {total > 1 && (
                  <>
                    <span className="mx-1 h-5 w-px bg-white/30" />
                    <IconBtn label="Hoja anterior" disabled={index === 0} onClick={() => setIndex(index - 1)}>
                      <ChevronLeft size={18} />
                    </IconBtn>
                    <span className="min-w-14 text-center text-sm tabular-nums">
                      {index + 1} / {total}
                    </span>
                    <IconBtn
                      label="Hoja siguiente"
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

      {expired && (
        <button
          onClick={() => window.location.reload()}
          className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-neutral-900/90 text-white"
        >
          <RefreshCw size={28} />
          <span className="font-medium">El enlace del plano expiró</span>
          <span className="text-sm text-white/70">Toca para recargar</span>
        </button>
      )}
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
