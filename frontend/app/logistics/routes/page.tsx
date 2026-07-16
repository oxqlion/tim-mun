"use client";

import { useCallback, useEffect, useState } from "react";
import RoleGuard from "@/components/RoleGuard";
import Nav from "@/components/Nav";
import StatusBadge from "@/components/StatusBadge";
import { api, ApiError } from "@/lib/api";
import type { RouteOut, StopStatus } from "@/types/api";

const LINKS = [
  { href: "/logistics/dashboard", label: "Dashboard" },
  { href: "/logistics/routes", label: "Routes" },
  { href: "/logistics/trucks", label: "Trucks" },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function RoutesContent() {
  const [date, setDate] = useState(todayIso());
  const [routes, setRoutes] = useState<RouteOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const load = useCallback((d: string) => {
    api
      .get<RouteOut[]>(`/routes?date=${d}`)
      .then(setRoutes)
      .catch(() => setError("Failed to load routes"));
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
    <div className="mx-auto w-full max-w-4xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-lg font-semibold">Routes</h1>
        <div className="flex items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Date
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-md border border-black/15 px-3 py-1.5"
            />
          </label>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {generating ? "Generating…" : "Generate routes"}
          </button>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="flex flex-col gap-4">
        {routes?.map((route) => (
          <div key={route.id} className="rounded-lg border border-black/10 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium">Truck {route.truck_id}</p>
              <StatusBadge status={route.status} />
            </div>
            <ol className="flex flex-col gap-2">
              {route.stops.map((stop) => (
                <li
                  key={stop.id}
                  className="flex items-center justify-between rounded-md bg-zinc-50 px-3 py-2 text-sm"
                >
                  <span>
                    #{stop.stop_sequence} · {stop.stop_type} · request {stop.pickup_request_id}
                    {stop.allocated_weight_kg != null && ` · ${stop.allocated_weight_kg}kg`}
                  </span>
                  <span className="flex items-center gap-2">
                    <StatusBadge status={stop.status} />
                    {stop.status !== "completed" && (
                      <select
                        value={stop.status}
                        onChange={(e) => handleStopUpdate(stop.id, e.target.value as StopStatus)}
                        className="rounded-md border border-black/15 px-2 py-1 text-xs"
                      >
                        <option value="pending">pending</option>
                        <option value="in_progress">in_progress</option>
                        <option value="completed">completed</option>
                      </select>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ))}
        {routes?.length === 0 && (
          <p className="rounded-lg border border-dashed border-black/15 px-4 py-10 text-center text-black/40">
            No routes for this date yet. Generate routes to match pending pickup requests to trucks.
          </p>
        )}
      </div>
    </div>
  );
}

export default function RoutesPage() {
  return (
    <RoleGuard role="logistics">
      <Nav links={LINKS} />
      <RoutesContent />
    </RoleGuard>
  );
}
