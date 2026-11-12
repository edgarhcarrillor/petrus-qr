import QRCode from "qrcode";

export type QrLogo = { dataUrl: string; aspect: number };

const INK = "#0f1b2d";
const MARGIN = 3; // zona blanca alrededor, en módulos
/** Fracción máxima del área del QR que puede ocupar el recuadro del logo. */
const LOGO_AREA = 0.075;

/**
 * Genera el QR como SVG. Con `logo`, deja un rectángulo blanco de esquinas
 * redondeadas en el centro, con la forma del logo. Usa corrección de errores
 * H (tolera ~30 % dañado); el recuadro ocupa ≤ 7,5 % del área.
 * Sin logo, el QR sale completo.
 */
export function buildQrSvg(url: string, logo?: QrLogo | null): string {
  const qr = QRCode.create(url, { errorCorrectionLevel: "H" });
  const n = qr.modules.size;
  const total = n + MARGIN * 2;
  const box = logo ? logoBox(n, logo.aspect) : null;

  const inBox = (r: number, c: number) =>
    !!box && c >= box.x && c < box.x + box.w && r >= box.y && r < box.y + box.h;

  let d = "";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.modules.get(r, c) && !inBox(r, c)) d += `M${c + MARGIN} ${r + MARGIN}h1v1h-1z`;
    }
  }

  let center = "";
  if (box && logo) {
    const bx = box.x + MARGIN, by = box.y + MARGIN;
    const edge = 0.3; // separación del recuadro respecto a los módulos
    const pad = 0.55; // aire entre el borde del recuadro y el logo
    center =
      `<rect x="${bx + edge}" y="${by + edge}" width="${box.w - edge * 2}" height="${box.h - edge * 2}" ` +
      `rx="${Math.min(box.w, box.h) * 0.2}" fill="#fff" stroke="${INK}" stroke-width="0.22"/>` +
      `<image href="${logo.dataUrl}" x="${bx + edge + pad}" y="${by + edge + pad}" ` +
      `width="${box.w - (edge + pad) * 2}" height="${box.h - (edge + pad) * 2}" preserveAspectRatio="xMidYMid meet"/>`;
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges">` +
    `<rect width="${total}" height="${total}" fill="#fff"/>` +
    `<path d="${d}" fill="${INK}"/>` +
    center +
    `</svg>`
  );
}

/** Recuadro centrado, en módulos enteros, con la proporción del logo. */
export function logoBox(n: number, aspect: number) {
  const a = Math.min(Math.max(aspect, 0.25), 6);
  let w = Math.sqrt(LOGO_AREA * n * n * a);
  let h = w / a;
  const maxW = n * 0.5, maxH = n * 0.32;
  if (w > maxW) { w = maxW; h = w / a; }
  if (h > maxH) { h = maxH; w = h * a; }
  let W = Math.max(5, Math.round(w));
  let H = Math.max(5, Math.round(h));
  if ((n - W) % 2) W += 1; // centrado exacto
  if ((n - H) % 2) H += 1;
  return { x: (n - W) / 2, y: (n - H) / 2, w: W, h: H };
}

/** Rasteriza el SVG a PNG (en el navegador). */
export async function svgToPng(svg: string, size = 2048): Promise<string> {
  const img = await loadImage(URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" })));
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, size, size);
  return canvas.toDataURL("image/png");
}

// ─── Procesamiento del logo subido ──────────────────────────────────────────

const LOGO_MAX = 1200; // px del lado mayor del PNG normalizado

/**
 * Normaliza el logo (SVG, PNG o JPG): lo dibuja sobre fondo blanco, recorta el
 * margen blanco/transparente sobrante y lo reduce a ≤ 1200 px. Devuelve un PNG.
 */
export async function processLogo(file: File): Promise<{ blob: Blob; aspect: number; dataUrl: string }> {
  const isSvg = file.type === "image/svg+xml" || /\.svg$/i.test(file.name);
  if (!isSvg && !/^image\/(png|jpe?g)$/.test(file.type)) throw new Error("Formato no soportado: usa SVG, PNG o JPG");
  if (file.size > 5 * 1024 * 1024) throw new Error("El logo supera 5 MB");

  let src: string;
  let w = 0, h = 0;
  if (isSvg) {
    const doc = new DOMParser().parseFromString(await file.text(), "image/svg+xml");
    const el = doc.documentElement;
    if (el.nodeName !== "svg") throw new Error("El SVG no es válido");
    const vb = el.getAttribute("viewBox")?.trim().split(/[\s,]+/).map(Number);
    const aw = parseFloat(el.getAttribute("width") ?? ""), ah = parseFloat(el.getAttribute("height") ?? "");
    const ratio = vb?.length === 4 && vb[2] > 0 && vb[3] > 0 ? vb[2] / vb[3] : aw > 0 && ah > 0 ? aw / ah : 1;
    // Tamaño explícito para que el navegador lo rasterice nítido.
    w = ratio >= 1 ? 2000 : Math.round(2000 * ratio);
    h = ratio >= 1 ? Math.round(2000 / ratio) : 2000;
    if (!vb && aw > 0 && ah > 0) el.setAttribute("viewBox", `0 0 ${aw} ${ah}`);
    el.setAttribute("width", String(w));
    el.setAttribute("height", String(h));
    src = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(el)], { type: "image/svg+xml" }));
  } else {
    src = URL.createObjectURL(file);
  }

  const img = await loadImage(src);
  if (!w || !h) {
    w = img.naturalWidth;
    h = img.naturalHeight;
  }
  if (!w || !h) throw new Error("No se pudo leer la imagen");

  // 1) Sobre fondo blanco.
  const full = document.createElement("canvas");
  full.width = w;
  full.height = h;
  const fctx = full.getContext("2d", { willReadFrequently: true })!;
  fctx.fillStyle = "#fff";
  fctx.fillRect(0, 0, w, h);
  fctx.drawImage(img, 0, 0, w, h);

  // 2) Recorte del margen blanco (o transparente, que ya quedó blanco).
  const { data } = fctx.getImageData(0, 0, w, h);
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (data[i] < 235 || data[i + 1] < 235 || data[i + 2] < 235) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) throw new Error("El logo está en blanco");
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;

  // 3) Reducción a ≤ LOGO_MAX px.
  const s = Math.min(1, LOGO_MAX / Math.max(cw, ch));
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(cw * s));
  out.height = Math.max(1, Math.round(ch * s));
  const octx = out.getContext("2d")!;
  octx.fillStyle = "#fff";
  octx.fillRect(0, 0, out.width, out.height);
  octx.imageSmoothingQuality = "high";
  octx.drawImage(full, x0, y0, cw, ch, 0, 0, out.width, out.height);

  const blob = await new Promise<Blob>((ok, fail) =>
    out.toBlob((b) => (b ? ok(b) : fail(new Error("No se pudo procesar el logo"))), "image/png"),
  );
  return { blob, aspect: out.width / out.height, dataUrl: out.toDataURL("image/png") };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, fail) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(src);
      ok(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(src);
      fail(new Error("No se pudo leer la imagen"));
    };
    img.src = src;
  });
}
