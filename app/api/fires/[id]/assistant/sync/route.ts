import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { syncFireKnowledge } from "@/lib/ai/fire-assistant";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth0.getSession();
    if (!session?.user?.email) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const fireId = Number(id);
    if (!Number.isFinite(fireId)) return NextResponse.json({ ok: false, error: "Invalid fire id" }, { status: 400 });
    const res = await syncFireKnowledge(fireId);
    return NextResponse.json(res);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Sync failed" }, { status: 500 });
  }
}
