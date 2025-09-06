import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, fireVolunteers, zoneMembers, zones, zoneUpdates, zoneUpdateImages, fires, fireDeactivationVotes } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { auth0 } from "@/lib/auth0";

export const runtime = "nodejs";

async function getMe() {
  const session = await auth0.getSession();
  const email = session?.user?.email;
  if (!email) return null;
  const u = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return u[0] ?? null;
}

async function ensureConfirmedVolunteerInZone(fireId: number, zoneId: number, userId: number) {
  const v = await db
    .select()
    .from(fireVolunteers)
    .where(and(eq(fireVolunteers.fireId, fireId), eq(fireVolunteers.userId, userId), eq(fireVolunteers.status, "confirmed")))
    .limit(1);
  if (!v.length) throw new Error("Forbidden");
  // must also be a member of this specific zone
  const m = await db
    .select()
    .from(zoneMembers)
    .where(and(eq(zoneMembers.fireId, fireId), eq(zoneMembers.zoneId, zoneId), eq(zoneMembers.userId, userId)))
    .limit(1);
  if (!m.length) throw new Error("Forbidden");
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string; zoneId: string }> }) {
  try {
    const { id, zoneId } = await params;
    const fireId = Number(id);
    const z = Number(zoneId);
    if (!Number.isFinite(fireId) || !Number.isFinite(z)) return NextResponse.json({ ok: false, error: "Invalid params" }, { status: 400 });

    // validate zone belongs to fire
    const zrow = await db.select().from(zones).where(and(eq(zones.id, z), eq(zones.fireId, fireId))).limit(1);
    if (!zrow.length) return NextResponse.json({ ok: false, error: "Zone not found" }, { status: 404 });

    const me = await getMe();
    if (!me) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    await ensureConfirmedVolunteerInZone(fireId, z, me.id);

    const body = (await req.json().catch(() => ({}))) as { text?: string | null; images?: { key: string; url: string; width?: number; height?: number }[] };
    const text = typeof body.text === "string" ? body.text.trim() : null;
    const imgs = Array.isArray(body.images) ? body.images : [];
    if ((!text || text.length === 0) && imgs.length === 0) {
      return NextResponse.json({ ok: false, error: "Празно обновление" }, { status: 400 });
    }

    const [upd] = await db
      .insert(zoneUpdates)
      .values({ zoneId: z, userId: me.id, text })
      .returning();

    if (imgs.length) {
      await db.insert(zoneUpdateImages).values(
        imgs.slice(0, 12).map((im) => ({ updateId: upd.id, s3Key: im.key, url: im.url, width: im.width ?? null, height: im.height ?? null }))
      );
    }

    // Touch fire activity
    try {
      await db.update(fires).set({ lastActivityAt: new Date(), updatedAt: new Date(), status: 'active', deactivatedAt: null }).where(eq(fires.id, fireId));
      await db.delete(fireDeactivationVotes).where(eq(fireDeactivationVotes.fireId, fireId));
    } catch {}

    return NextResponse.json({ ok: true, id: upd.id });
  } catch (e: any) {
    const msg = e?.message || "Error";
    const status = msg === "Forbidden" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
