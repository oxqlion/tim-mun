export type Role = "warehouse" | "logistics";

export type UnitType = "kg" | "sack" | "pallet";
export type RequestStatus = "pending" | "matched" | "in_progress" | "completed" | "cancelled";
export type TruckStatus = "available" | "on_trip" | "maintenance";
export type RouteStatus = "planned" | "in_progress" | "completed";
export type StopStatus = "pending" | "in_progress" | "completed";

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
}

export interface RequestItemOut extends RequestItemIn {
  id: string;
  pickup_request_id: string;
}

export interface PickupRequestCreate {
  pickup_date: string;
  destination_name: string;
  destination_lat?: number;
  destination_lng?: number;
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
}

export interface RouteOut {
  id: string;
  truck_id: string;
  route_date: string;
  status: RouteStatus;
  total_distance_km: number | null;
  generated_at: string;
  stops: RouteStopOut[];
}

export interface PickupRequestOut {
  id: string;
  warehouse_id: string;
  pickup_date: string;
  destination_name: string;
  destination_lat?: number;
  destination_lng?: number;
  status: RequestStatus;
  created_at: string;
  estimated_arrival: string | null;
  items: RequestItemOut[];
  matched_route?: RouteOut | null;
}

export interface TruckOut {
  id: string;
  logistics_company_id: string;
  plate_number: string;
  capacity_weight_kg: number;
  capacity_volume_m3?: number;
  status: TruckStatus;
}

export interface TruckCreate {
  plate_number: string;
  capacity_weight_kg: number;
  capacity_volume_m3?: number;
}
