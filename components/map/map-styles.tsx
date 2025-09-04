"use client";

import React, { useEffect, useState } from "react";
import { MapIcon, MoonIcon, SatelliteIcon, SunIcon, TreesIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useMap } from "@/context/map-context";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type StyleOption = {
  id: string;
  label: string;
  icon: React.ReactNode;
};

const STYLE_OPTIONS: StyleOption[] = [
  { id: "streets-v12", label: "Map", icon: <MapIcon className="w-5 h-5" /> },
  { id: "satellite-streets-v12", label: "Satellite", icon: <SatelliteIcon className="w-5 h-5" /> },
  { id: "outdoors-v12", label: "Terrain", icon: <TreesIcon className="w-5 h-5" /> },
  { id: "light-v11", label: "Light", icon: <SunIcon className="w-5 h-5" /> },
  { id: "dark-v11", label: "Dark", icon: <MoonIcon className="w-5 h-5" /> },
];

export default function MapStyles({ initialStyle = "streets-v12" }: { initialStyle?: string }) {
  const { map } = useMap();
  const { setTheme } = useTheme();
  const [activeStyle, setActiveStyle] = useState(initialStyle);

  const handleChange = (value: string) => {
    if (!map) return;
    map.setStyle(`mapbox://styles/mapbox/${value}`);
    setActiveStyle(value);
  };

  useEffect(() => {
    setTheme(activeStyle === "dark-v11" ? "dark" : "light");
  }, [activeStyle, setTheme]);

  return (
    <aside className="absolute bottom-4 left-4 z-10">
      <Tabs value={activeStyle} onValueChange={handleChange}>
        <TabsList className="bg-background/90 shadow-lg backdrop-blur">
          {STYLE_OPTIONS.map((style) => (
            <TabsTrigger
              key={style.id}
              value={style.id}
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm flex items-center sm:px-3 sm:py-1.5"
            >
              {style.icon}
              <span className="hidden sm:inline ml-1">{style.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </aside>
  );
}
