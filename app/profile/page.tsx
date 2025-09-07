import { auth0 } from "@/lib/auth0"
import Link from "next/link"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { db } from "@/lib/db";
import { notificationSubscriptions, users, volunteerProfiles } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import VolunteerProfileSection from "@/components/volunteers/volunteer-profile-section";
import SubscriptionsGrid from "@/components/subscriptions/subscriptions-grid";
import FiresHeader from "@/components/fires/fires-header";
import { ArrowLeft } from "lucide-react";

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
    <>
    <FiresHeader />
    <main className="container mx-auto p-6">
      <Card className="max-w-3xl mx-auto">
        <CardHeader className="relative">
          <CardTitle>Profile</CardTitle>
          <CardAction>
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link href="/fires" className="no-underline">
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline ml-1.5">Назад към пожарите</span>
              </Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-6">
          <UserHeader user={user} />
          {/* Volunteer profile */}
          {/* Server-side fetch of the user's volunteer profile */}
          {/* @ts-expect-error Async Server Component below */}
          <VolunteerProfileServer email={user.email!} />
          {/* Subscriptions */}
          <SubscriptionsList email={user.email!} />
        </CardContent>
      </Card>
    </main>
    </>
  )
}

async function VolunteerProfileServer({ email }: { email: string }) {
  const [me] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!me) return null;
  const [profile] = await db.select().from(volunteerProfiles).where(eq(volunteerProfiles.userId, me.id)).limit(1);
  return <VolunteerProfileSection profile={profile || null} />;
}

async function SubscriptionsList({ email }: { email: string }) {
  const [me] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!me) return null;
  const subs = await db
    .select()
    .from(notificationSubscriptions)
    .where(eq(notificationSubscriptions.userId, me.id))
    .orderBy(desc(notificationSubscriptions.createdAt));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-semibold">Моите абонаменти</h3>
        <div className="text-xs text-muted-foreground">Общо: {subs.length}</div>
      </div>
      {subs.length === 0 ? (
        <div className="rounded-lg border p-6 text-center space-y-2">
          <div className="text-sm text-muted-foreground">Нямате абонаменти за известия.</div>
          <div className="text-sm text-muted-foreground">Създайте абонамент от бутона „Получавай известия“ в горната навигация.</div>
        </div>
      ) : (
        <SubscriptionsGrid subs={subs as any} />
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
