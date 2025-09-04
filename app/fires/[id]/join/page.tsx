import Link from "next/link";
import { auth0 } from "@/lib/auth0";
import { joinWithToken, getFireById } from "@/app/actions/fires";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const runtime = "nodejs";
export const revalidate = 0;

export default async function JoinWithTokenPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { id } = await params;
  const fireId = Number(id);
  const { token = "" } = await searchParams;
  const fire = await getFireById(fireId);
  if (!fire) {
    return (
      <main className="container mx-auto p-6">
        <Card className="max-w-lg mx-auto">
          <CardHeader><CardTitle>Пожарът не е намерен</CardTitle></CardHeader>
          <CardContent><Link href="/fires"><Button variant="outline">Към всички пожари</Button></Link></CardContent>
        </Card>
      </main>
    );
  }

  const session = await auth0.getSession();
  const user = session?.user;

  if (!user) {
    const ret = encodeURIComponent(`/fires/${fireId}/join?token=${encodeURIComponent(token)}`);
    return (
      <main className="container mx-auto p-6">
        <Card className="max-w-lg mx-auto">
          <CardHeader><CardTitle>Необходими са права</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">За да се присъединиш като доброволец, влез в профила си.</p>
            <a href={`/auth/login?returnTo=${ret}`}><Button>Вход</Button></a>
          </CardContent>
        </Card>
      </main>
    );
  }

  const res = await joinWithToken(fireId, token);

  return (
    <main className="container mx-auto p-6">
      <Card className="max-w-lg mx-auto">
        <CardHeader>
          <CardTitle>{res.ok ? "Успешно присъединяване" : "Неуспешно присъединяване"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {res.ok ? "Ти вече си потвърден доброволец за този пожар." : (res.error || "Невалиден или изтекъл токен.")}
          </p>
          <Link href={`/fires/${fireId}`}><Button>Към пожара</Button></Link>
        </CardContent>
      </Card>
    </main>
  );
}
