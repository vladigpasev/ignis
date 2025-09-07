import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, volunteerProfiles, notificationSubscriptions } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { auth0 } from "@/lib/auth0";
import crypto from "node:crypto";

export const runtime = "nodejs";

async function getLocalUser() {
  const session = await auth0.getSession();
  const authUser = session?.user;
  if (!authUser?.email) return null;
  let [me] = await db.select().from(users).where(eq(users.email, authUser.email)).limit(1);
  if (!me) {
    [me] = await db.insert(users).values({ email: authUser.email, name: authUser.name ?? null }).returning();
  }
  return { authUser, me };
}

export async function GET() {
  try {
    const ctx = await getLocalUser();
    if (!ctx) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const { me } = ctx;
    const [p] = await db.select().from(volunteerProfiles).where(eq(volunteerProfiles.userId, me.id)).limit(1);
    const completed = !!p?.completedAt;
    return NextResponse.json({ ok: true, completed, profile: p || null });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getLocalUser();
    if (!ctx) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const { me, authUser } = ctx;

    const body = await req.json().catch(() => ({}));
    const phone = typeof body?.phone === 'string' ? body.phone.trim() : null;
    const city = typeof body?.city === 'string' ? body.city.trim() : null;
    const lat = Number(body?.lat);
    const lng = Number(body?.lng);
    const bio = typeof body?.bio === 'string' ? body.bio.trim() : null;
    const motivation = typeof body?.motivation === 'string' ? body.motivation.trim() : null;
    const skills = Array.isArray(body?.skills) ? body.skills : [];
    const transport = typeof body?.transport === 'object' && body.transport ? body.transport : {};
    const availability = typeof body?.availability === 'string' ? body.availability : null;
    const firstAid = body?.firstAid ? 1 : 0;
    const agreeContact = body?.agreeContact ? 1 : 0;

    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !city) {
      return NextResponse.json({ ok: false, error: "Missing city selection" }, { status: 400 });
    }

    const [row] = await db
      .insert(volunteerProfiles)
      .values({
        userId: me.id,
        phone: phone || null,
        city,
        lat,
        lng,
        bio,
        motivation,
        skills,
        transport,
        availability,
        firstAid,
        agreeContact,
        completedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [volunteerProfiles.userId],
        set: {
          phone: phone || null,
          city,
          lat,
          lng,
          bio,
          motivation,
          skills,
          transport,
          availability,
          firstAid,
          agreeContact,
          updatedAt: new Date(),
          completedAt: new Date(),
        },
      })
      .returning();

    // Ensure at least one notifications subscription exists for the user.
    // If none, create a volunteer default with 50km radius.
    const existingSubs = await db
      .select()
      .from(notificationSubscriptions)
      .where(eq(notificationSubscriptions.userId, me.id))
      .orderBy(desc(notificationSubscriptions.createdAt));
    if (existingSubs.length === 0) {
      const unsubscribeToken = crypto.randomBytes(16).toString('hex');
      await db.insert(notificationSubscriptions).values({
        userId: me.id,
        email: authUser.email || null,
        phone: phone || null,
        lat,
        lng,
        radiusKm: 50,
        sourceFirms: 0,
        sourceReports: 1,
        active: 1,
        unsubscribeToken,
      });
    }

    return NextResponse.json({ ok: true, profile: row, completed: true });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
