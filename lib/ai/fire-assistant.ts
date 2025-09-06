import { openai, DEFAULT_MODEL } from "@/lib/ai/openai";
import { db } from "@/lib/db";
import {
  chatMessages,
  fireAiResources,
  fireAiThreads,
  fireVolunteers,
  fires,
  users,
  zoneMembers,
  zones,
} from "@/lib/db/schema";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { buildFireKnowledge } from "./fire-knowledge";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { canUseSendbird, fireChannelUrl, listChannelMessages } from "@/lib/sendbird";

const ASSISTANT_NAME_PREFIX = "Ignis Fire Bot";

function instructionsForFire(fireId: number) {
  return (
    `Ти си помощник за пожар №${fireId} (Ignis). Отговаряш САМО на въпроси свързани с пожари, доброволци, зони, логистика и безопасност.` +
    ` Използвай наличния контекст (file_search) и ако нещо липсва, задай уточняващи въпроси (например екипировка, опит, локация).` +
    ` Когато препоръчваш зона за включване на доброволец, вземи предвид: текущ брой хора на зона, активност в чатовете и обновленията, близост/радиус, рискове.` +
    ` Ако е необходимо, извикай функцията get_fire_state за актуални числа по зони.` +
    ` Отказвай учтиво теми извън пожарната ситуация.`
  );
}

export async function getOrCreateFireAssistant(fireId: number) {
  const [row] = await db.select().from(fireAiResources).where(eq(fireAiResources.fireId, fireId)).limit(1);
  // If assistant exists, ensure model is up-to-date and return
  if (row) {
    try {
      const client = openai();
      await client.beta.assistants.update(row.assistantId, {
        model: DEFAULT_MODEL,
        tool_resources: { file_search: { vector_store_ids: [row.vectorStoreId] } },
      });
    } catch {}
    return row;
  }

  const client = openai();
  // Create empty vector store
  const vs = await client.beta.vectorStores.create({ name: `fire-${fireId}-kb` });
  // Create assistant with file_search tool and our function tool
  const asst = await client.beta.assistants.create({
    name: `${ASSISTANT_NAME_PREFIX} #${fireId}`,
    model: DEFAULT_MODEL,
    instructions: instructionsForFire(fireId),
    tools: [
      { type: "file_search" },
      {
        type: "function",
        function: {
          name: "get_fire_state",
          description: "Връща актуално състояние: зони, членове, общи броячи за пожара.",
          parameters: { type: "object", properties: {}, additionalProperties: false },
        },
      },
    ],
    tool_resources: { file_search: { vector_store_ids: [vs.id] } },
    metadata: { fireId: String(fireId), app: "ignis" },
  });

  const [saved] = await db
    .insert(fireAiResources)
    .values({ fireId, assistantId: asst.id, vectorStoreId: vs.id })
    .onConflictDoUpdate({
      target: fireAiResources.fireId,
      set: { assistantId: asst.id, vectorStoreId: vs.id, updatedAt: new Date() },
    })
    .returning();
  return saved;
}

export async function syncFireKnowledge(fireId: number) {
  const client = openai();
  const res = await getOrCreateFireAssistant(fireId);
  const { content } = await buildFireKnowledge({ fireId });

  // Write to tmp file and upload
  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), `fire-${fireId}-kb-`));
  const filePath = path.join(tmpDir, `fire-${fireId}-knowledge.md`);
  await fs.promises.writeFile(filePath, content, "utf8");

  const file = await client.files.create({ file: fs.createReadStream(filePath), purpose: "assistants" });
  await client.beta.vectorStores.files.create(res.vectorStoreId, { file_id: file.id });

  return { ok: true, vectorStoreId: res.vectorStoreId, bytes: content.length };
}

export async function getOrCreateThread(fireId: number, userId: number) {
  const [row] = await db
    .select()
    .from(fireAiThreads)
    .where(and(eq(fireAiThreads.fireId, fireId), eq(fireAiThreads.userId, userId)))
    .limit(1);
  if (row) return row.threadId;
  const client = openai();
  const thread = await client.beta.threads.create({ metadata: { fireId: String(fireId), userId: String(userId) } });
  const [saved] = await db
    .insert(fireAiThreads)
    .values({ fireId, userId, threadId: thread.id })
    .onConflictDoUpdate({ target: [fireAiThreads.fireId, fireAiThreads.userId], set: { threadId: thread.id, updatedAt: new Date() } })
    .returning();
  return saved.threadId;
}

export async function toolGetFireState(fireId: number) {
  // Build a lightweight, fresh snapshot for reasoning
  const z = await db
    .select({ id: zones.id, title: zones.title, geomType: zones.geomType, centerLat: zones.centerLat, centerLng: zones.centerLng, radiusM: zones.radiusM })
    .from(zones)
    .where(eq(zones.fireId, fireId));

  const membersRaw = await db
    .select({ zoneId: zoneMembers.zoneId, n: sql<number>`count(*)` })
    .from(zoneMembers)
    .where(eq(zoneMembers.fireId, fireId))
    .groupBy(zoneMembers.zoneId);
  const members: Record<number, number> = {};
  for (const r of membersRaw) members[r.zoneId] = Number(r.n || 0);

  const volunteerCounts = await db
    .select({
      confirmed: sql<number>`sum(case when ${fireVolunteers.status}='confirmed' then 1 else 0 end)` ,
      requested: sql<number>`sum(case when ${fireVolunteers.status}='requested' then 1 else 0 end)` ,
    })
    .from(fireVolunteers)
    .where(eq(fireVolunteers.fireId, fireId));

  let generalChatLast: { id: number; message: string; createdAt: Date }[] = [];
  if (canUseSendbird()) {
    try {
      const sb = await listChannelMessages(fireChannelUrl(fireId), 30);
      generalChatLast = sb.map((m) => ({ id: m.message_id, message: m.message || '', createdAt: new Date(m.created_at) }));
    } catch {}
  }
  if (generalChatLast.length === 0) {
    try {
      generalChatLast = await db
        .select({ id: chatMessages.id, message: chatMessages.message, createdAt: chatMessages.createdAt })
        .from(chatMessages)
        .where(and(eq(chatMessages.fireId, fireId), isNull(chatMessages.zoneId), isNull(chatMessages.deletedAt)))
        .orderBy(desc(chatMessages.createdAt))
        .limit(30);
    } catch {}
  }

  return {
    zones: z.map((zz) => ({ id: zz.id, title: zz.title, members: members[zz.id] || 0, geom: { type: zz.geomType, centerLat: zz.centerLat, centerLng: zz.centerLng, radiusM: zz.radiusM } })),
    volunteers: { confirmed: Number(volunteerCounts[0]?.confirmed || 0), requested: Number(volunteerCounts[0]?.requested || 0) },
    generalChatLast: generalChatLast.map((m) => ({ id: m.id, at: m.createdAt, text: m.message.slice(0, 500) })),
  };
}

export async function askFireAssistant({ fireId, userId, message }: { fireId: number; userId: number; message: string }) {
  const client = openai();
  const { assistantId } = await getOrCreateFireAssistant(fireId);
  const threadId = await getOrCreateThread(fireId, userId);

  // Ensure we have at least one knowledge file uploaded (best-effort, non-blocking)
  try { syncFireKnowledge(fireId).catch(() => {}); } catch {}

  // Post user message
  await client.beta.threads.messages.create(threadId, { role: "user", content: message });

  // Start run with attached vector store
  let run = await client.beta.threads.runs.create(threadId, {
    assistant_id: assistantId,
  });

  // Poll + handle tool calls (longer budget to avoid empty answers)
  const MAX_STEPS = 50; // ~ up to ~35s with sleeps below
  for (let i = 0; i < MAX_STEPS; i++) {
    run = await client.beta.threads.runs.retrieve(threadId, run.id);
    if (run.status === "completed") break;
    if (run.status === "requires_action" && run.required_action?.type === "submit_tool_outputs") {
      const calls = run.required_action.submit_tool_outputs.tool_calls || [];
      const outputs: { tool_call_id: string; output: string }[] = [];
      for (const c of calls) {
        if (c.function.name === "get_fire_state") {
          const snapshot = await toolGetFireState(fireId);
          outputs.push({ tool_call_id: c.id, output: JSON.stringify(snapshot) });
        }
      }
      await client.beta.threads.runs.submitToolOutputs(threadId, run.id, { tool_outputs: outputs });
      continue;
    }
    if (run.status === "failed" || run.status === "cancelled" || run.status === "expired") {
      throw new Error(`Assistant run ${run.status}`);
    }
    await new Promise((r) => setTimeout(r, 700));
  }

  // Fetch latest assistant messages for this run
  const msgs = await client.beta.threads.messages.list(threadId, { order: "desc", limit: 30 });
  const textChunks: string[] = [];
  for (const m of msgs.data) {
    if (m.run_id !== run.id) continue;
    if (m.role !== "assistant") continue;
    for (const pc of m.content) {
      if (pc.type === "text") textChunks.push(pc.text.value);
    }
  }
  let answer = textChunks.reverse().join("\n\n").trim();
  // Fallback: if nothing matched this run (e.g. eventual consistency), take most recent assistant text
  if (!answer) {
    const fallback = msgs.data.find((m) => m.role === "assistant");
    if (fallback) {
      const buf: string[] = [];
      for (const pc of fallback.content) if (pc.type === "text") buf.push(pc.text.value);
      answer = buf.join("\n\n").trim();
    }
  }
  return { ok: true, answer, threadId };
}
