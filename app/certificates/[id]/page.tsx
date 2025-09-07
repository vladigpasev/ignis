import { db } from "@/lib/db";
import { userCertificates, users } from "@/lib/db/schema";
import { auth0 } from "@/lib/auth0";
import { and, eq } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import CertificateActions from "@/components/certificates/certificate-actions";

export const runtime = "nodejs";

async function getMe() {
  const session = await auth0.getSession();
  const email = session?.user?.email;
  if (!email) return null;
  const row = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return row[0] || null;
}

export default async function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cid = Number(id);
  const me = await getMe();
  if (!me) return <div className="container mx-auto p-6">Unauthorized</div>;
  const row = await db
    .select()
    .from(userCertificates)
    .where(and(eq(userCertificates.id, cid), eq(userCertificates.userId, me.id)))
    .limit(1);
  const cert = row[0];
  if (!cert) return <div className="container mx-auto p-6">Not found</div>;

  const traits = Array.isArray(cert.traits) ? cert.traits as any[] : [];
  const metrics = (cert.metrics || {}) as Record<string, number>;

  return (
    <main>
      <div className="bg-gradient-to-br from-orange-100 to-amber-50 border-b">
        <div className="container mx-auto px-6 py-6 flex items-center justify-between">
          <Link href="/profile" className="no-underline">
            <Button variant="outline" size="sm" className="rounded-full">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline ml-1.5">Back to profile</span>
            </Button>
          </Link>
          <CertificateActions />
        </div>
      </div>

      <div className="container mx-auto p-6 print:p-0">
        <Card className="max-w-3xl mx-auto shadow-xl print:shadow-none">
          <CardContent className="p-0">
            <div className="bg-gradient-to-br from-amber-200 via-orange-100 to-white rounded-t-xl p-8 text-center">
              <div className="uppercase tracking-widest text-xs text-muted-foreground">Certificate of Contribution</div>
              <h1 className="text-2xl font-bold mt-2">{cert.title || 'Volunteer Certificate'}</h1>
              <div className="mt-2 text-sm text-muted-foreground">Period: {cert.period}</div>
            </div>

            <div className="p-6 space-y-6">
              {cert.summary && (
                <p className="leading-relaxed text-balance text-sm sm:text-base">{cert.summary}</p>
              )}

              {/* Metrics */}
              {Object.keys(metrics).length > 0 && (
                <div>
                  <div className="text-sm font-semibold mb-2">Key Metrics</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {Object.entries(metrics).map(([k, v]) => (
                      <div key={k} className="rounded-lg border p-3 text-center">
                        <div className="text-xl font-bold">{Number(v)}</div>
                        <div className="text-xs text-muted-foreground">{labelForMetric(k)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Qualities */}
              {traits.length > 0 && (
                <div>
                  <div className="text-sm font-semibold mb-2">Qualities</div>
                  <div className="space-y-2">
                    {traits.map((t, idx) => (
                      <div key={idx} className="rounded-lg border p-4">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="font-semibold">{t.name}</div>
                          {typeof t.score === 'number' && (
                            <Badge variant="secondary" className="rounded-full">{Math.round((t.score as number) * 10) / 10}</Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">{t.description}</div>
                        {Array.isArray(t.evidence) && t.evidence.length > 0 && (
                          <ul className="list-disc pl-5 mt-2 text-sm text-muted-foreground space-y-1">
                            {t.evidence.slice(0,3).map((e: string, i: number) => (
                              <li key={i}>{e}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function labelForMetric(key: string) {
  switch (key) {
    case 'updates':
      return 'Zone updates';
    case 'update_images':
      return 'Images uploaded';
    case 'chat_messages':
      return 'Chat messages';
    case 'zones_joined':
      return 'Zones joined';
    case 'fires_involved':
      return 'Fires involved';
    case 'active_days':
      return 'Active days';
    case 'words_contributed':
      return 'Words (total)';
    default:
      return key.replaceAll('_', ' ');
  }
}
