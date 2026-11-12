import { after, NextResponse, type NextRequest } from "next/server";
import { getPublicQr, logScan } from "@/lib/public-qr";

/**
 * Dirección que va DENTRO del QR impreso: /q/<slug>. Nunca cambia.
 * Registra el escaneo y redirige:
 *   - contenido tipo link → directo a esa URL
 *   - cualquier otro      → al visor /v/<slug>
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/q/[slug]">) {
  const { slug } = await ctx.params;
  const found = await getPublicQr(slug);

  if (found?.qr.is_active) {
    const country = request.headers.get("x-vercel-ip-country");
    const ua = request.headers.get("user-agent");
    after(() => logScan(found.qr.id, country, ua).catch(() => {}));

    if (found.version?.kind === "link" && found.version.link_url) {
      return redirectNoStore(found.version.link_url);
    }
  }
  return redirectNoStore(new URL(`/v/${encodeURIComponent(slug)}`, request.url).toString());
}

function redirectNoStore(url: string) {
  // 302 y sin caché: si mañana cambia el contenido, el QR debe llevar al nuevo destino.
  const res = NextResponse.redirect(url, 302);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
