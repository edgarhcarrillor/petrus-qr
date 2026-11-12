"use client";

/**
 * Convierte un PDF o una imagen en imágenes de página con marca de agua,
 * en el NAVEGADOR del admin (no necesita librerías nativas en el servidor).
 *
 * El visor público solo recibe estas imágenes: el PDF original nunca se envía
 * a quien escanea el QR.
 */

export type RenderedPage = { blob: Blob; ext: string; width: number; height: number };

// Lado mayor máximo y área máxima (iOS Safari limita los canvas a ~16,7 MP).
const MAX_SIDE = 4096;
const MAX_AREA = 16_000_000;

function fitScale(w: number, h: number) {
  let s = Math.min(1, MAX_SIDE / Math.max(w, h));
  if (w * s * h * s > MAX_AREA) s = Math.sqrt(MAX_AREA / (w * h));
  return s;
}

function drawWatermark(ctx: CanvasRenderingContext2D, w: number, h: number, text: string) {
  const size = Math.max(14, Math.round(Math.min(w, h) / 28));
  ctx.save();
  ctx.font = `600 ${size}px system-ui, sans-serif`;
  ctx.fillStyle = "rgba(200, 30, 30, 0.10)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-Math.PI / 6);
  const stepX = ctx.measureText(text).width + size * 4;
  const stepY = size * 6;
  const span = Math.hypot(w, h);
  for (let y = -span; y <= span; y += stepY) {
    const offset = (Math.round(y / stepY) % 2) * (stepX / 2);
    for (let x = -span; x <= span; x += stepX) ctx.fillText(text, x + offset, y);
  }
  ctx.restore();

  // Pie fijo, más legible, abajo a la derecha.
  const foot = Math.max(12, Math.round(size * 0.7));
  ctx.save();
  ctx.font = `600 ${foot}px system-ui, sans-serif`;
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.fillStyle = "rgba(200, 30, 30, 0.55)";
  ctx.fillText(text, w - foot, h - foot / 2);
  ctx.restore();
}

async function canvasToBlob(canvas: HTMLCanvasElement): Promise<{ blob: Blob; ext: string }> {
  const attempt = (type: string, q?: number) =>
    new Promise<Blob | null>((res) => canvas.toBlob(res, type, q));
  // WebP si el navegador lo codifica (Safari antiguo devuelve PNG): si no, JPEG.
  const webp = await attempt("image/webp", 0.85);
  if (webp && webp.type === "image/webp") return { blob: webp, ext: "webp" };
  const jpg = await attempt("image/jpeg", 0.88);
  if (!jpg) throw new Error("No se pudo generar la imagen de la página");
  return { blob: jpg, ext: "jpg" };
}

function newCanvas(w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas no disponible");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return { canvas, ctx };
}

export async function renderPdf(
  file: File,
  watermark: string,
  onProgress?: (done: number, total: number) => void,
): Promise<RenderedPage[]> {
  const pdfjs = await import("pdfjs-dist");
  // Copiado a /public por scripts/copy-pdf-worker.mjs (postinstall).
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const doc = await task.promise;
  const out: RenderedPage[] = [];
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      // Renderiza a ~300 dpi (escala 4,17 sobre 72 dpi) y luego limita por tamaño.
      const scale = 300 / 72 * fitScale(base.width * (300 / 72), base.height * (300 / 72));
      const viewport = page.getViewport({ scale });
      const { canvas, ctx } = newCanvas(viewport.width, viewport.height);
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      drawWatermark(ctx, canvas.width, canvas.height, watermark);
      const { blob, ext } = await canvasToBlob(canvas);
      out.push({ blob, ext, width: canvas.width, height: canvas.height });
      page.cleanup();
      canvas.width = canvas.height = 0; // libera memoria
      onProgress?.(n, doc.numPages);
    }
  } finally {
    await task.destroy();
  }
  return out;
}

export async function renderImage(file: File, watermark: string): Promise<RenderedPage[]> {
  const bitmap = await createImageBitmap(file);
  const s = fitScale(bitmap.width, bitmap.height);
  const { canvas, ctx } = newCanvas(bitmap.width * s, bitmap.height * s);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  drawWatermark(ctx, canvas.width, canvas.height, watermark);
  const { blob, ext } = await canvasToBlob(canvas);
  return [{ blob, ext, width: canvas.width, height: canvas.height }];
}
