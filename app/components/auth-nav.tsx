"use client";
import { useUser } from "@auth0/nextjs-auth0";

export default function AuthNav() {
  const { user, isLoading } = useUser();

  return (
    <nav style={{ display: "flex", gap: 12, alignItems: "center", padding: 12 }}>
      {isLoading && <span>Loading session…</span>}
      {!isLoading && !user && (
        <a href="/auth/login" style={{ textDecoration: "underline" }}>
          Login
        </a>
      )}
      {!isLoading && user && (
        <>
          {user.picture && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.picture}
              alt={user.name || "User"}
              width={28}
              height={28}
              style={{ borderRadius: "50%" }}
            />
          )}
          <span style={{ fontSize: 14 }}>{user.name || user.email}</span>
          <a href="/auth/logout" style={{ textDecoration: "underline" }}>
            Logout
          </a>
        </>
      )}
    </nav>
  );
}
