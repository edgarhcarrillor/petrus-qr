"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Download, ExternalLink, TriangleAlert } from "lucide-react";
import { isProvisionalBase, qrBaseUrl } from "@/lib/constants";
import { buildQrSvg, svgToPng } from "@/lib/qr-art";

export function QrCard({ slug, title, label }: { slug: string; title: string; label: string | null }) {
  const [base, setBase] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // origin solo existe en el navegador
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBase(qrBaseUrl(window.location.origin));
  }, []);

  const url = base ? `${base}/q/${slug}` : "";
  const svg = useMemo(() => (url ? buildQrSvg(url, label) : ""), [url, label]);
  const fileBase = `QR-${title.replace(/[^\w-]+/g, "_").slice(0, 40)}-${slug}`;

  async function downloadPng() {
    save(await svgToPng(svg, 2048), `${fileBase}.png`);
  }
  function downloadSvg() {
    const href = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    save(href, `${fileBase}.svg`);
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }
  function save(href: string, name: string) {
    const a = document.createElement("a");
    a.href = href;
    a.download = name;
    a.click();
  }
  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="card flex flex-col gap-4 p-5">
      <div
        className="mx-auto aspect-square w-full max-w-60 [&>svg]:h-full [&>svg]:w-full"
        // SVG generado localmente (src/lib/qr-art.ts) con el texto escapado.
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <p className="break-all text-center font-mono text-sm">{url || "…"}</p>

      {base && isProvisionalBase(base) && (
        <p className="flex gap-2 rounded-lg bg-warn-bg p-3 text-xs text-warn-fg">
          <TriangleAlert size={16} className="shrink-0" />
          Dominio provisorio. Sirve para pruebas, pero no imprimas QR definitivos hasta configurar
          NEXT_PUBLIC_QR_BASE_URL con el dominio final.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button className="btn" onClick={downloadPng} disabled={!svg}>
          <Download size={16} /> PNG
        </button>
        <button className="btn" onClick={downloadSvg} disabled={!svg}>
          <Download size={16} /> SVG
        </button>
        <button className="btn" onClick={copy} disabled={!url}>
          <Copy size={16} /> {copied ? "Copiado" : "Copiar link"}
        </button>
        <a className="btn" href={url || undefined} target="_blank" rel="noreferrer">
          <ExternalLink size={16} /> Abrir
        </a>
      </div>
    </div>
  );
}
