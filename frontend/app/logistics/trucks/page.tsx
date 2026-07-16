"use client";

import { useEffect, useState } from "react";
import RoleGuard from "@/components/RoleGuard";
import Nav from "@/components/Nav";
import StatusBadge from "@/components/StatusBadge";
import { api, ApiError } from "@/lib/api";
import type { TruckOut } from "@/types/api";

const LINKS = [
  { href: "/logistics/dashboard", label: "Dashboard" },
  { href: "/logistics/routes", label: "Routes" },
  { href: "/logistics/trucks", label: "Trucks" },
];

function TrucksContent() {
  const [trucks, setTrucks] = useState<TruckOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [plate, setPlate] = useState("");
  const [capacity, setCapacity] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function load() {
    api
      .get<TruckOut[]>("/trucks")
      .then(setTrucks)
      .catch(() => setError("Failed to load trucks"));
  }

  useEffect(load, []);

  async function handleAddTruck(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/trucks", {
        plate_number: plate,
        capacity_weight_kg: Number(capacity),
      });
      setPlate("");
      setCapacity("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add truck");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <h1 className="mb-6 text-lg font-semibold">Fleet</h1>

      <form onSubmit={handleAddTruck} className="mb-8 flex flex-wrap items-end gap-3 rounded-lg border border-black/10 p-4">
        <label className="flex flex-col gap-1 text-sm">
          Plate number
          <input
            required
            value={plate}
            onChange={(e) => setPlate(e.target.value)}
            className="rounded-md border border-black/15 px-3 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Capacity (kg)
          <input
            required
            type="number"
            min={0}
            step="any"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            className="rounded-md border border-black/15 px-3 py-1.5"
          />
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Add truck
        </button>
      </form>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="overflow-hidden rounded-lg border border-black/10">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-black/50">
            <tr>
              <th className="px-4 py-2 font-medium">Plate</th>
              <th className="px-4 py-2 font-medium">Capacity (kg)</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {trucks?.map((t) => (
              <tr key={t.id} className="border-t border-black/5">
                <td className="px-4 py-2">{t.plate_number}</td>
                <td className="px-4 py-2">{t.capacity_weight_kg}</td>
                <td className="px-4 py-2">
                  <StatusBadge status={t.status} />
                </td>
              </tr>
            ))}
            {trucks?.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-black/40">
                  No trucks yet — add one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function TrucksPage() {
  return (
    <RoleGuard role="logistics">
      <Nav links={LINKS} />
      <TrucksContent />
    </RoleGuard>
  );
}
