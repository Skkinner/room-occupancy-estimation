# Is Anyone There? — Emergency Occupancy Intelligence

> **RESEARCH DEMO — NOT FOR LIFE-SAFETY DECISIONS / نموذج تجريبي — لا يُستخدم لاتخاذ قرارات سلامة الأرواح**

A React + TypeScript dashboard for a machine-learning class demo. A building security coordinator, running a
**simulated** evacuation drill, sees which (fictional) rooms *may* still contain occupants so staff can
prioritize manual sweeps.

This is advisory research software. It is **not** a fire alarm, a certified life-safety system, a
rescue-dispatch system or an evacuation-clearance authority. In a later January evaluation the model
**missed 62.59% of occupied readings**.

---

## Quick start

```bash
cd frontend
npm install
cp .env.example .env        # optional; the default API is http://localhost:8000
npm run dev                 # http://localhost:5173
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck (`tsc --noEmit`) + production build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm test` | Vitest: safety and acceptance logic tests |

**API:** set `VITE_API_URL` to the existing FastAPI service (default `http://localhost:8000`). The
backend in this repo (`backend/`) already allows CORS from `http://localhost:5173` and `http://127.0.0.1:5173`. Add `?lang=ar` or `?lang=en` to any URL to choose the language.

If the API is unreachable, the app opens in a clearly labeled **offline simulation mode** and keeps working.

## API integration

| Endpoint | Use |
| --- | --- |
| `GET /health` | Connectivity check on load, on "Retry connection", every 15 s while offline (auto-reconnect), and after a failed prediction. `model_loaded: false` is treated as offline (no predictions). |
| `GET /schema` | Discovers the exact sensor feature names **and their order**. The parser accepts `{features: [...]}`, `{feature_names: [...]}`, `{sensors: {...}}`, a bare array of names or `{name,min,max}` objects, or a JSON-Schema `properties` map. Without a valid schema the app refuses to call `/predict` and stays in offline simulation. |
| `POST /predict` | Body is **exactly the 16 schema features** as a flat JSON object (the backend rejects unknown fields). `room_id` and `source` stay client-side for labeling. Missing, non-numeric or out-of-range values block the request and are listed in Room Detail. Response fields used: `estimated_count`, `probabilities`, `safety_notice`, `requires_manual_verification` (the parser also accepts the earlier draft names `estimated_occupancy` / `class_probabilities`). |

Response handling (`src/lib/validation.ts`):
- `estimated_occupancy` must be 0–3 and `class_probabilities` must be numbers. Anything else is shown as an error with a Retry button.
- `safety_status` is **forced** to `UNKNOWN_REQUIRES_PHYSICAL_VERIFICATION`, whatever the server returns.
- Per-class values are labeled **"Uncalibrated model scores"**, never as probabilities or certainty.

## Data provenance

| Data | Label in the UI |
| --- | --- |
| Built-in readings (`src/lib/simulation.ts`) | **Simulated data**. Deterministic seeded mock data for six fictional rooms. Expected labels are shown as *"Scenario design label — simulated, NOT measured truth"*. |
| A CSV you load on the Drill page | **Historical replay**. Rows keep their dataset timestamps. An occupancy column, if present, is shown as *"Recorded dataset label (ground truth)"*. The file never leaves the browser. |
| Offline estimates | **"Demo simulator — not the model"**. A hand-written heuristic, used only when the API is unavailable or switched off. |
| API estimates | **"Model output (API)"** |

Nothing is ever labeled real-time. The replay clock is labeled *simulated clock*, every replay view shows
a **Not real-time** badge, and device-clock times (for audit entries) are labeled *device clock*.

The floor plan (rooms A101–A106) is **fictional**: the dataset was recorded in one room.

## Safety rules enforced in code

| Rule | Where |
| --- | --- |
| The ML estimate and the manual inspection status are separate state. No model action writes to `inspections`. | `src/state/reducer.ts` |
| No "clear", "safe" or "evacuated" state exists. The lowest priority is *"Unconfirmed — physical check required"*. | `src/lib/safety.ts` |
| Readings ≥ 90 s old (replay time) are **STALE** (hatched amber, with their age shown); rooms with no readings are **Unavailable**. Both force the "no current data" priority. | `freshnessFor`, `priorityFor` |
| Stale estimates are shown struck through, with their age. | `EstimateCell` |
| A manual check is a simulated event with an alias, a confirmation dialog, a toast, an audit-trail entry and an event-log entry. It is client-only and ephemeral. | `ManualCheckForm`, `RECORD_INSPECTION` |
| Red is used only for the explicit simulated-drill notice. There are no alarm, call or notification integrations. | `index.css`, `Banners.tsx` |

## Project structure

```
frontend/
├── index.html
├── src/
│   ├── main.tsx, App.tsx          # providers + routes
│   ├── index.css                  # theme tokens, hatch pattern, reduced-motion
│   ├── i18n/                      # en.ts (source), ar.ts (type-checked parity), provider/RTL
│   ├── lib/
│   │   ├── api.ts                 # fetch client with timeouts and typed errors
│   │   ├── schema.ts              # /schema discovery
│   │   ├── validation.ts          # sensor payload + response validation
│   │   ├── safety.ts              # freshness, priority, invariants
│   │   ├── simulation.ts          # LABELED mock data + offline heuristic
│   │   ├── csv.ts                 # historical CSV replay parser
│   │   └── format.ts              # locale-aware time and number formatting
│   ├── state/
│   │   ├── reducer.ts             # pure, testable demo state
│   │   ├── DemoStore.tsx          # provider: connection, playback, predictions, derived room views
│   │   └── acceptance.test.ts     # automated acceptance checks
│   ├── data/rooms.ts              # fictional rooms A101–A106
│   ├── components/
│   │   ├── ui/                    # shadcn-style primitives (Radix AlertDialog/Switch, cva)
│   │   ├── layout/                # AppShell, safety/offline/drill banners
│   │   └── rooms/                 # badges, table, charts, timeline, event log, check form
│   └── pages/                     # Overview, FloorPlan, RoomDetail, Drill, About, NotFound
```

## Pages

1. **Command Center** (`/`): metric cards, drill state, the "sitting still" story, floor selector, filterable room table (ML estimate and manual inspection in separate columns), replay timeline and event log.
2. **Floor Plan** (`/floor-plan`): fictional SVG schematic. Priority is shown by color **and** shape (octagon, triangle, slashed circle, dashed "?" and boxed check). Rooms are keyboard-focusable and show details on hover or click. The legend and watermark say *simulated*.
3. **Room Detail** (`/rooms/:id`): the "Unknown — physical verification required" note, provenance, the estimate with the zero caveat, uncalibrated scores, a CO₂ + slope chart, sensor panels (including PIR), the simulated check form and the audit trail.
4. **Drill Simulation** (`/drill`): start/end the simulated drill, playback controls, Pause → Guess → Reveal, historical CSV loader and simulator toggle.
5. **Model Limitations** (`/about`): dataset and model limits, the 62.59% miss rate, how the UI enforces safety, connection and schema details, and the 2-minute script.

## Acceptance checklist

| Requirement | How it's met | Verified by |
| --- | --- | --- |
| Zero prediction never sets "verified" | Reducer ignores estimates for inspections; no verified/clear state exists | `npm test` |
| No API connection shows an offline banner | `ConnectionBanner` (role=alert) plus an "Offline simulation" header badge | Stop the API and reload |
| Arabic switches to RTL | `<html dir="rtl" lang="ar">`, logical CSS properties, mirrored icons | Header language button |
| A stale reading can't look current | Freshness from replay age; hatched STALE badge, struck-through estimate | `npm test`, room A104 after step 30 |
| Historical replay is never "real-time" | "Not real-time" badge and dataset/simulated clock labels | Drill page, load a CSV |
| Probabilities are described as uncalibrated | Score card title and note | Room Detail |
| A manual check creates an audit log entry | `RECORD_INSPECTION` plus an event-log entry | `npm test`, Room Detail |
| No blank placeholder pages | All routes are fully built; empty, loading and error states included | Floor 2, unknown room ID, `/xyz` |

## Accessibility

Skip link; focus moves to `<main>` on navigation; landmarks and labeled navigation; every control is
keyboard operable (SVG rooms use `role=button`, Enter/Space); ARIA live regions for the replay clock,
events and toasts; status never relies on color alone (icons, shapes, text, hatching);
`prefers-reduced-motion` disables animations and chart transitions; layout works at 390 px with no
horizontal page scroll.

See **[../DEMO_SCRIPT.md](../DEMO_SCRIPT.md)** for the 2-minute walkthrough and the **[root README](../README.md)** for the FastAPI backend.
