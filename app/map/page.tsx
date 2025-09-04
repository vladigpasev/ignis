import HomeClient from "@/app/home-client";
import { listFires, createFire } from "@/app/actions/fires";

export default async function MapPage() {
  const rows = await listFires(500);
  const initialFires = rows.map((f) => ({
    ...f,
    createdAt: typeof f.createdAt === "string" ? f.createdAt : new Date(f.createdAt).toISOString(),
    updatedAt: typeof f.updatedAt === "string" ? f.updatedAt : new Date(f.updatedAt).toISOString(),
  }));

  return <HomeClient initialFires={initialFires as any} createAction={createFire} />;
}

