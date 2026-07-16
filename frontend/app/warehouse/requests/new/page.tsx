"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import RoleGuard from "@/components/RoleGuard";
import DashboardLayout, { warehouseNav } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
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
import { 
  Plus, Trash2, Loader2, Send, MapPin, 
  Calendar, Package, Scale, Ruler, Info 
} from "lucide-react";
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
        required_arrival_date: requiredArrivalDate,
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
    <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in duration-500 pb-12">
      
      {error && (
        <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive border border-destructive/30 flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
          {error}
        </div>
      )}

      {/* Request Details Section */}
      <Card className="border-none bg-muted/40 shadow-sm">
        <CardHeader className="pb-4 border-b border-muted/50 mb-4">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" /> Dispatch Routing & Schedule
          </CardTitle>
          <CardDescription>
            Specify when and where this warehouse order needs to be delivered.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-6 sm:grid-cols-2 pt-2">
          
          <div className="space-y-4 sm:border-r sm:pr-6 border-muted/50">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Timeline
            </h4>
            <div className="space-y-2">
              <Label>Pickup Date <span className="text-destructive">*</span></Label>
              <Input required type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} className="bg-background shadow-sm" />
            </div>
            <div className="space-y-2">
              <Label>Required Arrival Date <span className="text-destructive">*</span></Label>
              <Input required type="date" value={requiredArrivalDate} onChange={(e) => setRequiredArrivalDate(e.target.value)} className="bg-background shadow-sm" />
            </div>
          </div>

          <div className="space-y-4 sm:pl-2">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <MapPin className="h-4 w-4" /> Destination
            </h4>
            <div className="space-y-2">
              <Label>Location Name <span className="text-destructive">*</span></Label>
              <Input required value={destinationName} onChange={(e) => setDestinationName(e.target.value)} placeholder="e.g. Central Market, Jakarta" className="bg-background shadow-sm" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Latitude</Label>
                <Input type="number" step="any" value={destinationLat} onChange={(e) => setDestinationLat(e.target.value)} placeholder="-6.2088" className="bg-background shadow-sm font-mono text-sm" />
              </div>
              <div className="space-y-2">
                <Label>Longitude</Label>
                <Input type="number" step="any" value={destinationLng} onChange={(e) => setDestinationLng(e.target.value)} placeholder="106.8456" className="bg-background shadow-sm font-mono text-sm" />
              </div>
            </div>
          </div>

          <div className="space-y-2 sm:col-span-2 pt-2">
            <Label className="flex items-center gap-2"><Info className="h-4 w-4 text-muted-foreground" /> Dispatch Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Enter any special instructions for the logistics fleet..." rows={2} className="bg-background shadow-sm resize-none" />
          </div>

        </CardContent>
      </Card>

      {/* Commodity Items Section */}
      <Card className="shadow-sm">
        <CardHeader className="border-b bg-muted/20 pb-4">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" /> Cargo & Commodities
          </CardTitle>
          <CardDescription>
            Detail the physical items included in this dispatch to optimize fleet space.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          
          {items.map((item, i) => (
            <div key={i} className="rounded-xl border bg-muted/20 p-5 relative group transition-colors hover:border-primary/30">
              
              {/* Delete Item Button */}
              <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))} disabled={items.length === 1}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="mb-4 grid grid-cols-1 sm:grid-cols-12 gap-4 pr-6 sm:pr-0">
                <div className="sm:col-span-4 space-y-1.5">
                  <Label className="text-xs font-semibold uppercase text-muted-foreground">Commodity <span className="text-destructive">*</span></Label>
                  <Input required value={item.commodity_name} onChange={(e) => updateItem(i, { commodity_name: e.target.value })} placeholder="e.g. Premium Rice" className="bg-background shadow-sm" />
                </div>
                
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs font-semibold uppercase text-muted-foreground">Unit</Label>
                  <Select value={item.unit_type} onValueChange={(v) => updateItem(i, { unit_type: v as UnitType })}>
                    <SelectTrigger className="bg-background shadow-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kg">kg</SelectItem>
                      <SelectItem value="sack">sack</SelectItem>
                      <SelectItem value="pallet">pallet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs font-semibold uppercase text-muted-foreground">Quantity <span className="text-destructive">*</span></Label>
                  <Input required type="number" min={0} step="any" value={item.quantity || ""} onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })} className="bg-background shadow-sm" />
                </div>
                
                <div className="sm:col-span-3 space-y-1.5">
                  <Label className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1"><Scale className="h-3 w-3" /> Weight (kg)</Label>
                  <Input type="number" min={0} step="any" value={item.estimated_weight_kg ?? ""} onChange={(e) => updateItem(i, { estimated_weight_kg: e.target.value ? Number(e.target.value) : undefined })} className="bg-background shadow-sm" placeholder="Optional" />
                </div>
              </div>

              {/* Dimensions + flags */}
              <div className="grid grid-cols-2 sm:grid-cols-12 gap-4">
                <div className="sm:col-span-3 space-y-1.5">
                  <Label className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1"><Ruler className="h-3 w-3" /> Length (cm)</Label>
                  <Input type="number" min={0} value={item.length_cm ?? ""} onChange={(e) => updateItem(i, { length_cm: e.target.value ? Number(e.target.value) : undefined })} className="bg-background shadow-sm" placeholder="L" />
                </div>
                <div className="sm:col-span-3 space-y-1.5">
                  <Label className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1"><Ruler className="h-3 w-3" /> Width (cm)</Label>
                  <Input type="number" min={0} value={item.width_cm ?? ""} onChange={(e) => updateItem(i, { width_cm: e.target.value ? Number(e.target.value) : undefined })} className="bg-background shadow-sm" placeholder="W" />
                </div>
                <div className="sm:col-span-3 space-y-1.5">
                  <Label className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1"><Ruler className="h-3 w-3" /> Height (cm)</Label>
                  <Input type="number" min={0} value={item.height_cm ?? ""} onChange={(e) => updateItem(i, { height_cm: e.target.value ? Number(e.target.value) : undefined })} className="bg-background shadow-sm" placeholder="H" />
                </div>
                
                <div className="col-span-2 sm:col-span-3 flex items-center gap-6 sm:pl-4 pt-5 sm:pt-6">
                  <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={item.stackable} 
                      onChange={(e) => updateItem(i, { stackable: e.target.checked })} 
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary shadow-sm cursor-pointer" 
                    />
                    Stackable
                  </label>
                  <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={item.fragile} 
                      onChange={(e) => updateItem(i, { fragile: e.target.checked })} 
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary shadow-sm cursor-pointer" 
                    />
                    Fragile
                  </label>
                </div>
              </div>

            </div>
          ))}

          <Button 
            type="button" 
            variant="outline" 
            onClick={() => setItems((prev) => [...prev, emptyItem()])}
            className="w-full border-dashed border-2 py-6 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <Plus className="mr-2 h-4 w-4" /> Add Another Commodity Item
          </Button>

        </CardContent>
      </Card>

      {/* Action Footer */}
      <div className="flex items-center justify-end gap-4 pt-4 border-t">
        <Button 
          type="button" 
          variant="ghost" 
          onClick={() => router.push("/warehouse/requests")}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={loading} className="shadow-sm transition-all active:scale-95 px-6">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          {loading ? "Submitting Order…" : "Submit Dispatch Order"}
        </Button>
      </div>

    </form>
  );
}

export default function NewRequestPage() {
  return (
    <RoleGuard role="warehouse">
      <DashboardLayout navItems={warehouseNav} title="Create Dispatch Order">
        <NewRequestForm />
      </DashboardLayout>
    </RoleGuard>
  );
}
