"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import RoleGuard from "@/components/RoleGuard";
import Nav from "@/components/Nav";
import StatusBadge from "@/components/StatusBadge";
import { api } from "@/lib/api";
import type { PickupRequestOut } from "@/types/api";

const LINKS = [
  { href: "/warehouse/dashboard", label: "Dashboard" },
  { href: "/warehouse/requests/new", label: "New request" },
  { href: "/warehouse/requests", label: "Requests" },
];

function DashboardContent() {
  const [requests, setRequests] = useState<PickupRequestOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<PickupRequestOut[]>("/pickup-requests")
      .then(setRequests)
      .catch(() => setError("Failed to load requests"));
  }, []);

  const counts = requests?.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Dashboard</h1>
        <Link href="/warehouse/requests/new" className="rounded-md bg-black px-4 py-2 text-sm text-white">
          + New pickup request
        </Link>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-5">
        {["pending", "matched", "in_progress", "completed", "cancelled"].map((status) => (
          <div key={status} className="rounded-lg border border-black/10 p-4">
            <p className="text-xs text-black/50">{status.replace("_", " ")}</p>
            <p className="text-2xl font-semibold">{counts?.[status] ?? 0}</p>
          </div>
        ))}
      </div>

      <h2 className="mb-3 text-sm font-medium text-black/70">Recent requests</h2>
      <div className="overflow-hidden rounded-lg border border-black/10">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-black/50">
            <tr>
              <th className="px-4 py-2 font-medium">Destination</th>
              <th className="px-4 py-2 font-medium">Pickup date</th>
              <th className="px-4 py-2 font-medium">ETA</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {requests?.slice(0, 5).map((r) => (
              <tr key={r.id} className="border-t border-black/5">
                <td className="px-4 py-2">{r.destination_name}</td>
                <td className="px-4 py-2">{r.pickup_date}</td>
                <td className="px-4 py-2 text-black/60">
                  {r.estimated_arrival
                    ? new Date(r.estimated_arrival).toLocaleString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                        day: "numeric",
                        month: "short",
                      })
                    : "—"}
                </td>
                <td className="px-4 py-2">
                  <StatusBadge status={r.status} />
                </td>
              </tr>
            ))}
            {requests?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-black/40">
                  No requests yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function WarehouseDashboardPage() {
  return (
    <RoleGuard role="warehouse">
      <Nav links={LINKS} />
      <DashboardContent />
    </RoleGuard>
  );
}
