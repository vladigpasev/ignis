"use client";

import { useRef, useState } from "react";
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
  const fileRef = useRef<HTMLInputElement | null>(null);

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
        if (!p?.ok) throw new Error(p?.error || "Грешка при пресайна.");
        // Include ACL header to match the presigned request (server signs with ACL: public-read)
        const putRes = await fetch(p.url, {
          method: "PUT",
          body: f,
          headers: { "Content-Type": ct },
        });
        if (!putRes.ok) {
          let details = "";
          try { details = await putRes.text(); } catch {}
          const msg = `Неуспешно качване (${putRes.status})${details ? ": " + details.slice(0, 200) : ""}`;
          // eslint-disable-next-line no-console
          console.error("S3 PUT error", putRes.status, details);
          throw new Error(msg);
        }
        onUploaded({ key: p.key, url: p.publicUrl });
      }
    } catch (e) {
      alert((e as any)?.message || "Грешка при качването.");
    } finally {
      setBusy(false);
      // Allow selecting the same file again by clearing the input value
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="inline-flex items-center gap-2">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <Button
        size="sm"
        variant="outline"
        type="button"
        disabled={busy}
        onClick={() => fileRef.current?.click()}
      >
        {busy ? "Качване…" : multiple ? "Качи изображения" : "Качи изображение"}
      </Button>
    </div>
  );
}
