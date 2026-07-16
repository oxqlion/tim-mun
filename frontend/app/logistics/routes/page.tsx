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
import { 
  Calendar, Loader2, CheckCircle, Package, Route as RouteIcon, Warehouse, Activity
} from "lucide-react";
import type { RouteOut, StopStatus } from "@/types/api";

const RouteMap = lazy(() => import("@/components/RouteMap"));

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

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
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Top Control Bar */}
      <Card className="border-none bg-muted/40 shadow-sm">
        <CardContent className="flex flex-col sm:flex-row flex-wrap items-end justify-between gap-4 py-4">
          <div className="space-y-2 w-full sm:w-auto">
            <Label htmlFor="route-date" className="text-muted-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Active Date
            </Label>
            <Input
              id="route-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full sm:w-56 bg-background shadow-sm h-10"
            />
          </div>
          <Button 
            onClick={handleGenerate} 
            disabled={generating} 
            className="w-full sm:w-auto h-10 transition-all active:scale-95 shadow-sm"
          >
            {generating ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating routes...</>
            ) : (
              <><Activity className="mr-2 h-4 w-4" /> Generate Routes</>
            )}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive border border-destructive/30 flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
          {error}
        </div>
      )}

      {/* Empty state */}
      {routes?.length === 0 && !generating && (
        <Card className="border-dashed border-2 bg-transparent shadow-none">
          <CardContent className="py-24 flex flex-col items-center justify-center text-center">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <RouteIcon className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">No active routes for this date</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">
              Generate routes from pending orders, or use the Transportation Plans module for advanced fleet optimization.
            </p>
            <Button variant="outline" onClick={() => setDate(todayIso())}>
              Jump to Today
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Routes List */}
      <div className="space-y-6">
        {routes?.map((route, i) => (
          <Card key={route.id} className="overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            
            {/* Route Header */}
            <div className="bg-muted/30 border-b p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
                  {i + 1}
                </div>
                <div>
                  <h4 className="text-lg font-bold">
                    {route.truck_plate_number ?? `Truck ${route.truck_id.slice(0, 8)}…`}
                  </h4>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                    {route.truck_vehicle_type && (
                      <>
                        <span className="capitalize">{route.truck_vehicle_type.replace("_", " ")}</span>
                        <span>•</span>
                      </>
                    )}
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
              <Badge variant="outline" className="bg-background text-sm px-3 py-1 uppercase tracking-wider font-semibold shadow-sm">
                {route.status}
              </Badge>
            </div>

            <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Left Column: Map */}
              <div className="space-y-6">
                <div className="rounded-xl overflow-hidden border shadow-inner h-full min-h-[300px]">
                  <Suspense fallback={<div className="h-full w-full min-h-[300px] flex items-center justify-center bg-muted text-muted-foreground animate-pulse">Loading map...</div>}>
                    <div className="h-64 sm:h-80 lg:h-full">
                      <RouteMap route={route} />
                    </div>
                  </Suspense>
                </div>
              </div>

              {/* Right Column: Route Sequence Timeline */}
              <div>
                <h4 className="text-base font-semibold mb-6 flex items-center gap-2">
                  <Warehouse className="h-4 w-4 text-muted-foreground" /> 
                  Facility Routing Sequence
                </h4>
                
                <div className="relative ml-3 border-l-2 border-muted/60 pb-4">
                  {route.stops.map((stop, index) => {
                    const visuals = getStopVisuals(stop.stop_type);
                    const showWeight = stop.allocated_weight_kg && stop.allocated_weight_kg > 0;
                    const isLast = index === route.stops.length - 1;

                    return (
                      <div key={stop.id} className={`relative pl-6 ${isLast ? "" : "mb-6"}`}>
                        {/* Timeline Node */}
                        <div 
                          className={`absolute -left-[15px] top-1.5 flex h-7 w-7 items-center justify-center rounded-full border-4 border-background text-[10px] font-bold text-white shadow-sm ${visuals.color}`}
                          title={`Sequence ${stop.stop_sequence}`}
                        >
                          {stop.stop_sequence}
                        </div>
                        
                        {/* Stop Card */}
                        <div className="rounded-lg border bg-card p-4 shadow-sm hover:shadow-md transition-shadow group">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                            
                            {/* Left Side: Location Info */}
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="text-base font-bold text-foreground">
                                  {stop.location_name || visuals.fallbackName}
                                </span>
                                {stop.status === "completed" && <CheckCircle className="h-4 w-4 text-emerald-500" />}
                              </div>
                              
                              <div className="flex items-center gap-2 mb-3">
                                <Badge variant="outline" className={`text-[10px] font-semibold uppercase tracking-wider py-0.5 ${visuals.badgeColor}`}>
                                  {visuals.icon} {visuals.label}
                                </Badge>
                              </div>
                              
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
                                {showWeight && (
                                  <span className="flex items-center gap-1 bg-muted px-2 py-1 rounded-md text-foreground font-medium">
                                    <Package className="h-3.5 w-3.5" /> {stop.allocated_weight_kg} kg
                                  </span>
                                )}
                                {stop.eta && (
                                  <span className="flex items-center gap-1">
                                    ETA: <span className="font-medium text-foreground">{formatEtaWIB(stop.eta)}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {/* Right Side: Live Status Controls */}
                            <div className="flex flex-col items-start sm:items-end gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                              {stop.status === "completed" ? (
                                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 shadow-none pointer-events-none">
                                  <CheckCircle className="h-3 w-3 mr-1" /> Completed
                                </Badge>
                              ) : (
                                <div className="w-full sm:w-[130px]">
                                  <Label className="sr-only">Update Status</Label>
                                  <Select 
                                    value={stop.status} 
                                    onValueChange={(v) => handleStopUpdate(stop.id, v as StopStatus)}
                                  >
                                    <SelectTrigger className="h-8 text-xs bg-muted/50 focus:ring-1">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="pending">Pending</SelectItem>
                                      <SelectItem value="in_progress">In Progress</SelectItem>
                                      <SelectItem value="completed">Completed</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </div>

                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function RoutesPage() {
  return (
    <RoleGuard role="logistics">
      <DashboardLayout navItems={logisticsNav} title="Live Route Tracking">
        <RoutesContent />
      </DashboardLayout>
    </RoleGuard>
  );
}