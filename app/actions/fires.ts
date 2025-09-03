"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { fires } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { auth0 } from "@/lib/auth0";

export async function listFires(limit = 500) {
  const rows = await db
    .select()
    .from(fires)
    .orderBy(desc(fires.createdAt))
    .limit(Math.min(Math.max(limit, 1), 2000));
  return rows;
}

export async function createFire(form: FormData) {
  const session = await auth0.getSession();
  const user = session?.user;
  if (!user) throw new Error("Unauthorized");

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

  await db.insert(fires).values({
    lat,
    lng,
    radiusM,
    status: "active",
    createdBy: null,
  });

  revalidatePath("/");
}

