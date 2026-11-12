import QRCode from "qrcode";
import { CENTER_LABEL_MAX } from "./constants";

const INK = "#0f1b2d";
const MARGIN = 3; // zona blanca alrededor, en módulos (el estándar pide ≥ 4; 3 basta en impresión)

/**
 * Genera el QR como SVG. Con `label`, deja un recuadro blanco en el centro con
 * el texto (ej. «PetrusCore»). Usa corrección de errores H (30 %): el recuadro
 * ocupa < 5 % del área, muy por debajo de lo que el QR tolera.
 */
export function buildQrSvg(url: string, label?: string | null): string {
  const text = (label ?? "").trim().slice(0, CENTER_LABEL_MAX);
  const qr = QRCode.create(url, { errorCorrectionLevel: "H" });
  const n = qr.modules.size;
  const total = n + MARGIN * 2;

  // Recuadro central en módulos enteros (bordes limpios).
  let box: { x: number; y: number; w: number; h: number } | null = null;
  let fontSize = 0;
  if (text) {
    const h = Math.max(5, Math.round(n * 0.15));
    fontSize = h * 0.6;
    const textW = text.length * fontSize * 0.6; // ancho aprox. de Arial bold
    let w = Math.ceil(textW + h * 0.6);
    const maxW = Math.floor(n * 0.48);
    if (w > maxW) {
      fontSize *= maxW / w;
      w = maxW;
    }
    if ((n - w) % 2) w += 1; // centrado exacto
    const hh = (n - h) % 2 ? h + 1 : h;
    box = { x: (n - w) / 2, y: (n - hh) / 2, w, h: hh };
  }

  const inBox = (r: number, c: number) =>
    !!box && c >= box.x && c < box.x + box.w && r >= box.y && r < box.y + box.h;

  let d = "";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.modules.get(r, c) && !inBox(r, c)) d += `M${c + MARGIN} ${r + MARGIN}h1v1h-1z`;
    }
  }

  let center = "";
  if (box && text) {
    const bx = box.x + MARGIN, by = box.y + MARGIN;
    const pad = 0.35;
    center =
      `<rect x="${bx + pad}" y="${by + pad}" width="${box.w - pad * 2}" height="${box.h - pad * 2}" rx="${box.h * 0.22}" fill="#fff" stroke="${INK}" stroke-width="0.25"/>` +
      `<text x="${bx + box.w / 2}" y="${by + box.h / 2}" font-family="Arial, Helvetica, sans-serif" font-weight="700" ` +
      `font-size="${fontSize.toFixed(2)}" fill="${INK}" text-anchor="middle" dominant-baseline="central" ` +
      `textLength="${(Math.min(text.length * fontSize * 0.6, box.w - box.h * 0.5)).toFixed(2)}" lengthAdjust="spacingAndGlyphs">${escapeXml(text)}</text>`;
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges">` +
    `<rect width="${total}" height="${total}" fill="#fff"/>` +
    `<path d="${d}" fill="${INK}"/>` +
    center +
    `</svg>`
  );
}

/** Rasteriza el SVG a PNG (en el navegador). */
export async function svgToPng(svg: string, size = 2048): Promise<string> {
  const img = new Image();
  const src = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    await new Promise<void>((ok, fail) => {
      img.onload = () => ok();
      img.onerror = () => fail(new Error("No se pudo generar el PNG"));
      img.src = src;
    });
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, size, size);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(src);
  }
}

function escapeXml(s: string) {
  return s.replace(/[<>&"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}
