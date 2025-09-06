import { db } from "@/lib/db";
import {
  fires,
  fireVolunteers,
  zones,
  zoneMembers,
  zoneUpdates,
  zoneUpdateImages,
  chatMessages,
  users,
  type Fire,
} from "@/lib/db/schema";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { canUseSendbird, fireChannelUrl, listChannelMessages, zoneChannelUrl } from "@/lib/sendbird";

export type FireKnowledgeOptions = {
  fireId: number;
  maxChat?: number; // total general chat messages
  maxZoneChat?: number; // per-zone chat messages
  maxUpdatesPerZone?: number;
};

export async function buildFireKnowledge({ fireId, maxChat = 400, maxZoneChat = 200, maxUpdatesPerZone = 50 }: FireKnowledgeOptions) {
  const [f] = (await db.select().from(fires).where(eq(fires.id, fireId)).limit(1)) as Fire[];
  if (!f) throw new Error("Fire not found");

  const vols = await db
    .select({ userId: fireVolunteers.userId, status: fireVolunteers.status, joinedAt: fireVolunteers.createdAt, updatedAt: fireVolunteers.updatedAt, name: users.name, email: users.email })
    .from(fireVolunteers)
    .leftJoin(users, eq(users.id, fireVolunteers.userId))
    .where(eq(fireVolunteers.fireId, fireId));

  const zlist = await db
    .select({
      id: zones.id,
      title: zones.title,
      description: zones.description,
      geomType: zones.geomType,
      centerLat: zones.centerLat,
      centerLng: zones.centerLng,
      radiusM: zones.radiusM,
      polygon: zones.polygon,
      createdAt: zones.createdAt,
    })
    .from(zones)
    .where(eq(zones.fireId, fireId));

  const membersPerZone = await db
    .select({ zoneId: zoneMembers.zoneId, userId: zoneMembers.userId })
    .from(zoneMembers)
    .where(eq(zoneMembers.fireId, fireId));

  const updates = await db
    .select({ id: zoneUpdates.id, zoneId: zoneUpdates.zoneId, userId: zoneUpdates.userId, text: zoneUpdates.text, createdAt: zoneUpdates.createdAt, name: users.name, email: users.email })
    .from(zoneUpdates)
    .leftJoin(users, eq(users.id, zoneUpdates.userId))
    .where(eq(zoneUpdates.zoneId, sql<number>`any(SELECT id FROM zones WHERE fire_id = ${fireId})` as any))
    .orderBy(desc(zoneUpdates.createdAt));

  const imgs = await db
    .select({ updateId: zoneUpdateImages.updateId, url: zoneUpdateImages.url, width: zoneUpdateImages.width, height: zoneUpdateImages.height })
    .from(zoneUpdateImages)
    .where(eq(zoneUpdateImages.updateId, sql<number>`any(SELECT id FROM zone_updates WHERE zone_id = any(SELECT id FROM zones WHERE fire_id = ${fireId}))` as any));

  let generalChatDb: { id: number; userId: number; message: string; createdAt: Date; name: string | null; email: string | null }[] = [];
  try {
    generalChatDb = await db
      .select({ id: chatMessages.id, userId: chatMessages.userId, message: chatMessages.message, createdAt: chatMessages.createdAt, name: users.name, email: users.email })
      .from(chatMessages)
      .leftJoin(users, eq(users.id, chatMessages.userId))
      .where(and(eq(chatMessages.fireId, fireId), isNull(chatMessages.zoneId), isNull(chatMessages.deletedAt)))
      .orderBy(desc(chatMessages.createdAt))
      .limit(maxChat);
  } catch {}

  // Map zoneId -> recent chats
  const perZoneChat: Record<number, { createdAt: Date; who: string; text: string }[]> = {};
  const useSb = canUseSendbird();
  if (useSb) {
    // Prefer Sendbird messages if available
    try {
      const fireChan = fireChannelUrl(fireId);
      const sbMsgs = await listChannelMessages(fireChan, maxChat);
      generalChatDb = sbMsgs.map((m) => ({
        id: m.message_id,
        userId: 0,
        message: m.message || '',
        createdAt: new Date(m.created_at),
        name: m.user?.nickname || null,
        email: m.user?.user_id || 'sendbird',
      })) as any;
    } catch {}
    for (const z of zlist) {
      try {
        const chan = zoneChannelUrl(fireId, z.id);
        const sb = await listChannelMessages(chan, maxZoneChat);
        perZoneChat[z.id] = sb.map((m) => ({ createdAt: new Date(m.created_at), who: m.user?.nickname || m.user?.user_id || 'user', text: m.message || '' }));
      } catch {
        perZoneChat[z.id] = [];
      }
    }
  } else {
    // Fallback to local DB chat (legacy)
    for (const z of zlist) {
      try {
        const rows = await db
          .select({ id: chatMessages.id, userId: chatMessages.userId, message: chatMessages.message, createdAt: chatMessages.createdAt, name: users.name, email: users.email })
          .from(chatMessages)
          .leftJoin(users, eq(users.id, chatMessages.userId))
          .where(and(eq(chatMessages.fireId, fireId), eq(chatMessages.zoneId, z.id), isNull(chatMessages.deletedAt)))
          .orderBy(desc(chatMessages.createdAt))
          .limit(maxZoneChat);
        perZoneChat[z.id] = rows.map((r) => ({ createdAt: r.createdAt, who: r.name || r.email || 'user', text: r.message }));
      } catch {
        perZoneChat[z.id] = [];
      }
    }
  }

  // Build Markdown knowledge pack
  const lines: string[] = [];
  lines.push(`# Fire ${fireId} Knowledge Base`);
  lines.push("");
  lines.push(`Status: ${f.status}`);
  lines.push(`Location center: (${f.lat.toFixed(5)}, ${f.lng.toFixed(5)})`);
  lines.push(`Approx radius: ${f.radiusM} m`);
  lines.push(`CreatedAt: ${f.createdAt.toISOString()}`);
  lines.push(`LastActivityAt: ${f.lastActivityAt.toISOString()}`);
  lines.push("");

  // Volunteers
  lines.push(`## Volunteers (${vols.length})`);
  for (const v of vols) {
    lines.push(`- ${v.name || v.email} — status=${v.status} (joined ${new Date(v.joinedAt).toISOString()})`);
  }
  lines.push("");

  // Zones
  lines.push(`## Zones (${zlist.length})`);
  for (const z of zlist) {
    const members = membersPerZone.filter((m) => m.zoneId === z.id).map((m) => m.userId);
    lines.push(`### Zone ${z.id}: ${z.title || "(untitled)"}`);
    if (z.description) lines.push(z.description);
    lines.push(`Geom: ${z.geomType} ${z.geomType === 'circle' ? `center=(${z.centerLat?.toFixed(5)}, ${z.centerLng?.toFixed(5)}), radius=${z.radiusM}m` : `polygon points=${Array.isArray((z as any).polygon?.coordinates) ? (z as any).polygon.coordinates.length : 'n/a'}`}`);
    lines.push(`Members (${members.length}): ${members.join(", ")}`);
    // Zone updates (latest first, capped)
    const zUpdates = updates.filter((u) => u.zoneId === z.id).slice(0, maxUpdatesPerZone);
    if (zUpdates.length) {
      lines.push(`Updates (${zUpdates.length} recent):`);
      for (const u of zUpdates) {
        const imgsFor = imgs.filter((im) => im.updateId === u.id);
        const who = u.name || u.email;
        const created = new Date(u.createdAt).toISOString();
        const imgTxt = imgsFor.length ? ` [images: ${imgsFor.map((i) => i.url).join(", ")}]` : '';
        lines.push(`- ${created} ${who}: ${u.text || ''}${imgTxt}`);
      }
    }
    // Zone chat
    const zChat = perZoneChat[z.id] || [];
    if (zChat.length) {
      lines.push(`Zone chat (${zChat.length} recent):`);
      for (const c of zChat.slice().reverse()) {
        lines.push(`- ${new Date(c.createdAt).toISOString()} ${c.who}: ${c.text}`);
      }
    }
    lines.push("");
  }

  // General chat
  lines.push(`## General chat (${generalChatDb.length} recent)`);
  for (const c of generalChatDb.slice().reverse()) {
    const who = c.name || c.email;
    lines.push(`- ${new Date(c.createdAt).toISOString()} ${who}: ${c.message}`);
  }

  const content = lines.join("\n");
  return { content };
}
