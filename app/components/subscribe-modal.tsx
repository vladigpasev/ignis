"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { BellRing } from "lucide-react";
import MapProvider from "@/lib/mapbox/provider";
import { useMap } from "@/context/map-context";
import type mapboxgl from "mapbox-gl";
import { useUser } from "@auth0/nextjs-auth0";

const ACCESS_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN as string | undefined;

function MapInner({ center, onCenterChange, radiusKm }: { center: [number, number]; onCenterChange: (lng: number, lat: number) => void; radiusKm: number; }) {
  const { map } = useMap();
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const circleId = useRef<string>(`sub-circle-${Math.random().toString(36).slice(2)}`);

  const updateCircle = useCallback((m: mapboxgl.Map, lng: number, lat: number, rKm: number) => {
    if (!m || !m.isStyleLoaded || !m.isStyleLoaded()) {
      const onLoad = () => {
        try { updateCircle(m, lng, lat, rKm); } finally { m.off('load', onLoad); }
      };
      m.on('load', onLoad);
      return;
    }

    const r = Math.max(0.2, Math.min(200, rKm)) * 1000; // meters
    const steps = 64;
    const coords: [number, number][] = [];
    const d2r = Math.PI / 180;
    const earth = 6378137; // meters
    const latRad = lat * d2r;
    for (let i = 0; i <= steps; i++) {
      const theta = (i / steps) * 2 * Math.PI;
      const dx = (r * Math.cos(theta)) / (earth * Math.cos(latRad));
      const dy = (r * Math.sin(theta)) / earth;
      const newLng = lng + (dx * 180) / Math.PI;
      const newLat = lat + (dy * 180) / Math.PI;
      coords.push([newLng, newLat]);
    }
    const data: GeoJSON.Feature<GeoJSON.Polygon> = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [coords] },
    };
    const srcId = `${circleId.current}-src`;
    const fillId = `${circleId.current}-fill`;
    const lineId = `${circleId.current}-line`;

    try {
      if (m.getSource(srcId)) {
        (m.getSource(srcId) as mapboxgl.GeoJSONSource).setData(data);
      } else {
        m.addSource(srcId, { type: 'geojson', data });
        if (!m.getLayer(fillId)) m.addLayer({ id: fillId, type: 'fill', source: srcId, paint: { 'fill-color': '#ef4444', 'fill-opacity': 0.18 }});
        if (!m.getLayer(lineId)) m.addLayer({ id: lineId, type: 'line', source: srcId, paint: { 'line-color': '#ef4444', 'line-width': 2, 'line-opacity': 0.6 }});
      }
    } catch (e: any) {
      // If style not ready despite the check, retry on next styledata
      const onStyle = () => {
        try { updateCircle(m, lng, lat, rKm); } finally { m.off('styledata', onStyle); }
      };
      m.on('styledata', onStyle);
    }
  }, []);

  useEffect(() => {
    if (!map) return;
    if (!markerRef.current) {
      const mk = new (require('mapbox-gl').Marker)({ draggable: true, color: '#ef4444' })
        .setLngLat(center)
        .addTo(map);
      mk.on('dragend', () => {
        const p = mk.getLngLat();
        onCenterChange(p.lng, p.lat);
      });
      markerRef.current = mk;
      map.addControl(new (require('mapbox-gl').NavigationControl)({ showCompass: false }));
      map.addControl(new (require('mapbox-gl').GeolocateControl)({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: false }));
      map.on('click', (e) => onCenterChange(e.lngLat.lng, e.lngLat.lat));
    } else {
      markerRef.current.setLngLat(center);
    }
    updateCircle(map, center[0], center[1], radiusKm);
  }, [map, center[0], center[1], radiusKm, onCenterChange, updateCircle]);

  return null;
}

export default function SubscribeModal() {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [radiusKm, setRadiusKm] = useState<number>(15);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const { user, isLoading } = useUser();

  // default center: Sofia
  const [center, setCenter] = useState<[number, number]>([23.3219, 42.6977]);

  const mapRef = useRef<HTMLDivElement | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (!ACCESS_TOKEN || !q || q.trim().length < 2) { setSuggestions([]); return; }
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${ACCESS_TOKEN}&autocomplete=true&limit=6&language=bg,en`;
      const res = await fetch(url);
      const data = await res.json();
      const feats = Array.isArray(data?.features) ? data.features : [];
      setSuggestions(feats);
      setSuggestOpen(true);
    } catch (e) {
      setSuggestions([]);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => doSearch(query), 250);
    return () => clearTimeout(id);
  }, [query, doSearch]);

  const useMyLocation = () => {
    setMsg("");
    if (!navigator.geolocation) { setMsg("Геолокация не е налична в браузъра."); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setCenter([Number(longitude.toFixed(6)), Number(latitude.toFixed(6))]);
      },
      (err) => setMsg("Неуспешно вземане на локация: " + (err?.message || "")),
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");
    if (!user) { setMsg("Трябва да сте логнати."); return; }
    try {
      setLoading(true);
      const res = await fetch('/api/subscriptions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, lat: center[1], lng: center[0], radiusKm }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || res.statusText);
      setMsg("Успешно записване! Ще получавате известия за района.");
      setPhone("");
    } catch (e: any) {
      setMsg(e?.message || 'Грешка при записване.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="lg"
          className="rounded-full px-5 py-2.5 bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 text-white shadow-md hover:shadow-lg hover:from-orange-600 hover:via-amber-600 hover:to-yellow-600 transition-all"
        >
          <BellRing className="w-4 h-4" />
          Получавай известия
        </Button>
      </DialogTrigger>
      {/* Wider, polished desktop layout */}
      <DialogContent className="w-[98vw] max-w-[1320px] md:max-w-[1400px] p-0 overflow-hidden rounded-xl border shadow-2xl">
        <div className="grid md:grid-cols-[1.8fr_1fr] gap-0 md:h-[80vh] md:max-h-[900px]">
          {/* Map + Search */}
          <div className="relative bg-muted/20">
            <div className="absolute z-10 w-full p-4 md:p-5 pointer-events-none">
              <div className="max-w-[620px] pointer-events-auto">
                <div className="bg-background/90 backdrop-blur rounded-lg shadow-lg border flex items-center gap-2 p-2.5">
                  <Input
                    placeholder="Търси адрес или място…"
                    aria-label="Търси адрес или място"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => query && setSuggestOpen(true)}
                  />
                  <Button type="button" variant="outline" onClick={useMyLocation} className="whitespace-nowrap">Моята локация</Button>
                </div>
                {suggestOpen && suggestions.length > 0 && (
                  <div className="mt-2 bg-background/90 backdrop-blur rounded-lg shadow-lg border max-h-72 overflow-auto">
                    {suggestions.map((f: any) => (
                      <button
                        key={f.id}
                        onClick={() => { setCenter([f.center[0], f.center[1]]); setSuggestOpen(false); setQuery(f.place_name || ''); }}
                        className="w-full text-left px-3 py-2.5 hover:bg-accent focus:bg-accent focus:outline-none text-sm"
                      >
                        <div className="font-medium text-foreground">{f.text || f.place_name}</div>
                        <div className="text-[11px] text-muted-foreground">{f.place_name}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div ref={mapRef} className="h-[52vh] md:h-full ring-1 ring-border" />

            {/* Map init */}
            <MapProvider
              mapContainerRef={mapRef as any}
              initialViewState={{ longitude: center[0], latitude: center[1], zoom: 10 }}
              onMapLoad={(m) => {
                try { m.resize(); } catch {}
              }}
            >
              <MapInner center={center} onCenterChange={(lng, lat) => setCenter([lng, lat])} radiusKm={radiusKm} />
            </MapProvider>
          </div>

          {/* Form */}
          <div className="flex flex-col border-l bg-background p-5 md:p-6 gap-4">
            <DialogHeader>
              <DialogTitle className="text-lg md:text-xl">Известия за пожари в район</DialogTitle>
            </DialogHeader>
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="grid grid-cols-1 gap-4">
                {!isLoading && !user && (
                  <div className="p-3.5 rounded-lg bg-accent/40 text-foreground text-sm border">
                    За да създадете абонамент за известия, моля <a className="underline" href="/auth/login">влезте в профила си</a>.
                  </div>
                )}
                {!!user && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Имейл</Label>
                      <Input value={user.email || ''} readOnly aria-readonly="true"/>
                    </div>
                    <div>
                      <Label htmlFor="phone">Телефон (по избор)</Label>
                      <Input id="phone" placeholder="3598XXXXXXXX" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    </div>
                  </div>
                )}

                <div>
                  <Label id="radius-label">Радиус: {radiusKm} км</Label>
                  <input aria-labelledby="radius-label" type="range" min={1} max={200} value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))} className="w-full accent-orange-500" />
                  <p className="text-xs text-muted-foreground mt-1">Препоръка: 10–25 км</p>
                </div>

                <div className="text-xs text-muted-foreground">Избрани координати: {center[1].toFixed(5)}, {center[0].toFixed(5)}</div>
                {msg && (
                  <div role="status" aria-live="polite" className="text-sm px-3 py-2 rounded-md border bg-background/60">
                    {msg}
                  </div>
                )}
              </div>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">Можете да се отпишете по всяко време от линка в имейла/SMS.</p>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Затвори</Button>
                  <Button type="submit" disabled={loading || !user}>{loading ? 'Записване…' : 'Запиши'}</Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
