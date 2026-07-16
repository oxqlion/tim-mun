# AgriLoad — Implementation Plan

## Stack

| Layer | Choice |
|---|---|
| Database | Firebase Firestore (NoSQL, with emulator for local dev) |
| Backend | FastAPI + Pydantic v2 + OR-Tools + OSRM |
| Frontend | Next.js 16 (App Router) + React 19 + Tailwind CSS 4 + Leaflet |
| Auth | Custom JWT (PyJWT + bcrypt) |
| Route Optimization | Google OR-Tools (Pickup & Delivery Problem) |
| Distance/ETA | OSRM (OpenStreetMap Routing Machine) |
| Space Optimization | Volume-based bin packing (custom) |
| Map | Leaflet + OpenStreetMap (free, no API key) |

## Features Implemented

### Authentication
- [x] Login / Register
- [x] Role-based access (warehouse / logistics)
- [x] JWT auth with Bearer tokens

### Warehouse
- [x] Dashboard (request counts, recent requests, ETA)
- [x] Create pickup request (date, arrival deadline, destination, items with dimensions/stackable/fragile)
- [x] Request history with status tracking
- [x] ETA visibility after optimization

### Logistics / Fleet Management
- [x] Dashboard (pending requests, fleet size, available trucks, active trips, recent plans)
- [x] Pickup request management (view all, filter by status/date)
- [x] Fleet management (add trucks with type, plate, capacity, interior dimensions)
- [x] Transportation plan generation (one-click: fleet allocation + route + space optimization)
- [x] Space optimization (loading sequence, utilization bars, position notes)
- [x] Route optimization (OR-Tools PDP, destination-aware, OSRM real distances)
- [x] Transportation plan review (summary, routes, map, space allocation, loading sequence)
- [x] Plan approval flow (optimized → approved)
- [x] Route map visualization (Leaflet, pickup/dropoff markers, polyline)
- [x] Fuel estimation + savings calculation

### Optimization Engine
- [x] Pickup & Delivery Problem solver (OR-Tools)
- [x] Destination-aware grouping (requests going same direction share a truck)
- [x] OSRM real road distances + travel duration for ETA
- [x] Best-fit decreasing fleet allocation (weight + volume)
- [x] Priority scheduling (urgent deliveries first by required_arrival_date)
- [x] Volume-based space optimization (stackable/fragile aware)
- [x] Loading sequence generation (heavy → light → fragile on top)
- [x] Fuel consumption estimation + savings vs naive individual delivery

## API Endpoints

### Auth
- `POST /auth/register`
- `POST /auth/login`

### Warehouse
- `POST /pickup-requests`
- `GET /pickup-requests`
- `GET /pickup-requests/{id}`

### Logistics
- `GET /pickup-requests/all` (with status/date filters)
- `GET /trucks`
- `POST /trucks`
- `POST /transportation-plans` (generate)
- `GET /transportation-plans`
- `GET /transportation-plans/{id}`
- `POST /transportation-plans/{id}/approve`
- `GET /routes?date=`
- `PATCH /route-stops/{id}`

## Status Flow

### Pickup Request
`pending` → `optimized` (after plan generation) → `assigned` (after plan approval) → `in_transit` → `completed`

### Transportation Plan
`draft` → `optimized` → `approved` → `in_transit` → `completed`

### Route
`planned` → `in_progress` → `completed`

### Route Stop
`pending` → `in_progress` → `completed`
