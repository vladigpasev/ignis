import { db } from "@/lib/db";
import {
  chatMessages,
  fireVolunteers,
  users,
  zoneMembers,
  zones,
  zoneUpdateImages,
  zoneUpdates,
} from "@/lib/db/schema";
import { and, between, desc, eq, gte, lte, sql, inArray } from "drizzle-orm";

export type ActivityWindow = { start: Date; end: Date };

export type UserActivity = {
  window: ActivityWindow;
  updates: { id: number; text: string | null; createdAt: Date; zoneId: number; fireId: number }[];
  updateImagesCount: number;
  chat: { id: number; text: string; createdAt: Date; fireId: number; zoneId: number | null }[];
  volunteers: { fireId: number; status: string; joinedAt: Date }[];
  zonesJoined: { zoneId: number; fireId: number; joinedAt: Date }[];
  metrics: Record<string, number>;
  firesInvolved: number[]; // unique fire ids
  sample: {
    updates: { at: string; text: string }[];
    chat: { at: string; text: string }[];
  };
};

export async function buildUserActivity(userId: number, window: ActivityWindow): Promise<UserActivity> {
  const start = window.start;
  const end = window.end;

  const updates = await db
    .select({ id: zoneUpdates.id, text: zoneUpdates.text, createdAt: zoneUpdates.createdAt, zoneId: zoneUpdates.zoneId, fireId: zones.fireId })
    .from(zoneUpdates)
    .innerJoin(zones, eq(zones.id, zoneUpdates.zoneId))
    .where(and(eq(zoneUpdates.userId, userId), gte(zoneUpdates.createdAt, start), lte(zoneUpdates.createdAt, end)))
    .orderBy(desc(zoneUpdates.createdAt));

  const updateIds = updates.map((u) => u.id);
  let updateImagesCount = 0;
  if (updateIds.length) {
    const rows = await db
      .select({ n: sql<number>`count(*)` })
      .from(zoneUpdateImages)
      .where(inArray(zoneUpdateImages.updateId, updateIds as any));
    updateImagesCount = Number(rows[0]?.n || 0);
  }

  const chat = await db
    .select({ id: chatMessages.id, text: chatMessages.message, createdAt: chatMessages.createdAt, fireId: chatMessages.fireId, zoneId: chatMessages.zoneId })
    .from(chatMessages)
    .where(and(eq(chatMessages.userId, userId), gte(chatMessages.createdAt, start), lte(chatMessages.createdAt, end)))
    .orderBy(desc(chatMessages.createdAt));

  const volunteers = await db
    .select({ fireId: fireVolunteers.fireId, status: fireVolunteers.status, joinedAt: fireVolunteers.createdAt })
    .from(fireVolunteers)
    .where(and(eq(fireVolunteers.userId, userId), gte(fireVolunteers.createdAt, start), lte(fireVolunteers.createdAt, end)));

  const zonesJoined = await db
    .select({ zoneId: zoneMembers.zoneId, fireId: zoneMembers.fireId, joinedAt: zoneMembers.createdAt })
    .from(zoneMembers)
    .where(and(eq(zoneMembers.userId, userId), gte(zoneMembers.createdAt, start), lte(zoneMembers.createdAt, end)));

  const allDates: string[] = [];
  for (const u of updates) allDates.push(u.createdAt.toISOString().slice(0, 10));
  for (const c of chat) allDates.push(c.createdAt.toISOString().slice(0, 10));

  const firesSet = new Set<number>();
  for (const u of updates) if (u.fireId) firesSet.add(u.fireId);
  for (const c of chat) if (c.fireId) firesSet.add(c.fireId);
  for (const v of volunteers) if (v.fireId) firesSet.add(v.fireId);
  for (const z of zonesJoined) if (z.fireId) firesSet.add(z.fireId);

  const words =
    updates.reduce((acc, u) => acc + (u.text ? u.text.split(/\s+/).filter(Boolean).length : 0), 0) +
    chat.reduce((acc, c) => acc + (c.text ? c.text.split(/\s+/).filter(Boolean).length : 0), 0);

  const metrics: Record<string, number> = {
    updates: updates.length,
    update_images: updateImagesCount,
    chat_messages: chat.length,
    zones_joined: zonesJoined.length,
    fires_involved: firesSet.size,
    active_days: new Set(allDates).size,
    words_contributed: words,
  };

  const sample = {
    updates: updates.slice(0, 40).map((u) => ({ at: u.createdAt.toISOString(), text: (u.text || '').slice(0, 800) })),
    chat: chat.slice(0, 40).map((c) => ({ at: c.createdAt.toISOString(), text: (c.text || '').slice(0, 500) })),
  };

  return {
    window,
    updates,
    updateImagesCount,
    chat,
    volunteers,
    zonesJoined,
    metrics,
    firesInvolved: Array.from(firesSet.values()),
    sample,
  };
}
