import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generateCertificateForUser, listMyCertificates, periodKey } from "@/lib/ai/certificates";

export const runtime = "nodejs";

async function ensureLocalUser() {
  const session = await auth0.getSession();
  const email = session?.user?.email;
  if (!email) return null;
  const row = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return row[0] || null;
}

export async function GET() {
  const me = await ensureLocalUser();
  if (!me) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const list = await listMyCertificates(me.id);
  return NextResponse.json({ ok: true, certificates: list });
}

export async function POST(req: Request) {
  try {
    const me = await ensureLocalUser();
    if (!me) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const body = (await req.json().catch(() => ({}))) as { period?: string };
    const period = (body.period && /^(\d{4})-(\d{2})$/.test(body.period)) ? body.period : periodKey();
    const res = await generateCertificateForUser(me.id, period);
    return NextResponse.json({ ok: true, id: res.id });
  } catch (e: any) {
    const msg = e?.message || "Error";
    const status = msg === "CertificateAlreadyExists" ? 409 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

