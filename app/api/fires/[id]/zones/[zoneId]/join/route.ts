import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { zones, zoneMembers, users, fireVolunteers, fires, fireDeactivationVotes } from "@/lib/db/schema";
import { ensureSbUser, getOrCreateZoneChannel, joinUserToChannel } from "@/lib/sendbird";
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

export async function POST(req: Request, { params }: { params: Promise<{ id: string; zoneId: string }> }) {
  try {
    const { id, zoneId } = await params;
    const fireId = Number(id);
    const z = Number(zoneId);
    const { action } = (await req.json().catch(() => ({}))) as { action?: "join" | "leave" };

    const me = await getLocalUser();
    if (!me) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    await requireConfirmedVolunteer(fireId, me.id);

    const exists = await db.select().from(zones).where(and(eq(zones.id, z), eq(zones.fireId, fireId))).limit(1);
    if (!exists.length && action !== "leave")
      return NextResponse.json({ ok: false, error: "Zone not found" }, { status: 404 });

    if (action === "leave") {
      await db.delete(zoneMembers).where(and(eq(zoneMembers.fireId, fireId), eq(zoneMembers.userId, me.id)));
      return NextResponse.json({ ok: true });
    }

    await db
      .insert(zoneMembers)
      .values({ zoneId: z, fireId, userId: me.id })
      .onConflictDoUpdate({
        target: [zoneMembers.fireId, zoneMembers.userId],
        set: { zoneId: z },
      });

    try {
      await db.update(fires).set({ lastActivityAt: new Date(), updatedAt: new Date(), status: 'active', deactivatedAt: null }).where(eq(fires.id, fireId));
      await db.delete(fireDeactivationVotes).where(eq(fireDeactivationVotes.fireId, fireId));
    } catch {}

    // Auto-join Sendbird zone channel (best-effort)
    try {
      const sbUid = `user-${me.id}`;
      await ensureSbUser(sbUid, me.name || me.email);
      const channelUrl = await getOrCreateZoneChannel(fireId, z, exists[0]?.title ?? null);
      await joinUserToChannel(channelUrl, sbUid);
    } catch (e) {
      console.warn("[sendbird] auto-join zone failed", (e as any)?.message);
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const msg = e?.message || "Error";
    const status = msg === "Forbidden" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
