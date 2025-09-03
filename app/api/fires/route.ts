import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fires, type Fire } from "@/lib/db/schema";
import { auth0 } from "@/lib/auth0";
import { eq, desc } from "drizzle-orm";
import { haversineMeters } from "@/lib/geo";

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
    if (!user) {
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

    // Ако имаме локален mapping между auth0 и users, може да го използваме; иначе оставяме null
    // Демонстрационно: няма директен user.id тук – оставяме createdBy = null
    const [created] = await db
      .insert(fires)
      .values({
        lat,
        lng,
        radiusM,
        status: "active",
        createdBy: null,
      })
      .returning();

    return NextResponse.json({ ok: true, fire: created });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}

