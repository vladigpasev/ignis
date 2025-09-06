import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { fires, fireDeactivationVotes } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export const runtime = "nodejs";

function timingSafeEqual(a: string, b: string) {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function verifySignature(raw: string, headerSig: string | null | undefined) {
  const token = process.env.SENDBIRD_WEBHOOK_TOKEN;
  if (!token) return true; // if not configured, skip verification (dev)
  if (!headerSig) return false;
  const hmac = crypto.createHmac("sha256", token);
  hmac.update(raw);
  const digest = hmac.digest("hex");
  return timingSafeEqual(digest, headerSig);
}

function extractFireId(channelUrl: string | null | undefined): number | null {
  if (!channelUrl) return null;
  // Expected formats: fire-<id> or fire-<id>-zone-<zoneId>
  const m = channelUrl.match(/^fire-(\d+)(?:-zone-(\d+))?$/);
  if (!m) return null;
  const id = Number(m[1]);
  return Number.isFinite(id) ? id : null;
}

export async function POST(req: Request) {
  try {
    const raw = await req.text();
    const sig = req.headers.get("x-sendbird-signature") || req.headers.get("X-Sendbird-Signature");
    if (!verifySignature(raw, sig)) {
      return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });
    }

    let body: any = {};
    try { body = JSON.parse(raw); } catch {}

    // Only react to message events
    const category = String(body?.category || "");
    if (!category.includes("message")) return NextResponse.json({ ok: true });

    const channelUrl: string | undefined = body?.channel?.channel_url || body?.channel_url || body?.channel?.url;
    const fireId = extractFireId(channelUrl);
    if (!fireId) return NextResponse.json({ ok: true });

    const ts: number | undefined = body?.ts || body?.message?.created_at || body?.created_at;
    const when = ts && Number.isFinite(Number(ts)) ? new Date(Number(ts)) : new Date();

    // Mark activity and auto-reactivate if needed; clear votes
    try {
      await db
        .update(fires)
        .set({ lastActivityAt: when, updatedAt: new Date(), status: 'active', deactivatedAt: null })
        .where(eq(fires.id, fireId));
      await db.delete(fireDeactivationVotes).where(eq(fireDeactivationVotes.fireId, fireId));
    } catch (e) {
      // ignore
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Error" }, { status: 500 });
  }
}

