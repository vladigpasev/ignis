import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chatBlocks, fireVolunteers, users } from "@/lib/db/schema";
import { auth0 } from "@/lib/auth0";
import { and, eq } from "drizzle-orm";

export const runtime = "nodejs";

async function getLocalUser() {
  const session = await auth0.getSession();
  if (!session?.user?.email) return null;
  const email = session.user.email;
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (rows.length) return rows[0];
  const [created] = await db.insert(users).values({ email, name: session.user.name ?? null }).returning();
  return created;
}

async function requireConfirmedVolunteer(fireId: number, userId: number) {
  const rows = await db
    .select()
    .from(fireVolunteers)
    .where(and(eq(fireVolunteers.fireId, fireId), eq(fireVolunteers.userId, userId), eq(fireVolunteers.status, "confirmed")))
    .limit(1);
  if (!rows.length) throw new Error("Forbidden");
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fireId = Number(id);
  const list = await db.select().from(chatBlocks).where(eq(chatBlocks.fireId, fireId));
  return NextResponse.json({ ok: true, blocks: list });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const fireId = Number(id);
    const me = await getLocalUser();
    if (!me) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    await requireConfirmedVolunteer(fireId, me.id);

    const { blockedUserId } = (await req.json().catch(() => ({}))) as { blockedUserId?: number };
    if (!Number.isFinite(blockedUserId))
      return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });

    // Do not allow blocking confirmed volunteers
    const alreadyConfirmed = await db
      .select()
      .from(fireVolunteers)
      .where(and(eq(fireVolunteers.fireId, fireId), eq(fireVolunteers.userId, Number(blockedUserId)), eq(fireVolunteers.status, "confirmed")))
      .limit(1);
    if (alreadyConfirmed.length) {
      return NextResponse.json({ ok: false, error: "Cannot block confirmed volunteer" }, { status: 400 });
    }

    await db
      .insert(chatBlocks)
      .values({ fireId, blockedUserId: Number(blockedUserId), blockedByUserId: me.id })
      .onConflictDoNothing();

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const msg = e?.message || "Error";
    const status = msg === "Forbidden" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { searchParams } = new URL(req.url);
    const uid = Number(searchParams.get("userId"));
    const { id } = await params;
    const fireId = Number(id);
    const me = await getLocalUser();
    if (!me) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    await requireConfirmedVolunteer(fireId, me.id);

    await db.delete(chatBlocks).where(and(eq(chatBlocks.fireId, fireId), eq(chatBlocks.blockedUserId, uid)));
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const msg = e?.message || "Error";
    const status = msg === "Forbidden" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
