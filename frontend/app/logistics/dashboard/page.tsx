"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import RoleGuard from "@/components/RoleGuard";
import DashboardLayout, { logisticsNav } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { Truck, Package, MapPin, Fuel } from "lucide-react";
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

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Requests</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{pendingRequests?.length ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Fleet Size</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{trucks?.length ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Available</CardTitle>
            <Truck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{trucks?.filter((t) => t.status === "available").length ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Trips</CardTitle>
            <MapPin className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{activeTrips}</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick action */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Recent Plans</h2>
        <Link href="/logistics/plans" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/80">
          Generate New Plan
        </Link>
      </div>

      {/* Plans list */}
      <div className="space-y-3">
        {plans?.slice(0, 5).map((plan) => (
          <Card key={plan.id} className="transition-colors hover:bg-accent/50">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-sm font-medium">{plan.plan_date}</p>
                  <p className="text-xs text-muted-foreground">
                    {plan.total_requests} requests · {plan.total_trucks_used} trucks
                    {plan.total_distance_km && ` · ${plan.total_distance_km} km`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {plan.fuel_savings_percent && (
                  <span className="flex items-center gap-1 text-xs text-green-600">
                    <Fuel className="h-3 w-3" />
                    {plan.fuel_savings_percent}% saved
                  </span>
                )}
                <Badge variant={plan.status === "approved" ? "default" : "secondary"}>
                  {plan.status}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
        {plans?.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No plans yet. Generate your first transportation plan.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function LogisticsDashboardPage() {
  return (
    <RoleGuard role="logistics">
      <DashboardLayout navItems={logisticsNav} title="Dashboard">
        <DashboardContent />
      </DashboardLayout>
    </RoleGuard>
  );
}
