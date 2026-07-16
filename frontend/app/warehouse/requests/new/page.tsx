"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import RoleGuard from "@/components/RoleGuard";
import DashboardLayout, { warehouseNav } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, ApiError } from "@/lib/api";
import { Plus, Trash2, Loader2 } from "lucide-react";
import type { PickupRequestCreate, RequestItemIn, UnitType } from "@/types/api";

function emptyItem(): RequestItemIn {
  return { commodity_name: "", unit_type: "kg", quantity: 0, stackable: false, fragile: false };
}

function NewRequestForm() {
  const router = useRouter();
  const [pickupDate, setPickupDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [requiredArrivalDate, setRequiredArrivalDate] = useState("");
  const [destinationName, setDestinationName] = useState("");
  const [destinationLat, setDestinationLat] = useState("");
  const [destinationLng, setDestinationLng] = useState("");
  const [notes, setNotes] = useState("");
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
        required_arrival_date: requiredArrivalDate || undefined,
        destination_name: destinationName,
        destination_lat: destinationLat ? Number(destinationLat) : undefined,
        destination_lng: destinationLng ? Number(destinationLng) : undefined,
        notes: notes || undefined,
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
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Request details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Request Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Pickup date *</Label>
            <Input required type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Must arrive by</Label>
            <Input type="date" value={requiredArrivalDate} onChange={(e) => setRequiredArrivalDate(e.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Delivery destination *</Label>
            <Input required value={destinationName} onChange={(e) => setDestinationName(e.target.value)} placeholder="e.g. Central Market, Jakarta" />
          </div>
          <div className="space-y-2">
            <Label>Latitude</Label>
            <Input type="number" step="any" value={destinationLat} onChange={(e) => setDestinationLat(e.target.value)} placeholder="-6.2088" />
          </div>
          <div className="space-y-2">
            <Label>Longitude</Label>
            <Input type="number" step="any" value={destinationLng} onChange={(e) => setDestinationLng(e.target.value)} placeholder="106.8456" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any special instructions..." rows={2} />
          </div>
        </CardContent>
      </Card>

      {/* Commodity items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Commodity List</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={() => setItems((prev) => [...prev, emptyItem()])}>
            <Plus className="mr-1 h-3 w-3" /> Add Item
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.map((item, i) => (
            <div key={i} className="rounded-lg border p-4">
              <div className="mb-3 grid grid-cols-12 gap-3">
                <div className="col-span-4 space-y-1">
                  <Label className="text-xs">Commodity *</Label>
                  <Input required value={item.commodity_name} onChange={(e) => updateItem(i, { commodity_name: e.target.value })} placeholder="Rice" />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Unit</Label>
                  <Select value={item.unit_type} onValueChange={(v) => updateItem(i, { unit_type: v as UnitType })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kg">kg</SelectItem>
                      <SelectItem value="sack">sack</SelectItem>
                      <SelectItem value="pallet">pallet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Quantity *</Label>
                  <Input required type="number" min={0} step="any" value={item.quantity || ""} onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })} />
                </div>
                <div className="col-span-3 space-y-1">
                  <Label className="text-xs">Weight (kg)</Label>
                  <Input type="number" min={0} step="any" value={item.estimated_weight_kg ?? ""} onChange={(e) => updateItem(i, { estimated_weight_kg: e.target.value ? Number(e.target.value) : undefined })} />
                </div>
                <div className="col-span-1 flex items-end">
                  <Button type="button" variant="ghost" size="icon" onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))} disabled={items.length === 1}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </div>
              {/* Dimensions + flags */}
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-3 space-y-1">
                  <Label className="text-xs">L (cm)</Label>
                  <Input type="number" min={0} value={item.length_cm ?? ""} onChange={(e) => updateItem(i, { length_cm: e.target.value ? Number(e.target.value) : undefined })} />
                </div>
                <div className="col-span-3 space-y-1">
                  <Label className="text-xs">W (cm)</Label>
                  <Input type="number" min={0} value={item.width_cm ?? ""} onChange={(e) => updateItem(i, { width_cm: e.target.value ? Number(e.target.value) : undefined })} />
                </div>
                <div className="col-span-3 space-y-1">
                  <Label className="text-xs">H (cm)</Label>
                  <Input type="number" min={0} value={item.height_cm ?? ""} onChange={(e) => updateItem(i, { height_cm: e.target.value ? Number(e.target.value) : undefined })} />
                </div>
                <div className="col-span-3 flex items-end gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={item.stackable} onChange={(e) => updateItem(i, { stackable: e.target.checked })} className="rounded" />
                    Stackable
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={item.fragile} onChange={(e) => updateItem(i, { fragile: e.target.checked })} className="rounded" />
                    Fragile
                  </label>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {loading ? "Submitting…" : "Submit Request"}
      </Button>
    </form>
  );
}

export default function NewRequestPage() {
  return (
    <RoleGuard role="warehouse">
      <DashboardLayout navItems={warehouseNav} title="New Pickup Request">
        <NewRequestForm />
      </DashboardLayout>
    </RoleGuard>
  );
}
