"use client";

import { useEffect, useState } from "react";
import type { RouteOut } from "@/types/api";

// Lazy-load leaflet to avoid SSR issues
let L: typeof import("leaflet") | null = null;

interface RouteMapProps {
  route: RouteOut;
}

const PICKUP_COLOR = "#2563eb"; // blue
const DROPOFF_COLOR = "#dc2626"; // red
const LINE_COLOR = "#374151"; // gray-700

export default function RouteMap({ route }: RouteMapProps) {
  const [mapId] = useState(() => `map-${route.id}`);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    let map: L.Map | null = null;

    async function initMap() {
      const leaflet = await import("leaflet");
      L = leaflet;

      const stopsWithCoords = route.stops.filter((s) => s.lat != null && s.lng != null);
      if (stopsWithCoords.length === 0) return;

      // Create map
      const container = document.getElementById(mapId);
      if (!container) return;

      // Clear existing map instance if any
      if ((container as HTMLElement & { _leaflet_id?: number })._leaflet_id) {
        container.innerHTML = "";
        delete (container as HTMLElement & { _leaflet_id?: number })._leaflet_id;
      }

      map = leaflet.map(mapId);

      leaflet
        .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
        })
        .addTo(map);

      // Add markers and build polyline
      const latLngs: [number, number][] = [];

      for (const stop of stopsWithCoords) {
        const lat = stop.lat!;
        const lng = stop.lng!;
        latLngs.push([lat, lng]);

        const isPickup = stop.stop_type === "pickup";
        const color = isPickup ? PICKUP_COLOR : DROPOFF_COLOR;
        const label = isPickup ? "P" : "D";

        const icon = leaflet.divIcon({
          className: "custom-marker",
          html: `<div style="
            background: ${color};
            color: white;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: bold;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          ">${label}${stop.stop_sequence}</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const popupContent = `
          <strong>#${stop.stop_sequence} ${isPickup ? "Pickup" : "Dropoff"}</strong><br/>
          ${stop.allocated_weight_kg ? `Weight: ${stop.allocated_weight_kg} kg` : ""}
          ${stop.eta ? `<br/>ETA: ${new Date(stop.eta).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}` : ""}
        `;

        leaflet.marker([lat, lng], { icon }).addTo(map).bindPopup(popupContent);
      }

      // Draw polyline connecting stops in sequence
      if (latLngs.length > 1) {
        leaflet
          .polyline(latLngs, {
            color: LINE_COLOR,
            weight: 3,
            opacity: 0.7,
            dashArray: "8, 8",
          })
          .addTo(map);
      }

      // Fit bounds to show all markers
      const bounds = leaflet.latLngBounds(latLngs);
      map.fitBounds(bounds, { padding: [30, 30] });
    }

    initMap();

    return () => {
      if (map) {
        map.remove();
        map = null;
      }
    };
  }, [mounted, mapId, route.stops]);

  const stopsWithCoords = route.stops.filter((s) => s.lat != null && s.lng != null);
  if (stopsWithCoords.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-md bg-zinc-50 text-sm text-black/40">
        No location data available for this route
      </div>
    );
  }

  return <div id={mapId} className="h-64 w-full rounded-md border border-black/10" />;
}
