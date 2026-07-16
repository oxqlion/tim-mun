"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Box, Weight, Package, PackageOpen } from "lucide-react";

interface StatsProps {
  spaceUtilization: number;
  weightUtilization: number;
  remainingWeight: number;
  remainingVolume: number;
  loadedItems: number;
  totalItems: number;
  truckCapacityKg: number;
  truckVolumeM3: number;
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-2.5 w-full rounded-full bg-muted">
      <div
        className={`h-2.5 rounded-full transition-all ${color}`}
        style={{ width: `${Math.min(100, value)}%` }}
      />
    </div>
  );
}

export default function OptimizationStatistics({
  spaceUtilization,
  weightUtilization,
  remainingWeight,
  remainingVolume,
  loadedItems,
  totalItems,
  truckCapacityKg,
  truckVolumeM3,
}: StatsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <Card>
        <CardContent className="p-3">
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Box className="h-3 w-3" /> Space
          </div>
          <p className="text-lg font-bold">{spaceUtilization}%</p>
          <ProgressBar value={spaceUtilization} color="bg-blue-500" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3">
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Weight className="h-3 w-3" /> Weight
          </div>
          <p className="text-lg font-bold">{weightUtilization}%</p>
          <ProgressBar value={weightUtilization} color="bg-amber-500" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3">
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Weight className="h-3 w-3" /> Remaining Weight
          </div>
          <p className="text-lg font-bold">{remainingWeight.toLocaleString()} kg</p>
          <p className="text-[10px] text-muted-foreground">of {truckCapacityKg.toLocaleString()} kg</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3">
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Box className="h-3 w-3" /> Remaining Volume
          </div>
          <p className="text-lg font-bold">{remainingVolume.toFixed(1)} m³</p>
          <p className="text-[10px] text-muted-foreground">of {truckVolumeM3.toFixed(1)} m³</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3">
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Package className="h-3 w-3" /> Loaded
          </div>
          <p className="text-lg font-bold">{loadedItems}</p>
          <ProgressBar value={(loadedItems / Math.max(totalItems, 1)) * 100} color="bg-green-500" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3">
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <PackageOpen className="h-3 w-3" /> Unloaded
          </div>
          <p className="text-lg font-bold">{totalItems - loadedItems}</p>
          <p className="text-[10px] text-muted-foreground">items didn&apos;t fit</p>
        </CardContent>
      </Card>
    </div>
  );
}
