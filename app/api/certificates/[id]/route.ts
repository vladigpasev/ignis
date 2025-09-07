import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { db } from "@/lib/db";
import { userCertificates, users } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export const runtime = "nodejs";

async function getMe() {
  const session = await auth0.getSession();
  const email = session?.user?.email;
  if (!email) return null;
  const row = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return row[0] || null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cid = Number(id);
  if (!Number.isFinite(cid)) return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
  const me = await getMe();
  if (!me) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const row = await db
    .select()
    .from(userCertificates)
    .where(and(eq(userCertificates.id, cid), eq(userCertificates.userId, me.id)))
    .limit(1);
  const cert = row[0];
  if (!cert) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, certificate: cert });
}

