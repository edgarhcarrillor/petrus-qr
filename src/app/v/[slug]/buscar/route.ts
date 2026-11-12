import { NextResponse, type NextRequest } from "next/server";
import { normalizeQuery } from "@/lib/plan-index";
import { searchPlan } from "@/lib/public-qr";

/**
 * GET /v/<slug>/buscar?q=503 — busca una marquilla/tag en el plano actual.
 * Devuelve solo los resultados (nunca el texto completo del plano).
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/v/[slug]/buscar">) {
  const { slug } = await ctx.params;
  const q = normalizeQuery(request.nextUrl.searchParams.get("q") ?? "");
  if (!q) return json({ error: "Escribe una marquilla" }, 400);

  const result = await searchPlan(slug, q);
  if (!result) return json({ error: "Este QR no tiene buscador" }, 404);
  return json(result, 200);
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}
