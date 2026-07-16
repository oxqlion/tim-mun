"use client";

import { useCallback, useEffect, useState, lazy, Suspense } from "react";
import RoleGuard from "@/components/RoleGuard";
import DashboardLayout, { logisticsNav } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import { Fuel, MapPin, Package, Truck, CheckCircle, Loader2 } from "lucide-react";
import type { TransportationPlanOut, TruckOut } from "@/types/api";
import SpaceOptimizationSection from "@/components/space-optimization/SpaceOptimizationSection";

const RouteMap = lazy(() => import("@/components/RouteMap"));

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function PlansContent() {
  const [date, setDate] = useState(todayIso());
  const [plan, setPlan] = useState<TransportationPlanOut | null>(null);
  const [trucks, setTrucks] = useState<TruckOut[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState(false);

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
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <Label htmlFor="plan-date">Plan Date</Label>
          <Input
            id="plan-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-44"
          />
        </div>
        <Button onClick={handleGenerate} disabled={generating}>
          {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {generating ? "Generating…" : "Generate Plan"}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Empty state */}
      {!plan && (
        <Card>
          <CardContent className="py-16 text-center">
            <Package className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-muted-foreground">No plan for this date yet.</p>
            <p className="text-sm text-muted-foreground/70">Generate a plan to optimize pending pickup requests.</p>
          </CardContent>
        </Card>
      )}

      {plan && (
        <>
          {/* Plan Summary */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Plan Summary</CardTitle>
              <div className="flex items-center gap-3">
                <Badge variant={plan.status === "approved" ? "default" : "secondary"}>
                  {plan.status}
                </Badge>
                {plan.status === "optimized" && (
                  <Button size="sm" onClick={handleApprove} disabled={approving} className="bg-green-600 hover:bg-green-700">
                    {approving ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <CheckCircle className="mr-2 h-3 w-3" />}
                    Approve Plan
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <div className="rounded-lg bg-muted p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Package className="h-3 w-3" /> Requests
                  </div>
                  <p className="mt-1 text-xl font-bold">{plan.total_requests}</p>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Truck className="h-3 w-3" /> Trucks
                  </div>
                  <p className="mt-1 text-xl font-bold">{plan.total_trucks_used}</p>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" /> Distance
                  </div>
                  <p className="mt-1 text-xl font-bold">{plan.total_distance_km ? `${plan.total_distance_km} km` : "—"}</p>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Fuel className="h-3 w-3" /> Fuel Est.
                  </div>
                  <p className="mt-1 text-xl font-bold">{plan.estimated_fuel_liters ? `${plan.estimated_fuel_liters} L` : "—"}</p>
                </div>
                <div className="rounded-lg bg-green-50 p-3">
                  <div className="flex items-center gap-2 text-xs text-green-700">
                    <Fuel className="h-3 w-3" /> Savings
                  </div>
                  <p className="mt-1 text-xl font-bold text-green-700">
                    {plan.fuel_savings_percent ? `${plan.fuel_savings_percent}%` : "—"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Optimization Log */}
          {plan.optimization_log && plan.optimization_log.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Optimization Log</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="max-h-80 overflow-y-auto rounded-md bg-muted p-4 font-mono text-xs leading-relaxed">
                  {plan.optimization_log.join("\n")}
                </pre>
              </CardContent>
            </Card>
          )}

          {/* Routes */}
          {plan.routes.map((route) => (
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
                <div className="flex items-center gap-2">
                  {route.space_utilization_percent != null && (
                    <span className="text-xs text-muted-foreground">
                      Space {route.space_utilization_percent}% · Weight {route.weight_utilization_percent}%
                    </span>
                  )}
                  <Badge variant="secondary">{route.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Utilization bars */}
                {route.space_utilization_percent != null && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                        <span>Space</span>
                        <span>{route.space_utilization_percent}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-blue-500 transition-all"
                          style={{ width: `${Math.min(100, route.space_utilization_percent)}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                        <span>Weight</span>
                        <span>{route.weight_utilization_percent}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-amber-500 transition-all"
                          style={{ width: `${Math.min(100, route.weight_utilization_percent ?? 0)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Space Optimization */}
                <SpaceOptimizationSection
                  route={route}
                  truck={trucks.find((t) => t.id === route.truck_id)}
                />

                {/* Map */}
                <Suspense fallback={<div className="h-96 animate-pulse rounded-md bg-muted" />}>
                  <RouteMap route={route} />
                </Suspense>

                {/* Stops */}
                <div>
                  <p className="mb-2 text-sm font-medium">Route Sequence</p>
                  <div className="space-y-2">
                    {route.stops.map((stop) => (
                      <div
                        key={stop.id}
                        className="flex items-center justify-between rounded-md border px-3 py-2"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white ${
                              stop.stop_type === "pickup" ? "bg-blue-600" : "bg-red-500"
                            }`}
                          >
                            {stop.stop_sequence}
                          </span>
                          <div>
                            <p className="text-sm font-medium">
                              {stop.stop_type === "pickup" ? "📦 Pickup" : "📍 Dropoff"}
                              {stop.location_name && ` — ${stop.location_name}`}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {stop.allocated_weight_kg && `${stop.allocated_weight_kg} kg`}
                              {stop.eta && ` · ETA ${new Date(stop.eta).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">{stop.status}</Badge>
                      </div>
                    ))}
                  </div>
                </div>

              </CardContent>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}

export default function PlansPage() {
  return (
    <RoleGuard role="logistics">
      <DashboardLayout navItems={logisticsNav} title="Transportation Plans">
        <PlansContent />
      </DashboardLayout>
    </RoleGuard>
  );
}
