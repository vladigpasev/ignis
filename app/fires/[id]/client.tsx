"use client";

import { useMemo, useRef, useState, useTransition, useEffect } from "react";
import MapProvider from "@/lib/mapbox/provider";
import MapControls from "@/components/map/map-controls";
import FireMarker from "@/components/fires/fire-marker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { metersToReadable, circlePolygon } from "@/lib/geo";
import { Navigation, QrCode, Check, User2, Users, MessageCircle, Plus, X } from "lucide-react";
import * as QRCode from "qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import ZoneDraw from "@/components/zones/zone-draw";
import ZoneList from "@/components/zones/zone-list";
import ZoneShapes from "@/components/zones/zone-shapes";
import ChatBox from "@/components/chat/chat-box";
import type mapboxgl from "mapbox-gl";

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

type ZoneListItem = {
  id: number;
  fireId: number;
  title?: string | null;
  description?: string | null;
  geomType: "circle" | "polygon";
  centerLat?: number | null;
  centerLng?: number | null;
  radiusM?: number | null;
  polygon?: [number, number][];
  createdAt: string;
  members: number;
  /** NEW - за UI подредба/бутоните */
  isMember?: boolean;
  /** NEW - cover снимка (последно качена), ако има */
  coverUrl?: string | null;
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

  // zones
  const [zones, setZones] = useState<ZoneListItem[]>([]);
  const [zonesLoaded, setZonesLoaded] = useState(false);
  const [zonesRefreshAt, setZonesRefreshAt] = useState<number>(0);
  const [showZoneCreator, setShowZoneCreator] = useState(false);

  // chat
  const [chatOpen, setChatOpen] = useState(false);
  // local ref to map instance captured on load
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef<mapboxgl.Map | null>(null);

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

  async function loadZones() {
    try {
      const j = await fetch(`/api/fires/${fire.id}/zones`, { cache: "no-store" }).then((r) => r.json());
      if (j?.ok) {
        setZones(j.zones || []);
        setZonesRefreshAt(Date.now());
      } else {
        console.error("Zones load error:", j?.error);
      }
    } catch (e) {
      console.error("Zones fetch failed:", e);
    } finally {
      // ВАЖНО: винаги маркираме като „заредено“, за да имаме fallback (пин) и да избегнем „празна“ карта
      setZonesLoaded(true);
    }
  }
  // Зареждаме зоните при отваряне на изгледа, за да знаем дали да показваме пин-а
  useEffect(() => {
    loadZones();
  }, []);

  // Малък ретрай — ако първото извикване фейлне/карта не е готова
  useEffect(() => {
    if (zonesLoaded) return;
    let tries = 0;
    const id = setInterval(() => {
      if (zonesLoaded || tries >= 4) {
        clearInterval(id);
        return;
      }
      tries += 1;
      loadZones();
    }, 1500);
    return () => clearInterval(id);
  }, [zonesLoaded, fire.id]);

  const canEditZones = viewer === "confirmed";

  // Compute and constrain map view to the fire area (zones + vicinity)
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;

    // Helper: compute [w, s, e, n] bounds
    const computeBounds = (): [number, number, number, number] | null => {
      try {
        if (zones && zones.length > 0) {
          let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
          for (const z of zones) {
            if (z.geomType === "circle" && z.centerLat != null && z.centerLng != null && z.radiusM) {
              const poly = circlePolygon({ lat: z.centerLat, lng: z.centerLng }, z.radiusM, 64).geometry.coordinates[0];
              for (const [lng, lat] of poly) {
                if (lng < w) w = lng;
                if (lng > e) e = lng;
                if (lat < s) s = lat;
                if (lat > n) n = lat;
              }
            } else if (z.polygon && z.polygon.length > 0) {
              for (const [lng, lat] of z.polygon) {
                if (lng < w) w = lng;
                if (lng > e) e = lng;
                if (lat < s) s = lat;
                if (lat > n) n = lat;
              }
            }
          }
          if (isFinite(w) && isFinite(s) && isFinite(e) && isFinite(n)) return [w, s, e, n];
        }
        // Fallback to fire center + radius if no zones
        const lat = fire.lat;
        const lng = fire.lng;
        const r = Math.max(200, fire.radiusM || 500); // ensure minimal radius
        const degLat = r / 111320; // ~ meters per degree latitude
        const degLng = r / (111320 * Math.cos((lat * Math.PI) / 180) || 1);
        return [lng - degLng, lat - degLat, lng + degLng, lat + degLat];
      } catch {
        return null;
      }
    };

    // Helper: expand bounds by a factor (relative to width/height) plus a small constant margin
    const expand = (b: [number, number, number, number], factor = 0.3): [number, number, number, number] => {
      const [w, s, e, n] = b;
      const width = Math.max(1e-5, e - w);
      const height = Math.max(1e-5, n - s);
      const kx = width * factor + 0.002; // ~200m lon margin near equator
      const ky = height * factor + 0.002; // ~200m lat margin
      return [w - kx, s - ky, e + kx, n + ky];
    };

    const raw = computeBounds();
    if (!raw) return;

    // Soft fit for viewport, wider bounds to limit panning
    const fit = expand(raw, 0.35);
    const clamp = expand(raw, 0.9);

    try {
      // Apply bounds and min/max zoom constraints
      map.setMaxBounds([[clamp[0], clamp[1]], [clamp[2], clamp[3]]]);
      map.setMaxZoom(19);

      // Fit view and then prevent zooming out too far
      map.fitBounds([[fit[0], fit[1]], [fit[2], fit[3]]], { padding: 60, maxZoom: 17, duration: 600 });
      map.once("moveend", () => {
        try {
          // Allow zooming out only a bit from the fitted view
          const current = map.getZoom();
          map.setMinZoom(Math.max(11, current - 1.2));
        } catch {}
      });
    } catch {}
  }, [mapReady, zonesLoaded, zones, fire.id, fire.lat, fire.lng, fire.radiusM]);

  return (
    <div className="w-screen min-h-screen">
      <div className="relative h-[65vh] w-full">
        <div id="map-container" ref={mapContainerRef} className="absolute inset-0 h-full w-full" />

        <MapProvider
          mapContainerRef={mapContainerRef}
          initialViewState={{ longitude: centerForMap.lng, latitude: centerForMap.lat, zoom: 15 }}
          styleUrl="mapbox://styles/mapbox/satellite-streets-v12"
          onMapLoad={(map) => {
            // NEW: безопасно презареждаме зоните точно когато стилът/картата са готови
            mapRef.current = map;
            setMapReady(true);
            loadZones();
          }}
        >
          <MapControls />
          {zonesLoaded && zones.length === 0 && (
            <FireMarker id={fire.id} lat={fire.lat} lng={fire.lng} />
          )}

          {zones.length > 0 && <ZoneShapes zones={zones as any} />}

          {showZoneCreator && canEditZones && (
            <div className="absolute top-4 left-4 z-10">
              <ZoneDraw
                fireId={fire.id}
                onCreated={() => {
                  setShowZoneCreator(false);
                  loadZones();
                }}
                onClose={() => setShowZoneCreator(false)}
              />
            </div>
          )}
        </MapProvider>

        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          <Badge variant="secondary" className="shadow-lg">Пожар #{fire.id}</Badge>
        </div>

        {canEditZones && !showZoneCreator && (
          <div className="absolute top-4 left-4 z-10">
            <Button size="sm" className="rounded-full shadow-md" onClick={() => setShowZoneCreator(true)} title="Създай зона">
              <Plus className="h-4 w-4 mr-1" />
              Създай зона
            </Button>
          </div>
        )}
      </div>

      <div className="max-w-6xl mx-auto w-full px-4 py-6">
        <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Основни данни</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <div>
                Статус: <span className="text-foreground font-medium">{fire.status}</span>
              </div>
              <div>
                Радиус: <span className="text-foreground font-medium">{metersToReadable(fire.radiusM)}</span>
              </div>
              <div>
                Координати: <span className="text-foreground font-medium">{fire.lat.toFixed(5)}, {fire.lng.toFixed(5)}</span>
              </div>
              <div>
                Създаден: <span className="text-foreground font-medium" suppressHydrationWarning>{new Date(fire.createdAt).toLocaleString()}</span>
              </div>

              <Separator className="my-3" />

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    window.open(
                      `https://www.google.com/maps/dir/?api=1&destination=${fire.lat},${fire.lng}`,
                      "_blank",
                    )
                  }
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
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-4 w-4" /> {confirmed.length}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <User2 className="h-4 w-4" /> {requested.length}
                  </span>
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
                          <span className="text-muted-foreground" suppressHydrationWarning> — от {new Date(r.createdAt).toLocaleString()}</span>
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

        <div className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Зони на пожара</CardTitle>
            </CardHeader>
            <CardContent>
              <ZoneList fireId={fire.id} canEdit={canEditZones} onChange={loadZones} refreshAt={zonesRefreshAt} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Floating Chat Button + Panel */}
      <div className="fixed bottom-4 right-4 z-20">
        {chatOpen && (
          <div className="mb-3 w-[min(380px,90vw)] max-h-[70vh] bg-background/95 backdrop-blur border rounded-lg shadow-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium">Общ чат</div>
              <Button size="icon" variant="ghost" onClick={() => setChatOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <ChatBox
              fetchUrl={`/api/fires/${fire.id}/chat`}
              postUrl={`/api/fires/${fire.id}/chat`}
              canBlock={viewer === "confirmed"}
              onBlock={async (userId) => {
                if (!confirm("Блокиране на потребителя от общия чат?")) return;
                await fetch(`/api/fires/${fire.id}/blocks`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ blockedUserId: userId }),
                });
              }}
            />
          </div>
        )}
        <Button size="icon" className="rounded-full h-12 w-12 shadow-lg" onClick={() => setChatOpen((v) => !v)} title="Чат">
          <MessageCircle className="h-6 w-6" />
        </Button>
      </div>

      <Dialog open={isQR} onOpenChange={setIsQR}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Присъединяване чрез QR</DialogTitle>
            <DialogDescription>
              Сканирай или сподели този код — сканиращият става потвърден доброволец в този пожар.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center gap-3">
            {qrImg ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrImg} alt="QR" className="rounded-md border" />
            ) : (
              <div className="text-sm text-muted-foreground">Генериране…</div>
            )}
            {qrUrl && <div className="text-xs break-all text-muted-foreground max-w-full">{qrUrl}</div>}
            {qrUrl && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => navigator.clipboard?.writeText(qrUrl)}>
                  Копирай линк
                </Button>
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
