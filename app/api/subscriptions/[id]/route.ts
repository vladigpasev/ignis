import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notificationSubscriptions, users } from "@/lib/db/schema";
import { auth0 } from "@/lib/auth0";
import { and, eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const session = await auth0.getSession();
    const authUser = session?.user;
    if (!authUser?.email) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const subId = Number(id);
    if (!Number.isFinite(subId)) {
      return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
    }
    const [me] = await db.select().from(users).where(eq(users.email, authUser.email)).limit(1);
    if (!me) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const [row] = await db
      .select()
      .from(notificationSubscriptions)
      .where(and(eq(notificationSubscriptions.id, subId), eq(notificationSubscriptions.userId, me.id)))
      .limit(1);
    if (!row) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

    await db
      .update(notificationSubscriptions)
      .set({ active: 0, updatedAt: new Date() })
      .where(eq(notificationSubscriptions.id, subId));

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
