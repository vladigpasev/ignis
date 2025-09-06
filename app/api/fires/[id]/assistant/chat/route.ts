import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { askFireAssistant } from "@/lib/ai/fire-assistant";

export const runtime = "nodejs";

async function ensureLocalUser() {
  const session = await auth0.getSession();
  const email = session?.user?.email;
  if (!email) return null;
  const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (row) return row;
  const [created] = await db.insert(users).values({ email, name: session?.user?.name ?? null }).returning();
  return created;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await ensureLocalUser();
    if (!me) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const fireId = Number(id);
    if (!Number.isFinite(fireId)) return NextResponse.json({ ok: false, error: "Invalid fire id" }, { status: 400 });
    const body = (await req.json().catch(() => ({}))) as { message?: string };
    const msg = String(body?.message || "").trim().slice(0, 8000);
    if (!msg) return NextResponse.json({ ok: false, error: "Empty message" }, { status: 400 });
    const res = await askFireAssistant({ fireId, userId: me.id, message: msg });
    return NextResponse.json(res);
  } catch (e: any) {
    console.error("[assistant/chat]", e);
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}

