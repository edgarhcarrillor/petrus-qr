import { QrCode } from "lucide-react";

export function Brand({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="grid size-8 place-items-center rounded-lg bg-brand text-white">
        <QrCode size={18} />
      </span>
      <span className="font-semibold tracking-tight">
        Petrus <span className="text-brand">QR</span>
      </span>
    </div>
  );
}
