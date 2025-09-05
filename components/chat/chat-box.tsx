"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Message = { id: number; userId: number; name?: string | null; email: string; message: string; createdAt: string };

export default function ChatBox({
  fetchUrl,
  postUrl,
  canBlock = false,
  onBlock,
}: {
  fetchUrl: string;
  postUrl: string;
  canBlock?: boolean;
  onBlock?: (userId: number) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [poll, setPoll] = useState(true);
  const ref = useRef<HTMLDivElement | null>(null);

  async function load() {
    const res = await fetch(fetchUrl, { cache: "no-store" }).then((r) => r.json());
    if (res?.ok) setMessages(res.messages || []);
  }
  useEffect(() => {
    load();
  }, [fetchUrl]);

  useEffect(() => {
    if (!poll) return;
    const t = setInterval(load, 3500);
    return () => clearInterval(t);
  }, [poll, fetchUrl]);

  useEffect(() => {
    ref.current?.scrollTo({ top: 9999999, behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    try {
      const res = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: body }),
      }).then((r) => r.json());
      if (!res?.ok) throw new Error(res?.error || "Грешка");
      setText("");
      await load();
    } catch (e: any) {
      alert(e?.message || "Грешка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div ref={ref} className="max-h-[46vh] overflow-y-auto rounded-lg border p-3 bg-background/50">
        {messages.map((m) => (
          <div key={m.id} className="py-1.5">
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{m.name || m.email}</span>{" "}
              <span suppressHydrationWarning>• {new Date(m.createdAt).toLocaleString()}</span>
              {canBlock && onBlock && (
                <Button size="sm" variant="outline" className="ml-2 h-6 px-2" onClick={() => onBlock(m.userId)}>
                  Блокирай
                </Button>
              )}
            </div>
            <div className="text-sm">{m.message}</div>
          </div>
        ))}
        {messages.length === 0 && <div className="text-sm text-muted-foreground">Няма съобщения още.</div>}
      </div>

      <div className="flex gap-2">
        <Textarea rows={2} placeholder="Напиши съобщение…" value={text} onChange={(e) => setText(e.target.value)} />
        <Button onClick={send} disabled={busy || !text.trim()} className="self-start">
          Изпрати
        </Button>
      </div>
    </div>
  );
}
