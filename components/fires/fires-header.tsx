"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useUser } from "@auth0/nextjs-auth0";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import VolunteerModal from "@/components/volunteers/volunteer-modal";

export default function FiresHeader() {
  const { user, isLoading } = useUser();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [volModalOpen, setVolModalOpen] = useState(false);
  const [volCompleted, setVolCompleted] = useState<boolean | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current) return;
      if (menuRef.current.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    // Listen for global request to open volunteer modal
    const openVolHandler = () => setVolModalOpen(true);
    window.addEventListener('open-volunteer-modal' as any, openVolHandler as any);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      window.removeEventListener('open-volunteer-modal' as any, openVolHandler as any);
    };
  }, []);

  // Load volunteer profile state
  useEffect(() => {
    if (!user) { setVolCompleted(null); return; }
    (async () => {
      try {
        const r = await fetch('/api/me/volunteer-profile', { cache: 'no-store' });
        if (!r.ok) { setVolCompleted(null); return; }
        const j = await r.json();
        setVolCompleted(!!j?.completed);
        // First-time prompt: show once if not completed and not seen
        if (!j?.completed) {
          const seen = localStorage.getItem('volunteerPromptSeen');
          if (!seen) {
            setTimeout(() => setVolModalOpen(true), 300);
            localStorage.setItem('volunteerPromptSeen', '1');
          }
        }
      } catch { setVolCompleted(null); }
    })();
  }, [user]);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-6xl mx-auto w-full px-4 h-14 flex items-center justify-between">
        <Link href="/fires" className="flex min-w-0 items-center gap-2 group">
          <Image src="/img/logo.svg" alt="FireLinks" width={28} height={28} />
          <span className="text-[18px] font-semibold tracking-tight group-hover:text-primary transition-colors">
            FireLinks
          </span>
          <span className="ml-2 text-xs rounded-full bg-primary/10 text-primary px-2 py-0.5">Пожари</span>
        </Link>

        <div className="flex items-center gap-3 shrink-0" ref={menuRef}>
          {!isLoading && user && volCompleted === false && (
            <Button size="sm" className="rounded-full hidden sm:inline-flex" onClick={() => setVolModalOpen(true)}>
              Стани доброволец
            </Button>
          )}
          {isLoading ? (
            <div className="h-9 w-24 rounded-md bg-muted animate-pulse" />
          ) : user ? (
            <div className="relative">
              <button
                onClick={() => setOpen((v) => !v)}
                className="inline-flex items-center gap-2 rounded-full p-0.5 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring/40"
                aria-haspopup="menu"
                aria-expanded={open}
              >
                <Avatar className="h-9 w-9">
                  {user.picture ? (
                    <AvatarImage src={user.picture} alt={user.name || user.email || "Profile"} />
                  ) : (
                    <AvatarFallback>{(user.name || user.email || "U").slice(0, 2).toUpperCase()}</AvatarFallback>
                  )}
                </Avatar>
              </button>

              {open && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-72 rounded-xl border border-border/60 bg-popover shadow-xl overflow-hidden"
                >
                  <div className="bg-gradient-to-r from-primary/10 to-transparent p-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        {user.picture ? (
                          <AvatarImage src={user.picture} alt={user.name || user.email || "Profile"} />
                        ) : (
                          <AvatarFallback>{(user.name || user.email || "U").slice(0, 2).toUpperCase()}</AvatarFallback>
                        )}
                      </Avatar>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-foreground">
                          {user.name || user.email || "User"}
                        </div>
                        {user.email && (
                          <div className="truncate text-sm text-muted-foreground">{user.email}</div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="p-3">
                    {volCompleted === false && (
                      <Button className="w-full mb-2" onClick={() => { setVolModalOpen(true); setOpen(false); }}>
                        Попълни профил на доброволец
                      </Button>
                    )}
                    <Link href="/profile" onClick={() => setOpen(false)}>
                      <Button className="w-full justify-center">Настройки на профила</Button>
                    </Link>

                    <div className="my-2 h-px bg-border" />

                    <a
                      href="/auth/logout"
                      onClick={() => setOpen(false)}
                      className="block rounded-md px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                      role="menuitem"
                    >
                      Изход
                    </a>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link href="/auth/login">
              <Button>Login</Button>
            </Link>
          )}
        </div>
      </div>
      {/* Global volunteer modal */}
      <VolunteerModal
        open={volModalOpen}
        onOpenChange={setVolModalOpen}
        afterSave={() => setVolCompleted(true)}
      />
    </header>
  );
}
