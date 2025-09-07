"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function GenerateCertificateButton({ disabled }: { disabled?: boolean }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onClick() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/certificates", { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        const msg = j?.error || `Failed (${res.status})`;
        alert(msg === "CertificateAlreadyExists" ? "You already have a certificate for this month." : msg);
        setLoading(false);
        return;
      }
      const j = await res.json();
      const id = j?.id;
      if (id) router.push(`/certificates/${id}`);
      else setLoading(false);
    } catch (e: any) {
      alert(e?.message || "Failed to generate certificate");
      setLoading(false);
    }
  }

  return (
    <Button onClick={onClick} disabled={disabled || loading} className="rounded-full">
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      Generate Certificate
    </Button>
  );
}
