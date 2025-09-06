import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { openai } from "@/lib/ai/openai";
import { getOrCreateFireAssistant, getOrCreateThread, syncFireKnowledge, toolGetFireState } from "@/lib/ai/fire-assistant";

export const runtime = "nodejs";

async function ensureLocalUser() {
  const session = await auth0.getSession();
  const email = session?.user?.email;
  if (!email) return null;
  const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (row) return row;
  const [created] = await db.insert(users).values({ email, name: session?.user?.name ?? null }).returning();
  return created;
}

function sseInit(controller: ReadableStreamDefaultController) {
  // Also send a data message so client .onmessage triggers immediately
  sseData(controller, { type: 'open' }, 'open');
}
function sseData(controller: ReadableStreamDefaultController, obj: any, event?: string) {
  const enc = new TextEncoder();
  const payload = `data: ${JSON.stringify(obj)}\n\n`;
  if (event) {
    controller.enqueue(enc.encode(`event: ${event}\n`));
  }
  controller.enqueue(enc.encode(payload));
}
function sseClose(controller: ReadableStreamDefaultController) {
  // Send a default message event the client listens for
  sseData(controller, { type: 'done' });
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fireId = Number(id);
  if (!Number.isFinite(fireId)) return NextResponse.json({ ok: false, error: "Invalid fire id" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const q = String(searchParams.get("q") || "").trim().slice(0, 8000);
  if (!q) return NextResponse.json({ ok: false, error: "Missing q" }, { status: 400 });

  const me = await ensureLocalUser();
  if (!me) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const stream = new ReadableStream({
    start: async (controller) => {
      sseInit(controller);
      try {
        const client = openai();
        const { assistantId, vectorStoreId } = await getOrCreateFireAssistant(fireId);
        const threadId = await getOrCreateThread(fireId, me.id);

        // Best-effort sync (do not block the stream)
        try { (async () => { await syncFireKnowledge(fireId); })(); } catch {}

        // Add the user message to the thread
        await client.beta.threads.messages.create(threadId, { role: "user", content: q });

        // Use robust polling approach for compatibility, and stream the final text in chunks
        const run = await client.beta.threads.runs.create(threadId, {
          assistant_id: assistantId,
          tool_resources: { file_search: { vector_store_ids: [vectorStoreId] } },
        });

        let currentRun = run;
        for (let i = 0; i < 120; i++) {
          currentRun = await client.beta.threads.runs.retrieve(threadId, currentRun.id);
          if (currentRun.status === 'requires_action') {
            const calls = currentRun.required_action?.submit_tool_outputs?.tool_calls || [];
            const outputs: any[] = [];
            for (const c of calls) {
              if (c?.function?.name === 'get_fire_state') {
                const snapshot = await toolGetFireState(fireId);
                outputs.push({ tool_call_id: c.id, output: JSON.stringify(snapshot) });
              }
            }
            if (outputs.length) {
              await client.beta.threads.runs.submitToolOutputs(threadId, currentRun.id, { tool_outputs: outputs });
            }
          }
          if (currentRun.status === 'completed') break;
          if (['failed','cancelled','expired'].includes(currentRun.status as any)) {
            throw new Error(`Assistant run ${currentRun.status}`);
          }
          // Keep connection warm with a heartbeat
          if (i % 5 === 0) sseData(controller, { type: 'heartbeat' });
          await new Promise(r => setTimeout(r, 800));
        }

        const msgs = await client.beta.threads.messages.list(threadId, { order: 'desc', limit: 10 });
        let answer = '';
        for (const m of msgs.data) {
          if (m.run_id !== currentRun.id) continue;
          if (m.role !== 'assistant') continue;
          for (const pc of m.content) {
            if (pc.type === 'text') answer += pc.text.value;
          }
        }
        // If model returned nothing, send a generic message
        if (!answer.trim()) answer = 'Няма отговор. Опитай пак след момент.';
        const chunks = answer.match(/.{1,60}/g) || [];
        for (const ch of chunks) {
          sseData(controller, { type: 'token', value: ch });
          await new Promise(r => setTimeout(r, 20));
        }
        sseClose(controller);
        controller.close();
      } catch (e: any) {
        sseData(controller, { type: 'error', error: e?.message || 'Server error' });
        sseClose(controller);
        controller.close();
      }
    },
    cancel() {
      // Client disconnected
    },
  });

  const headers = new Headers({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  return new Response(stream, { headers });
}
