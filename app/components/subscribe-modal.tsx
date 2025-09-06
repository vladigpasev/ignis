"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

function isValidEmail(v: string) {
  return /.+@.+\..+/.test(v);
}

function round(n: number, p = 4) { return Math.round(n * Math.pow(10, p)) / Math.pow(10, p); }

export default function SubscribeModal() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [lat, setLat] = useState<string>("");
  const [lng, setLng] = useState<string>("");
  const [radiusKm, setRadiusKm] = useState<number>(15);
  const [sourceReports, setSourceReports] = useState(true);
  const [sourceFirms, setSourceFirms] = useState(true);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string>("");

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setMsg("Геолокация не е налична в браузъра.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setLat(String(round(latitude)));
        setLng(String(round(longitude)));
        setMsg("");
      },
      (err) => setMsg("Неуспешно вземане на локация: " + (err?.message || "")),
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");
    if (!email && !phone) {
      setMsg("Въведете имейл или телефон.");
      return;
    }
    if (email && !isValidEmail(email)) {
      setMsg("Невалиден имейл адрес.");
      return;
    }
    const latN = Number(lat), lngN = Number(lng);
    if (!Number.isFinite(latN) || !Number.isFinite(lngN)) {
      setMsg("Въведете коректни координати (lat/lng).");
      return;
    }
    try {
      setLoading(true);
      const res = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, phone, lat: latN, lng: lngN, radiusKm, sourceFirms, sourceReports }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || res.statusText);
      setMsg("Успешно записване! Ще получавате известия за района.");
      setEmail(""); setPhone("");
      // setOpen(false); keep open to show msg
    } catch (e: any) {
      setMsg(e?.message || 'Грешка при записване.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">Получавай известия</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Известия за пожари</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="email">Имейл</Label>
              <Input id="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="phone">Телефон</Label>
              <Input id="phone" placeholder="3598XXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="lat">Ширина (lat)</Label>
              <Input id="lat" placeholder="42.6975" value={lat} onChange={(e) => setLat(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="lng">Дължина (lng)</Label>
              <Input id="lng" placeholder="23.3241" value={lng} onChange={(e) => setLng(e.target.value)} />
            </div>
          </div>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Label htmlFor="radius">Радиус (км)</Label>
              <Input id="radius" type="number" min={1} max={200} value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))} />
              <p className="text-xs text-gray-500 mt-1">Препоръка: 10–25 км</p>
            </div>
            <Button type="button" variant="outline" onClick={useMyLocation}>
              Използвай локацията ми
            </Button>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={sourceReports} onChange={(e) => setSourceReports(e.target.checked)} /> Доклади
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={sourceFirms} onChange={(e) => setSourceFirms(e.target.checked)} /> FIRMS
            </label>
          </div>
          {msg && <div className="text-sm text-gray-700">{msg}</div>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Затвори</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Записване…' : 'Запиши'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

