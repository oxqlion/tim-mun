"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import RoleGuard from "@/components/RoleGuard";
import Nav from "@/components/Nav";
import { api, ApiError } from "@/lib/api";
import type { PickupRequestCreate, RequestItemIn, UnitType } from "@/types/api";

const LINKS = [
  { href: "/warehouse/dashboard", label: "Dashboard" },
  { href: "/warehouse/requests/new", label: "New request" },
  { href: "/warehouse/requests", label: "Requests" },
];

function emptyItem(): RequestItemIn {
  return { commodity_name: "", unit_type: "kg", quantity: 0 };
}

function NewRequestForm() {
  const router = useRouter();
  const [pickupDate, setPickupDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [destinationName, setDestinationName] = useState("");
  const [destinationLat, setDestinationLat] = useState("");
  const [destinationLng, setDestinationLng] = useState("");
  const [items, setItems] = useState<RequestItemIn[]>([emptyItem()]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function updateItem(index: number, patch: Partial<RequestItemIn>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const payload: PickupRequestCreate = {
        pickup_date: pickupDate,
        destination_name: destinationName,
        destination_lat: destinationLat ? Number(destinationLat) : undefined,
        destination_lng: destinationLng ? Number(destinationLng) : undefined,
        items,
      };
      await api.post("/pickup-requests", payload);
      router.push("/warehouse/requests");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create request");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-8">
      <h1 className="mb-6 text-lg font-semibold">New pickup request</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            Pickup date
            <input
              required
              type="date"
              value={pickupDate}
              onChange={(e) => setPickupDate(e.target.value)}
              className="rounded-md border border-black/15 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            Destination
            <input
              required
              value={destinationName}
              onChange={(e) => setDestinationName(e.target.value)}
              placeholder="e.g. Central Market, Jakarta"
              className="rounded-md border border-black/15 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Destination lat (optional)
            <input
              value={destinationLat}
              onChange={(e) => setDestinationLat(e.target.value)}
              className="rounded-md border border-black/15 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Destination lng (optional)
            <input
              value={destinationLng}
              onChange={(e) => setDestinationLng(e.target.value)}
              className="rounded-md border border-black/15 px-3 py-2"
            />
          </label>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium text-black/70">Items</h2>
            <button
              type="button"
              onClick={() => setItems((prev) => [...prev, emptyItem()])}
              className="text-sm text-blue-600"
            >
              + Add item
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 rounded-md border border-black/10 p-3">
                <input
                  required
                  placeholder="Commodity (e.g. rice)"
                  value={item.commodity_name}
                  onChange={(e) => updateItem(i, { commodity_name: e.target.value })}
                  className="col-span-4 rounded-md border border-black/15 px-2 py-1.5 text-sm"
                />
                <select
                  value={item.unit_type}
                  onChange={(e) => updateItem(i, { unit_type: e.target.value as UnitType })}
                  className="col-span-2 rounded-md border border-black/15 px-2 py-1.5 text-sm"
                >
                  <option value="kg">kg</option>
                  <option value="sack">sack</option>
                  <option value="pallet">pallet</option>
                </select>
                <input
                  required
                  type="number"
                  min={0}
                  step="any"
                  placeholder="Quantity"
                  value={item.quantity || ""}
                  onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })}
                  className="col-span-2 rounded-md border border-black/15 px-2 py-1.5 text-sm"
                />
                <input
                  type="number"
                  min={0}
                  step="any"
                  placeholder="Est. weight kg"
                  value={item.estimated_weight_kg ?? ""}
                  onChange={(e) =>
                    updateItem(i, {
                      estimated_weight_kg: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="col-span-3 rounded-md border border-black/15 px-2 py-1.5 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}
                  disabled={items.length === 1}
                  className="col-span-1 text-black/40 hover:text-red-600 disabled:opacity-30"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-fit rounded-md bg-black px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "Submitting…" : "Submit request"}
        </button>
      </form>
    </div>
  );
}

export default function NewRequestPage() {
  return (
    <RoleGuard role="warehouse">
      <Nav links={LINKS} />
      <NewRequestForm />
    </RoleGuard>
  );
}
