"use client";

import { lazy, Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Box } from "lucide-react";
import TruckInfoCard from "./TruckInfoCard";
import OptimizationStatistics from "./OptimizationStatistics";
import LoadingSequence from "./LoadingSequence";
import type { RouteOut, TruckOut } from "@/types/api";

const TruckVisualization = lazy(() => import("./TruckVisualization"));

interface SpaceOptimizationSectionProps {
  route: RouteOut;
  truck?: TruckOut;
}

export default function SpaceOptimizationSection({ route, truck }: SpaceOptimizationSectionProps) {
  const allocations = route.space_allocations ?? [];

  if (allocations.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <Box className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
          <p className="text-muted-foreground">No space optimization data available.</p>
        </CardContent>
      </Card>
    );
  }

  const truckCapacityKg = truck?.capacity_weight_kg ?? 10000;
  const truckDimensions = truck?.length_cm && truck?.width_cm && truck?.height_cm
    ? { length: truck.length_cm, width: truck.width_cm, height: truck.height_cm }
    : null;
  const truckVolumeM3 = truckDimensions
    ? (truckDimensions.length * truckDimensions.width * truckDimensions.height) / 1_000_000
    : 30;

  const totalWeight = allocations.reduce((s, a) => s + a.weight_kg, 0);
  const totalVolume = allocations.reduce((s, a) => s + a.volume_m3, 0);
  const spaceUtil = route.space_utilization_percent ?? (totalVolume / truckVolumeM3 * 100);
  const weightUtil = route.weight_utilization_percent ?? (totalWeight / truckCapacityKg * 100);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Box className="h-4 w-4" />
        <h3 className="text-sm font-semibold">Space Optimization</h3>
      </div>

      {/* Truck Info */}
      <TruckInfoCard route={route} truckCapacityKg={truckCapacityKg} truckDimensions={truckDimensions} />

      {/* 3D Visualization */}
      {truckDimensions && (
        <Suspense fallback={<div className="h-80 animate-pulse rounded-lg border bg-muted" />}>
          <TruckVisualization truckDimensions={truckDimensions} allocations={allocations} />
        </Suspense>
      )}

      {/* Statistics */}
      <OptimizationStatistics
        spaceUtilization={Math.round(spaceUtil)}
        weightUtilization={Math.round(weightUtil)}
        remainingWeight={Math.round(truckCapacityKg - totalWeight)}
        remainingVolume={Math.max(0, truckVolumeM3 - totalVolume)}
        loadedItems={allocations.length}
        totalItems={allocations.length}
        truckCapacityKg={truckCapacityKg}
        truckVolumeM3={truckVolumeM3}
      />

      {/* Loading Sequence */}
      <LoadingSequence allocations={allocations} />
    </div>
  );
}
