import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  zones,
  zoneMembers,
  zoneGalleryImages,
  zoneUpdates,
  zoneUpdateImages,
  users,
  fireVolunteers,
} from "@/lib/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { auth0 } from "@/lib/auth0";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; zoneId: string }> }) {
  const { id, zoneId } = await params;
  const fireId = Number(id);
  const z = Number(zoneId);

  const zone = await db.select().from(zones).where(and(eq(zones.id, z), eq(zones.fireId, fireId))).limit(1);
  if (!zone.length) return NextResponse.json({ ok: false, error: "Zone not found" }, { status: 404 });

  const members = await db
    .select({
      userId: zoneMembers.userId,
      name: users.name,
      email: users.email,
      joinedAt: zoneMembers.createdAt,
    })
    .from(zoneMembers)
    .leftJoin(users, eq(users.id, zoneMembers.userId))
    .where(and(eq(zoneMembers.zoneId, z)));

  const gallery = await db
    .select()
    .from(zoneGalleryImages)
    .where(eq(zoneGalleryImages.zoneId, z))
    .orderBy(desc(zoneGalleryImages.createdAt));

  const updates = await db
    .select({
      id: zoneUpdates.id,
      text: zoneUpdates.text,
      createdAt: zoneUpdates.createdAt,
      userId: zoneUpdates.userId,
      name: users.name,
      email: users.email,
    })
    .from(zoneUpdates)
    .leftJoin(users, eq(users.id, zoneUpdates.userId))
    .where(eq(zoneUpdates.zoneId, z))
    .orderBy(desc(zoneUpdates.createdAt))
    .limit(50);

  const updIds = updates.map((u) => u.id);
  const imagesMap: Record<number, any[]> = {};
  if (updIds.length) {
    const rows = await db.select().from(zoneUpdateImages).where(inArray(zoneUpdateImages.updateId, updIds));
    for (const r of rows) {
      (imagesMap[(r as any).updateId] ||= []).push(r);
    }
  }

  // Determine viewer's membership for this fire (if logged in)
  let myZoneId: number | null = null;
  let viewerUserId: number | null = null;
  try {
    const session = await auth0.getSession();
    const email = session?.user?.email;
    if (email) {
      const u = await db.select().from(users).where(eq(users.email, email)).limit(1);
      const me = u[0];
      if (me) {
        viewerUserId = me.id;
        const row = await db
          .select({ zoneId: zoneMembers.zoneId })
          .from(zoneMembers)
          .where(and(eq(zoneMembers.fireId, fireId), eq(zoneMembers.userId, me.id)))
          .limit(1);
        myZoneId = row[0]?.zoneId ?? null;
      }
    }
  } catch {}

  return NextResponse.json({
    ok: true,
    zone: zone[0],
    members,
    gallery,
    updates: updates.map((u) => ({ ...u, images: imagesMap[u.id] || [] })),
    myZoneId,
    isMember: myZoneId != null && myZoneId === z,
    viewerUserId,
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; zoneId: string }> }) {
  const { id, zoneId } = await params;
  const fireId = Number(id);
  const z = Number(zoneId);

  const { addGalleryImage } = (await req.json().catch(() => ({}))) as any;
  if (addGalleryImage?.url && addGalleryImage?.key) {
    const session = await auth0.getSession();
    const email = session?.user?.email;
    if (!email) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const u = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const me = u[0];
    if (!me) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const row = await db
      .select()
      .from(fireVolunteers)
      .where(and(eq(fireVolunteers.fireId, fireId), eq(fireVolunteers.userId, me.id), eq(fireVolunteers.status, "confirmed")))
      .limit(1);
    if (!row.length) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    await db
      .insert(zoneGalleryImages)
      .values({ zoneId: z, userId: me.id, s3Key: addGalleryImage.key, url: addGalleryImage.url });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "No-op" }, { status: 400 });
}
