import { listMyInactiveFires } from "@/app/actions/fires";
import FireList from "@/components/fires/fire-list";

export const runtime = "nodejs";
export const revalidate = 0;

export default async function PastFiresPage() {
  const rows = await listMyInactiveFires();
  const fires = rows.map((f: any) => ({
    ...f,
    createdAt: typeof f.createdAt === 'string' ? f.createdAt : new Date(f.createdAt).toISOString(),
  }));
  return (
    <div className="w-full min-h-screen">
      <div className="max-w-6xl mx-auto w-full px-4 py-6">
        <h1 className="text-2xl font-semibold mb-4">Минали (неактивни) пожари</h1>
        <FireList fires={fires as any} title="Минали пожари" />
      </div>
    </div>
  );
}
