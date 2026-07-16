"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck } from "lucide-react";
import type { RouteOut } from "@/types/api";

interface TruckInfoProps {
  route: RouteOut;
  truckCapacityKg: number;
  truckDimensions: { length: number; width: number; height: number } | null;
}

export default function TruckInfoCard({ route, truckCapacityKg, truckDimensions }: TruckInfoProps) {
  const totalWeight = route.space_allocations.reduce((sum, a) => sum + a.weight_kg, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm">Truck Information</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Plate Number</p>
            <p className="font-medium">{route.truck_plate_number ?? route.truck_id.slice(0, 8)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Vehicle Type</p>
            <p className="font-medium capitalize">{(route.truck_vehicle_type ?? "truck").replace("_", " ")}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Dimensions (L×W×H)</p>
            <p className="font-medium">
              {truckDimensions
                ? `${truckDimensions.length} × ${truckDimensions.width} × ${truckDimensions.height} cm`
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Payload</p>
            <p className="font-medium">{totalWeight.toLocaleString()} / {truckCapacityKg.toLocaleString()} kg</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
