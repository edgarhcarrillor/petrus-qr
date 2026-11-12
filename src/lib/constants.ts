export const BUCKET = "qr-files";

/** Segundos que vive una URL firmada del visor. */
export const SIGNED_URL_TTL = 60 * 30;

export const KIND_LABEL = {
  pdf: "PDF / Planos",
  image: "Imagen",
  link: "Link",
  text: "Texto",
} as const;

export type ContentKind = keyof typeof KIND_LABEL;

export type PageRef = { path: string; width: number; height: number; name?: string };

/**
 * URL base que va DENTRO del QR impreso. Viene de NEXT_PUBLIC_QR_BASE_URL
 * (ej. https://qr.petrustech.cl). Si no está definida, se usa el origen actual.
 */
export function qrBaseUrl(fallbackOrigin?: string) {
  const env = process.env.NEXT_PUBLIC_QR_BASE_URL?.trim().replace(/\/+$/, "");
  return env || fallbackOrigin || "";
}

/** true si la URL base aún no es un dominio definitivo (no imprimir QR finales). */
export function isProvisionalBase(base: string) {
  return !base || /localhost|127\.0\.0\.1|\.vercel\.app/i.test(base);
}
