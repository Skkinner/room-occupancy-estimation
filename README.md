# Is Anyone There? — AI-Assisted Emergency Occupancy Monitoring

> **RESEARCH DEMO — NOT FOR LIFE-SAFETY DECISIONS / نموذج تجريبي — لا يُستخدم لاتخاذ قرارات سلامة الأرواح**
>
> The model **missed ~62.59% of occupied readings** in its January evaluation session. An AI estimate can never
> establish that a room is empty, safe, or evacuated. Every room requires physical verification under the
> site's official procedures.

A machine-learning class project that estimates how many people are in a room (0–3) from environmental sensors
(temperature, light, sound, CO₂, motion), without cameras. A React dashboard uses those estimates during a
**simulated** evacuation drill to help a building security coordinator prioritize which rooms to sweep
manually.

| | |
| --- | --- |
| Dataset | [UCI Room Occupancy Estimation (#864)](https://archive.ics.uci.edu/dataset/864/room+occupancy+estimation), one room, Dec 2017 – Jan 2018 |
| Target | `Room_Occupancy_Count`, classes 0, 1, 2, 3 |
| Model | Tuned Logistic Regression (`C ≈ 1.013`) in a fitted sklearn `Pipeline(StandardScaler → LogisticRegression)` |
| Features | Feature Set C, 16 sensor features (see `/schema`) |
| Serialization | joblib, scikit-learn **1.6.1** |

---

## Architecture

```
 React (Vite, :5173)                         FastAPI (:8000)                       models/
 ─────────────────────                       ───────────────                       ───────
 GET /health   ───────────────────────────▶  model_loaded? ◀──── startup checks ── model.joblib
 GET /schema   ───────────────────────────▶  16 ordered features, classes          features.joblib
 POST /predict {16 sensor values} ────────▶  pandas DataFrame (training order)     metadata.json
               ◀── estimated_count, probabilities, requires_manual_verification=true
 Offline simulation (labeled) when the API or model is unavailable; auto-reconnect every 15 s
```

- **Backend** (`backend/`) loads the trained pipeline once at startup and validates it: 16 features, the order
  matches `features.joblib`, `metadata.json` and the pipeline's `feature_names_in_`, `predict` and `predict_proba`
  exist, and the classes are `[0,1,2,3]`. If any check fails, the API reports `model_unavailable` and returns
  **503** instead of predicting. It never retrains, refits or falls back to fake output.
- **Frontend** (`frontend/`) has an EN/AR (RTL) dashboard with a Command Center, Floor Plan, Room Detail, Drill
  Simulation and Model Limitations page. The ML estimate and the manual inspection status are separate, and
  nothing the model returns can mark a room clear. See [frontend/README.md](frontend/README.md).

## Folder structure

```
room-occupancy-estimation/
├── backend/
│   ├── main.py               # FastAPI app factory + routes (/health, /schema, /predict)
│   ├── config.py             # env-based settings, project-root-relative paths, CORS origins
│   ├── schemas.py            # Pydantic request/response models (strict 16-feature input)
│   ├── services/prediction.py# artifact loading, startup validation, inference
│   └── tests/                # pytest + TestClient (real model; fail clearly if artifacts missing)
├── frontend/                 # React 18 + TypeScript + Vite + Tailwind + Recharts
│   ├── src/ …                # see frontend/README.md
│   ├── package.json
│   └── .env.example          # VITE_API_URL
├── models/                   # trained artifacts exported from the notebook (committed; ~4 KB)
│   ├── model.joblib  features.joblib  metadata.json
│   └── example_input.json  example_output.json
├── data/                     # put Occupancy_Estimation.csv here (git-ignored)
├── notebooks/                # training / evaluation notebooks
├── requirements.txt
├── pytest.ini
├── .env.example              # backend settings
├── README.md
└── DEMO_SCRIPT.md            # 2-minute class walkthrough
```

## Requirements

- **Python 3.11–3.13** (tested with 3.13.14 on Windows 11)
- **Node.js 18+** (tested with Node 24, npm 11)
- Google Chrome or Edge

## Quick start (Windows / VS Code)

Open the project folder in VS Code and use two PowerShell terminals.

### 1. Backend (terminal 1, project root)

```powershell
py -m venv .venv                  # or: python -m venv .venv  (if `python` is on your PATH)
.\.venv\Scripts\Activate.ps1      # if blocked: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
python -m pip install -r requirements.txt
python -m uvicorn backend.main:app --reload
```

The backend runs at **http://localhost:8000**. Interactive docs are at http://localhost:8000/docs. The log should show
`Model loaded: Logistic Regression (16 features, classes [0, 1, 2, 3], …)`.

> On some Windows machines `python` opens the Microsoft Store. Use `py` to create the venv; after activation,
> `python` refers to the venv.

### 2. Frontend (terminal 2)

```powershell
cd frontend
npm install
copy .env.example .env            # VITE_API_URL=http://localhost:8000 (the default; this step is optional)
npm run dev
```

The frontend runs at **http://localhost:5173**. The header shows **API connected**, and estimates carry a
**Model output (API)** badge. Add `?lang=ar` for Arabic.

### Configuration

| Variable | Where | Default | Purpose |
| --- | --- | --- | --- |
| `VITE_API_URL` | `frontend/.env` | `http://localhost:8000` | Backend base URL |
| `OCCUPANCY_MODELS_DIR` | env / `.env.example` | `models` | Artifact folder (relative to the project root) |
| `OCCUPANCY_CORS_ORIGINS` | env | *(empty)* | Extra comma-separated origins. `http://localhost:5173` and `http://127.0.0.1:5173` are always allowed |
| `OCCUPANCY_LOG_LEVEL` | env | `INFO` | Server log level |

The backend reads these from the process environment. Set them in PowerShell before starting uvicorn, e.g.
`$env:OCCUPANCY_CORS_ORIGINS="http://192.168.1.20:5173"`.

## API

### `GET /health`

```json
{ "status": "ok", "model_loaded": true, "model": "Logistic Regression",
  "model_id": "logreg-featureC-2e10ea04440a", "n_features": 16, "api_version": "1.0.0", "mode": "research_demo", "detail": null }
```
If the artifacts are missing or invalid, it returns `"status": "model_unavailable", "model_loaded": false` with a short
`detail` (no server paths). The frontend then stays in labeled offline simulation.

### `GET /schema`

```json
{ "features": ["S1_Temp","S2_Temp","S3_Temp","S4_Temp","S1_Light","S2_Light","S3_Light","S4_Light",
               "S1_Sound","S2_Sound","S3_Sound","S4_Sound","S5_CO2","S5_CO2_Slope","S6_PIR","S7_PIR"],
  "n_features": 16, "target": "Room_Occupancy_Count", "classes": [0,1,2,3],
  "model": "Logistic Regression", "model_id": "logreg-featureC-2e10ea04440a", "feature_set": "C",
  "api_version": "1.0.0", "mode": "research_demo", "probabilities_calibrated": false }
```
Returns 503 if the model is unavailable.

### `POST /predict`

The request body must be exactly the 16 features: numbers only, finite, with no extra fields.

```powershell
curl.exe -X POST http://localhost:8000/predict -H "Content-Type: application/json" --data "@models/example_input.json"
```

Real response from the saved model for `models/example_input.json` (the first row of the dataset):

```json
{
  "estimated_count": 1,
  "estimated_occupied": true,
  "probabilities": { "0": 0.00372, "1": 0.99565, "2": 0.00063, "3": 2.3e-15 },
  "model": "Logistic Regression",
  "mode": "research_demo",
  "requires_manual_verification": true,
  "safety_status": "UNKNOWN_REQUIRES_PHYSICAL_VERIFICATION",
  "safety_notice": "Research demo. AI predictions cannot establish that a room is empty, safe, or evacuated. …",
  "timestamp": "2026-11-15T18:43:37+00:00"
}
```
Probabilities are shortened above; the API returns full floats. They are **uncalibrated model scores**.

| Status | When |
| --- | --- |
| 422 | Missing feature, non-numeric value (strings and booleans included), NaN/Infinity, unknown field, malformed JSON |
| 503 | Model not loaded. **No prediction is made** |
| 500 | Unexpected inference failure. Generic message only; details go to the server log |

## Testing

```powershell
# Backend (project root, venv active) — uses the REAL model artifacts
python -m pytest

# Frontend
cd frontend
npm test
npm run build
```

| Suite | Covers |
| --- | --- |
| `backend/tests/test_health.py` | Model loaded vs unavailable vs corrupt artifacts, no path leakage, CORS allow/deny |
| `backend/tests/test_schema.py` | 16 ordered features equal `features.joblib`, `metadata.json` and the pipeline's `feature_names_in_`; classes; 503 when unavailable |
| `backend/tests/test_predict.py` | Valid prediction, **notebook consistency** (`example_input.json` → `example_output.json`, tolerance 1e-3), 422 for missing / wrong type / NaN / Inf / unknown fields / malformed JSON, probabilities finite and summing to 1, a zero estimate still requires verification, no "safe/clear" fields, 503 and controlled 500 with no fabricated output |
| `frontend/src/state/acceptance.test.ts` | Zero estimate never changes inspection status, stale/unavailable logic, labels, CSV replay, backend contract parsing, EN/AR key parity |

If `models/` is missing any artifact, the backend tests **fail** with `BLOCKED: real model artifacts missing`.
They never substitute mock results.

## Bilingual frontend

The dashboard has full English and Arabic dictionaries (`frontend/src/i18n`) with parity enforced by TypeScript
and a unit test. Switching to Arabic sets `<html dir="rtl" lang="ar">` and mirrors the layout using logical CSS
properties. The safety banner is always shown in both languages.

## Model limitations

- Trained on **one room** (UCI #864). The multi-room building in the dashboard is fictional.
- **Missed ~62.59% of occupied readings** in the January evaluation session. It generalizes poorly to the
  January low-light occupancy conditions.
- The January test period was used repeatedly during development, so its results are optimistic. January has no
  class-1 (single-occupant) examples.
- Probabilities are **not calibrated**, and there is **no certification** of any kind.
- There is **no live sensor feed**. The dashboard replays simulated readings or a historical CSV.
- On the built-in simulated scenarios, the real model misses a mostly-still single occupant (A106) and undercounts a
  group of three (A102). See [DEMO_SCRIPT.md](DEMO_SCRIPT.md).

## Safety design (non-negotiable)

1. The ML estimate and the manual inspection status are separate. Only an explicit, confirmed, **simulated**
   staff check changes the inspection status, and it is written to an audit trail.
2. A zero estimate never marks a room cleared, safe or evacuated. No such state exists in the API or the UI.
3. The API always returns `requires_manual_verification: true` and `safety_status: UNKNOWN_REQUIRES_PHYSICAL_VERIFICATION`.
4. Missing data is labeled **Unavailable**; old data is labeled **Stale**, with its age shown.
5. Simulated data is labeled *simulated*, historical data *historical replay*, and nothing is labeled real-time.
6. There is no connection to alarms, notifications, dispatch or any real evacuation action. The drill is a button in the UI.
7. When the API or model is unavailable, estimates are visibly labeled **Demo simulator — not the model**. Real and
   simulated outputs are never mixed under the same label.

## Team contribution guide

- Branch from `main` (`feature/<short-name>`) and open a pull request. Don't push directly to `main`.
- Before a PR, run `python -m pytest`, then in `frontend/` run `npm test` and `npm run build`. All must pass.
- **Never** retrain or overwrite files in `models/` without updating `example_output.json` from the notebook
  and re-running the consistency test. Keep scikit-learn pinned to the version the model was saved with.
- Add every new UI string to **both** `frontend/src/i18n/en.ts` and `ar.ts`; the build fails otherwise.
- Don't add any UI or API state that implies a room is clear or safe.
- Don't commit `.env`, `.venv/`, `node_modules/`, `dist/` or the dataset CSV.

## Demo

See **[DEMO_SCRIPT.md](DEMO_SCRIPT.md)** for the 2-minute walkthrough.
