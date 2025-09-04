"use client";

import { MapPin } from "lucide-react";
import Marker from "@/components/map/map-marker";

type Props = {
  id: string;
  lat: number;
  lng: number;
  count?: number;
  onClick?: (id: string) => void;
  onHover?: (id: string) => void;
};

export default function FirmsMarker({ id, lat, lng, count = 1, onClick, onHover }: Props) {
  const dummy: any = { properties: { mapbox_id: String(id) } };

  return (
    <Marker
      longitude={lng}
      latitude={lat}
      data={dummy}
      onHover={() => onHover?.(id)}
      onClick={() => onClick?.(id)}
    >
      <div className="relative rounded-full flex items-center justify-center transform transition-all duration-200 bg-amber-500 text-white shadow-lg size-8 cursor-pointer hover:scale-110">
        <MapPin className="stroke-[2.5px] size-4.5" />
        {count > 1 && (
          <span className="absolute -top-1.5 -right-1.5 text-[10px] leading-none px-1.5 py-0.5 rounded-full bg-black/85 text-white ring-2 ring-amber-400/90">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </div>
    </Marker>
  );
}
