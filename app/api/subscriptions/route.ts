import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notificationSubscriptions, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth0 } from "@/lib/auth0";
import crypto from "node:crypto";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const session = await auth0.getSession();
    const authUser = session?.user;
    if (!authUser?.email) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const phone = typeof body?.phone === 'string' ? body.phone.trim() : null;
    const lat = Number(body?.lat);
    const lng = Number(body?.lng);
    const radiusKmRaw = Number(body?.radiusKm);
    const radiusKm = Number.isFinite(radiusKmRaw) ? Math.max(1, Math.min(200, Math.round(radiusKmRaw))) : 15;
    // Force sources: reports only
    const sourceFirms = 0;
    const sourceReports = 1;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
    }

    // Ensure local user record
    let [me] = await db.select().from(users).where(eq(users.email, authUser.email)).limit(1);
    if (!me) {
      [me] = await db.insert(users).values({ email: authUser.email, name: authUser.name ?? null }).returning();
    }

    const unsubscribeToken = crypto.randomBytes(16).toString('hex');

    const [row] = await db.insert(notificationSubscriptions).values({
      userId: me.id,
      email: authUser.email,
      phone: phone || null,
      lat,
      lng,
      radiusKm,
      sourceFirms,
      sourceReports,
      active: 1,
      unsubscribeToken,
    }).returning();

    return NextResponse.json({ ok: true, subscription: row });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
