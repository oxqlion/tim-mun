"use client";

import type { SpaceAllocationOut } from "@/types/api";

const COLORS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
];

interface LoadingSequenceProps {
  allocations: SpaceAllocationOut[];
}

export default function LoadingSequence({ allocations }: LoadingSequenceProps) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Loading Sequence</p>
      <p className="text-xs text-muted-foreground">Load items in this order (first loaded = bottom of truck)</p>
      <div className="flex flex-col gap-1.5">
        {allocations.map((alloc, i) => (
          <div key={alloc.id} className="flex items-center gap-3 rounded-md border px-3 py-2">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ background: COLORS[i % COLORS.length] }}
            >
              {alloc.loading_sequence}
            </span>
            <div className="flex-1">
              <p className="text-sm font-medium">{alloc.commodity_name}</p>
              <p className="text-xs text-muted-foreground">{alloc.position_notes}</p>
            </div>
            <div className="text-right">
              <p className="text-sm">{alloc.weight_kg} kg</p>
              <p className="text-xs text-muted-foreground">{alloc.volume_m3.toFixed(3)} m³</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
