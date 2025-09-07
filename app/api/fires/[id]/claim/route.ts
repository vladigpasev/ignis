import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth0 } from "@/lib/auth0";
import { users, fireVolunteers, volunteerProfiles } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export const runtime = "nodejs";

async function getLocalUser() {
  const session = await auth0.getSession();
  const u = session?.user;
  if (!u?.email) return null;
  let [me] = await db.select().from(users).where(eq(users.email, u.email)).limit(1);
  if (!me) {
    [me] = await db.insert(users).values({ email: u.email, name: u.name ?? null }).returning();
  }
  return me;
}

async function requireVolunteerCompleted(userId: number) {
  const rows = await db
    .select({ c: volunteerProfiles.completedAt })
    .from(volunteerProfiles)
    .where(eq(volunteerProfiles.userId, userId))
    .limit(1);
  const ok = rows.length > 0 && !!rows[0].c;
  if (!ok) throw new Error("ProfileIncomplete");
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const fireId = Number(id);
    if (!Number.isFinite(fireId)) return NextResponse.json({ ok: false, error: 'Invalid fireId' }, { status: 400 });

    const me = await getLocalUser();
    if (!me) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    await requireVolunteerCompleted(me.id);

    const existing = await db
      .select()
      .from(fireVolunteers)
      .where(and(eq(fireVolunteers.fireId, fireId), eq(fireVolunteers.userId, me.id)))
      .limit(1);
    if (existing.length === 0) {
      await db.insert(fireVolunteers).values({ fireId, userId: me.id, status: 'requested' });
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const msg = e?.message || 'Error';
    const status = msg === 'ProfileIncomplete' ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

