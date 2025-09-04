"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { fires } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { auth0 } from "@/lib/auth0";

export async function listFires(limit = 500) {
  const max = Math.min(Math.max(limit, 1), 2000);

  async function run() {
    return await db
      .select()
      .from(fires)
      .orderBy(desc(fires.createdAt))
      .limit(max);
  }

  // transient retry once to mitigate occasional first-load failures
  try {
    return await run();
  } catch (e) {
    await new Promise((r) => setTimeout(r, 300));
    return await run();
  }
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
