"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, MapPin, X } from "lucide-react";
import { useMap } from "@/context/map-context";
import { cn } from "@/lib/utils";
import { iconMap, LocationFeature, LocationSuggestion } from "@/lib/mapbox/utils";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { LocationMarker } from "@/components/location-marker";
import { LocationPopup } from "@/components/location-popup";
import { useDebounce } from "@/hooks/useDebounce";

export default function MapSearch() {
  const { map } = useMap();
  const [query, setQuery] = useState("");
  const [displayValue, setDisplayValue] = useState("");
  const [results, setResults] = useState<LocationSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<LocationFeature | null>(null);
  const [selectedLocations, setSelectedLocations] = useState<LocationFeature[]>([]);
  const debouncedQuery = useDebounce(query, 400);

  const accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;
  const sessionToken = useMemo(() => {
    const env = process.env.NEXT_PUBLIC_MAPBOX_SESSION_TOKEN;
    if (env) return env;
    const key = "mapbox-session-token";
    const cached = typeof window !== "undefined" ? localStorage.getItem(key) : null;
    if (cached) return cached;
    const generated = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random()).slice(2);
    if (typeof window !== "undefined") localStorage.setItem(key, generated);
    return generated;
  }, []);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const searchLocations = async () => {
      setIsSearching(true);
      setIsOpen(true);

      try {
        const res = await fetch(
          `https://api.mapbox.com/search/searchbox/v1/suggest?q=${encodeURIComponent(debouncedQuery)}&access_token=${accessToken}&session_token=${sessionToken}&limit=5`
        );

        const data = await res.json();
        setResults(data?.suggestions ?? []);
      } catch (err) {
        console.error("Geocoding error:", err);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    searchLocations();
  }, [debouncedQuery, accessToken, sessionToken]);

  const handleInputChange = (value: string) => {
    setQuery(value);
    setDisplayValue(value);
  };

  const handleSelect = async (suggestion: LocationSuggestion) => {
    try {
      setIsSearching(true);

      const res = await fetch(
        `https://api.mapbox.com/search/searchbox/v1/retrieve/${suggestion.mapbox_id}?access_token=${accessToken}&session_token=${sessionToken}`
      );

      const data = await res.json();
      const featuresData = data?.features as LocationFeature[] | undefined;

      if (map && featuresData?.length) {
        const [lng, lat] = featuresData[0]?.geometry?.coordinates;
        map.flyTo({ center: [lng, lat], zoom: 14, speed: 4, duration: 1000, essential: true });

        setDisplayValue(suggestion.name);
        setSelectedLocations(featuresData);
        setSelectedLocation(featuresData[0]);
        setResults([]);
        setIsOpen(false);
      }
    } catch (err) {
      console.error("Retrieve error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setQuery("");
    setDisplayValue("");
    setResults([]);
    setIsOpen(false);
    setSelectedLocation(null);
    setSelectedLocations([]);
  };

  return (
    <>
      <section className="absolute top-4 left-1/2 sm:left-4 z-10 w-[90vw] sm:w-[350px] -translate-x-1/2 sm:translate-x-0 rounded-lg shadow-lg">
        <Command className="rounded-lg">
          <div className={cn("w-full flex items-center justify-between px-3 gap-1", isOpen && "border-b")}>
            <CommandInput placeholder="Търси локация..." value={displayValue} onValueChange={handleInputChange} className="flex-1" />
            {displayValue && !isSearching && (
              <X className="size-4 shrink-0 text-muted-foreground cursor-pointer hover:text-foreground transition-colors" onClick={clearSearch} />
            )}
            {isSearching && <Loader2 className="size-4 shrink-0 text-primary animate-spin" />}
          </div>

          {isOpen && (
            <CommandList className="max-h-60 overflow-y-auto">
              {!query.trim() || isSearching ? null : results.length === 0 ? (
                <CommandEmpty className="py-6 text-center">
                  <div className="flex flex-col items-center justify-center space-y-1">
                    <p className="text-sm font-medium">Няма резултати</p>
                    <p className="text-xs text-muted-foreground">Пробвай с друг термин</p>
                  </div>
                </CommandEmpty>
              ) : (
                <CommandGroup>
                  {results.map((location) => (
                    <CommandItem
                      key={location.mapbox_id}
                      onSelect={() => handleSelect(location)}
                      value={`${location.name} ${location.place_formatted} ${location.mapbox_id}`}
                      className="flex items-center py-3 px-2 cursor-pointer hover:bg-accent rounded-md"
                    >
                      <div className="flex items-center space-x-2">
                        <div className="bg-primary/10 p-1.5 rounded-full">
                          {location.maki && iconMap[location.maki] ? iconMap[location.maki] : <MapPin className="h-4 w-4 text-primary" />}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium truncate max-w-[270px]">{location.name}</span>
                          <span className="text-xs text-muted-foreground truncate max-w-[270px]">{location.place_formatted}</span>
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          )}
        </Command>
      </section>

      {selectedLocations.map((location) => (
        <LocationMarker key={location.properties.mapbox_id} location={location} onHover={(data) => setSelectedLocation(data)} />
      ))}

      {selectedLocation && <LocationPopup location={selectedLocation} onClose={() => setSelectedLocation(null)} />}
    </>
  );
}

