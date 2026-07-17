"use client";

import { useCallback, useEffect, useState } from "react";
import RoleGuard from "@/components/RoleGuard";
import DashboardLayout, { logisticsNav } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import {
  Fuel, MapPin, Truck, CheckCircle, Loader2,
  ChevronDown, ChevronUp, Calendar, Activity, Warehouse
} from "lucide-react";
import type { TransportationPlanOut, TruckOut } from "@/types/api";
import RouteCard from "@/components/RouteCard";

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
              <RouteCard
                key={route.id}
                route={route}
                truck={trucks.find((t) => t.id === route.truck_id)}
                index={i}
              />
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