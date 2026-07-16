# Agri-logistics POC — implementation plan

Prototype covering two account types (warehouse, logistics/truck owner), pickup requests, and route/load allocation, per the reviewed mockups and schema.

## 1. Stack decision (read before starting)

| Layer | Choice | Why |
|---|---|---|
| Database | **Firebase SQL Connect** (managed PostgreSQL, Cloud SQL-backed) | Keeps the relational schema (FKs, joins) intact; satisfies "use Firebase" without forcing a NoSQL redesign |
| Backend ORM | **SQLAlchemy + Alembic** (Python, in `backend/`) | Backend is the sole owner of schema migrations |
| Frontend data access | **REST calls to FastAPI only** — no Prisma, no direct DB access from Next.js | Avoids two ORMs migrating the same database independently |
| Auth | **Firebase Authentication**, custom claim `role: "warehouse" | "logistics"` | Shared identity across both services; FastAPI verifies the Firebase ID token on each request |
| Frontend framework | Next.js (App Router), TypeScript, fetch/`use` for API calls | Already decided |
| Backend framework | FastAPI, Pydantic v2 models mirroring the SQLAlchemy models | Already decided |

**If you'd rather keep Prisma in Next.js:** that only works cleanly if Next.js is also allowed to read the DB directly. In that case, make FastAPI the only service that runs migrations (`alembic upgrade head`), and run `prisma db pull` + `prisma generate` in the frontend to introspect the existing schema read-only — never `prisma migrate` from the frontend. Decide this before scaffolding; don't let both sides migrate.

## 2. Repo structure

```
frontend/                    # Next.js
  app/
    (warehouse)/
      dashboard/page.tsx
      requests/new/page.tsx
      requests/page.tsx      # history/status list
    (logistics)/
      dashboard/page.tsx
      routes/page.tsx
      trucks/page.tsx
    login/page.tsx
  lib/
    api.ts                   # thin fetch wrapper, attaches Firebase ID token
    firebase-client.ts        # Firebase Auth client init only — no Firestore/DB client
  types/
    api.ts                   # hand-written or generated types matching backend Pydantic schemas

backend/                     # FastAPI
  app/
    main.py
    core/
      config.py               # env vars, settings
      auth.py                 # Firebase ID token verification middleware/dependency
    db/
      session.py              # SQLAlchemy engine/session
      models.py                # SQLAlchemy models (mirrors schema.sql)
    schemas/                  # Pydantic request/response models
      warehouse.py
      logistics.py
      pickup_request.py
      route.py
    api/
      warehouses.py
      logistics.py
      pickup_requests.py
      routes.py
    services/
      optimizer.py            # route/load allocation logic — stub first, real algorithm later
    alembic/
      versions/
  alembic.ini
  requirements.txt
```

## 3. Database schema

Use `schema.sql` (already written) as the source of truth for the first Alembic migration. Translate each `CREATE TABLE` into a matching SQLAlchemy model in `db/models.py` — same table names, columns, and `CHECK` constraints. Don't hand-edit the schema in two places; if a column changes, change `models.py` and generate a new Alembic revision (`alembic revision --autogenerate`), not the other way around.

## 4. API contract (first pass)

Auth on every route below via `Authorization: Bearer <firebase-id-token>`; FastAPI dependency resolves it to a `user_id` and `role`.

**Warehouse-role routes**
- `POST /pickup-requests` — body: `pickup_date`, `destination_name`, `destination_lat/lng`, `items: [{commodity_name, unit_type, quantity, estimated_weight_kg?}]`. Creates a `pickup_requests` row with `status = pending` plus its `request_items`.
- `GET /pickup-requests` — list the calling warehouse's own requests, most recent first, with status.
- `GET /pickup-requests/{id}` — detail view, including matched route if any.

**Logistics-role routes**
- `GET /trucks` — the calling company's trucks and current status.
- `GET /routes?date=` — routes for that company on a given day, each with its ordered `route_stops`.
- `POST /routes/generate` — triggers `services/optimizer.py` against all `pending` pickup requests for a date and this company's available trucks; creates `routes` + `route_stops`, sets matched requests to `status = matched`.
- `PATCH /route-stops/{id}` — mark a stop `completed` (updates `eta`/actual arrival — add an `actual_arrival` column if you want real tracking here, it's not in the current schema).

**Shared**
- `POST /auth/register` — creates the `users` row plus a `warehouses` or `logistics_companies` row depending on role, after Firebase Auth account creation on the client.

## 5. Optimizer — stub first

For the POC, `services/optimizer.py` does not need real routing/bin-packing on day one. Start with a naive version: group pending requests by destination, assign to the first available truck with enough remaining `capacity_weight_kg`, sequence stops by whatever order requests came in. This unblocks the frontend (routes/route_stops screens have real data to render) while the actual optimization logic is developed separately — swapping the function body later shouldn't require touching the API contract or the frontend at all.

## 6. Milestones for Claude Code

Work through these in order; each should be a working, demoable slice before moving to the next.

1. **Scaffold + auth** — FastAPI health check route, Firebase Auth wired on both sides, `/auth/register` working, login page in Next.js.
2. **Schema + migrations** — SQLAlchemy models from `schema.sql`, first Alembic migration applied to a real Firebase SQL Connect instance.
3. **Warehouse flow** — `POST/GET /pickup-requests`, the "new pickup request" form and "your requests" table from the mockup, wired end to end.
4. **Logistics flow (stub optimizer)** — `GET /trucks`, `POST /routes/generate` with the naive optimizer, `GET /routes`, the routes dashboard from the mockup wired end to end.
5. **Polish + status transitions** — status badges reflecting real state (`pending` → `matched` → `in_progress` → `completed`), basic error states.
6. **Real optimizer** — replace the naive grouping in `services/optimizer.py` with actual load/route optimization, no other layer should need to change.

## 7. Open decisions to confirm before Claude Code starts

- Confirm Firebase SQL Connect is available/acceptable for your GCP project and billing setup (it's a recently renamed, still-evolving product — check current docs at the time you set this up).
- Confirm the Prisma-vs-REST-only decision from section 1.
- Decide whether `route_stops.eta` should get an `actual_arrival` column now or later — affects whether "real-time tracking" is demoable in the POC or comes after.
