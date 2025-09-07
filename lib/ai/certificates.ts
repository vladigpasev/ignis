import { openai, DEFAULT_MODEL } from "@/lib/ai/openai";
import { db } from "@/lib/db";
import { userCertificates, users } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { buildUserActivity } from "./user-activity";

export function periodKey(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function periodWindow(key: string): { start: Date; end: Date } {
  const [y, m] = key.split("-").map((x) => Number(x));
  const start = new Date(Date.UTC(y, (m - 1), 1, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 0, 23, 59, 59)); // last day of month
  return { start, end };
}

type AiOutput = {
  title?: string;
  summary: string;
  qualities: { name: string; description: string; evidence?: string[]; score?: number }[];
  metrics?: Record<string, number>;
  badge?: string;
};

export async function listMyCertificates(userId: number) {
  return await db
    .select()
    .from(userCertificates)
    .where(eq(userCertificates.userId, userId))
    .orderBy(desc(userCertificates.createdAt));
}

export async function generateCertificateForUser(userId: number, forPeriod?: string) {
  const period = forPeriod || periodKey();
  // One per user per period
  const exists = await db
    .select({ id: userCertificates.id })
    .from(userCertificates)
    .where(and(eq(userCertificates.userId, userId), eq(userCertificates.period, period)))
    .limit(1);
  if (exists.length) {
    throw new Error("CertificateAlreadyExists");
  }

  const { start, end } = periodWindow(period);
  const activity = await buildUserActivity(userId, { start, end });

  const urow = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const displayName = urow[0]?.name || urow[0]?.email || `User #${userId}`;

  let parsed: AiOutput | null = null;
  // Try AI first, but fall back gracefully if unavailable
  let aiError: any = null;
  try {
    const client = openai();
    const sys = `You generate volunteer contribution certificates. Use English only. Be fair, conservative, and grounded strictly in provided data. Output clean JSON only.`;
  const schema = {
    type: "object",
    properties: {
      title: { type: "string" },
      summary: { type: "string" },
      qualities: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            evidence: { type: "array", items: { type: "string" } },
            score: { type: "number" },
          },
          required: ["name", "description"],
        },
      },
      metrics: { type: "object", additionalProperties: { type: "number" } },
      badge: { type: "string" },
    },
    required: ["summary", "qualities"],
    additionalProperties: true,
  } as const;

  const userContext = {
    user: { id: userId, name: displayName },
    period,
    window: { start: activity.window.start.toISOString(), end: activity.window.end.toISOString() },
    metrics: activity.metrics,
    firesInvolved: activity.firesInvolved,
    samples: activity.sample,
  };

  // Compose
  const prompt = [
    {
      role: "system" as const,
      content: sys,
    },
    {
      role: "user" as const,
      content:
        `Generate a recognition certificate summary for ${displayName}. ` +
        `Scope strictly to the activity and window below. ` +
        `Highlight 3-6 qualities with brief, specific descriptions grounded in evidence. ` +
        `Keep the main summary to ~100-140 words. ` +
        `If activity is low, still be supportive but honest.\n\n` +
        `Return ONLY compact JSON following this schema (no markdown, no extra text).\n\n` +
        `Schema: ${JSON.stringify(schema)}\n\n` +
        `Data: ${JSON.stringify(userContext).slice(0, 100000)}`,
    },
  ];

    const res = await client.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: prompt,
      temperature: 0.5,
      response_format: { type: "json_object" },
    });
    const content = res.choices[0]?.message?.content || '{}';
    try {
      parsed = JSON.parse(content) as AiOutput;
    } catch {
      parsed = null;
    }
  } catch (e) {
    aiError = e;
    parsed = null;
  }

  if (!parsed) {
    // Fallback summary using simple heuristics
    const m = activity.metrics;
    const parts: string[] = [];
    if (m.updates) parts.push(`${m.updates} zone updates published`);
    if (m.chat_messages) parts.push(`${m.chat_messages} chat messages shared`);
    if (m.update_images) parts.push(`${m.update_images} images uploaded`);
    const s = parts.length ? parts.join(", ") : "modest activity";
    parsed = {
      title: `Volunteer Certificate — ${period}`,
      summary: `${displayName} had ${s} during ${period}. Thank you for your contribution and engagement!`,
      qualities: [
        { name: "Engagement", description: "Consistent participation and contributions to team efforts." },
        { name: "Teamwork", description: "Positive collaboration in chats and zones." },
      ],
      metrics: activity.metrics,
    };
  }

  const [saved] = await db
    .insert(userCertificates)
    .values({
      userId,
      period,
      title: parsed.title || `Volunteer Certificate — ${period}`,
      summary: parsed.summary || null,
      traits: parsed.qualities || null,
      metrics: parsed.metrics || activity.metrics,
      data: { ...parsed, aiError: aiError ? String(aiError?.message || aiError) : undefined },
    })
    .returning();

  return saved;
}
