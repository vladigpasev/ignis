import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ensureSbUser, fireChannelUrl, getOrCreateFireChannel, inviteUserToChannel, joinUserToChannel } from "@/lib/sendbird";

export const runtime = "nodejs";

async function getLocalUser() {
  const session = await auth0.getSession();
  const email = session?.user?.email;
  if (!email) return null;
  const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (row) return row;
  const [created] = await db.insert(users).values({ email, name: session?.user?.name ?? null }).returning();
  return created;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const fireId = Number(id);
    if (!Number.isFinite(fireId)) return NextResponse.json({ ok: false, error: "Invalid fire id" }, { status: 400 });

    const me = await getLocalUser();
    if (!me) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const sbUserId = `user-${me.id}`;
    const sbUser = await ensureSbUser(sbUserId, me.name || me.email);
    const channelUrl = await getOrCreateFireChannel(fireId);
    // Invite to keep the original flow, then auto-join
    await inviteUserToChannel(channelUrl, sbUserId);
    await joinUserToChannel(channelUrl, sbUserId);

    return NextResponse.json({
      ok: true,
      appId: process.env.NEXT_PUBLIC_SENDBIRD_APP_ID,
      userId: sbUser.user_id,
      nickname: me.name || me.email,
      accessToken: sbUser.access_token || null,
      channelUrl,
    });
  } catch (e: any) {
    console.error("[sendbird/connect]", e);
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
