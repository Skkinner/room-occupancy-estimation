# 2-minute demo script

**Setup (before class):** start the backend and the frontend (see the [README](./README.md#quick-start-windows--vs-code)).
The header should show **API connected**, and estimates should carry the teal **Model output (API)** badge.
If the API is down, the amber **Offline simulation** banner appears and estimates are labeled
**Demo simulator — not the model**. The demo still works; say so out loud.

> The room scenarios are **simulated** sensor readings for **fictional** rooms. In API mode those readings are
> scored by the **real trained Logistic Regression model**.

| Time | Screen | Say / do |
| --- | --- | --- |
| 0:00 | Any page | Point at the top banner: *"Research demo — not for life-safety decisions."* In a later January evaluation this model **missed 62.59% of occupied readings**. |
| 0:15 | Command Center | Walk through the four metric cards. *"Nothing is ever green. The best a room gets is 'Unconfirmed — physical check required'."* Read the story card: a lecture room is booked, but motion sensors can miss someone sitting still. |
| 0:30 | Command Center | Click **Start simulated drill**. The confirmation dialog says no alarm, notification or call is connected. Confirm, then press **Play** (2×). |
| 0:50 | Room A106 | **API mode:** open **A106 Study Room**. The real model estimates **0**, yet the scenario has one mostly-still person. **Offline mode:** use **A101** instead, where the simulator shows the same miss. *"Zero does not mean empty. That's why the primary note says physical verification is required."* Point at the **uncalibrated model scores** card. |
| 1:10 | Command Center / Floor Plan | Past step 30, **A104** turns **STALE** (hatched, age shown) and **A105** stays **Unavailable**. Both still demand a check. On the Floor Plan, priority is shown by shape and color, under a *simulated* watermark. |
| 1:25 | Room A103 | Record a simulated check: alias `Warden-7`, status *"Simulated check: no one found — not official clearance"*. Confirm the dialog, then show the toast, audit trail and event-log entry. |
| 1:45 | Drill Simulation | **Pause → Guess → Reveal** on A106 (or A101 offline): guess, then reveal the model estimate and the *scenario label (simulated, not measured truth)*. Click the language button to show the Arabic RTL layout. Close on **Model Limitations**. |

**Closing line:** *"The tool can help decide where to look first. It can never decide that a room is empty.
Always follow the official evacuation plan and emergency responders."*

## Optional: real historical replay

On the Drill page, load `data/Occupancy_Estimation.csv` (the UCI dataset, kept locally and not committed).
The chosen room switches to **Historical replay** with the dataset's own timestamps, and Reveal shows the
**recorded dataset label**. Start row `0` is the same reading as `models/example_input.json`, which the model
classifies as 1 occupant (≈ 99.6%).

## Optional: show API loss and recovery

Stop the backend (Ctrl+C) and press **Step forward**. The amber offline banner appears, with a **Retry connection**
button, and every estimate switches to the simulator label. Restart the backend: within about 15 s the
dashboard reconnects on its own and shows **Model output (API)** again.

## Measured behavior of the real model on the built-in scenarios

Sampled every 5 replay steps; read as estimate / scenario label.

| Room | Behavior |
| --- | --- |
| A101 lecture (1 still person) | 1 / 1 throughout |
| A102 seminar (3 → leave) | 1–2 / 3 while occupied (undercounts), then 0 / 0 |
| A103 storage (empty) | 0 / 0 |
| A104 lab (2, feed drops) | 2 / 2 until the feed stops, then STALE |
| A105 office | no readings, Unavailable |
| A106 study (1 mostly still) | **0 / 1, missed throughout** |
