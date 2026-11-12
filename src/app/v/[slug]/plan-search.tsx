"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, List, Search, Table2, X } from "lucide-react";
import type { Box, SearchHit, SearchResult, SearchRow } from "@/lib/plan-index";
import type { SignedPage } from "@/lib/public-qr";

type Mode = "idle" | "open" | "nav";

/**
 * Buscador de marquillas sobre el visor.
 *  - idle: barra de búsqueda.
 *  - open: panel con la ficha de la tabla de marquillas + ubicaciones.
 *  - nav:  barra compacta «503 · 2 de 5 ‹ ›» mientras se mira el plano.
 */
export function PlanSearch({
  slug,
  pages,
  onFocus,
  onClear,
}: {
  slug: string;
  pages: SignedPage[];
  onFocus: (page: number, box: Box) => void;
  onClear: () => void;
}) {
  const [mode, setMode] = useState<Mode>("idle");
  const [q, setQ] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState<{ kind: "hit" | "row"; i: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    const term = q.trim();
    if (!term) return;
    inputRef.current?.blur();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/v/${encodeURIComponent(slug)}/buscar?q=${encodeURIComponent(term)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al buscar");
      setResult(data as SearchResult);
      setCurrent(null);
      setMode("open");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al buscar");
    } finally {
      setLoading(false);
    }
  }

  function goHit(i: number) {
    const hit = result?.hits[i];
    if (!hit) return;
    setCurrent({ kind: "hit", i });
    setMode("nav");
    onFocus(hit.page, hit.box);
  }

  function goRow(i: number) {
    const row = result?.rows[i];
    if (!row) return;
    setCurrent({ kind: "row", i });
    setMode("nav");
    onFocus(row.page, row.box);
  }

  function clear() {
    setResult(null);
    setCurrent(null);
    setMode("idle");
    setError(null);
    onClear();
  }

  const hits = result?.hits ?? [];
  const rows = result?.rows ?? [];
  const pageName = (p: number) => pages[p]?.name || `Hoja ${p + 1}`;

  // ── Barra compacta mientras se navega ──
  if (mode === "nav" && result && current) {
    const isHit = current.kind === "hit";
    const total = isHit ? hits.length : rows.length;
    const target = isHit ? hits[current.i] : rows[current.i];
    const go = isHit ? goHit : goRow;
    return (
      <div className="absolute inset-x-0 top-0 z-20 p-2">
        <div className="mx-auto flex max-w-xl items-center gap-1 rounded-xl bg-white p-1 text-neutral-900 shadow-lg">
          <NavBtn label="Anterior" disabled={current.i === 0} onClick={() => go(current.i - 1)}>
            <ChevronLeft size={20} />
          </NavBtn>
          <button
            type="button"
            onClick={() => setMode("open")}
            className="min-w-0 flex-1 rounded-lg px-2 py-1 text-left hover:bg-neutral-100"
          >
            <span className="block truncate text-sm font-semibold">
              {result.q}
              <span className="font-normal text-neutral-500">
                {" "}
                · {isHit ? `${current.i + 1} de ${total}` : "tabla de marquillas"}
              </span>
            </span>
            <span className="block truncate text-xs text-neutral-500">{pageName(target.page)}</span>
          </button>
          <NavBtn label="Siguiente" disabled={current.i >= total - 1} onClick={() => go(current.i + 1)}>
            <ChevronRight size={20} />
          </NavBtn>
          <NavBtn label="Ver resultados" onClick={() => setMode("open")}>
            <List size={18} />
          </NavBtn>
          <NavBtn label="Cerrar búsqueda" onClick={clear}>
            <X size={18} />
          </NavBtn>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-x-0 top-0 z-20 flex max-h-full flex-col p-2">
      <div className="mx-auto flex w-full max-w-xl flex-col overflow-hidden rounded-xl bg-white text-neutral-900 shadow-lg">
        <form onSubmit={search} className="flex items-center gap-2 p-2">
          <Search size={18} className="ml-1 shrink-0 text-neutral-400" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar marquilla o tag (ej. 503, Q1)"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            maxLength={40}
            className="min-w-0 flex-1 bg-transparent py-1.5 text-base outline-none placeholder:text-neutral-400"
          />
          {result && (
            <button type="button" onClick={clear} aria-label="Limpiar" className="p-1 text-neutral-400">
              <X size={18} />
            </button>
          )}
          <button
            disabled={loading || !q.trim()}
            className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
          >
            {loading ? "…" : "Buscar"}
          </button>
        </form>
        {error && <p className="border-t border-neutral-200 px-3 py-2 text-sm text-danger">{error}</p>}

        {mode === "open" && result && (
          <div className="max-h-[70dvh] overflow-y-auto border-t border-neutral-200">
            {!rows.length && !hits.length && (
              <p className="p-4 text-sm text-neutral-600">
                No se encontró <strong>{result.q}</strong> en este plano.
              </p>
            )}

            {rows.length > 0 && (
              <section className="p-3">
                <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  <Table2 size={14} /> Tabla de marquillas
                  {rows.length > 1 && (
                    <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 normal-case tracking-normal text-amber-800">
                      {rows.length} filas con este código
                    </span>
                  )}
                </h2>
                <ul className="flex flex-col gap-2">
                  {rows.map((row, i) => (
                    <li key={i}>
                      <RowCard row={row} pageName={pageName(row.page)} onView={() => goRow(i)} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {hits.length > 0 && (
              <section className="border-t border-neutral-100 p-3">
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Dónde aparece en el plano · {hits.length}
                </h2>
                <ul className="flex flex-col gap-2">
                  {hits.map((hit, i) => (
                    <li key={i}>
                      <HitCard
                        hit={hit}
                        q={result.q}
                        page={pages[hit.page]}
                        pageName={pageName(hit.page)}
                        active={current?.kind === "hit" && current.i === i}
                        onView={() => goHit(i)}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function RowCard({ row, pageName, onView }: { row: SearchRow; pageName: string; onView: () => void }) {
  const idx = (re: RegExp) => row.headers.findIndex((h) => re.test(h));
  const from = idx(/desde|origen/i);
  const to = idx(/hasta|destino/i);
  const shown = new Set([0, from, to]);
  const extra = row.headers
    .map((h, k) => ({ h: h.replace(/\s*\(.*\)\s*$/, ""), v: row.cells[k], k }))
    .filter((c) => !shown.has(c.k) && c.v);

  return (
    <div className="rounded-lg border border-neutral-200 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-lg font-bold leading-tight">{row.cells[0]}</p>
        <button
          onClick={onView}
          className="shrink-0 rounded-md border border-neutral-300 px-2 py-1 text-xs font-medium hover:bg-neutral-100"
        >
          Ver en tabla
        </button>
      </div>
      {from >= 0 && to >= 0 ? (
        <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <span className="text-neutral-500">Desde</span>
          <span className="font-medium">{row.cells[from] || "—"}</span>
          <span className="text-neutral-500">Hasta</span>
          <span className="font-medium">{row.cells[to] || "—"}</span>
        </div>
      ) : null}
      {extra.length > 0 && (
        <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {extra.map((c) => (
            <div key={c.k} className="flex gap-1">
              <dt className="text-neutral-500">{c.h}:</dt>
              <dd>{c.v}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="mt-2 truncate text-xs text-neutral-400">{pageName}</p>
    </div>
  );
}

function HitCard({
  hit,
  q,
  page,
  pageName,
  active,
  onView,
}: {
  hit: SearchHit;
  q: string;
  page?: SignedPage;
  pageName: string;
  active: boolean;
  onView: () => void;
}) {
  const showText = hit.text.replace(/\s+/g, "").toUpperCase() !== q;
  return (
    <button
      onClick={onView}
      className={`flex w-full items-center gap-3 rounded-lg border p-2 text-left hover:bg-neutral-50 ${
        active ? "border-brand ring-2 ring-brand/20" : "border-neutral-200"
      }`}
    >
      {page && <Crop page={page} box={hit.box} />}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{pageName}</span>
        {showText && <span className="line-clamp-2 text-xs text-neutral-500">«{hit.text}»</span>}
      </span>
      <span className="shrink-0 rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white">Ver</span>
    </button>
  );
}

/** Recorte ampliado de la zona del plano donde está la marquilla. */
function Crop({ page, box }: { page: SignedPage; box: Box }) {
  const W = 112, H = 76;
  const aspect = page.width / page.height;
  let rw = Math.min(1, Math.max(box.w * 5, 0.07));
  let rh = (rw * aspect * H) / W;
  if (rh > 1) {
    rh = 1;
    rw = (W / H) / aspect;
  }
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  const rx = clamp(cx - rw / 2, 0, 1 - rw);
  const ry = clamp(cy - rh / 2, 0, 1 - rh);
  const pos = (r: number, s: number) => (s >= 1 ? 0 : (r / (1 - s)) * 100);
  return (
    <span
      className="relative block shrink-0 overflow-hidden rounded-md border border-neutral-200 bg-white"
      style={{
        width: W,
        height: H,
        backgroundImage: `url("${page.url}")`,
        backgroundSize: `${100 / rw}% ${100 / rh}%`,
        backgroundPosition: `${pos(rx, rw)}% ${pos(ry, rh)}%`,
      }}
    >
      <span
        className="absolute rounded-sm border-2 border-red-500"
        style={{
          left: `${((box.x - rx) / rw) * 100}%`,
          top: `${((box.y - ry) / rh) * 100}%`,
          width: `${(box.w / rw) * 100}%`,
          height: `${(box.h / rh) * 100}%`,
          margin: -3,
          boxSizing: "content-box",
          padding: 1,
        }}
      />
    </span>
  );
}

function clamp(v: number, a: number, b: number) {
  return Math.min(Math.max(v, a), Math.max(a, b));
}

function NavBtn({
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
      className="grid size-10 shrink-0 place-items-center rounded-lg hover:bg-neutral-100 disabled:opacity-30"
    >
      {children}
    </button>
  );
}
