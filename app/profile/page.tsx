import { auth0 } from "@/lib/auth0"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { db } from "@/lib/db";
import { notificationSubscriptions, users } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";

export default async function ProfilePage() {
  const session = await auth0.getSession()
  const user = session?.user

  if (!user) {
    return (
      <main className="container mx-auto p-6">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">You are not logged in.</p>
            <Button asChild>
              <Link href="/auth/login">Login</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="container mx-auto p-6">
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <UserHeader user={user} />
          {/* Subscriptions */}
          <SubscriptionsList email={user.email!} />
        </CardContent>
      </Card>
    </main>
  )
}

async function SubscriptionsList({ email }: { email: string }) {
  const [me] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!me) return null;
  const subs = await db
    .select()
    .from(notificationSubscriptions)
    .where(eq(notificationSubscriptions.userId, me.id))
    .orderBy(desc(notificationSubscriptions.createdAt));

  async function removeSub(id: number) {
    "use server";
    // Soft-delete by setting active=0 for the current user
    await db
      .update(notificationSubscriptions)
      .set({ active: 0, updatedAt: new Date() })
      .where(and(eq(notificationSubscriptions.id, id), eq(notificationSubscriptions.userId, me.id)));
  }

  return (
    <div className="space-y-3">
      <h3 className="font-semibold">Моите абонаменти</h3>
      {subs.length === 0 && <p className="text-sm text-muted-foreground">Нямате активни абонаменти.</p>}
      {subs.length > 0 && (
        <div className="border rounded-md overflow-hidden">
          <div className="grid grid-cols-6 gap-2 p-2 text-xs font-medium bg-gray-50">
            <div>Статус</div>
            <div>Имейл</div>
            <div>Телефон</div>
            <div>Координати</div>
            <div>Радиус (км)</div>
            <div>Действия</div>
          </div>
          {subs.map((s) => (
            <form action={removeSub.bind(null, s.id)} key={s.id} className="grid grid-cols-6 gap-2 p-2 items-center border-t text-sm">
              <div>{s.active ? 'Активен' : 'Спрян'}</div>
              <div className="truncate">{s.email || '-'}</div>
              <div className="truncate">{s.phone || '-'}</div>
              <div className="truncate">{s.lat.toFixed(4)}, {s.lng.toFixed(4)}</div>
              <div>{s.radiusKm}</div>
              <div className="flex gap-2">
                {s.active === 1 && (
                  <Button type="submit" size="sm" variant="outline">Прекрати</Button>
                )}
                {s.unsubscribeToken && (
                  <a href={`/u/${s.unsubscribeToken}`} className="text-xs underline">Линк за отписване</a>
                )}
              </div>
            </form>
          ))}
        </div>
      )}
    </div>
  );
}

function UserHeader({ user }: { user: any }) {
  return (
    <div className="flex items-center gap-4">
      {user.picture && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.picture}
          alt={user.name || "User"}
          width={64}
          height={64}
          className="rounded-full"
        />
      )}
      <div>
        <h2 className="text-lg font-semibold">{user.name || user.email}</h2>
        {user.email && (
          <p className="text-sm text-muted-foreground">{user.email}</p>
        )}
      </div>
    </div>
  );
}
