import { Crosshair } from "lucide-react";
import { LocationFeature } from "@/lib/mapbox/utils";
import Marker from "@/components/map/map-marker";

interface LocationMarkerProps {
  location: LocationFeature;
  onHover: (data: LocationFeature) => void;
}

export function LocationMarker({ location, onHover }: LocationMarkerProps) {
  return (
    <Marker
      longitude={location.geometry.coordinates[0]}
      latitude={location.geometry.coordinates[1]}
      data={location}
      onHover={({ data }) => onHover(data)}
    >
      <div className="relative size-8 cursor-pointer transform transition-transform duration-200 hover:scale-110">
        {/* soft glow to distinguish from fires */}
        <span className="absolute -inset-1 rounded-full bg-sky-400/25 blur-sm" />
        <div className="relative rounded-full h-full w-full bg-sky-600 text-white shadow-lg ring-2 ring-white">
          <div className="flex h-full w-full items-center justify-center">
            <Crosshair className="size-4.5" />
          </div>
        </div>
      </div>
    </Marker>
  );
}
