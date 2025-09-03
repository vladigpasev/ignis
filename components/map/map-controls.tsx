"use client";

import React from "react";
import { PlusIcon, MinusIcon } from "lucide-react";
import { useMap } from "@/context/map-context";
import { Button } from "@/components/ui/button";

export default function MapControls() {
  const { map } = useMap();

  return (
    <aside className="absolute bottom-8 right-4 z-10 bg-background/80 p-2 rounded-lg shadow-lg flex flex-col gap-2">
      <Button variant="ghost" size="icon" onClick={() => map?.zoomIn()}>
        <PlusIcon className="w-5 h-5" />
        <span className="sr-only">Zoom in</span>
      </Button>
      <Button variant="ghost" size="icon" onClick={() => map?.zoomOut()}>
        <MinusIcon className="w-5 h-5" />
        <span className="sr-only">Zoom out</span>
      </Button>
    </aside>
  );
}

