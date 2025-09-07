"use client";

import { useMemo, useState, useTransition } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, PauseCircle, Mail, Phone, MapPin, Ruler, Link2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

type Sub = {
  id: number;
  email: string | null;
  phone: string | null;
  lat: number;
  lng: number;
  radiusKm: number;
  active: number | boolean;
  unsubscribeToken: string | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

function formatDate(d?: string | Date) {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  try {
    return new Intl.DateTimeFormat("bg", { dateStyle: "medium", timeStyle: "short" }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

function SubscriptionCard({ sub, onDeleted }: { sub: Sub; onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const [copyOk, setCopyOk] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const isActive = useMemo(() => Number(sub.active) === 1 || sub.active === true, [sub.active]);

  const copyUnsub = async () => {
    if (!sub.unsubscribeToken) return;
    const url = `${location.origin}/u/${sub.unsubscribeToken}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopyOk(true);
      setTimeout(() => setCopyOk(false), 1800);
    } catch {}
  };

  const doDelete = async () => {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/subscriptions/${sub.id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Грешка при прекратяване");
        onDeleted();
        router.refresh();
      } finally {
        setOpen(false);
      }
    });
  };

  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between gap-3 flex-wrap">
        <CardTitle className="text-base flex items-center gap-2">
          {isActive ? (
            <Badge variant="success" className="gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Активен</Badge>
          ) : (
            <Badge variant="secondary" className="gap-1"><PauseCircle className="w-3.5 h-3.5" /> Спрян</Badge>
          )}
        </CardTitle>
        <div className="text-xs text-muted-foreground min-w-0 truncate">
          {sub.updatedAt ? `Обновен: ${formatDate(sub.updatedAt)}` : sub.createdAt ? `Създаден: ${formatDate(sub.createdAt)}` : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <MapPin className="w-4 h-4" />
          <span className="truncate">{sub.lat.toFixed(4)}, {sub.lng.toFixed(4)}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Ruler className="w-4 h-4" />
          <span>Радиус: {sub.radiusKm} км</span>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="flex items-center gap-2 min-w-0">
            <Mail className="w-4 h-4 text-muted-foreground" />
            <span className="truncate">{sub.email || '—'}</span>
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <Phone className="w-4 h-4 text-muted-foreground" />
            <span className="truncate">{sub.phone || '—'}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-muted-foreground min-w-0 truncate hidden sm:block">
          {sub.createdAt ? `Създаден: ${formatDate(sub.createdAt)}` : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 justify-end w-full sm:w-auto">
          {sub.unsubscribeToken && (
            <Button type="button" variant="outline" size="sm" onClick={copyUnsub} className="h-8">
              <Link2 className="w-4 h-4 mr-1.5" /> {copyOk ? 'Копирано' : 'Линк за отписване'}
            </Button>
          )}
          {isActive && (
            <>
              <Button type="button" variant="destructive" size="sm" onClick={() => setOpen(true)} className="h-8">
                <Trash2 className="w-4 h-4 mr-1.5" /> Прекрати
              </Button>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Прекратяване на абонамент</DialogTitle>
                    <DialogDescription>
                      Сигурни ли сте, че искате да спрете този абонамент? Можете да създадете нов по всяко време.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>Откажи</Button>
                    <Button type="button" onClick={doDelete} disabled={isPending}>{isPending ? 'Прекратяване…' : 'Прекрати'}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}

export default function SubscriptionsGrid({ subs }: { subs: Sub[] }) {
  const [version, setVersion] = useState(0);
  const onDeleted = () => setVersion((v) => v + 1);
  // version is to force re-render after a delete before router.refresh() lands

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {subs.map((s) => (
        <SubscriptionCard key={`${s.id}-${version}`} sub={s} onDeleted={onDeleted} />
      ))}
    </div>
  );
}
