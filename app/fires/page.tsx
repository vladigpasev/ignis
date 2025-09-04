import HomeClient from "@/app/home-client";
import { listFires, createFire } from "@/app/actions/fires";

export const runtime = "nodejs";
export const revalidate = 0;

export default async function FiresPage() {
  let rows: any[] = [];
  try {
    rows = await listFires(500);
  } catch (e) {
    console.error("listFires failed:", e);
    rows = [];
  }
  const initialFires = rows.map((f) => ({
    ...f,
    createdAt: typeof f.createdAt === "string" ? f.createdAt : new Date(f.createdAt).toISOString(),
    updatedAt: typeof f.updatedAt === "string" ? f.updatedAt : new Date(f.updatedAt).toISOString(),
  }));

  return <HomeClient initialFires={initialFires as any} createAction={createFire} />;
}

