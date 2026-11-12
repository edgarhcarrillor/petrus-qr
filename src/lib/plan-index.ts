/**
 * Índice de texto de planos (buscador de marquillas).
 *
 * Módulo puro, sin dependencias: corre en el navegador del admin (al publicar)
 * y en el servidor (al buscar). Todas las coordenadas están normalizadas 0..1
 * respecto de la página tal como se ve (rotación incluida), así calzan con las
 * imágenes renderizadas sin importar su resolución.
 */

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type Box = { x: number; y: number; w: number; h: number };

/** Dirección de lectura en pantalla: h →, l ←, u ↑, d ↓. */
type Dir = "h" | "l" | "u" | "d";

/** [texto, x, y, w, h, dir] — tupla para que el JSON sea compacto. */
export type TextItem = [string, number, number, number, number, Dir];

export type IndexTable = {
  /** Encabezados de columna, p. ej. ["Marquilla", "Desde (equipo : borne)", …]. */
  headers: string[];
  rows: { cells: string[]; box: Box }[];
};

export type IndexPage = {
  name: string;
  items: TextItem[];
  tables: IndexTable[];
  /** Índices de items que pertenecen a tablas (no se listan como ubicaciones). */
  tableItems: number[];
};

export type PlanIndex = { v: 1; pages: IndexPage[] };

// Subconjunto de pdf.js que usamos (evita depender de sus tipos aquí).
type PdfTextItem = { str: string; transform: number[]; width: number; height: number };
type PdfViewport = {
  width: number;
  height: number;
  convertToViewportPoint(x: number, y: number): number[];
};

// ─── Extracción ─────────────────────────────────────────────────────────────

const r4 = (n: number) => Math.round(n * 10000) / 10000;

/** Convierte los textos de una página de pdf.js en cajas normalizadas. */
export function extractItems(raw: unknown[], viewport: PdfViewport): TextItem[] {
  const out: TextItem[] = [];
  for (const it of raw as PdfTextItem[]) {
    const str = typeof it?.str === "string" ? it.str.replace(/\s+/g, " ").trim() : "";
    if (!str || !it.transform) continue;
    const [a, b, c, d, e, f] = it.transform;
    const la = Math.hypot(a, b) || 1;
    const lc = Math.hypot(c, d) || 1;
    const ux = a / la, uy = b / la; // dirección del texto
    const vx = c / lc, vy = d / lc; // "hacia arriba" del texto
    const w = it.width || la * str.length * 0.5;
    const h = it.height || lc;
    const desc = h * 0.22; // espacio de descendentes bajo la línea base

    const corners = [
      [e - vx * desc, f - vy * desc],
      [e + ux * w - vx * desc, f + uy * w - vy * desc],
      [e + vx * h, f + vy * h],
      [e + ux * w + vx * h, f + uy * w + vy * h],
    ].map(([x, y]) => viewport.convertToViewportPoint(x, y));
    const xs = corners.map((p) => p[0]);
    const ys = corners.map((p) => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);

    const p0 = viewport.convertToViewportPoint(e, f);
    const p1 = viewport.convertToViewportPoint(e + ux, f + uy);
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1];
    const dir: Dir = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? "h" : "l") : dy < 0 ? "u" : "d";

    out.push([
      str,
      r4(minX / viewport.width),
      r4(minY / viewport.height),
      r4((maxX - minX) / viewport.width),
      r4((maxY - minY) / viewport.height),
      dir,
    ]);
  }
  return out;
}

/** Nombre de la hoja desde el rótulo: "TO-EL-001 · DIAGRAMA DE INTERCONEXIÓN …". */
export function pageName(items: TextItem[], n: number): string {
  const texts = items.map((i) => i[0]);
  const after = (re: RegExp, stop: RegExp, max: number) => {
    const k = texts.findIndex((t) => re.test(t));
    if (k < 0) return "";
    const parts: string[] = [];
    for (let j = k + 1; j < texts.length && parts.length < max; j++) {
      if (stop.test(texts[j])) break;
      parts.push(texts[j]);
    }
    return parts.join(" ").trim();
  };
  const STOP = /^(DIB\.?|REV\.?|ESCALA|FECHA|PLANO|PROYECTO|APR\.?|HOJA)\b/i;
  const title = after(/^T[ÍI]TULO:?$/i, STOP, 4);
  const code = after(/^PLANO\s*N[°º.]?:?$/i, /.*/, 1) || after(/^PLANO\s*N[°º.]?:?$/i, STOP, 1);
  const name = [code, title].filter(Boolean).join(" · ").slice(0, 90);
  return name || `Hoja ${n}`;
}

// ─── Tablas (marquillas, tags) ──────────────────────────────────────────────

const TABLE_KEY = /^(marquillas?|tag|cable|conductor|n[°º.]?\s*marquilla)$/i;

type Cell = { i: number; x: number; y: number; w: number; h: number; t: string };

/** Detecta tablas cuya primera columna es Marquilla / Tag / Cable y lee sus filas. */
export function parseTables(items: TextItem[]): { tables: IndexTable[]; used: Set<number> } {
  // Solo textos horizontales; trabajamos en "puntos" relativos (0..1).
  const cells: Cell[] = items
    .map((it, i) => ({ i, t: it[0], x: it[1], y: it[2], w: it[3], h: it[4], dir: it[5] }))
    .filter((c) => c.dir === "h" && !isFrameMark(c))
    .map(({ i, t, x, y, w, h }) => ({ i, t, x, y, w, h }));
  if (!cells.length) return { tables: [], used: new Set() };

  const medianH = median(cells.map((c) => c.h)) || 0.005;
  const rowTol = medianH * 0.45;
  const bottom = (c: Cell) => c.y + c.h;
  const end = (c: Cell) => c.x + c.w;
  const HEADER_GAP = 0.15; // salto horizontal que corta un encabezado
  const LEFT_SLACK = 0.05; // los valores pueden empezar antes que el título centrado

  const tables: IndexTable[] = [];
  const used = new Set<number>();

  const keys = cells.filter((c) => TABLE_KEY.test(c.t));
  for (const key of keys) {
    const sameLine = cells
      .filter((c) => Math.abs(bottom(c) - bottom(key)) <= rowTol)
      .sort((a, b) => a.x - b.x);

    // Encabezado: desde la clave hacia la derecha, hasta otra clave o un salto grande.
    const header: Cell[] = [key];
    for (const c of sameLine) {
      if (c.x <= key.x) continue;
      if (TABLE_KEY.test(c.t)) break;
      if (c.x - end(header[header.length - 1]) > HEADER_GAP) break;
      header.push(c);
    }
    if (header.length < 2) continue;

    // Límites: no invadir la tabla vecina de la misma línea.
    const prevKey = [...sameLine].reverse().find((c) => c.x < key.x && TABLE_KEY.test(c.t));
    const prevEnd = prevKey
      ? Math.max(...sameLine.filter((c) => c.x >= prevKey.x && c.x < key.x).map(end))
      : -1;
    const nextKey = sameLine.find((c) => c.x > key.x && TABLE_KEY.test(c.t));
    const left = Math.max(key.x - LEFT_SLACK, prevEnd + medianH * 0.5);
    const lastEnd = end(header[header.length - 1]);
    const right = nextKey
      ? Math.max(lastEnd + medianH, Math.min(nextKey.x - LEFT_SLACK, lastEnd + HEADER_GAP))
      : Math.min(1.01, lastEnd + HEADER_GAP);

    // Filas debajo del encabezado dentro del rango horizontal.
    const below = cells
      .filter((c) => c.x >= left && c.x < right && bottom(c) > bottom(key) + rowTol)
      .sort((a, b) => bottom(a) - bottom(b));
    const lines: Cell[][] = [];
    for (const c of below) {
      const last = lines[lines.length - 1];
      if (last && Math.abs(bottom(c) - bottom(last[0])) <= rowTol) last.push(c);
      else lines.push([c]);
    }
    // Corta la tabla cuando aparece un salto grande entre líneas.
    const gaps = lines.slice(1).map((l, k) => bottom(l[0]) - bottom(lines[k][0]));
    const step = median(gaps.slice(0, 12)) || medianH * 2;
    const firstGap = lines.length ? bottom(lines[0][0]) - bottom(key) : 0;
    if (!lines.length || firstGap > step * 3.5) continue;
    let stop = lines.length;
    for (let k = 0; k < gaps.length; k++) {
      if (gaps[k] > Math.max(step * 2.6, medianH * 3)) {
        stop = k + 1;
        break;
      }
    }
    const body = lines.slice(0, stop);
    if (!body.length) continue;

    // Columnas: agrupa los inicios x de las celdas; si no calza con el
    // encabezado, usa puntos medios entre centros de encabezados.
    const starts = columnStarts(body.flat(), header, body.length, medianH);

    const rows: IndexTable["rows"] = [];
    for (const line of body) {
      const vals: string[] = header.map(() => "");
      for (const c of line.sort((a, b) => a.x - b.x)) {
        let col = 0;
        for (let k = 0; k < starts.length; k++) if (c.x + medianH * 0.3 >= starts[k]) col = k;
        vals[col] = vals[col] ? `${vals[col]} ${c.t}` : c.t;
      }
      const box = unionBox(line);
      const prev = rows[rows.length - 1];
      if (!vals[0]) {
        // Sin código: continuación de la fila anterior (texto en dos líneas).
        if (!prev) continue;
        prev.cells = prev.cells.map((v, k) => (vals[k] ? `${v} ${vals[k]}`.trim() : v));
        prev.box = unionBox([prev.box, box]);
      } else {
        rows.push({ cells: vals, box });
      }
      line.forEach((c) => used.add(c.i));
    }
    header.forEach((c) => used.add(c.i));
    if (rows.length) tables.push({ headers: header.map((c) => c.t), rows });
  }
  return { tables, used };
}

/** Letras/números del marco del plano (A–F, 1–8) pegados al borde. */
function isFrameMark(c: { t: string; x: number; y: number; w: number; h: number }) {
  if (c.t.length > 2) return false;
  return c.x < 0.03 || c.x > 0.975 || c.y + c.h < 0.04 || c.y > 0.96;
}

/**
 * Inicio x de cada columna. Agrupa los inicios de las celdas (las columnas de
 * datos suelen estar alineadas a la izquierda) y asigna cada grupo al título
 * que tiene encima. Columnas sin grupo: punto medio entre títulos.
 */
function columnStarts(cells: Cell[], header: Cell[], rowCount: number, unit: number): number[] {
  const sorted = [...cells].sort((a, b) => a.x - b.x);
  const clusters: Cell[][] = [];
  for (const c of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && c.x - last[last.length - 1].x <= unit * 1.1) last.push(c);
    else clusters.push([c]);
  }
  const minCount = Math.max(2, Math.round(rowCount * 0.1));
  const starts: (number | null)[] = header.map(() => null);
  const centers = header.map((h) => h.x + h.w / 2);

  for (const cl of clusters) {
    if (cl.length < minCount) continue;
    const x0 = cl[0].x;
    const x1 = Math.max(...cl.map((c) => c.x + c.w));
    // Título con mayor solape horizontal; si ninguno solapa, el más cercano.
    let best = -1, bestScore = 0;
    header.forEach((h, k) => {
      const overlap = Math.min(x1, h.x + h.w) - Math.max(x0, h.x);
      if (overlap > bestScore) { bestScore = overlap; best = k; }
    });
    if (best < 0) {
      const mid = (x0 + x1) / 2;
      best = centers.reduce((b, c, k) => (Math.abs(c - mid) < Math.abs(centers[b] - mid) ? k : b), 0);
    }
    starts[best] = starts[best] === null ? x0 : Math.min(starts[best]!, x0);
  }

  const out = starts.map((s, k) => s ?? (k === 0 ? -1 : (centers[k - 1] + centers[k]) / 2));
  out[0] = -1; // la primera columna parte desde el borde de la tabla
  for (let k = 1; k < out.length; k++) if (out[k] <= out[k - 1]) out[k] = out[k - 1] + 1e-4;
  return out;
}

function unionBox(list: { x: number; y: number; w: number; h: number }[]): Box {
  const x = Math.min(...list.map((b) => b.x));
  const y = Math.min(...list.map((b) => b.y));
  const x2 = Math.max(...list.map((b) => b.x + b.w));
  const y2 = Math.max(...list.map((b) => b.y + b.h));
  return { x: r4(x), y: r4(y), w: r4(x2 - x), h: r4(y2 - y) };
}

function median(a: number[]) {
  if (!a.length) return 0;
  const s = [...a].sort((p, q) => p - q);
  return s[Math.floor(s.length / 2)];
}

export function buildPage(items: TextItem[], n: number): IndexPage {
  const { tables, used } = parseTables(items);
  return { name: pageName(items, n), items, tables, tableItems: [...used].sort((a, b) => a - b) };
}

// ─── Búsqueda ───────────────────────────────────────────────────────────────

export type SearchRow = { page: number; headers: string[]; cells: string[]; box: Box };
export type SearchHit = { page: number; box: Box; text: string };
export type SearchResult = { q: string; rows: SearchRow[]; hits: SearchHit[] };

export function normalizeQuery(q: string) {
  return q.normalize("NFC").toUpperCase().replace(/\s+/g, "").slice(0, 40);
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Busca un código (marquilla, tag, borne) como palabra completa en todo el plano. */
export function searchIndex(index: PlanIndex, rawQ: string, limit = 200): SearchResult {
  const q = normalizeQuery(rawQ);
  const res: SearchResult = { q, rows: [], hits: [] };
  if (!q) return res;
  // Palabra completa: no puede haber letra/número pegado (503 ≠ 1503 ≠ 503A).
  const re = new RegExp(`(?<![A-Z0-9])${esc(q)}(?![A-Z0-9])`, "g");

  index.pages.forEach((page, p) => {
    // Filas de tabla cuya primera columna es el código buscado.
    for (const table of page.tables) {
      for (const row of table.rows) {
        const first = row.cells[0].toUpperCase();
        const tokens = first.split(/\s*(?:[/,·;]|…|\.\.\.)\s*|\s+/).map((t) => t.replace(/\s+/g, ""));
        if (first.replace(/\s+/g, "") === q || tokens.includes(q)) {
          res.rows.push({ page: p, headers: table.headers, cells: row.cells, box: row.box });
        }
      }
    }
    // Ubicaciones en el dibujo (fuera de las tablas).
    const skip = new Set(page.tableItems);
    page.items.forEach((it, i) => {
      if (skip.has(i) || res.hits.length >= limit) return;
      const text = it[0].toUpperCase();
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) && res.hits.length < limit) {
        res.hits.push({ page: p, box: subBox(it, m.index, m.index + m[0].length), text: it[0].slice(0, 140) });
      }
    });
  });
  return res;
}

/** Caja aproximada de un trozo del texto (para no resaltar la frase entera). */
function subBox(it: TextItem, start: number, end: number): Box {
  const [t, x, y, w, h, dir] = it;
  const len = t.length || 1;
  const fs = start / len, fe = end / len;
  if (fs <= 0.01 && fe >= 0.99) return { x, y, w, h };
  switch (dir) {
    case "h": return { x: r4(x + w * fs), y, w: r4(w * (fe - fs)), h };
    case "l": return { x: r4(x + w * (1 - fe)), y, w: r4(w * (fe - fs)), h };
    case "u": return { x, y: r4(y + h * (1 - fe)), w, h: r4(h * (fe - fs)) };
    case "d": return { x, y: r4(y + h * fs), w, h: r4(h * (fe - fs)) };
  }
}
