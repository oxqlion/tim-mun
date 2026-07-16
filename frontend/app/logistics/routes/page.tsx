"use client";

import { useCallback, useEffect, useState, lazy, Suspense } from "react";
import RoleGuard from "@/components/RoleGuard";
import DashboardLayout, { logisticsNav } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, ApiError } from "@/lib/api";
import { formatEtaWIB } from "@/lib/format";
import { Loader2 } from "lucide-react";
import type { RouteOut, StopStatus } from "@/types/api";

const RouteMap = lazy(() => import("@/components/RouteMap"));

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function getStopVisuals(type: string) {
  switch (type) {
    case "start_at_origin": 
      return { color: "bg-emerald-600", label: "🏁 Start" };
    case "return_to_origin": 
      return { color: "bg-slate-700", label: "🏠 Return" };
    case "pickup": 
      return { color: "bg-blue-600", label: "📦 Pickup" };
    case "dropoff": 
      return { color: "bg-red-500", label: "📍 Dropoff" };
    default: 
      return { color: "bg-gray-500", label: "🔘 Stop" };
  }
}

function RoutesContent() {
  const [date, setDate] = useState(todayIso());
  const [routes, setRoutes] = useState<RouteOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const load = useCallback((d: string) => {
    api.get<RouteOut[]>(`/routes?date=${d}`).then(setRoutes).catch(() => setError("Failed to load routes"));
  }, []);

  useEffect(() => load(date), [date, load]);

  async function handleGenerate() {
    setError(null);
    setGenerating(true);
    try {
      await api.post("/routes/generate", { date });
      load(date);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to generate routes");
    } finally {
      setGenerating(false);
    }
  }

  async function handleStopUpdate(stopId: string, status: StopStatus) {
    try {
      await api.patch(`/route-stops/${stopId}`, { status });
      load(date);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update stop");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <Label>Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
        </div>
        <Button onClick={handleGenerate} disabled={generating}>
          {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {generating ? "Generating…" : "Generate Routes"}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {routes?.map((route) => (
        <Card key={route.id}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm">
                {route.truck_plate_number ?? `Truck ${route.truck_id.slice(0, 8)}…`}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {route.truck_vehicle_type && `${route.truck_vehicle_type.replace("_", " ")} · `}
                {route.stops.length} stops
                {route.total_distance_km && ` · ${route.total_distance_km} km`}
              </p>
            </div>
            <Badge variant="secondary">{route.status}</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <Suspense fallback={<div className="h-96 animate-pulse rounded-md bg-muted" />}>
              <RouteMap route={route} />
            </Suspense>

            <div className="space-y-2">
              {route.stops.map((stop) => {
                const visuals = getStopVisuals(stop.stop_type);
                // Hide 0kg rendering for origin stops to prevent clutter
                const showWeight = stop.allocated_weight_kg && stop.allocated_weight_kg > 0;

                return (
                  <div key={stop.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white ${visuals.color}`}>
                        {stop.stop_sequence}
                      </span>
                      <div>
                        <p className="text-sm font-medium">
                          {visuals.label}
                          {stop.location_name && ` — ${stop.location_name}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {showWeight ? `${stop.allocated_weight_kg} kg` : ""}
                          {showWeight && stop.eta ? ` · ` : ""}
                          {stop.eta && `ETA ${formatEtaWIB(stop.eta)}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{stop.status}</Badge>
                      {stop.status !== "completed" && (
                        <Select value={stop.status} onValueChange={(v) => handleStopUpdate(stop.id, v as StopStatus)}>
                          <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">pending</SelectItem>
                            <SelectItem value="in_progress">in progress</SelectItem>
                            <SelectItem value="completed">completed</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}

      {routes?.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            No routes for this date. Generate routes or use Transportation Plans.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function RoutesPage() {
  return (
    <RoleGuard role="logistics">
      <DashboardLayout navItems={logisticsNav} title="Routes">
        <RoutesContent />
      </DashboardLayout>
    </RoleGuard>
  );
}
