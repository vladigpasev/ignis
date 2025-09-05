import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { zones, users, fireVolunteers, zoneMembers } from "@/lib/db/schema";
import { auth0 } from "@/lib/auth0";
import { and, desc, eq, sql } from "drizzle-orm";

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

  const list = await db
    .select({
      id: zones.id,
      fireId: zones.fireId,
      title: zones.title,
      description: zones.description,
      geomType: zones.geomType,
      centerLat: zones.centerLat,
      centerLng: zones.centerLng,
      radiusM: zones.radiusM,
      polygon: zones.polygon,
      createdAt: zones.createdAt,
      members: sql<number>`count(${zoneMembers.id})::int`.as("members"),
    })
    .from(zones)
    .leftJoin(zoneMembers, eq(zoneMembers.zoneId, zones.id))
    .where(eq(zones.fireId, fireId))
    .groupBy(
      zones.id,
      zones.fireId,
      zones.title,
      zones.description,
      zones.geomType,
      zones.centerLat,
      zones.centerLng,
      zones.radiusM,
      zones.polygon,
      zones.createdAt,
    )
    .orderBy(desc(zones.createdAt));

  return NextResponse.json({ ok: true, zones: list });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const fireId = Number(id);
    const me = await getLocalUser();
    if (!me) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    await requireConfirmedVolunteer(fireId, me.id);

    const body = (await req.json().catch(() => ({}))) as any;
    const { title, description, geomType, centerLat, centerLng, radiusM, polygon } = body || {};
    if (geomType !== "circle" && geomType !== "polygon") {
      return NextResponse.json({ ok: false, error: "Invalid geomType" }, { status: 400 });
    }
    if (geomType === "circle") {
      if (![centerLat, centerLng, radiusM].every((x: any) => Number.isFinite(x))) {
        return NextResponse.json({ ok: false, error: "Invalid circle payload" }, { status: 400 });
      }
    } else {
      if (!Array.isArray(polygon) || polygon.length < 3) {
        return NextResponse.json({ ok: false, error: "Polygon needs >= 3 points" }, { status: 400 });
      }
    }

    const [created] = await db
      .insert(zones)
      .values({
        fireId,
        title: (title ?? "").slice(0, 120) || null,
        description: (description ?? "").slice(0, 4000) || null,
        geomType,
        centerLat: geomType === "circle" ? Number(centerLat) : null,
        centerLng: geomType === "circle" ? Number(centerLng) : null,
        radiusM: geomType === "circle" ? Math.max(20, Math.min(20000, Math.round(Number(radiusM)))) : null,
        polygon: geomType === "polygon" ? polygon : null,
        createdBy: me.id,
      })
      .returning();

    return NextResponse.json({ ok: true, zone: created });
  } catch (e: any) {
    const msg = e?.message || "Error";
    const status = msg === "Forbidden" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
