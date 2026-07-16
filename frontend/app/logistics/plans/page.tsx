"use client";

import { useCallback, useEffect, useState, lazy, Suspense } from "react";
import RoleGuard from "@/components/RoleGuard";
import DashboardLayout, { logisticsNav } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import { formatEtaWIB } from "@/lib/format";
import { 
  Fuel, MapPin, Package, Truck, CheckCircle, Loader2, 
  ChevronDown, ChevronUp, Calendar, Activity, Route as RouteIcon, Warehouse
} from "lucide-react";
import type { TransportationPlanOut, TruckOut } from "@/types/api";
import SpaceOptimizationSection from "@/components/space-optimization/SpaceOptimizationSection";

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

function PlansContent() {
  const [date, setDate] = useState(todayIso());
  const [plan, setPlan] = useState<TransportationPlanOut | null>(null);
  const [trucks, setTrucks] = useState<TruckOut[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [showLog, setShowLog] = useState(false);

  const loadPlans = useCallback(() => {
    api.get<TruckOut[]>("/trucks").then(setTrucks).catch(() => {});
    api
      .get<TransportationPlanOut[]>("/transportation-plans")
      .then((plans) => {
        const match = plans.find((p) => p.plan_date === date);
        if (match) {
          api.get<TransportationPlanOut>(`/transportation-plans/${match.id}`).then(setPlan);
        } else {
          setPlan(null);
        }
      })
      .catch(() => setError("Failed to load plans"));
  }, [date]);

  useEffect(() => loadPlans(), [loadPlans]);

  async function handleGenerate() {
    setError(null);
    setGenerating(true);
    try {
      const newPlan = await api.post<TransportationPlanOut>("/transportation-plans", { plan_date: date });
      setPlan(newPlan);
      setShowLog(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to generate plan");
    } finally {
      setGenerating(false);
    }
  }

  async function handleApprove() {
    if (!plan) return;
    setError(null);
    setApproving(true);
    try {
      const updated = await api.post<TransportationPlanOut>(`/transportation-plans/${plan.id}/approve`);
      setPlan(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to approve plan");
    } finally {
      setApproving(false);
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Top Control Bar */}
      <Card className="border-none bg-muted/40 shadow-sm">
        <CardContent className="flex flex-col sm:flex-row flex-wrap items-end justify-between gap-4 py-4">
          <div className="space-y-2 w-full sm:w-auto">
            <Label htmlFor="plan-date" className="text-muted-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Date of Dispatch
            </Label>
            <Input
              id="plan-date"
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
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Optimizing Dispatches...</>
            ) : (
              <><Activity className="mr-2 h-4 w-4" /> Generate Plan</>
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
      {!plan && !generating && (
        <Card className="border-dashed border-2 bg-transparent shadow-none">
          <CardContent className="py-24 flex flex-col items-center justify-center text-center">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Warehouse className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">No dispatch plan generated yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">
              Select a date and hit "Generate Dispatch Plan" to let our AI build the most efficient multi-warehouse routes for your fleet.
            </p>
            <Button variant="outline" onClick={() => setDate(todayIso())}>
              Jump to Today
            </Button>
          </CardContent>
        </Card>
      )}

      {plan && (
        <div className="space-y-6">
          {/* Plan Summary Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Daily Warehouse Dispatch Plan</h2>
              <p className="text-sm text-muted-foreground">
                {plan.routes.length} vehicle routes optimized for inter-warehouse transfers and deliveries.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={plan.status === "approved" ? "default" : "secondary"} className="text-sm px-3 py-1 shadow-sm">
                Status: <span className="capitalize ml-1">{plan.status}</span>
              </Badge>
              {plan.status === "optimized" && (
                <Button onClick={handleApprove} disabled={approving} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all hover:shadow-md">
                  {approving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                  Approve Plan
                </Button>
              )}
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card className="bg-card hover:bg-accent/10 transition-colors">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
                <Warehouse className="h-5 w-5 text-blue-500 mb-2" />
                <p className="text-2xl font-bold">{plan.total_requests}</p>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-1">Orders Handled</p>
              </CardContent>
            </Card>
            <Card className="bg-card hover:bg-accent/10 transition-colors">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
                <Truck className="h-5 w-5 text-indigo-500 mb-2" />
                <p className="text-2xl font-bold">{plan.total_trucks_used}</p>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-1">Fleet Deployed</p>
              </CardContent>
            </Card>
            <Card className="bg-card hover:bg-accent/10 transition-colors">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
                <MapPin className="h-5 w-5 text-rose-500 mb-2" />
                <p className="text-2xl font-bold">{plan.total_distance_km ? `${plan.total_distance_km}` : "—"}</p>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-1">Total KM</p>
              </CardContent>
            </Card>
            <Card className="bg-card hover:bg-accent/10 transition-colors">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
                <Fuel className="h-5 w-5 text-amber-500 mb-2" />
                <p className="text-2xl font-bold">{plan.estimated_fuel_liters ? `${plan.estimated_fuel_liters}` : "—"}</p>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-1">Liters Fuel</p>
              </CardContent>
            </Card>
            <Card className="bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900 shadow-sm">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full text-emerald-700 dark:text-emerald-400">
                <CheckCircle className="h-5 w-5 mb-2" />
                <p className="text-2xl font-bold">{plan.fuel_savings_percent ? `${plan.fuel_savings_percent}%` : "—"}</p>
                <p className="text-xs font-semibold uppercase tracking-wider mt-1">Distance Saved</p>
              </CardContent>
            </Card>
          </div>

          {/* Expandable Optimization Log */}
          {plan.optimization_log && plan.optimization_log.length > 0 && (
            <Card className="border shadow-sm overflow-hidden">
              <button 
                onClick={() => setShowLog(!showLog)}
                className="w-full flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2 font-medium text-sm">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  View AI Engine Optimization Log
                </div>
                {showLog ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              
              {showLog && (
                <div className="border-t p-0">
                  <pre className="max-h-64 overflow-y-auto bg-[#1e1e1e] text-[#d4d4d4] p-4 font-mono text-[11px] leading-relaxed">
                    {plan.optimization_log.join("\n")}
                  </pre>
                </div>
              )}
            </Card>
          )}

          {/* Routes Section */}
          <div className="space-y-6 pt-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Warehouse className="h-5 w-5" /> Warehouse Dispatch Itineraries
            </h3>
            
            {plan.routes.map((route, i) => (
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
                      truck={trucks.find((t) => t.id === route.truck_id)}
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
                            <div className="rounded-lg border bg-card p-3 shadow-sm hover:shadow-md transition-shadow group">
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
      )}
    </div>
  );
}

export default function PlansPage() {
  return (
    <RoleGuard role="logistics">
      <DashboardLayout navItems={logisticsNav} title="Warehouse Dispatch Planning">
        <PlansContent />
      </DashboardLayout>
    </RoleGuard>
  );
}