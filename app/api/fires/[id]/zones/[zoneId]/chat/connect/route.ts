import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { db } from "@/lib/db";
import { users, zoneMembers, zones } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { ensureSbUser, getOrCreateZoneChannel, joinUserToChannel } from "@/lib/sendbird";

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

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; zoneId: string }> }) {
  try {
    const { id, zoneId } = await params;
    const fireId = Number(id);
    const z = Number(zoneId);

    const me = await getLocalUser();
    if (!me) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    // Require that user is a member of some zone in this fire and that it matches z
    const membership = await db.select().from(zoneMembers).where(and(eq(zoneMembers.fireId, fireId), eq(zoneMembers.userId, me.id))).limit(1);
    if (!membership.length || membership[0].zoneId !== z) {
      return NextResponse.json({ ok: false, error: "Not a member of this zone" }, { status: 403 });
    }

    // Resolve zone title
    const zr = await db.select().from(zones).where(and(eq(zones.id, z), eq(zones.fireId, fireId))).limit(1);
    const zoneTitle = zr[0]?.title ?? null;

    const sbUserId = `user-${me.id}`;
    const sbUser = await ensureSbUser(sbUserId, me.name || me.email);
    const channelUrl = await getOrCreateZoneChannel(fireId, z, zoneTitle);
    await joinUserToChannel(channelUrl, sbUserId);

    return NextResponse.json({
      ok: true,
      appId: process.env.NEXT_PUBLIC_SENDBIRD_APP_ID,
      userId: sbUser.user_id,
      nickname: me.name || me.email,
      accessToken: sbUser.access_token || null,
      channelUrl,
    });
  } catch (e: any) {
    console.error("[sendbird/zone-connect]", e);
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}

