import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, zoneUpdates, zoneUpdateImages } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { auth0 } from "@/lib/auth0";

export const runtime = "nodejs";

async function getMe() {
  const session = await auth0.getSession();
  const email = session?.user?.email;
  if (!email) return null;
  const u = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return u[0] ?? null;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; zoneId: string; updateId: string }> }) {
  try {
    const { id, zoneId, updateId } = await params;
    const fireId = Number(id); // not used directly but part of path
    const z = Number(zoneId);
    const uId = Number(updateId);
    if (!Number.isFinite(fireId) || !Number.isFinite(z) || !Number.isFinite(uId)) {
      return NextResponse.json({ ok: false, error: "Invalid params" }, { status: 400 });
    }

    const me = await getMe();
    if (!me) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const row = await db.select().from(zoneUpdates).where(and(eq(zoneUpdates.id, uId), eq(zoneUpdates.zoneId, z))).limit(1);
    if (!row.length) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    if (row[0].userId !== me.id) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

    const body = (await req.json().catch(() => ({}))) as {
      text?: string | null;
      addImages?: { key: string; url: string; width?: number; height?: number }[];
      removeImageIds?: number[];
    };

    if (typeof body.text === "string") {
      await db.update(zoneUpdates).set({ text: body.text.trim() }).where(eq(zoneUpdates.id, uId));
    }

    if (Array.isArray(body.removeImageIds) && body.removeImageIds.length) {
      await db.delete(zoneUpdateImages).where(and(eq(zoneUpdateImages.updateId, uId), inArray(zoneUpdateImages.id, body.removeImageIds.slice(0, 100))));
    }

    if (Array.isArray(body.addImages) && body.addImages.length) {
      await db.insert(zoneUpdateImages).values(
        body.addImages.slice(0, 12).map((im) => ({ updateId: uId, s3Key: im.key, url: im.url, width: im.width ?? null, height: im.height ?? null }))
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const msg = e?.message || "Error";
    const status = msg === "Forbidden" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

