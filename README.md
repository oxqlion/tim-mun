# Agri-logistics POC

Built for **Garuda Hacks 7.0** by team **Tim Mun**.

## What it does

Warehouses submit pickup requests (destination + commodity line items). Logistics
companies register trucks and generate routes that match pending requests to
available trucks by capacity. Status flows `pending → matched → in_progress → completed`.

## Tech Stack

- Frontend: Next.js (App Router) + TypeScript + Tailwind CSS
- Backend: FastAPI + Pydantic v2
- Database: Cloud Firestore (via `firebase-admin` / `google-cloud-firestore`), run locally against the Firestore emulator
- Auth: Backend-issued JWT (bcrypt-hashed passwords stored in Firestore) — no external auth provider required for the POC
- Other tools/APIs: `firebase-tools` (emulator only)

See `implementation-plan.md` for the original design doc and `schema.sql` for the
logical schema (kept as documentation — Firestore itself has no migrations).

## Team

- Tim Mun

## Getting started

Three terminals, in order:

### 1. Firestore emulator

Requires [`firebase-tools`](https://firebase.google.com/docs/cli) (`npm install -g firebase-tools`, or use `npx`).

```bash
npx firebase-tools emulators:start --only firestore
```

Runs on `localhost:8080` with the Emulator UI on `localhost:4000`. No GCP project
or credentials needed — `.firebaserc` points at a dummy project id used only locally.

### 2. Backend (FastAPI)

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

API on `http://localhost:8000`, interactive docs at `http://localhost:8000/docs`,
health check at `http://localhost:8000/health`.

### 3. Frontend (Next.js)

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

App on `http://localhost:3000`.

## Demo walkthrough

1. Go to `http://localhost:3000`, register a **logistics** account, then add a
   truck (e.g. capacity 5000 kg) on the Trucks page.
2. Register a **warehouse** account (open a new browser profile/incognito
   window, or log out first — one JWT is stored per browser), and submit a
   pickup request for today's date with one or two items.
3. Back in the logistics account, go to Routes, pick today's date, and click
   **Generate routes** — a route with a pickup stop should appear, the
   request status flips to `matched`, and the truck flips to `on_trip`.
4. Mark the stop `completed` from the dropdown — the linked pickup request
   updates to `completed`.

## Switching to real Firestore later

Unset `FIRESTORE_EMULATOR_HOST` in `backend/.env`, set `GOOGLE_APPLICATION_CREDENTIALS`
to a service-account key for your Firebase project, and update `.firebaserc` /
`FIREBASE_PROJECT_ID` — no application code changes required.

## License

MIT
