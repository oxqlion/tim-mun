export type Role = "warehouse" | "logistics";

export type UnitType = "kg" | "sack" | "pallet";
export type RequestStatus = "pending" | "assigned" | "optimized" | "in_transit" | "completed" | "cancelled";
export type TruckStatus = "available" | "on_trip" | "maintenance";
export type VehicleType = "pickup" | "truck_small" | "truck_medium" | "truck_large";
export type RouteStatus = "planned" | "in_progress" | "completed";
export type StopStatus = "pending" | "in_progress" | "completed";
export type PlanStatus = "draft" | "optimized" | "approved" | "in_transit" | "completed";

export interface TokenResponse {
  access_token: string;
  token_type: string;
  role: Role;
  user_id: string;
}

export interface RegisterPayload {
  name: string;
  role: Role;
  email: string;
  password: string;
  phone?: string;
  warehouse?: { name: string; address?: string; lat?: number; lng?: number };
  logistics?: { name: string };
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RequestItemIn {
  commodity_name: string;
  unit_type: UnitType;
  quantity: number;
  estimated_weight_kg?: number;
  length_cm?: number;
  width_cm?: number;
  height_cm?: number;
  stackable: boolean;
  fragile: boolean;
}

export interface RequestItemOut extends RequestItemIn {
  id: string;
  pickup_request_id: string;
}

export interface PickupRequestCreate {
  pickup_date: string;
  required_arrival_date: string;
  destination_name: string;
  destination_lat?: number;
  destination_lng?: number;
  notes?: string;
  items: RequestItemIn[];
}

export interface RouteStopOut {
  id: string;
  route_id: string;
  pickup_request_id: string;
  stop_sequence: number;
  stop_type: "pickup" | "dropoff";
  lat: number | null;
  lng: number | null;
  eta: string | null;
  allocated_weight_kg: number | null;
  allocated_volume_m3: number | null;
  status: StopStatus;
  location_name: string | null;
}

export interface SpaceAllocationOut {
  id: string;
  route_id: string;
  pickup_request_id: string;
  item_id: string;
  commodity_name: string;
  loading_sequence: number;
  position_notes: string | null;
  weight_kg: number;
  volume_m3: number;
  quantity: number;
  dropoff_order: number | null;
  dropoff_location_name: string | null;
}

export interface RouteOut {
  id: string;
  transportation_plan_id: string | null;
  truck_id: string;
  truck_plate_number: string | null;
  truck_vehicle_type: string | null;
  route_date: string;
  status: RouteStatus;
  total_distance_km: number | null;
  space_utilization_percent: number | null;
  weight_utilization_percent: number | null;
  generated_at: string;
  stops: RouteStopOut[];
  space_allocations: SpaceAllocationOut[];
}

export interface PickupRequestOut {
  id: string;
  warehouse_id: string;
  warehouse_name: string | null;
  warehouse_address: string | null;
  pickup_date: string;
  required_arrival_date: string;
  destination_name: string;
  destination_lat?: number;
  destination_lng?: number;
  notes?: string;
  status: RequestStatus;
  created_at: string;
  estimated_arrival: string | null;
  items: RequestItemOut[];
  matched_route?: RouteOut | null;
}

export interface TruckOut {
  id: string;
  logistics_company_id: string;
  vehicle_type: VehicleType;
  plate_number: string;
  capacity_weight_kg: number;
  capacity_volume_m3?: number;
  length_cm?: number;
  width_cm?: number;
  height_cm?: number;
  status: TruckStatus;
}

export interface TruckCreate {
  vehicle_type: VehicleType;
  plate_number: string;
  capacity_weight_kg: number;
  capacity_volume_m3?: number;
  length_cm?: number;
  width_cm?: number;
  height_cm?: number;
}

export interface TransportationPlanOut {
  id: string;
  logistics_company_id: string;
  plan_date: string;
  status: PlanStatus;
  total_requests: number;
  total_trucks_used: number;
  total_distance_km: number | null;
  estimated_fuel_liters: number | null;
  fuel_savings_percent: number | null;
  created_at: string;
  approved_at: string | null;
  optimization_log: string[];
  routes: RouteOut[];
}

export interface TransportationPlanSummary {
  id: string;
  logistics_company_id: string;
  plan_date: string;
  status: PlanStatus;
  total_requests: number;
  total_trucks_used: number;
  total_distance_km: number | null;
  estimated_fuel_liters: number | null;
  fuel_savings_percent: number | null;
  created_at: string;
  approved_at: string | null;
}
