"use client";

import { useMemo, useRef, useState, useTransition, useEffect } from "react";
import MapProvider from "@/lib/mapbox/provider";
import MapControls from "@/components/map/map-controls";
import MapStyles from "@/components/map/map-styles";
import FireMarker from "@/components/fires/fire-marker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { metersToReadable } from "@/lib/geo";
import { Navigation, QrCode, Check, User2, Users } from "lucide-react";
import * as QRCode from "qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type Fire = {
  id: number;
  lat: number;
  lng: number;
  radiusM: number;
  status: string;
  createdAt: string;
};

type VolunteerRow = {
  id: number;
  userId: number;
  status: "requested" | "confirmed";
  createdAt: string;
  name: string | null;
  email: string;
};

export default function FireDetailsClient({
  fire,
  viewerStatus,
  initialVolunteers,
  claimAction,
  approveAction,
  generateTokenAction,
  joinBaseUrl,
}: {
  fire: Fire;
  viewerStatus: "none" | "requested" | "confirmed";
  initialVolunteers: { confirmed: VolunteerRow[]; requested: VolunteerRow[] };
  claimAction: (form: FormData) => Promise<{ ok: boolean }>;
  approveAction: (form: FormData) => Promise<{ ok: boolean }>;
  generateTokenAction: (form: FormData) => Promise<{ ok: boolean; token?: string; expiresAt?: string; error?: string }>;
  joinBaseUrl: string;
}) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);

  const [viewer, setViewer] = useState(viewerStatus);
  const [confirmed, setConfirmed] = useState(initialVolunteers.confirmed);
  const [requested, setRequested] = useState(initialVolunteers.requested);

  const [isQR, setIsQR] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrImg, setQrImg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!qrUrl) {
      setQrImg(null);
      return;
    }
    (async () => {
      try {
        const dataUrl = await QRCode.toDataURL(qrUrl, { margin: 1, width: 320 });
        setQrImg(dataUrl);
      } catch (e) {
        console.error(e);
        setQrImg(null);
      }
    })();
  }, [qrUrl]);

  const centerForMap = useMemo(() => ({ lat: fire.lat, lng: fire.lng }), [fire.lat, fire.lng]);

  const claim = () => {
    const fd = new FormData();
    fd.set("fireId", String(fire.id));
    startTransition(async () => {
      const res = await claimAction(fd);
      if (res?.ok) {
        setViewer("requested");
        setRequested((prev) => [
          ...prev,
          { id: -1, userId: -1, status: "requested", createdAt: new Date().toISOString(), name: null, email: "Вие" },
        ]);
      }
    });
  };

  const approve = (userId: number) => {
    const fd = new FormData();
    fd.set("fireId", String(fire.id));
    fd.set("userId", String(userId));
    startTransition(async () => {
      const res = await approveAction(fd);
      if (res?.ok) {
        setRequested((prev) => prev.filter((r) => r.userId !== userId));
        const row = initialVolunteers.requested.find((r) => r.userId === userId) || requested.find((r) => r.userId === userId);
        if (row) {
          setConfirmed((prev) => [...prev, { ...row, status: "confirmed" }]);
        }
      }
    });
  };

  const generateQR = () => {
    const fd = new FormData();
    fd.set("fireId", String(fire.id));
    startTransition(async () => {
      const res = await generateTokenAction(fd);
      if (res?.ok && res.token) {
        const base = joinBaseUrl || (typeof window !== "undefined" ? window.location.origin : "");
        const url = `${base}/fires/${fire.id}/join?token=${res.token}`;
        setQrUrl(url);
        setIsQR(true);
      } else {
        alert(res?.error || "Грешка при генериране на QR.");
      }
    });
  };

  return (
    <div className="w-screen min-h-screen">
      <div className="relative h-[65vh] w-full">
        <div id="map-container" ref={mapContainerRef} className="absolute inset-0 h-full w-full" />

        <MapProvider
          mapContainerRef={mapContainerRef}
          initialViewState={{ longitude: centerForMap.lng, latitude: centerForMap.lat, zoom: 15 }}
          styleUrl="mapbox://styles/mapbox/satellite-streets-v12"
        >
          <MapControls />
          <MapStyles initialStyle="satellite-streets-v12" />

          <FireMarker id={fire.id} lat={fire.lat} lng={fire.lng} />
        </MapProvider>

        <div className="absolute top-4 right-4 z-10">
          <Badge variant="secondary" className="shadow-lg">Пожар #{fire.id}</Badge>
        </div>
      </div>

      <div className="max-w-5xl mx-auto w-full px-4 py-6 grid gap-4 md:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Основни данни</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div>Статус: <span className="text-foreground font-medium">{fire.status}</span></div>
            <div>Радиус: <span className="text-foreground font-medium">{metersToReadable(fire.radiusM)}</span></div>
            <div>Координати: <span className="text-foreground font-medium">{fire.lat.toFixed(5)}, {fire.lng.toFixed(5)}</span></div>
            <div>Създаден: <span className="text-foreground font-medium">{new Date(fire.createdAt).toLocaleString()}</span></div>

            <Separator className="my-3" />

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${fire.lat},${fire.lng}`, "_blank")}
              >
                <Navigation className="h-4 w-4 mr-1.5" />
                Навигация
              </Button>

              {viewer === "none" && (
                <Button size="sm" disabled={isPending} onClick={claim}>
                  {isPending ? "Заявяване…" : "Заяви да съм доброволец"}
                </Button>
              )}
              {viewer === "requested" && (
                <Button size="sm" variant="secondary" disabled>
                  Заявено — чака потвърждение
                </Button>
              )}
              {viewer === "confirmed" && (
                <Button size="sm" onClick={generateQR} disabled={isPending}>
                  <QrCode className="h-4 w-4 mr-1.5" />
                  Генерирай QR за присъединяване
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Доброволци</span>
              <span className="text-sm font-normal text-muted-foreground flex items-center gap-3">
                <span className="inline-flex items-center gap-1"><Users className="h-4 w-4" /> {confirmed.length}</span>
                <span className="inline-flex items-center gap-1"><User2 className="h-4 w-4" /> {requested.length}</span>
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-xs uppercase text-muted-foreground mb-1">Потвърдени</div>
              {confirmed.length === 0 ? (
                <div className="text-sm text-muted-foreground">Няма.</div>
              ) : (
                <ul className="space-y-1">
                  {confirmed.map((r) => (
                    <li key={`c-${r.userId}`} className="text-sm">
                      <span className="font-medium text-foreground">{r.name || r.email}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <Separator />

            <div>
              <div className="text-xs uppercase text-muted-foreground mb-1">Заявили</div>
              {requested.length === 0 ? (
                <div className="text-sm text-muted-foreground">Няма чакащи.</div>
              ) : (
                <ul className="space-y-2">
                  {requested.map((r) => (
                    <li key={`r-${r.userId}`} className="flex items-center justify-between gap-2">
                      <div className="text-sm">
                        <span className="font-medium text-foreground">{r.name || r.email}</span>
                        <span className="text-muted-foreground"> — от {new Date(r.createdAt).toLocaleString()}</span>
                      </div>
                      {viewer === "confirmed" ? (
                        <Button size="sm" variant="outline" onClick={() => approve(r.userId)} disabled={isPending}>
                          <Check className="h-4 w-4 mr-1" />
                          Потвърди
                        </Button>
                      ) : (
                        <Badge variant="secondary">Чака потвърждение</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isQR} onOpenChange={setIsQR}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Присъединяване чрез QR</DialogTitle>
            <DialogDescription>Сканирай или сподели този код — сканиращият става потвърден доброволец в този пожар.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center gap-3">
            {qrImg ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrImg} alt="QR" className="rounded-md border" />
            ) : (
              <div className="text-sm text-muted-foreground">Генериране…</div>
            )}
            {qrUrl && (
              <div className="text-xs break-all text-muted-foreground max-w-full">{qrUrl}</div>
            )}
            {qrUrl && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => navigator.clipboard?.writeText(qrUrl)}>Копирай линк</Button>
                <a href={qrUrl} target="_blank" rel="noreferrer">
                  <Button size="sm">Отвори</Button>
                </a>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
