import { db } from "@/lib/db";
import { users, userCertificates } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import GenerateCertificateButton from "./generate-button";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { periodKey } from "@/lib/ai/certificates";

export default async function CertificatesSection({ email }: { email: string }) {
  const [me] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!me) return null;
  let rows: any[] = [];
  try {
    rows = await db
      .select()
      .from(userCertificates)
      .where(eq(userCertificates.userId, me.id))
      .orderBy(desc(userCertificates.createdAt));
  } catch {
    // Table might be missing on first deploy; hide section gracefully
    return null;
  }

  const thisPeriod = periodKey();
  const alreadyThisMonth = rows.some((r) => r.period === thisPeriod);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-semibold">Certificates</h3>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="rounded-full">Monthly limit: 1</Badge>
          <GenerateCertificateButton disabled={alreadyThisMonth} />
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-lg border p-6 text-center space-y-2">
          <div className="text-sm text-muted-foreground">You don’t have any certificates yet. You can generate one for the current month.</div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {rows.map((r) => (
            <Link key={r.id} href={`/certificates/${r.id}`} className="no-underline">
              <Card className="p-4 h-full hover:shadow-md transition-shadow">
                <div className="text-sm text-muted-foreground">{r.period}</div>
                <div className="font-semibold mt-1">{r.title || "Certificate"}</div>
                <div className="text-xs text-muted-foreground mt-2 line-clamp-2">{r.summary || "View details"}</div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
