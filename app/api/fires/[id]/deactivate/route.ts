import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { db } from "@/lib/db";
import { users, fires, fireVolunteers, fireDeactivationVotes } from "@/lib/db/schema";
import { and, count, desc, eq, sql } from "drizzle-orm";

export const runtime = "nodejs";

async function getLocalUser() {
  const session = await auth0.getSession();
  const email = session?.user?.email;
  if (!email) return null;
  const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (row) return row;
  const [created] = await db.insert(users).values({ email, name: session?.user?.name ?? null }).returning();
  return created;
}

function percentThreshold(total: number) {
  const pct = Number(process.env.FIRE_DEACTIVATION_PERCENT || 0.5);
  const minVotes = Number(process.env.FIRE_DEACTIVATION_MIN_VOTES || 2);
  const required = Math.max(minVotes, Math.ceil(total * (Number.isFinite(pct) ? pct : 0.5)));
  return required;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const fireId = Number(id);
    if (!Number.isFinite(fireId)) return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });

    const [fire] = await db.select().from(fires).where(eq(fires.id, fireId)).limit(1);
    if (!fire) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

    const me = await getLocalUser();

    const totalConfirmedRow = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(fireVolunteers)
      .where(and(eq(fireVolunteers.fireId, fireId), eq(fireVolunteers.status, 'confirmed')))
      .limit(1);
    const totalConfirmed = totalConfirmedRow[0]?.c ?? 0;

    const votesRow = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(fireDeactivationVotes)
      .where(eq(fireDeactivationVotes.fireId, fireId))
      .limit(1);
    const votes = votesRow[0]?.c ?? 0;

    let hasVoted = false;
    if (me) {
      const hv = await db
        .select({ c: sql<number>`count(*)::int` })
        .from(fireDeactivationVotes)
        .where(and(eq(fireDeactivationVotes.fireId, fireId), eq(fireDeactivationVotes.userId, me.id)))
        .limit(1);
      hasVoted = (hv[0]?.c ?? 0) > 0;
    }

    const required = percentThreshold(totalConfirmed);
    return NextResponse.json({ ok: true, status: fire.status, votes, required, totalConfirmed, hasVoted });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Error" }, { status: 500 });
  }
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const fireId = Number(id);
    if (!Number.isFinite(fireId)) return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });

    const me = await getLocalUser();
    if (!me) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const [fire] = await db.select().from(fires).where(eq(fires.id, fireId)).limit(1);
    if (!fire) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    if (fire.status !== 'active') return NextResponse.json({ ok: true, status: fire.status, votes: 0, required: 0 });

    // Must be confirmed volunteer to vote
    const v = await db
      .select()
      .from(fireVolunteers)
      .where(and(eq(fireVolunteers.fireId, fireId), eq(fireVolunteers.userId, me.id), eq(fireVolunteers.status, 'confirmed')))
      .limit(1);
    if (!v.length) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

    // Upsert vote
    await db
      .insert(fireDeactivationVotes)
      .values({ fireId, userId: me.id })
      .onConflictDoNothing();

    // Count votes and total confirmed
    const totalConfirmedRow = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(fireVolunteers)
      .where(and(eq(fireVolunteers.fireId, fireId), eq(fireVolunteers.status, 'confirmed')))
      .limit(1);
    const totalConfirmed = totalConfirmedRow[0]?.c ?? 0;

    const votesRow = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(fireDeactivationVotes)
      .where(eq(fireDeactivationVotes.fireId, fireId))
      .limit(1);
    const votes = votesRow[0]?.c ?? 0;

    const required = percentThreshold(totalConfirmed);

    if (votes >= required && totalConfirmed > 0) {
      await db.update(fires).set({ status: 'inactive', deactivatedAt: new Date(), updatedAt: new Date() }).where(eq(fires.id, fireId));
    }

    return NextResponse.json({ ok: true, votes, required });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Error" }, { status: 500 });
  }
}

