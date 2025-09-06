"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Loader2, Send, RotateCcw, Square, Bot, RefreshCw, Copy, Check } from "lucide-react";
import Markdown from "@/components/ui/markdown";

type Msg = { id: string; role: "user" | "assistant"; content: string };

function uid() { return Math.random().toString(36).slice(2); }

export default function FireAssistant({ fireId, fullHeight = false }: { fireId: number; fullHeight?: boolean }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const presets = useMemo(() => [
    "В коя зона е най-нужно още един доброволец и защо?",
    "Кои зони са най-активни сега и какво им трябва?",
    "Какви са последните обновления и рискове по зони?",
  ], []);

  useEffect(() => {
    // Greet on first mount
    if (messages.length === 0) {
      setMessages([
        { id: uid(), role: "assistant", content: "Здравей! Аз съм AI помощник за този пожар. Питай ме всичко свързано с доброволци, зони и координация. Мога да препоръчам къде да се включиш според текущата ситуация." },
      ]);
    }
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 1e9, behavior: "smooth" });
  }, [messages.map(m => m.content).join("@@")]);

  function stop() {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
  }

  async function syncKnowledge() {
    setSyncing(true);
    try {
      const res = await fetch(`/api/fires/${fireId}/assistant/sync`, { method: 'POST' }).then(r => r.json());
      if (!res?.ok) throw new Error(res?.error || 'Грешка при синхронизация');
      setMessages((prev) => [...prev, { id: uid(), role: 'assistant', content: 'Знанието е обновено. Готов съм с най-новия контекст.' }]);
    } catch (e: any) {
      setMessages((prev) => [...prev, { id: uid(), role: 'assistant', content: `Не успях да обновя знанието: ${(e?.message || 'Грешка')}` }]);
    } finally {
      setSyncing(false);
    }
  }

  async function send(text?: string) {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setInput("");
    setBusy(true);

    const userMsg: Msg = { id: uid(), role: 'user', content: q };
    const asstMsg: Msg = { id: uid(), role: 'assistant', content: '' };
    setMessages((prev) => [...prev, userMsg, asstMsg]);

    try {
      const ac = new AbortController();
      abortRef.current = ac;
      const res = await fetch(`/api/fires/${fireId}/assistant/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q }),
        signal: ac.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        const err = data?.error || res.statusText || 'Грешка';
        setMessages((prev) => prev.map((m) => m.id === asstMsg.id ? { ...m, content: `Грешка: ${err}` } : m));
      } else {
        const answer = String(data.answer || '').trim();
        setMessages((prev) => prev.map((m) => m.id === asstMsg.id ? { ...m, content: answer || 'Няма отговор.' } : m));
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        setMessages((prev) => prev.map((m) => m.id === asstMsg.id ? { ...m, content: (m.content || 'Прекратено.') } : m));
      } else {
        setMessages((prev) => prev.map((m) => m.id === asstMsg.id ? { ...m, content: (m.content || 'Грешка при свързване към сървъра. Опитай пак.') } : m));
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }

  function regenerate() {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUser) send(lastUser.content);
  }

  async function copyMessage(id: string) {
    const m = messages.find((x) => x.id === id);
    if (!m) return;
    try {
      await navigator.clipboard?.writeText(m.content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1200);
    } catch {}
  }

  return (
    <div className={fullHeight ? "flex h-full min-h-0 flex-col gap-3" : "flex flex-col gap-3"}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Bot className="h-4 w-4" /> AI Помощник
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={syncKnowledge} disabled={syncing} title="Обнови знанието">
            {syncing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Обнови
          </Button>
          <Button size="sm" variant="outline" onClick={regenerate} disabled={busy} title="Генерирай пак">
            <RotateCcw className="h-4 w-4 mr-1" /> Пак
          </Button>
          <Button size="sm" variant="outline" onClick={stop} disabled={!busy} title="Спри">
            <Square className="h-4 w-4 mr-1" /> Спри
          </Button>
        </div>
      </div>

      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button key={p} onClick={() => send(p)} className="text-sm px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 transition border">
              {p}
            </button>
          ))}
        </div>
      )}

      <Card className={fullHeight ? "p-0 overflow-hidden flex-1 min-h-0" : "p-0 overflow-hidden"}>
        <div ref={scrollRef} className={fullHeight ? "h-full overflow-y-auto p-3 bg-background/50" : "max-h-[46vh] overflow-y-auto p-3 bg-background/50"}>
          {messages.map((m) => (
            <div key={m.id} className={`group flex items-start gap-2 py-2 ${m.role === 'assistant' ? '' : 'justify-end'}`}>
              {m.role === 'assistant' && (
                <div className="mt-1 h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <Bot className="h-4 w-4" />
                </div>
              )}
              <div className={`relative max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow ${m.role === 'assistant' ? 'bg-muted' : 'bg-primary text-primary-foreground'}`}>
                {m.role === 'assistant' ? (
                  <Markdown content={m.content || (busy ? '…' : '')} />
                ) : (
                  <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
                )}
                {m.role === 'assistant' && (
                  <button onClick={() => copyMessage(m.id)} className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition rounded-full bg-background border shadow p-1" title="Копирай">
                    {copiedId === m.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex gap-2">
        <Textarea rows={2} placeholder="Попитай за зони, нужди, рискове…" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(); }} />
        <Button onClick={() => send()} disabled={busy || !input.trim()} className="self-start">
          {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
          Изпрати
        </Button>
      </div>
    </div>
  );
}
