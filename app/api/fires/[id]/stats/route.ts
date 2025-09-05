import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fireVolunteers, zones, zoneMembers, chatMessages, fireJoinTokens, fireJoinTokenUses } from "@/lib/db/schema";
import { and, eq, sql, gte } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fireId = Number(id);

  const counts = await db
    .select({
      confirmed: sql<number>`sum(case when ${fireVolunteers.status} = 'confirmed' then 1 else 0 end)`,
      requested: sql<number>`sum(case when ${fireVolunteers.status} = 'requested' then 1 else 0 end)`,
    })
    .from(fireVolunteers)
    .where(eq(fireVolunteers.fireId, fireId));

  const zonesCount = await db.select({ n: sql<number>`count(*)` }).from(zones).where(eq(zones.fireId, fireId));

  const perZone = await db
    .select({ zoneId: zoneMembers.zoneId, members: sql<number>`count(*)` })
    .from(zoneMembers)
    .where(eq(zoneMembers.fireId, fireId))
    .groupBy(zoneMembers.zoneId);

  const now = new Date();
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const totalMessages = await db
    .select({ n: sql<number>`count(*)` })
    .from(chatMessages)
    .where(eq(chatMessages.fireId, fireId));

  const lastHour = await db
    .select({ n: sql<number>`count(*)` })
    .from(chatMessages)
    .where(and(eq(chatMessages.fireId, fireId), gte(chatMessages.createdAt, hourAgo)));

  const lastDay = await db
    .select({ n: sql<number>`count(*)` })
    .from(chatMessages)
    .where(and(eq(chatMessages.fireId, fireId), gte(chatMessages.createdAt, dayAgo)));

  const qrIssued = await db
    .select({ n: sql<number>`count(*)` })
    .from(fireJoinTokens)
    .where(eq(fireJoinTokens.fireId, fireId));
  const qrUsed = await db
    .select({ n: sql<number>`count(*)` })
    .from(fireJoinTokenUses)
    .where(eq(fireJoinTokenUses.tokenId, sql<number>`any(SELECT id FROM fire_join_tokens WHERE fire_id = ${fireId})` as any));

  return NextResponse.json({
    ok: true,
    stats: {
      volunteers: {
        confirmed: Number(counts[0]?.confirmed || 0),
        requested: Number(counts[0]?.requested || 0),
      },
      zones: {
        count: Number(zonesCount[0]?.n || 0),
        membersPerZone: perZone.map((r) => ({ zoneId: r.zoneId, members: Number(r.members || 0) })),
      },
      chat: {
        total: Number(totalMessages[0]?.n || 0),
        lastHour: Number(lastHour[0]?.n || 0),
        lastDay: Number(lastDay[0]?.n || 0),
      },
      qr: {
        issued: Number(qrIssued[0]?.n || 0),
        used: Number(qrUsed[0]?.n || 0),
      },
    },
  });
}

