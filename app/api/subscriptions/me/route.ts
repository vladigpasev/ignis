import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notificationSubscriptions, users } from "@/lib/db/schema";
import { auth0 } from "@/lib/auth0";
import { and, desc, eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await auth0.getSession();
    const authUser = session?.user;
    if (!authUser?.email) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const [me] = await db.select().from(users).where(eq(users.email, authUser.email)).limit(1);
    if (!me) return NextResponse.json({ ok: true, subscriptions: [] });

    const rows = await db
      .select()
      .from(notificationSubscriptions)
      .where(eq(notificationSubscriptions.userId, me.id))
      .orderBy(desc(notificationSubscriptions.createdAt));

    return NextResponse.json({ ok: true, subscriptions: rows });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}

