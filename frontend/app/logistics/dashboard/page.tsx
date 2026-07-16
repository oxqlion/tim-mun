"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import RoleGuard from "@/components/RoleGuard";
import Nav from "@/components/Nav";
import StatusBadge from "@/components/StatusBadge";
import { api } from "@/lib/api";
import type { RouteOut, TruckOut } from "@/types/api";

const LINKS = [
  { href: "/logistics/dashboard", label: "Dashboard" },
  { href: "/logistics/routes", label: "Routes" },
  { href: "/logistics/trucks", label: "Trucks" },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function DashboardContent() {
  const [trucks, setTrucks] = useState<TruckOut[] | null>(null);
  const [routes, setRoutes] = useState<RouteOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.get<TruckOut[]>("/trucks"), api.get<RouteOut[]>(`/routes?date=${todayIso()}`)])
      .then(([t, r]) => {
        setTrucks(t);
        setRoutes(r);
      })
      .catch(() => setError("Failed to load dashboard data"));
  }, []);

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Dashboard</h1>
        <Link href="/logistics/routes" className="rounded-md bg-black px-4 py-2 text-sm text-white">
          Manage routes
        </Link>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-black/10 p-4">
          <p className="text-xs text-black/50">Fleet size</p>
          <p className="text-2xl font-semibold">{trucks?.length ?? 0}</p>
        </div>
        <div className="rounded-lg border border-black/10 p-4">
          <p className="text-xs text-black/50">Available trucks</p>
          <p className="text-2xl font-semibold">
            {trucks?.filter((t) => t.status === "available").length ?? 0}
          </p>
        </div>
        <div className="rounded-lg border border-black/10 p-4">
          <p className="text-xs text-black/50">Routes today</p>
          <p className="text-2xl font-semibold">{routes?.length ?? 0}</p>
        </div>
      </div>

      <h2 className="mb-3 text-sm font-medium text-black/70">Today&apos;s routes</h2>
      <div className="flex flex-col gap-3">
        {routes?.map((route) => (
          <div key={route.id} className="flex items-center justify-between rounded-lg border border-black/10 p-4">
            <span className="text-sm">
              Truck {route.truck_id} · {route.stops.length} stop{route.stops.length === 1 ? "" : "s"}
            </span>
            <StatusBadge status={route.status} />
          </div>
        ))}
        {routes?.length === 0 && (
          <p className="rounded-lg border border-dashed border-black/15 px-4 py-8 text-center text-black/40">
            No routes generated for today yet.
          </p>
        )}
      </div>
    </div>
  );
}

export default function LogisticsDashboardPage() {
  return (
    <RoleGuard role="logistics">
      <Nav links={LINKS} />
      <DashboardContent />
    </RoleGuard>
  );
}
