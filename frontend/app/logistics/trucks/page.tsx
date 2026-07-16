"use client";

import { useEffect, useState } from "react";
import RoleGuard from "@/components/RoleGuard";
import DashboardLayout, { logisticsNav } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
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
import { 
  Plus, Loader2, Truck, Hash, Scale, Ruler, Activity, CheckCircle, Wrench, Package 
} from "lucide-react";
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

  // Enhanced semantic status badges
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "available":
        return (
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 capitalize">
            <CheckCircle className="h-3 w-3 mr-1" /> Available
          </Badge>
        );
      case "on_trip":
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 capitalize">
            <Activity className="h-3 w-3 mr-1" /> Active Dispatch
          </Badge>
        );
      case "maintenance":
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 capitalize">
            <Wrench className="h-3 w-3 mr-1" /> Maintenance
          </Badge>
        );
      default:
        return <Badge variant="secondary" className="uppercase tracking-wider text-[10px]">{status}</Badge>;
    }
  };

  const formatVehicleType = (type: string) => {
    return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Registration Form */}
      <Card className="border-none bg-muted/40 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" /> Register New Vehicle
          </CardTitle>
          <CardDescription>
            Add a new transport vehicle to your active logistics fleet.
          </CardDescription>
        </CardHeader>
        
        <form onSubmit={handleAddTruck}>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Left Column: Identification */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 border-b pb-2">Vehicle Identification</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Vehicle Category</Label>
                  <Select value={vehicleType} onValueChange={(v) => setVehicleType(v as VehicleType)}>
                    <SelectTrigger className="bg-background shadow-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pickup">Pickup Truck</SelectItem>
                      <SelectItem value="truck_small">Small Box Truck</SelectItem>
                      <SelectItem value="truck_medium">Medium Truck</SelectItem>
                      <SelectItem value="truck_large">Heavy Duty Truck</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>License Plate <span className="text-destructive">*</span></Label>
                  <Input required value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="e.g. B 1234 XYZ" className="bg-background shadow-sm uppercase font-mono" />
                </div>
              </div>
            </div>

            {/* Right Column: Dimensions */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 border-b pb-2">Cargo Capacity & Dimensions</h4>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="space-y-2 sm:col-span-4">
                  <Label>Max Payload (kg) <span className="text-destructive">*</span></Label>
                  <Input required type="number" min={0} value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="e.g. 5000" className="bg-background shadow-sm" />
                </div>
                <div className="space-y-2 sm:col-span-1">
                  <Label>Length (cm)</Label>
                  <Input type="number" min={0} value={lengthCm} onChange={(e) => setLengthCm(e.target.value)} placeholder="L" className="bg-background shadow-sm" />
                </div>
                <div className="space-y-2 sm:col-span-1">
                  <Label>Width (cm)</Label>
                  <Input type="number" min={0} value={widthCm} onChange={(e) => setWidthCm(e.target.value)} placeholder="W" className="bg-background shadow-sm" />
                </div>
                <div className="space-y-2 sm:col-span-1">
                  <Label>Height (cm)</Label>
                  <Input type="number" min={0} value={heightCm} onChange={(e) => setHeightCm(e.target.value)} placeholder="H" className="bg-background shadow-sm" />
                </div>
              </div>
            </div>

          </CardContent>
          <CardFooter className="bg-muted/50 border-t px-6 py-4 flex justify-end">
            <Button type="submit" disabled={submitting} className="shadow-sm transition-all active:scale-95">
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Register Vehicle to Fleet
            </Button>
          </CardFooter>
        </form>
      </Card>

      {error && (
        <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive border border-destructive/30 flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
          {error}
        </div>
      )}

      {/* Trucks table */}
      <Card className="shadow-sm">
        <CardHeader className="border-b bg-muted/20 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold">Active Fleet Registry</CardTitle>
            <Badge variant="secondary" className="font-mono text-sm">
              Total: {trucks?.length ?? 0}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="font-semibold"><div className="flex items-center gap-2"><Truck className="h-4 w-4 text-muted-foreground" /> Vehicle Type</div></TableHead>
                  <TableHead className="font-semibold"><div className="flex items-center gap-2"><Hash className="h-4 w-4 text-muted-foreground" /> Plate Number</div></TableHead>
                  <TableHead className="font-semibold"><div className="flex items-center gap-2"><Scale className="h-4 w-4 text-muted-foreground" /> Max Payload</div></TableHead>
                  <TableHead className="font-semibold"><div className="flex items-center gap-2"><Ruler className="h-4 w-4 text-muted-foreground" /> Cargo Dimensions</div></TableHead>
                  <TableHead className="font-semibold">Operational Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trucks?.map((t) => (
                  <TableRow key={t.id} className="hover:bg-accent/10 transition-colors">
                    <TableCell className="font-medium text-foreground">
                      {formatVehicleType(t.vehicle_type)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono bg-background text-sm tracking-widest shadow-sm">
                        {t.plate_number}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {t.capacity_weight_kg.toLocaleString()} kg
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {t.length_cm && t.width_cm && t.height_cm ? (
                        <span className="flex items-center gap-1.5 bg-muted/50 w-fit px-2 py-1 rounded-md">
                          <Package className="h-3 w-3" />
                          {t.length_cm} × {t.width_cm} × {t.height_cm} cm
                        </span>
                      ) : (
                        <span className="italic text-muted-foreground/60">Not specified</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {renderStatusBadge(t.status)}
                    </TableCell>
                  </TableRow>
                ))}
                
                {trucks?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-24">
                      <div className="flex flex-col items-center justify-center text-center">
                        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                          <Truck className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground mb-1">No vehicles registered</h3>
                        <p className="text-sm text-muted-foreground max-w-sm mb-6">
                          Your fleet is currently empty. Use the registration form above to add your first transport vehicle.
                        </p>
                      </div>
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
      <DashboardLayout navItems={logisticsNav} title="Fleet & Assets Management">
        <TrucksContent />
      </DashboardLayout>
    </RoleGuard>
  );
}