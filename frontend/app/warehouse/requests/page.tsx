"use client";

import { useEffect, useState } from "react";
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

function RequestsList() {
  const [requests, setRequests] = useState<PickupRequestOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<PickupRequestOut[]>("/pickup-requests")
      .then(setRequests)
      .catch(() => setError("Failed to load requests"));
  }, []);

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8">
      <h1 className="mb-6 text-lg font-semibold">Your requests</h1>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="overflow-hidden rounded-lg border border-black/10">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-black/50">
            <tr>
              <th className="px-4 py-2 font-medium">Destination</th>
              <th className="px-4 py-2 font-medium">Pickup date</th>
              <th className="px-4 py-2 font-medium">Items</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {requests?.map((r) => (
              <tr key={r.id} className="border-t border-black/5">
                <td className="px-4 py-2">{r.destination_name}</td>
                <td className="px-4 py-2">{r.pickup_date}</td>
                <td className="px-4 py-2">
                  {r.items.map((it) => `${it.quantity} ${it.unit_type} ${it.commodity_name}`).join(", ")}
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

export default function RequestsPage() {
  return (
    <RoleGuard role="warehouse">
      <Nav links={LINKS} />
      <RequestsList />
    </RoleGuard>
  );
}
