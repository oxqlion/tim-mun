"use client";

import { useMemo } from "react";
import { buildDropoffRankToStopSequence } from "@/lib/loadingState";
import type { RouteStopOut, SpaceAllocationOut } from "@/types/api";

const COLORS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
];

interface LoadingSequenceProps {
  allocations: SpaceAllocationOut[];
  stops: RouteStopOut[];
}

export default function LoadingSequence({ allocations, stops }: LoadingSequenceProps) {
  const dropoffRankToSeq = useMemo(() => buildDropoffRankToStopSequence(stops), [stops]);

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Loading Sequence</p>
      <p className="text-xs text-muted-foreground">
        Load items in this order — cargo for the earliest delivery stop loads last, nearest the rear door
      </p>
      <div className="flex flex-col gap-1.5">
        {allocations.map((alloc, i) => {
          const color = COLORS[i % COLORS.length];
          return (
            <div key={alloc.id} className="flex items-center gap-3 rounded-md border px-3 py-2">
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ background: color }}
              >
                {alloc.loading_sequence}
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium">{alloc.commodity_name}</p>
                <p className="text-xs text-muted-foreground">{alloc.position_notes}</p>
                {alloc.dropoff_order != null && (
                  <p className="text-xs text-muted-foreground">
                    → Stop {dropoffRankToSeq.get(alloc.dropoff_order) ?? alloc.dropoff_order}
                    {alloc.dropoff_location_name ? `: ${alloc.dropoff_location_name}` : ""}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm">{alloc.weight_kg} kg</p>
                <p className="text-xs text-muted-foreground">{alloc.volume_m3.toFixed(3)} m³</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
