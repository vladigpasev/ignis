"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import MapProvider from "@/lib/mapbox/provider";
import { useMap } from "@/context/map-context";
import { useUser } from "@auth0/nextjs-auth0";
import { Sparkles, HeartHandshake, Crosshair } from "lucide-react";
import type mapboxgl from "mapbox-gl";

const ACCESS_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN as string | undefined;

function MapInner({ center, onCenterChange }: { center: [number, number]; onCenterChange: (lng: number, lat: number) => void; }) {
  const { map } = useMap();
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  useEffect(() => {
    if (!map) return;
    if (!markerRef.current) {
      const mk = new (require('mapbox-gl').Marker)({ color: '#ef4444' })
        .setLngLat(center)
        .addTo(map);
      markerRef.current = mk;
      map.addControl(new (require('mapbox-gl').NavigationControl)({ showCompass: false }));
      map.on('click', (e) => onCenterChange(e.lngLat.lng, e.lngLat.lat));
    } else {
      markerRef.current.setLngLat(center);
    }
  }, [map, center[0], center[1], onCenterChange]);
  return null;
}

export default function VolunteerModal({
  open,
  onOpenChange,
  afterSave,
  title = 'Стани доброволец',
  submitLabel = 'Стани доброволец',
  cancelLabel = 'Пропусни',
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  afterSave?: () => void;
  title?: string;
  submitLabel?: string;
  cancelLabel?: string;
}) {
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [center, setCenter] = useState<[number, number]>([23.3219, 42.6977]); // Sofia default
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [bio, setBio] = useState("");
  const [motivation, setMotivation] = useState("");
  const [firstAid, setFirstAid] = useState(false);
  const [agreeContact, setAgreeContact] = useState(true);
  const [transport, setTransport] = useState<{ car?: boolean; suv4x4?: boolean; truck?: boolean; motorcycle?: boolean }>({});
  const [skills, setSkills] = useState<string[]>([]);
  const [availability, setAvailability] = useState<string>('anytime');

  const mapRef = useRef<HTMLDivElement | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (!ACCESS_TOKEN || !q || q.trim().length < 2) { setSuggestions([]); return; }
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${ACCESS_TOKEN}&autocomplete=true&limit=6&types=place,locality,neighborhood&language=bg,en`;
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

  useEffect(() => {
    // Prefill if we have an existing profile
    if (!open) return;
    (async () => {
      try {
        const r = await fetch('/api/me/volunteer-profile', { cache: 'no-store' });
        if (!r.ok) return;
        const j = await r.json();
        if (j?.profile) {
          const p = j.profile;
          setPhone(p.phone || "");
          setCity(p.city || "");
          if (p.lat && p.lng) setCenter([p.lng, p.lat]);
          setBio(p.bio || "");
          setMotivation(p.motivation || "");
          setSkills(Array.isArray(p.skills) ? p.skills : []);
          setTransport(typeof p.transport === 'object' && p.transport ? p.transport : {});
          setAvailability(p.availability || 'anytime');
          setFirstAid(p.firstAid === 1);
          setAgreeContact(p.agreeContact !== 0);
        }
      } catch {}
    })();
  }, [open]);

  const toggleSkill = (s: string) => setSkills((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);

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
    if (!user) { setMsg("Моля, влез в профила си."); return; }
    if (!city) { setMsg("Моля, избери населено място."); return; }
    try {
      setLoading(true);
      const res = await fetch('/api/me/volunteer-profile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone, city, lat: center[1], lng: center[0],
          bio, motivation, skills, transport, availability, firstAid, agreeContact
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || res.statusText);
      setMsg("Записано успешно! Ще получаваш известия в радиус 50 км.");
      onOpenChange(false);
      afterSave?.();
    } catch (e: any) {
      setMsg(e?.message || 'Грешка при записване.');
    } finally {
      setLoading(false);
    }
  };

  const SkillCheckbox = ({ label, value }: { label: string; value: string }) => (
    <label className="flex items-center gap-2 cursor-pointer">
      <Checkbox checked={skills.includes(value)} onCheckedChange={() => toggleSkill(value)} />
      <span className="text-sm">{label}</span>
    </label>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[100vw] md:w-[96vw] max-w-[1280px] xl:max-w-[1360px] p-0 sm:rounded-xl max-h-[100dvh] h-[100dvh] md:h-auto md:max-h-[90vh] overflow-y-auto">
        <div className="grid md:grid-cols-[1.6fr_1fr] gap-4 md:gap-6 lg:gap-8 md:h-[85vh] md:max-h-[920px]">
          {/* Form first on mobile */}
          <div className="order-1 md:order-2 flex flex-col md:border-l bg-background p-6 lg:p-8 gap-6 overflow-auto">
            <div className="w-full max-w-[680px] md:max-w-[760px] lg:max-w-[820px] xl:max-w-[880px] mx-auto md:mx-0 space-y-5 pb-24">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base md:text-lg">
                <HeartHandshake className="w-5 h-5 text-primary" /> {title}
              </DialogTitle>
            </DialogHeader>
              <form onSubmit={onSubmit} className="space-y-6">
                <div className="grid grid-cols-1 gap-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Имейл</Label>
                    <Input value={user?.email || ''} readOnly />
                  </div>
                  <div>
                    <Label htmlFor="phone">Телефон</Label>
                    <Input id="phone" placeholder="3598XXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Населено място</Label>
                    <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="София, Пловдив, …" />
                    <div className="text-xs text-muted-foreground mt-1">Избери от предложенията над картата за точна локация.</div>
                  </div>
                  <div>
                    <Label>Координати</Label>
                    <Input value={`${center[1].toFixed(5)}, ${center[0].toFixed(5)}`} readOnly />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <Label>Кратко за теб</Label>
                  <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Опиши накратко опит, умения или принос." rows={4} />
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <Label>Защо искаш да си доброволец?</Label>
                  <Textarea value={motivation} onChange={(e) => setMotivation(e.target.value)} placeholder="Мотивация и цели като доброволец." rows={4} />
                </div>

                <div>
                  <Label>Умения</Label>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <SkillCheckbox label="Първа помощ" value="first_aid" />
                    <SkillCheckbox label="Опит с пожари" value="firefighting" />
                    <SkillCheckbox label="Навигация/карти" value="navigation" />
                    <SkillCheckbox label="Комуникации/координация" value="communications" />
                    <SkillCheckbox label="Логистика/доставки" value="logistics" />
                    <SkillCheckbox label="Готвене/подкрепа" value="support" />
                  </div>
                </div>

                <div>
                  <Label>Транспорт</Label>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="flex items-center gap-2 cursor-pointer"><Checkbox checked={!!transport.car} onCheckedChange={(v) => setTransport((t) => ({ ...t, car: !!v }))} /> <span className="text-sm">Лек автомобил</span></label>
                    <label className="flex items-center gap-2 cursor-pointer"><Checkbox checked={!!transport.suv4x4} onCheckedChange={(v) => setTransport((t) => ({ ...t, suv4x4: !!v }))} /> <span className="text-sm">4x4/внедорожник</span></label>
                    <label className="flex items-center gap-2 cursor-pointer"><Checkbox checked={!!transport.truck} onCheckedChange={(v) => setTransport((t) => ({ ...t, truck: !!v }))} /> <span className="text-sm">Бус/камион</span></label>
                    <label className="flex items-center gap-2 cursor-pointer"><Checkbox checked={!!transport.motorcycle} onCheckedChange={(v) => setTransport((t) => ({ ...t, motorcycle: !!v }))} /> <span className="text-sm">Мотоциклет/АТВ</span></label>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                  <div>
                    <Label>Наличност</Label>
                    <select value={availability} onChange={(e) => setAvailability(e.target.value)} className="w-full h-10 rounded-md border bg-background px-2 text-sm">
                      <option value="anytime">По всяко време</option>
                      <option value="weekdays">Делнични дни</option>
                      <option value="weekends">Уикенди</option>
                      <option value="evenings">Вечери</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-2 mt-2 sm:mt-6">
                    <Checkbox checked={firstAid} onCheckedChange={(v) => setFirstAid(!!v)} />
                    <span className="text-sm">Имам обучение по първа помощ</span>
                  </label>
                </div>

                <label className="flex items-center gap-2">
                  <Checkbox checked={agreeContact} onCheckedChange={(v) => setAgreeContact(!!v)} />
                  <span className="text-sm">Съгласен съм да бъда търсен по телефон/имейл за спешна помощ</span>
                </label>

                {msg && <div className="text-sm text-foreground">{msg}</div>}
              </div>
              {/* Sticky mobile actions */}
              <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t px-4 py-4 flex gap-3 md:justify-end">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="w-1/2 md:w-auto">{cancelLabel}</Button>
                <Button type="submit" disabled={loading || !user} className="w-1/2 md:w-auto">{loading ? 'Записване…' : submitLabel}</Button>
              </div>
            </form>
            <div className="text-[11px] text-muted-foreground text-center mt-1">След запис, автоматично ще получаваш известия за пожари в радиус 50 км около избраното място.</div>
            </div>
          </div>

          {/* Map second on mobile */}
          <div className="relative order-2 md:order-1">
            <div className="absolute z-10 w-full p-3 md:p-4">
              <div className="bg-background/90 backdrop-blur-sm rounded-md shadow flex items-center gap-2 p-2">
                <Input
                  placeholder="Твоето населено място (град/село)…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => query && setSuggestOpen(true)}
                  className="text-sm"
                />
                <Button type="button" size="sm" variant="outline" onClick={useMyLocation} className="shrink-0">
                  <Crosshair className="w-4 h-4" />
                  Моята локация
                </Button>
              </div>
              {suggestOpen && suggestions.length > 0 && (
                <div className="mt-2 bg-background/95 backdrop-blur rounded-md shadow max-h-60 overflow-auto">
                  {suggestions.map((f: any) => (
                    <button
                      key={f.id}
                      onClick={() => { setCenter([f.center[0], f.center[1]]); setSuggestOpen(false); setQuery(f.place_name || ''); setCity(f.text || f.place_name || ''); }}
                      className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                    >
                      {f.text || f.place_name}
                      <div className="text-[11px] text-muted-foreground">{f.place_name}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div ref={mapRef} className="h-64 sm:h-80 md:h-full" />
            <MapProvider
              mapContainerRef={mapRef as any}
              initialViewState={{ longitude: center[0], latitude: center[1], zoom: 10 }}
              onMapLoad={(m) => { try { m.resize(); } catch {} }}
            >
              <MapInner center={center} onCenterChange={(lng, lat) => { setCenter([lng, lat]); }} />
            </MapProvider>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
