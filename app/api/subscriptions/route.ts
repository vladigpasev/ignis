import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notificationSubscriptions } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body?.email === 'string' ? body.email.trim() : null;
    const phone = typeof body?.phone === 'string' ? body.phone.trim() : null;
    const lat = Number(body?.lat);
    const lng = Number(body?.lng);
    const radiusKmRaw = Number(body?.radiusKm);
    const radiusKm = Number.isFinite(radiusKmRaw) ? Math.max(1, Math.min(200, Math.round(radiusKmRaw))) : 15;
    const sourceFirms = body?.sourceFirms === false ? 0 : 1;
    const sourceReports = body?.sourceReports === false ? 0 : 1;

    if ((!email && !phone) || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
    }

    const [row] = await db.insert(notificationSubscriptions).values({
      email: email || null,
      phone: phone || null,
      lat,
      lng,
      radiusKm,
      sourceFirms,
      sourceReports,
    }).returning();

    return NextResponse.json({ ok: true, subscription: row });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}

