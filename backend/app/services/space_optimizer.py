"""Space optimization service — volume-based bin packing.

Calculates optimal loading arrangement for items assigned to a truck.
Considers:
- Item dimensions and weight
- Truck interior dimensions and weight capacity
- Stackability (stackable items can go under others)
- Fragility (fragile items loaded last / placed on top)

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
    """Calculate optimal loading arrangement for items in a truck.

    Loading strategy:
    1. Non-fragile, stackable, heavy items go first (bottom layer)
    2. Non-fragile, non-stackable items go next (middle)
    3. Fragile items go last (top layer, loaded last = unloaded first)

    Within each group, sort by weight descending (heavier items lower).
    """
    if not items:
        return SpaceResult(
            truck_id=truck.id,
            truck_weight_capacity_kg=truck.capacity_weight_kg,
            truck_volume_capacity_m3=truck.cargo_volume_m3,
            remaining_weight_kg=truck.capacity_weight_kg,
            remaining_volume_m3=truck.cargo_volume_m3,
        )

    # Categorize items for loading order
    bottom_layer: list[ItemForPacking] = []  # stackable, not fragile (can bear weight)
    middle_layer: list[ItemForPacking] = []  # not stackable, not fragile
    top_layer: list[ItemForPacking] = []     # fragile (must be on top)

    for item in items:
        if item.fragile:
            top_layer.append(item)
        elif item.stackable:
            bottom_layer.append(item)
        else:
            middle_layer.append(item)

    # Sort each layer by weight descending (heavier first within layer)
    bottom_layer.sort(key=lambda x: x.weight_kg, reverse=True)
    middle_layer.sort(key=lambda x: x.weight_kg, reverse=True)
    top_layer.sort(key=lambda x: x.weight_kg, reverse=True)

    # Assign loading sequence (1 = loaded first = bottom)
    loading_order = bottom_layer + middle_layer + top_layer
    loaded_items: list[LoadedItem] = []
    total_weight = 0.0
    total_volume = 0.0

    for seq, item in enumerate(loading_order, start=1):
        # Determine position notes
        if item.fragile:
            position = "Top layer — FRAGILE, handle with care"
        elif item.stackable and seq <= len(bottom_layer):
            position = "Bottom layer — stackable, weight-bearing"
        else:
            position = "Middle layer"

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
