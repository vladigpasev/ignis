"use client";

import { Button } from "@/components/ui/button";
import { Copy, Printer } from "lucide-react";

export default function CertificateActions() {
  async function onCopy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {}
  }
  function onPrint() {
    try { window.print(); } catch {}
  }
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" className="rounded-full" onClick={onCopy}>
        <Copy className="w-4 h-4 mr-1" /> Copy link
      </Button>
      <Button variant="default" size="sm" className="rounded-full" onClick={onPrint}>
        <Printer className="w-4 h-4 mr-1" /> Print
      </Button>
    </div>
  );
}
