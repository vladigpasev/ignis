import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chatMessages, users, zoneMembers } from "@/lib/db/schema";
import { auth0 } from "@/lib/auth0";
import { and, desc, eq, isNull } from "drizzle-orm";

export const runtime = "nodejs";

async function ensureUser() {
  const session = await auth0.getSession();
  if (!session?.user?.email) return null;
  const email = session.user.email;
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (rows.length) return rows[0];
  const [created] = await db.insert(users).values({ email, name: session.user.name ?? null }).returning();
  return created;
}

async function requireZoneMember(fireId: number, zoneId: number, userId: number) {
  const rows = await db
    .select()
    .from(zoneMembers)
    .where(and(eq(zoneMembers.fireId, fireId), eq(zoneMembers.zoneId, zoneId), eq(zoneMembers.userId, userId)))
    .limit(1);
  if (!rows.length) throw new Error("Forbidden");
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; zoneId: string }> }) {
  const { id, zoneId } = await params;
  const fireId = Number(id);
  const z = Number(zoneId);
  const limit = 150;

  const me = await ensureUser();
  if (!me) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  await requireZoneMember(fireId, z, me.id);

  const rows = await db
    .select({
      id: chatMessages.id,
      userId: chatMessages.userId,
      message: chatMessages.message,
      createdAt: chatMessages.createdAt,
      name: users.name,
      email: users.email,
    })
    .from(chatMessages)
    .leftJoin(users, eq(users.id, chatMessages.userId))
    .where(and(eq(chatMessages.fireId, fireId), eq(chatMessages.zoneId, z), isNull(chatMessages.deletedAt)))
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit);

  return NextResponse.json({ ok: true, messages: rows.reverse() });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string; zoneId: string }> }) {
  const { id, zoneId } = await params;
  const fireId = Number(id);
  const z = Number(zoneId);

  const me = await ensureUser();
  if (!me) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  try {
    await requireZoneMember(fireId, z, me.id);
  } catch {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { message } = (await req.json().catch(() => ({}))) as { message?: string };
  const body = String(message || "").trim().slice(0, 4000);
  if (!body) return NextResponse.json({ ok: false, error: "Empty message" }, { status: 400 });

  const [created] = await db.insert(chatMessages).values({ fireId, zoneId: z, userId: me.id, message: body }).returning();

  return NextResponse.json({ ok: true, message: { id: created.id } });
}

