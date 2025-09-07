import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fires, type Fire, users, fireVolunteers, volunteerProfiles } from "@/lib/db/schema";
import { auth0 } from "@/lib/auth0";
import { eq, desc } from "drizzle-orm";
import { haversineMeters } from "@/lib/geo";
import { ensureSbUser, getOrCreateFireChannel, joinUserToChannel } from "@/lib/sendbird";

type FireDTO = Fire & { distanceM?: number };

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");
    const limitParam = searchParams.get("limit");

    const limit = Math.min(Math.max(Number(limitParam) || 500, 1), 2000);

    // Взимаме последните (по създаване) до limit
    const rows = (await db
      .select()
      .from(fires)
      .where(eq(fires.status, 'active'))
      .orderBy(desc(fires.createdAt))
      .limit(limit)) as Fire[];

    let data: FireDTO[] = rows;

    if (lat && lng && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng))) {
      const origin = { lat: Number(lat), lng: Number(lng) };
      data = rows
        .map((f) => ({
          ...f,
          distanceM: haversineMeters(origin, { lat: f.lat, lng: f.lng }),
        }))
        .sort((a, b) => (a.distanceM! - b.distanceM!));
    }

    return NextResponse.json({ ok: true, fires: data });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth0.getSession();
    const user = session?.user;
    if (!user?.email) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const lat = Number(body?.lat);
    const lng = Number(body?.lng);
    const radiusM = Math.round(Number(body?.radiusM));

    if (
      Number.isNaN(lat) || Number.isNaN(lng) || Number.isNaN(radiusM) ||
      lat < -90 || lat > 90 || lng < -180 || lng > 180 ||
      radiusM < 50 || radiusM > 20000
    ) {
      return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
    }

    // ensure local user
    let [local] = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
    if (!local) {
      [local] = await db.insert(users).values({ email: user.email, name: user.name ?? null }).returning();
    }

    // Gate by volunteer profile completion
    const vp = await db
      .select({ c: volunteerProfiles.completedAt })
      .from(volunteerProfiles)
      .where(eq(volunteerProfiles.userId, local.id))
      .limit(1);
    const completed = vp.length > 0 && !!vp[0].c;
    if (!completed) {
      return NextResponse.json({ ok: false, error: "Моля, попълнете профила си на доброволец преди да създадете пожар." }, { status: 403 });
    }

    const [created] = await db
      .insert(fires)
      .values({ lat, lng, radiusM, status: "active", createdBy: local.id })
      .returning();

    // creator -> confirmed volunteer
    await db
      .insert(fireVolunteers)
      .values({ fireId: created.id, userId: local.id, status: "confirmed" })
      .onConflictDoUpdate({
        target: [fireVolunteers.fireId, fireVolunteers.userId],
        set: { status: "confirmed", updatedAt: new Date() },
      });

    // Auto-join creator into Sendbird channel (best-effort)
    try {
      const sbUid = `user-${local.id}`;
      await ensureSbUser(sbUid, local.name || local.email);
      const channelUrl = await getOrCreateFireChannel(created.id);
      await joinUserToChannel(channelUrl, sbUid);
    } catch (e) {
      console.warn("[sendbird] auto-join failed on fire create", (e as any)?.message);
    }

    return NextResponse.json({ ok: true, fire: created });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
