"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import RoleGuard from "@/components/RoleGuard";
import DashboardLayout, { logisticsNav } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { 
  Truck, Package, MapPin, Fuel, Warehouse, Activity, Calendar, Route as RouteIcon, CheckCircle, ChevronRight 
} from "lucide-react";
import type { TruckOut, TransportationPlanSummary, PickupRequestOut } from "@/types/api";

function DashboardContent() {
  const [trucks, setTrucks] = useState<TruckOut[] | null>(null);
  const [plans, setPlans] = useState<TransportationPlanSummary[] | null>(null);
  const [pendingRequests, setPendingRequests] = useState<PickupRequestOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<TruckOut[]>("/trucks"),
      api.get<TransportationPlanSummary[]>("/transportation-plans"),
      api.get<PickupRequestOut[]>("/pickup-requests/all?status_filter=pending"),
    ])
      .then(([t, p, r]) => {
        setTrucks(t);
        setPlans(p);
        setPendingRequests(r);
      })
      .catch(() => setError("Failed to load dashboard data"));
  }, []);

  const activeTrips = trucks?.filter((t) => t.status === "on_trip").length ?? 0;
  const availableTrucks = trucks?.filter((t) => t.status === "available").length ?? 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {error && (
        <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive border border-destructive/30 flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
          {error}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card hover:bg-accent/10 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pending Orders</CardTitle>
            <Warehouse className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{pendingRequests?.length ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">Awaiting dispatch</p>
          </CardContent>
        </Card>
        
        <Card className="bg-card hover:bg-accent/10 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fleet Capacity</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{trucks?.length ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">Total registered vehicles</p>
          </CardContent>
        </Card>
        
        <Card className="bg-emerald-50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900 shadow-sm transition-colors hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Available</CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">{availableTrucks}</p>
            <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-1">Ready for assignment</p>
          </CardContent>
        </Card>
        
        <Card className="bg-blue-50 border-blue-100 dark:bg-blue-950/20 dark:border-blue-900 shadow-sm transition-colors hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400">Active Dispatches</CardTitle>
            <Activity className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-700 dark:text-blue-400">{activeTrips}</p>
            <p className="text-xs text-blue-600/80 dark:text-blue-400/80 mt-1">Currently on route</p>
          </CardContent>
        </Card>
      </div>

      {/* Plans Section */}
      <div className="space-y-4">
        
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Recent Dispatch Plans</h2>
            <p className="text-sm text-muted-foreground">Your latest AI-optimized warehouse routing schedules.</p>
          </div>
          <Link href="/plans">
            <Button className="shadow-sm transition-all hover:shadow-md">
              <Activity className="mr-2 h-4 w-4" /> Generate New Plan
            </Button>
          </Link>
        </div>

        {/* Plans List */}
        <div className="space-y-3">
          {plans?.slice(0, 5).map((plan) => (
            <Card key={plan.id} className="overflow-hidden shadow-sm hover:shadow-md transition-shadow group">
              <CardContent className="p-0">
                <Link href={`/plans?date=${plan.plan_date}`} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 gap-4">
                  
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-base font-bold text-foreground">
                        {new Date(plan.plan_date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground mt-0.5">
                        <span className="font-medium text-foreground">{plan.total_requests}</span> orders
                        <span>•</span>
                        <span className="font-medium text-foreground">{plan.total_trucks_used}</span> vehicles
                        {plan.total_distance_km && (
                          <>
                            <span>•</span>
                            <span>{plan.total_distance_km} km</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                    {plan.fuel_savings_percent && plan.fuel_savings_percent > 0 && (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400">
                        <Fuel className="h-3 w-3 mr-1" />
                        {plan.fuel_savings_percent}% Saved
                      </Badge>
                    )}
                    <Badge variant={plan.status === "approved" ? "default" : "secondary"} className="uppercase tracking-wider text-[10px]">
                      {plan.status}
                    </Badge>
                    <ChevronRight className="h-5 w-5 text-muted-foreground opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </div>
                  
                </Link>
              </CardContent>
            </Card>
          ))}
          
          {plans?.length === 0 && (
            <Card className="border-dashed border-2 bg-transparent shadow-none">
              <CardContent className="py-16 flex flex-col items-center justify-center text-center">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <RouteIcon className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-1">No plans generated yet</h3>
                <p className="text-sm text-muted-foreground max-w-sm mb-6">
                  Ready to optimize your fleet? Generate your first multi-warehouse transportation plan.
                </p>
                <Link href="/plans">
                  <Button variant="outline">
                    Go to Planning
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LogisticsDashboardPage() {
  return (
    <RoleGuard role="logistics">
      <DashboardLayout navItems={logisticsNav} title="Warehouse Operations Hub">
        <DashboardContent />
      </DashboardLayout>
    </RoleGuard>
  );
}