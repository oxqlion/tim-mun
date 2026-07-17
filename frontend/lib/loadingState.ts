import type { RouteStopOut, SpaceAllocationOut } from "@/types/api";

export interface TruckStateAtStop {
  /** IDs of allocations physically in the truck at this stop; null = show everything (full load). */
  visibleIds: Set<string> | null;
  /** IDs of allocations picked up or delivered at this stop, to be visually emphasized. */
  highlightedIds: Set<string>;
}

/**
 * `SpaceAllocationOut.dropoff_order` is a rank among delivery stops only (1 =
 * first dropoff visited), assigned by the backend as it walks the route and
 * counts "dropoff"-type nodes (see optimizer.py, dropoff_seq). It is NOT the
 * same number as `RouteStopOut.stop_sequence`, which counts every stop
 * (origin, pickups, and dropoffs together). This maps rank -> stop_sequence
 * so allocations can be matched against the stop actually being viewed.
 */
export function buildDropoffRankToStopSequence(stops: RouteStopOut[]): Map<number, number> {
  const map = new Map<number, number>();
  let rank = 0;
  for (const stop of stops) {
    if (stop.stop_type === "dropoff") {
      rank += 1;
      map.set(rank, stop.stop_sequence);
    }
  }
  return map;
}

/**
 * Simulates the truck's cargo state as of arrival at a given stop.
 *
 * An item is "in the truck" once it has been picked up (at the earliest
 * "pickup" stop matching its pickup_request_id) and until it has been
 * delivered (at the stop whose stop_sequence corresponds to its
 * dropoff_order rank, see buildDropoffRankToStopSequence above). Items with
 * no matching pickup stop are assumed loaded from the origin.
 *
 * `selectedSeq === null` means no stop is selected: show the full load with
 * nothing highlighted, matching the pre-existing always-show-everything behavior.
 */
export function computeTruckStateAtStop(
  allocations: SpaceAllocationOut[],
  stops: RouteStopOut[],
  selectedSeq: number | null
): TruckStateAtStop {
  if (selectedSeq == null) {
    return { visibleIds: null, highlightedIds: new Set() };
  }

  const pickupSeqByRequestId = new Map<string, number>();
  for (const stop of stops) {
    if (stop.stop_type !== "pickup") continue;
    const existing = pickupSeqByRequestId.get(stop.pickup_request_id);
    if (existing == null || stop.stop_sequence < existing) {
      pickupSeqByRequestId.set(stop.pickup_request_id, stop.stop_sequence);
    }
  }
  const dropoffRankToSeq = buildDropoffRankToStopSequence(stops);

  const visibleIds = new Set<string>();
  const highlightedIds = new Set<string>();

  for (const alloc of allocations) {
    const pickupSeq = pickupSeqByRequestId.get(alloc.pickup_request_id) ?? -Infinity;
    const dropoffSeq = alloc.dropoff_order != null ? dropoffRankToSeq.get(alloc.dropoff_order) ?? null : null;

    const isVisible = pickupSeq <= selectedSeq && (dropoffSeq == null || dropoffSeq >= selectedSeq);
    if (isVisible) visibleIds.add(alloc.id);

    const isHighlighted = pickupSeq === selectedSeq || dropoffSeq === selectedSeq;
    if (isHighlighted) highlightedIds.add(alloc.id);
  }

  return { visibleIds, highlightedIds };
}
