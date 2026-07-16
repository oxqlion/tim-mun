"""Space optimization service — unloading-aware volume-based bin packing.

Calculates optimal loading arrangement for items assigned to a truck.
Considers:
- Delivery stop order (dropoff_order): cargo for earlier stops is loaded
  LAST so it ends up nearest the rear door, minimizing rehandling at
  unload time.
- Item dimensions and weight
- Truck interior dimensions and weight capacity
- Fragility (fragile items loaded later / placed on top within a stop group)
- Weight (heavier items loaded earlier / lower within a stop group)

Outputs loading sequence, space utilization, and weight utilization.

Contract: optimize_space(items, truck) -> SpaceResult
"""

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class ItemForPacking:
    """A single item to be loaded."""
    id: str
    pickup_request_id: str
    commodity_name: str
    quantity: float
    weight_kg: float
    length_cm: float
    width_cm: float
    height_cm: float
    stackable: bool = False
    fragile: bool = False
    dropoff_order: int = 9999
    """Delivery stop rank for this item's request (lower = delivered earlier).
    Defaults to 9999 when the route/stop sequence is unknown, which sorts as
    if delivered last — loaded deep rather than blocking known early-stop items."""
    dropoff_location_name: Optional[str] = None

    @property
    def volume_m3(self) -> float:
        """Calculate volume in cubic meters."""
        return (self.length_cm * self.width_cm * self.height_cm) / 1_000_000


@dataclass
class TruckDimensions:
    """Truck cargo space specifications."""
    id: str
    capacity_weight_kg: float
    capacity_volume_m3: Optional[float] = None
    length_cm: Optional[float] = None
    width_cm: Optional[float] = None
    height_cm: Optional[float] = None

    @property
    def cargo_volume_m3(self) -> float:
        """Calculate cargo volume from dimensions, or use stated capacity."""
        if self.length_cm and self.width_cm and self.height_cm:
            return (self.length_cm * self.width_cm * self.height_cm) / 1_000_000
        return self.capacity_volume_m3 or 0.0


@dataclass
class LoadedItem:
    """An item with its assigned loading position."""
    item_id: str
    pickup_request_id: str
    commodity_name: str
    loading_sequence: int
    position_notes: str
    weight_kg: float
    volume_m3: float
    quantity: float = 1
    dropoff_order: int = 9999
    dropoff_location_name: Optional[str] = None


@dataclass
class SpaceResult:
    """Result of space optimization for one truck."""
    truck_id: str
    loaded_items: list[LoadedItem] = field(default_factory=list)
    total_weight_kg: float = 0.0
    total_volume_m3: float = 0.0
    truck_weight_capacity_kg: float = 0.0
    truck_volume_capacity_m3: float = 0.0
    weight_utilization_percent: float = 0.0
    space_utilization_percent: float = 0.0
    remaining_weight_kg: float = 0.0
    remaining_volume_m3: float = 0.0
    fits: bool = True


def optimize_space(items: list[ItemForPacking], truck: TruckDimensions) -> SpaceResult:
    """Calculate optimal, unloading-aware loading arrangement for items in a truck.

    Loading strategy (LIFO by delivery stop):
    1. Primary key: dropoff_order descending — items delivered at the LAST
       stop are loaded FIRST (deepest, away from the door); items delivered
       at the FIRST stop are loaded LAST (nearest the rear door), so they
       come off first with no rehandling.
    2. Within the same stop: fragile items load later (end up higher/closer
       to the top of that stop's group) so nothing heavy sits on top of them.
    3. Within the same stop and fragility group: heavier items load earlier
       (end up lower), for reasonable weight distribution.
    """
    if not items:
        return SpaceResult(
            truck_id=truck.id,
            truck_weight_capacity_kg=truck.capacity_weight_kg,
            truck_volume_capacity_m3=truck.cargo_volume_m3,
            remaining_weight_kg=truck.capacity_weight_kg,
            remaining_volume_m3=truck.cargo_volume_m3,
        )

    # LIFO by delivery stop: later dropoff_order (delivered later) loads first.
    # Fragile items load later within a stop group; heavier items load earlier.
    loading_order = sorted(
        items,
        key=lambda x: (-x.dropoff_order, x.fragile, -x.weight_kg),
    )

    # Rank stops in loading order (1 = first stop reached) for readable notes.
    stop_ranks = sorted({item.dropoff_order for item in items})
    total_stops = len(stop_ranks)
    stop_rank_of = {order: i + 1 for i, order in enumerate(stop_ranks)}

    loaded_items: list[LoadedItem] = []
    total_weight = 0.0
    total_volume = 0.0

    for seq, item in enumerate(loading_order, start=1):
        stop_rank = stop_rank_of[item.dropoff_order]
        is_last_stop = stop_rank == total_stops
        stop_label = f"stop {stop_rank}" + (" (last)" if is_last_stop else "")
        depth = "load deep" if is_last_stop else "keep near door"
        position = f"Deliver {stop_label} — {depth}"
        if item.fragile:
            position += ", FRAGILE handle with care"

        item_volume = item.volume_m3
        total_weight += item.weight_kg
        total_volume += item_volume

        loaded_items.append(LoadedItem(
            item_id=item.id,
            pickup_request_id=item.pickup_request_id,
            commodity_name=item.commodity_name,
            loading_sequence=seq,
            position_notes=position,
            weight_kg=item.weight_kg,
            volume_m3=item_volume,
            quantity=item.quantity,
            dropoff_order=item.dropoff_order,
            dropoff_location_name=item.dropoff_location_name,
        ))

    truck_volume = truck.cargo_volume_m3
    weight_util = (total_weight / truck.capacity_weight_kg * 100) if truck.capacity_weight_kg > 0 else 0
    space_util = (total_volume / truck_volume * 100) if truck_volume > 0 else 0

    fits = total_weight <= truck.capacity_weight_kg and (
        truck_volume <= 0 or total_volume <= truck_volume
    )

    return SpaceResult(
        truck_id=truck.id,
        loaded_items=loaded_items,
        total_weight_kg=total_weight,
        total_volume_m3=total_volume,
        truck_weight_capacity_kg=truck.capacity_weight_kg,
        truck_volume_capacity_m3=truck_volume,
        weight_utilization_percent=round(weight_util, 1),
        space_utilization_percent=round(space_util, 1),
        remaining_weight_kg=round(truck.capacity_weight_kg - total_weight, 2),
        remaining_volume_m3=round(max(0, truck_volume - total_volume), 4),
        fits=fits,
    )
