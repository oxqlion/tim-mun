"use client";

import { useEffect, useState } from "react";
import RoleGuard from "@/components/RoleGuard";
import DashboardLayout, { logisticsNav } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, ApiError } from "@/lib/api";
import { Plus, Loader2 } from "lucide-react";
import type { TruckOut, VehicleType } from "@/types/api";

function TrucksContent() {
  const [trucks, setTrucks] = useState<TruckOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vehicleType, setVehicleType] = useState<VehicleType>("truck_medium");
  const [plate, setPlate] = useState("");
  const [capacity, setCapacity] = useState("");
  const [lengthCm, setLengthCm] = useState("");
  const [widthCm, setWidthCm] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function load() {
    api.get<TruckOut[]>("/trucks").then(setTrucks).catch(() => setError("Failed to load trucks"));
  }

  useEffect(load, []);

  async function handleAddTruck(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/trucks", {
        vehicle_type: vehicleType,
        plate_number: plate,
        capacity_weight_kg: Number(capacity),
        length_cm: lengthCm ? Number(lengthCm) : undefined,
        width_cm: widthCm ? Number(widthCm) : undefined,
        height_cm: heightCm ? Number(heightCm) : undefined,
      });
      setPlate("");
      setCapacity("");
      setLengthCm("");
      setWidthCm("");
      setHeightCm("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add truck");
    } finally {
      setSubmitting(false);
    }
  }

  const statusColor = (s: string) => {
    switch (s) {
      case "available": return "default";
      case "on_trip": return "secondary";
      case "maintenance": return "destructive";
      default: return "outline";
    }
  };

  return (
    <div className="space-y-6">
      {/* Add truck form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add Vehicle</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddTruck} className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="space-y-2">
              <Label>Vehicle type</Label>
              <Select value={vehicleType} onValueChange={(v) => setVehicleType(v as VehicleType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pickup">Pickup</SelectItem>
                  <SelectItem value="truck_small">Truck (S)</SelectItem>
                  <SelectItem value="truck_medium">Truck (M)</SelectItem>
                  <SelectItem value="truck_large">Truck (L)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Plate number *</Label>
              <Input required value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="B 1234 XYZ" />
            </div>
            <div className="space-y-2">
              <Label>Max payload (kg) *</Label>
              <Input required type="number" min={0} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
            </div>
            <div />
            <div className="space-y-2">
              <Label>Interior L (cm)</Label>
              <Input type="number" min={0} value={lengthCm} onChange={(e) => setLengthCm(e.target.value)} placeholder="400" />
            </div>
            <div className="space-y-2">
              <Label>Interior W (cm)</Label>
              <Input type="number" min={0} value={widthCm} onChange={(e) => setWidthCm(e.target.value)} placeholder="200" />
            </div>
            <div className="space-y-2">
              <Label>Interior H (cm)</Label>
              <Input type="number" min={0} value={heightCm} onChange={(e) => setHeightCm(e.target.value)} placeholder="200" />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Add Truck
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Trucks table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fleet ({trucks?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Plate</TableHead>
                  <TableHead>Payload (kg)</TableHead>
                  <TableHead>Dimensions (cm)</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trucks?.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="capitalize">{t.vehicle_type.replace("_", " ")}</TableCell>
                    <TableCell className="font-mono text-sm">{t.plate_number}</TableCell>
                    <TableCell>{t.capacity_weight_kg.toLocaleString()}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {t.length_cm && t.width_cm && t.height_cm
                        ? `${t.length_cm} × ${t.width_cm} × ${t.height_cm}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusColor(t.status) as "default" | "secondary" | "destructive" | "outline"}>
                        {t.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {trucks?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      No trucks yet — add one above.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function TrucksPage() {
  return (
    <RoleGuard role="logistics">
      <DashboardLayout navItems={logisticsNav} title="Fleet Management">
        <TrucksContent />
      </DashboardLayout>
    </RoleGuard>
  );
}
