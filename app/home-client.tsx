"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import MapProvider from "@/lib/mapbox/provider";
import MapStyles from "@/components/map/map-styles";
import MapControls from "@/components/map/map-controls";
import MapSearch from "@/components/map/map-search";

import FireCircles, { type FireItem } from "@/components/fires/fire-circles";
import FireMarker from "@/components/fires/fire-marker";
import FirePopup from "@/components/fires/fire-popup";
import UserLocationMarker from "@/components/fires/user-location-marker";
import ReportFire from "@/components/fires/report-fire";
import FireList from "@/components/fires/fire-list";
import { haversineMeters } from "@/lib/geo";

// 🆕 FIRMS
import FirmsHotspots from "@/components/fires/firms-hotspots";
type LatLng = { lat: number; lng: number };

export default function HomeClient({
  initialFires,
  createAction,
}: {
  initialFires: FireItem[];
  createAction: (formData: FormData) => Promise<void>;
}) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);

  const defaultCenter = useMemo<LatLng>(() => ({ lat: 42.6977, lng: 23.3219 }), []); // Sofia
  const [userPos, setUserPos] = useState<LatLng | null>(null);
  const [approxCenter, setApproxCenter] = useState<LatLng | null>(null);

  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Geo + IP fallback
  useEffect(() => {
    let done = false;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (done) return;
          done = true;
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setUserPos({ lat, lng });
        },
        async () => {
          if (done) return;
          try {
            const r = await fetch("/api/ip-geo");
            const j = await r.json();
            if (j?.latitude && j?.longitude) setApproxCenter({ lat: j.latitude, lng: j.longitude });
          } catch {}
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 8000 },
      );
    } else {
      (async () => {
        try {
          const r = await fetch("/api/ip-geo");
          const j = await r.json();
          if (j?.latitude && j?.longitude) setApproxCenter({ lat: j.latitude, lng: j.longitude });
        } catch {}
      })();
    }
  }, []);

  const centerForMap = userPos ?? approxCenter ?? defaultCenter;

  // Compute proximity-sorted fires on client
  const fires = useMemo(() => {
    const withDistance = initialFires.map((f) => {
      if (!userPos && !approxCenter) return f;
      const origin = userPos ?? approxCenter!;
      return { ...f, distanceM: haversineMeters(origin, { lat: f.lat, lng: f.lng }) };
    });
    if (!userPos && !approxCenter) return withDistance;
    return withDistance.slice().sort((a, b) => (a.distanceM ?? 0) - (b.distanceM ?? 0));
  }, [initialFires, userPos, approxCenter]);

  const selected = selectedId ? fires.find((f) => f.id === selectedId) ?? null : null;

  return (
    <div className="w-screen min-h-screen">
      <div className="relative h-[65vh] w-full">
        <div id="map-container" ref={mapContainerRef} className="absolute inset-0 h-full w-full" />

        <MapProvider
          mapContainerRef={mapContainerRef}
          initialViewState={{ longitude: centerForMap.lng, latitude: centerForMap.lat, zoom: 11 }}
        >
          <MapSearch />
          <MapControls />
          <MapStyles />

          {/* 🆕 FIRMS Live layer (жълто/оранжево) */}
          <FirmsHotspots
            createAction={createAction}
            dedupRadiusM={500}
            days={2}
            minConfidence={0}
            activeFires={fires.map((f) => ({ lat: f.lat, lng: f.lng }))}
          />

          {/* Report Fire via server action */}
          <ReportFire action={createAction} />

          <FireCircles fires={fires} />
          {fires.map((f) => (
            <FireMarker key={f.id} id={f.id} lat={f.lat} lng={f.lng} onClick={(id) => setSelectedId(id)} />
          ))}
          {userPos && <UserLocationMarker lat={userPos.lat} lng={userPos.lng} />}
          {selected && (
            <FirePopup
              id={selected.id}
              lat={selected.lat}
              lng={selected.lng}
              radiusM={selected.radiusM}
              createdAt={selected.createdAt}
              onClose={() => setSelectedId(null)}
            />
          )}
        </MapProvider>
      </div>

      <div className="mt-6">
        <FireList fires={fires} onFocus={(f) => setSelectedId(f.id)} />
      </div>
    </div>
  );
}
