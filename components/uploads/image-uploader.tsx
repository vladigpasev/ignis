"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function ImageUploader({
  prefix,
  onUploaded,
  multiple = true,
}: {
  prefix: string;
  onUploaded: (file: { key: string; url: string; width?: number; height?: number }) => void;
  multiple?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setBusy(true);
    try {
      for (const f of Array.from(files)) {
        const ct = f.type || "application/octet-stream";
        const ext = f.name.includes(".") ? "." + f.name.split(".").pop() : "";
        const p = await fetch("/api/uploads/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prefix, contentType: ct, ext }),
        }).then((r) => r.json());
        if (!p?.ok) throw new Error(p?.error || "presign failed");
        await fetch(p.url, { method: "PUT", body: f, headers: { "Content-Type": ct } });
        onUploaded({ key: p.key, url: p.publicUrl });
      }
    } catch (e) {
      alert((e as any)?.message || "Upload error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <label className="inline-flex items-center gap-2">
      <input
        type="file"
        accept="image/*"
        multiple={multiple}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <Button size="sm" variant="outline" type="button" disabled={busy}>
        {busy ? "Качване…" : "Качи снимки"}
      </Button>
    </label>
  );
}

