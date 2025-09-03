import { auth0 } from "@/lib/auth0";

export default async function ProfilePage() {
  const session = await auth0.getSession();
  const user = session?.user;

  if (!user) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Profile</h1>
        <p>You are not logged in.</p>
        <a href="/auth/login" style={{ textDecoration: "underline" }}>
          Login
        </a>
      </main>
    );
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>Profile</h1>
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {user.picture && <img src={user.picture} alt={user.name || "User"} width={64} height={64} style={{ borderRadius: "50%" }} />}
        <div>
          <h2 style={{ margin: 0 }}>{user.name || user.email}</h2>
          {user.email && <p style={{ margin: 0 }}>{user.email}</p>}
        </div>
      </div>
      <pre style={{ marginTop: 16 }}>{JSON.stringify(user, null, 2)}</pre>
    </main>
  );
}
