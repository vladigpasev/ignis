"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { fires, users, fireVolunteers, fireJoinTokens, fireJoinTokenUses, fireDeactivationVotes, type Fire } from "@/lib/db/schema";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { auth0 } from "@/lib/auth0";
import crypto from "crypto";
import { ensureSbUser, getOrCreateFireChannel, joinUserToChannel } from "@/lib/sendbird";

// ---------- helpers ----------
async function ensureLocalUser() {
  const session = await auth0.getSession();
  const u = session?.user;
  if (!u) throw new Error("Unauthorized");

  const email = u.email!;
  const name = u.name ?? null;

  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    const row = existing[0];
    if (name && row.name !== name) {
      await db.update(users).set({ name, updatedAt: new Date() }).where(eq(users.id, row.id));
    }
    return { session: u, local: row };
  }

  const [created] = await db.insert(users).values({ email, name }).returning();
  return { session: u, local: created };
}

async function requireConfirmedVolunteer(fireId: number, userId: number) {
  const row = await db
    .select()
    .from(fireVolunteers)
    .where(and(eq(fireVolunteers.fireId, fireId), eq(fireVolunteers.userId, userId), eq(fireVolunteers.status, "confirmed")))
    .limit(1);
  if (row.length === 0) throw new Error("Forbidden");
}

async function ensureSendbirdJoined(fireId: number, userId: number) {
  try {
    const u = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
    if (!u) return;
    const sbUid = `user-${u.id}`;
    await ensureSbUser(sbUid, u.name || u.email);
    const channelUrl = await getOrCreateFireChannel(fireId);
    await joinUserToChannel(channelUrl, sbUid);
  } catch (e: any) {
    console.warn("[sendbird] auto-join failed", fireId, userId, e?.message);
  }
}

// ----- Activity helpers -----
function inactivityDays() {
  const d = Number(process.env.FIRE_INACTIVITY_DAYS || 3);
  return Number.isFinite(d) && d > 0 ? d : 3;
}

async function reactivateFireIfNeeded(fireId: number) {
  try {
    // Reactivate if currently inactive; clear previous votes
    await db.update(fires).set({ status: 'active', deactivatedAt: null, updatedAt: new Date() }).where(and(eq(fires.id, fireId), eq(fires.status, 'inactive')));
    await db.delete(fireDeactivationVotes).where(eq(fireDeactivationVotes.fireId, fireId));
  } catch {}
}

async function touchFireActivity(fireId: number) {
  try {
    await db.update(fires).set({ lastActivityAt: new Date(), updatedAt: new Date() }).where(eq(fires.id, fireId));
    await reactivateFireIfNeeded(fireId);
  } catch {}
}

export async function autoDeactivateStaleFires() {
  const days = inactivityDays();
  // Refresh last_activity_at from related tables (best-effort)
  try {
    await db.execute(sql`
      UPDATE "fires" f
      SET "last_activity_at" = GREATEST(
        f."updated_at",
        COALESCE((SELECT MAX(u."created_at") FROM "zone_updates" u JOIN "zones" z ON z."id" = u."zone_id" WHERE z."fire_id" = f."id"), to_timestamp(0)),
        COALESCE((SELECT MAX(m."created_at") FROM "chat_messages" m WHERE m."fire_id" = f."id" AND m."deleted_at" IS NULL), to_timestamp(0)),
        COALESCE((SELECT MAX(v."updated_at") FROM "fire_volunteers" v WHERE v."fire_id" = f."id"), to_timestamp(0)),
        COALESCE((SELECT MAX(m."created_at") FROM "zone_members" m WHERE m."fire_id" = f."id"), to_timestamp(0)),
        COALESCE((SELECT MAX(u."used_at") FROM "fire_join_token_uses" u JOIN "fire_join_tokens" t ON t."id" = u."token_id" WHERE t."fire_id" = f."id"), to_timestamp(0)),
        f."last_activity_at"
      )
      WHERE f."status" = 'active';
    `);
  } catch {}

  // Deactivate fires with no activity for N days
  try {
    await db.execute(sql`
      UPDATE "fires"
      SET "status" = 'inactive', "deactivated_at" = now(), "updated_at" = now()
      WHERE "status" = 'active' AND "last_activity_at" < now() - (${days}::text || ' days')::interval;
    `);
  } catch {}
}

export async function listFires(limit = 500) {
  const max = Math.min(Math.max(limit, 1), 2000);
  async function run() {
    // best-effort maintenance pass
    await autoDeactivateStaleFires();

    const rows = await db
      .select()
      .from(fires)
      .where(eq(fires.status, "active"))
      .orderBy(desc(fires.createdAt))
      .limit(max);
    // attach volunteer counts per fire
    const counts = await db
      .select({
        fireId: fireVolunteers.fireId,
        confirmed: sql<number>`sum(case when ${fireVolunteers.status} = 'confirmed' then 1 else 0 end)`,
        requested: sql<number>`sum(case when ${fireVolunteers.status} = 'requested' then 1 else 0 end)`,
      })
      .from(fireVolunteers)
      .groupBy(fireVolunteers.fireId);
    const byId = new Map<number, { confirmed: number; requested: number }>();
    for (const c of counts) byId.set(c.fireId, { confirmed: Number(c.confirmed ?? 0), requested: Number(c.requested ?? 0) });
    return rows.map((r) => ({
      ...r,
      volunteersConfirmed: byId.get(r.id)?.confirmed ?? 0,
      volunteersRequested: byId.get(r.id)?.requested ?? 0,
    }));
  }
  try {
    return await run();
  } catch {
    await new Promise((r) => setTimeout(r, 300));
    return await run();
  }
}

export async function getFireById(id: number) {
  const rows = await db.select().from(fires).where(eq(fires.id, id)).limit(1);
  return rows[0] ?? null;
}

// ----- Volunteers listing -----
export async function volunteersForFire(fireId: number) {
  const rows = await db
    .select({
      id: fireVolunteers.id,
      userId: fireVolunteers.userId,
      status: fireVolunteers.status,
      createdAt: fireVolunteers.createdAt,
      name: users.name,
      email: users.email,
    })
    .from(fireVolunteers)
    .leftJoin(users, eq(fireVolunteers.userId, users.id))
    .where(eq(fireVolunteers.fireId, fireId))
    .orderBy(desc(fireVolunteers.createdAt));

  const confirmed = rows.filter((r) => r.status === "confirmed");
  const requested = rows.filter((r) => r.status === "requested");
  return { confirmed, requested };
}

export async function myVolunteerStatus(fireId: number): Promise<"none" | "requested" | "confirmed"> {
  const session = await auth0.getSession();
  const u = session?.user;
  if (!u?.email) return "none";
  const local = (await db.select().from(users).where(eq(users.email, u.email)).limit(1))[0];
  if (!local) return "none";
  const row = await db
    .select({ status: fireVolunteers.status })
    .from(fireVolunteers)
    .where(and(eq(fireVolunteers.fireId, fireId), eq(fireVolunteers.userId, local.id)))
    .limit(1);
  if (!row[0]) return "none";
  return row[0].status as any;
}

// ----- Create Fire (creator -> confirmed volunteer) -----
export async function createFire(form: FormData) {
  const { local } = await ensureLocalUser();

  const lat = Number(form.get("lat"));
  const lng = Number(form.get("lng"));
  const radiusM = Math.round(Number(form.get("radiusM")));

  if (
    Number.isNaN(lat) ||
    Number.isNaN(lng) ||
    Number.isNaN(radiusM) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180 ||
    radiusM < 50 ||
    radiusM > 20000
  ) {
    throw new Error("Invalid payload");
  }

  const [created] = await db
    .insert(fires)
    .values({
      lat,
      lng,
      radiusM,
      status: "active",
      createdBy: local.id,
      lastActivityAt: new Date(),
    })
    .returning();

  // creator becomes confirmed volunteer
  await db
    .insert(fireVolunteers)
    .values({
      fireId: created.id,
      userId: local.id,
      status: "confirmed",
    })
    .onConflictDoUpdate({
      target: [fireVolunteers.fireId, fireVolunteers.userId],
      set: { status: "confirmed", updatedAt: new Date() },
    });

  // Auto-join creator into Sendbird channel
  await ensureSendbirdJoined(created.id, local.id);

  revalidatePath("/fires");
  revalidatePath(`/fires/${created.id}`);
}

// ----- Claim volunteer (requested) -----
export async function claimVolunteer(form: FormData) {
  const { local } = await ensureLocalUser();
  const fireId = Number(form.get("fireId"));
  if (!Number.isFinite(fireId)) throw new Error("Invalid fireId");

  const existing = await db
    .select()
    .from(fireVolunteers)
    .where(and(eq(fireVolunteers.fireId, fireId), eq(fireVolunteers.userId, local.id)))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(fireVolunteers).values({ fireId, userId: local.id, status: "requested" });
  } else if (existing[0].status !== "confirmed") {
    // keep requested; if already confirmed, no change
  }

  await touchFireActivity(fireId);

  revalidatePath(`/fires/${fireId}`);
  return { ok: true };
}

// ----- Approve another user (make confirmed) -----
export async function approveVolunteer(form: FormData) {
  const { local } = await ensureLocalUser();
  const fireId = Number(form.get("fireId"));
  const userId = Number(form.get("userId"));
  if (!Number.isFinite(fireId) || !Number.isFinite(userId)) throw new Error("Invalid payload");

  // Only confirmed volunteers can approve
  await requireConfirmedVolunteer(fireId, local.id);

  // Upsert -> confirmed
  await db
    .insert(fireVolunteers)
    .values({
      fireId,
      userId,
      status: "confirmed",
    })
    .onConflictDoUpdate({
      target: [fireVolunteers.fireId, fireVolunteers.userId],
      set: { status: "confirmed", updatedAt: new Date() },
    });

  // Auto-unblock if previously blocked in general chat
  const { chatBlocks } = await import("@/lib/db/schema");
  const { and, eq } = await import("drizzle-orm");
  await db.delete(chatBlocks).where(and(eq(chatBlocks.fireId, fireId), eq(chatBlocks.blockedUserId, userId)));

  // Auto-join approved user into Sendbird channel
  await ensureSendbirdJoined(fireId, userId);

  await touchFireActivity(fireId);
  revalidatePath(`/fires/${fireId}`);
  return { ok: true };
}

// ----- Generate join token (for QR) -----
export async function generateJoinToken(form: FormData) {
  const { local } = await ensureLocalUser();
  const fireId = Number(form.get("fireId"));
  if (!Number.isFinite(fireId)) throw new Error("Invalid fireId");

  await requireConfirmedVolunteer(fireId, local.id);

  const token = crypto.randomBytes(16).toString("base64url");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 48); // 48h

  await db.insert(fireJoinTokens).values({
    fireId,
    token,
    createdBy: local.id,
    expiresAt,
  });

  return { ok: true, token, expiresAt: expiresAt.toISOString() };
}

// ----- Join with token (QR scan flow) -----
export async function joinWithToken(fireId: number, token: string) {
  if (!token || !Number.isFinite(fireId)) return { ok: false, error: "Invalid token." };

  const { local } = await ensureLocalUser();

  const now = new Date();
  const rows = await db
    .select()
    .from(fireJoinTokens)
    .where(
      and(
        eq(fireJoinTokens.fireId, fireId),
        eq(fireJoinTokens.token, token),
        isNull(fireJoinTokens.revokedAt),
        gt(fireJoinTokens.expiresAt, now),
      ),
    )
    .limit(1);

  if (rows.length === 0) {
    return { ok: false, error: "Невалиден или изтекъл токен." };
  }

  await db
    .insert(fireVolunteers)
    .values({
      fireId,
      userId: local.id,
      status: "confirmed",
    })
    .onConflictDoUpdate({
      target: [fireVolunteers.fireId, fireVolunteers.userId],
      set: { status: "confirmed", updatedAt: new Date() },
    });
  // record token use (best-effort)
  try {
    const tokenRow = rows[0];
    await db.insert(fireJoinTokenUses).values({ tokenId: tokenRow.id, userId: local.id });
  } catch {}

  // Auto-unblock in general chat upon becoming confirmed (best-effort)
  try {
    const { chatBlocks } = await import("@/lib/db/schema");
    const { and, eq } = await import("drizzle-orm");
    await db.delete(chatBlocks).where(and(eq(chatBlocks.fireId, fireId), eq(chatBlocks.blockedUserId, local.id)));
  } catch {}
  // Auto-join into Sendbird channel
  await ensureSendbirdJoined(fireId, local.id);
  await touchFireActivity(fireId);
  return { ok: true };
}

// ----- My inactive fires -----
export async function listMyInactiveFires() {
  const session = await auth0.getSession();
  const u = session?.user;
  if (!u?.email) return [] as any[];
  const [local] = await db.select().from(users).where(eq(users.email, u.email)).limit(1);
  if (!local) return [] as any[];
  const rows = await db
    .select()
    .from(fires)
    .where(eq(fires.status, 'inactive'))
    .orderBy(desc(fires.deactivatedAt), desc(fires.createdAt));
  // filter by confirmed membership
  const mine = await db
    .select({ fireId: fireVolunteers.fireId })
    .from(fireVolunteers)
    .where(and(eq(fireVolunteers.userId, local.id), eq(fireVolunteers.status, 'confirmed')));
  const mySet = new Set(mine.map((m) => m.fireId));
  return rows.filter((r) => mySet.has(r.id));
}
