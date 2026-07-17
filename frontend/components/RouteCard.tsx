"use client";

import { lazy, Suspense, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, CheckCircle, Route as RouteIcon } from "lucide-react";
import { formatEtaWIB } from "@/lib/format";
import SpaceOptimizationSection from "@/components/space-optimization/SpaceOptimizationSection";
import type { RouteOut, TruckOut } from "@/types/api";

const RouteMap = lazy(() => import("@/components/RouteMap"));

// Helper to determine visual styling, focusing on warehouse terminology
function getStopVisuals(type: string) {
  switch (type) {
    case "start_at_origin":
      return {
        color: "bg-emerald-600",
        badgeColor: "text-emerald-700 border-emerald-200 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/30",
        label: "Origin Dispatch",
        fallbackName: "Main Warehouse",
        icon: "🏢"
      };
    case "return_to_origin":
      return {
        color: "bg-slate-700",
        badgeColor: "text-slate-700 border-slate-200 bg-slate-50 dark:text-slate-400 dark:bg-slate-900/30",
        label: "Return & Unload",
        fallbackName: "Main Warehouse",
        icon: "↩️"
      };
    case "pickup":
      return {
        color: "bg-blue-600",
        badgeColor: "text-blue-700 border-blue-200 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/30",
        label: "Warehouse Loading",
        fallbackName: "Partner Warehouse",
        icon: "📦"
      };
    case "dropoff":
      return {
        color: "bg-amber-500",
        badgeColor: "text-amber-700 border-amber-200 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/30",
        label: "Customer Delivery",
        fallbackName: "Destination Dropoff",
        icon: "📍"
      };
    default:
      return {
        color: "bg-gray-400",
        badgeColor: "text-gray-700 border-gray-200 bg-gray-50",
        label: "Transit Stop",
        fallbackName: "Unknown Location",
        icon: "🔘"
      };
  }
}

interface RouteCardProps {
  route: RouteOut;
  truck?: TruckOut;
  index: number;
}

export default function RouteCard({ route, truck, index }: RouteCardProps) {
  const [selectedStopSequence, setSelectedStopSequence] = useState<number | null>(null);

  function handleStopClick(stopSequence: number) {
    setSelectedStopSequence((prev) => (prev === stopSequence ? null : stopSequence));
  }

  return (
    <Card className="overflow-hidden shadow-sm hover:shadow-md transition-shadow">

      {/* Route Header */}
      <div className="bg-muted/30 border-b p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
            {index + 1}
          </div>
          <div>
            <h4 className="text-lg font-bold">
              {route.truck_plate_number ?? `Truck ${route.truck_id.slice(0, 8)}…`}
            </h4>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
              <span className="capitalize">{route.truck_vehicle_type?.replace("_", " ")}</span>
              <span>•</span>
              <span>{route.stops.length} Stops</span>
              {route.total_distance_km && (
                <>
                  <span>•</span>
                  <span className="font-medium text-foreground">{route.total_distance_km} km round-trip</span>
                </>
              )}
            </div>
          </div>
        </div>
        <Badge variant="outline" className="bg-background">{route.status}</Badge>
      </div>

      <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Left Column: Map & Space Optimization */}
        <div className="space-y-6">

          {/* Utilization Bars */}
          {route.space_utilization_percent != null && (
            <div className="p-4 rounded-xl border bg-card space-y-4">
              <h5 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Fleet Capacity Utilization</h5>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Volume Space</span>
                  <span className="font-bold">{route.space_utilization_percent}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className={`h-full transition-all duration-1000 ${
                      route.space_utilization_percent > 90 ? "bg-rose-500" : "bg-blue-500"
                    }`}
                    style={{ width: `${Math.min(100, route.space_utilization_percent)}%` }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Payload Weight</span>
                  <span className="font-bold">{route.weight_utilization_percent}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className={`h-full transition-all duration-1000 ${
                      (route.weight_utilization_percent ?? 0) > 90 ? "bg-rose-500" : "bg-amber-500"
                    }`}
                    style={{ width: `${Math.min(100, route.weight_utilization_percent ?? 0)}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="rounded-xl overflow-hidden border shadow-inner">
            <Suspense fallback={<div className="h-64 flex items-center justify-center bg-muted text-muted-foreground animate-pulse">Loading map...</div>}>
              <div className="h-64 sm:h-80">
                <RouteMap route={route} />
              </div>
            </Suspense>
          </div>

          <SpaceOptimizationSection
            route={route}
            truck={truck}
            selectedStopSequence={selectedStopSequence}
            onClearSelection={() => setSelectedStopSequence(null)}
          />
        </div>

        {/* Right Column: Route Sequence Timeline focused on Facilities */}
        <div>
          <h4 className="text-base font-semibold mb-6 flex items-center gap-2">
            <RouteIcon className="h-4 w-4 text-muted-foreground" />
            Facility Routing Sequence
          </h4>

          <div className="relative ml-3 border-l-2 border-muted/60 pb-4">
            {route.stops.map((stop, index) => {
              const visuals = getStopVisuals(stop.stop_type);
              const showWeight = stop.allocated_weight_kg && stop.allocated_weight_kg > 0;
              const isLast = index === route.stops.length - 1;
              const isSelected = selectedStopSequence === stop.stop_sequence;

              return (
                <div key={stop.id} className={`relative pl-6 ${isLast ? "" : "mb-6"}`}>
                  {/* Timeline Node */}
                  <div
                    className={`absolute -left-[15px] top-1.5 flex h-7 w-7 items-center justify-center rounded-full border-4 border-background text-[10px] font-bold text-white shadow-sm ${visuals.color}`}
                    title={`Sequence ${stop.stop_sequence}`}
                  >
                    {stop.stop_sequence}
                  </div>

                  {/* Stop Card - Emphasizing Location Name */}
                  <button
                    type="button"
                    onClick={() => handleStopClick(stop.stop_sequence)}
                    className={`w-full text-left rounded-lg border bg-card p-3 shadow-sm transition-shadow group cursor-pointer hover:shadow-md ${
                      isSelected ? "border-primary ring-2 ring-primary/40" : ""
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div>
                        {/* PRIMARY FOCUS: The Location/Warehouse Name */}
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-base font-bold text-foreground">
                            {stop.location_name || visuals.fallbackName}
                          </span>
                          {stop.status === "completed" && <CheckCircle className="h-4 w-4 text-emerald-500" />}
                        </div>

                        {/* SECONDARY FOCUS: The Action happening at that location */}
                        <div className="flex items-center gap-2 mb-2.5">
                          <Badge variant="outline" className={`text-[10px] font-semibold uppercase tracking-wider py-0.5 ${visuals.badgeColor}`}>
                            {visuals.icon} {visuals.label}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          {showWeight && (
                            <span className="flex items-center gap-1 bg-muted px-2 py-0.5 rounded-md text-foreground font-medium">
                              <Package className="h-3 w-3" /> {stop.allocated_weight_kg} kg
                            </span>
                          )}
                          {stop.eta && (
                            <span className="flex items-center gap-1">
                              ETA: <span className="font-medium text-foreground">{formatEtaWIB(stop.eta)}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <Badge variant="secondary" className="w-fit sm:w-auto mt-2 sm:mt-0 text-[10px] uppercase tracking-wider">
                        {stop.status}
                      </Badge>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </Card>
  );
}
