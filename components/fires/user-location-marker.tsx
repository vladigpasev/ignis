"use client";

import Marker from "@/components/map/map-marker";

export default function UserLocationMarker({ lat, lng }: { lat: number; lng: number }) {
  const dummy: any = { properties: { mapbox_id: "me" } };

  return (
    <Marker longitude={lng} latitude={lat} data={dummy}>
      <div className="size-3 rounded-full bg-blue-500 ring-4 ring-blue-500/20 shadow-md" />
    </Marker>
  );
}

