"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, Download, ExternalLink, TriangleAlert } from "lucide-react";
import { isProvisionalBase, qrBaseUrl } from "@/lib/constants";

export function QrCard({ slug, title }: { slug: string; title: string }) {
  const [base, setBase] = useState("");
  const [svg, setSvg] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // origin solo existe en el navegador
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBase(qrBaseUrl(window.location.origin));
  }, []);

  const url = base ? `${base}/q/${slug}` : "";

  useEffect(() => {
    if (!url) return;
    QRCode.toString(url, { type: "svg", errorCorrectionLevel: "Q", margin: 2 }).then(setSvg);
  }, [url]);

  const fileBase = `QR-${title.replace(/[^\w-]+/g, "_").slice(0, 40)}-${slug}`;

  async function downloadPng() {
    const data = await QRCode.toDataURL(url, { errorCorrectionLevel: "Q", margin: 2, width: 2048 });
    save(data, `${fileBase}.png`);
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
        // SVG generado localmente por la librería qrcode a partir de nuestra propia URL.
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
        <button className="btn" onClick={downloadPng} disabled={!url}>
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
