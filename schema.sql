-- Proof-of-concept schema: warehouse pickup requests + logistics route/load optimization
-- Two account types share one users table; warehouses and logistics_companies each link back to it.

CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    role            VARCHAR(20) NOT NULL CHECK (role IN ('warehouse', 'logistics')),
    phone           VARCHAR(30),
    email           VARCHAR(255) UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- One warehouse profile per warehouse-role user. Assumes a fixed physical location for now.
CREATE TABLE warehouses (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id),
    name            VARCHAR(255) NOT NULL,
    address         VARCHAR(255),
    lat             DECIMAL(9,6),
    lng             DECIMAL(9,6)
);

-- One company profile per logistics-role user.
CREATE TABLE logistics_companies (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id),
    name            VARCHAR(255) NOT NULL
);

-- Trucks owned by a logistics company.
CREATE TABLE trucks (
    id                  SERIAL PRIMARY KEY,
    logistics_company_id INTEGER NOT NULL REFERENCES logistics_companies(id),
    plate_number        VARCHAR(20) NOT NULL,
    capacity_weight_kg   DECIMAL(10,2) NOT NULL,
    capacity_volume_m3   DECIMAL(10,2),
    status               VARCHAR(20) NOT NULL DEFAULT 'available'
                         CHECK (status IN ('available', 'on_trip', 'maintenance'))
);

-- A warehouse's pickup request. One destination assumed per request for now
-- (multi-drop within a single request can be added later without breaking this table).
CREATE TABLE pickup_requests (
    id                  SERIAL PRIMARY KEY,
    warehouse_id        INTEGER NOT NULL REFERENCES warehouses(id),
    pickup_date          DATE NOT NULL,
    destination_name     VARCHAR(255) NOT NULL,
    destination_lat       DECIMAL(9,6),
    destination_lng       DECIMAL(9,6),
    status                VARCHAR(20) NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'matched', 'in_progress', 'completed', 'cancelled')),
    created_at            TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Line items within a request. unit_type + quantity covers "80 sacks" or "3 pallets" or "400 kg"
-- directly from what the warehouse actually knows, without forcing a weight/dimension conversion at input time.
CREATE TABLE request_items (
    id                  SERIAL PRIMARY KEY,
    pickup_request_id    INTEGER NOT NULL REFERENCES pickup_requests(id),
    commodity_name        VARCHAR(255) NOT NULL,
    unit_type             VARCHAR(20) NOT NULL CHECK (unit_type IN ('kg', 'sack', 'pallet')),
    quantity              DECIMAL(10,2) NOT NULL,
    estimated_weight_kg    DECIMAL(10,2),
    length_cm              DECIMAL(8,2),
    width_cm               DECIMAL(8,2),
    height_cm              DECIMAL(8,2)
);

-- One route per truck per day. total_distance_km and generated_at exist so the optimizer's
-- output can be inspected/audited later, separate from what's shown on the dashboard.
CREATE TABLE routes (
    id                  SERIAL PRIMARY KEY,
    truck_id             INTEGER NOT NULL REFERENCES trucks(id),
    route_date            DATE NOT NULL,
    status                VARCHAR(20) NOT NULL DEFAULT 'planned'
                         CHECK (status IN ('planned', 'in_progress', 'completed')),
    total_distance_km      DECIMAL(10,2),
    generated_at           TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Ordered stops within a route. Doubles as the "load allocation" record: how much of this
-- request's produce is assigned to this truck, at this stop, in sequence.
CREATE TABLE route_stops (
    id                  SERIAL PRIMARY KEY,
    route_id              INTEGER NOT NULL REFERENCES routes(id),
    pickup_request_id      INTEGER NOT NULL REFERENCES pickup_requests(id),
    stop_sequence          INTEGER NOT NULL,
    stop_type              VARCHAR(10) NOT NULL CHECK (stop_type IN ('pickup', 'dropoff')),
    eta                    TIMESTAMP,
    allocated_weight_kg      DECIMAL(10,2),
    allocated_volume_m3      DECIMAL(10,2)
);

-- Relationships, in plain terms:
-- users 1--1 warehouses / logistics_companies (a user is one or the other, never both, per role check)
-- logistics_companies 1--N trucks
-- warehouses 1--N pickup_requests
-- pickup_requests 1--N request_items (what's being picked up)
-- trucks 1--N routes (one truck can run multiple routes on different dates)
-- routes 1--N route_stops, and route_stops N--1 pickup_requests
--   (a route can serve several pickup_requests; a single large request could in principle
--   also span two trucks, since nothing here caps how many route_stops reference one request)
