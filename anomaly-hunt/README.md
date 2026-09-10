# 🔍 Anomaly Hunt

![License](https://img.shields.io/badge/license-MIT-blue)
![Stack](https://img.shields.io/badge/stack-React%20%7C%20Recharts%20%7C%20Python-blueviolet)

An open-source field-investigations game for practicing two real BI/analytics
skills: spotting anomalies in business data, and forecasting where a trend
goes next. Every case is procedurally generated in the browser — no two
playthroughs look the same — and every round is scored against real
statistical methods, not an arbitrary "correct answer."

**[Play the live demo →](#)** *(add your GitHub Pages link here after deploying)*

## Two investigations, one engine

Both modes are built on the same procedurally-generated business-metric
library (`web/src/game-logic/businessMetrics.js`) — seven metric templates
(revenue, active users, support tickets, defect rate, response time, ad
ROAS, churn rate), each randomized every time, so the underlying data
engine is shared rather than duplicated per mode.

### 🕵️ Anomaly Hunt
Five cases, 45 seconds each. A business metric is shown with 1–3 injected
anomalies (point spikes, level shifts, missing-data gaps, trend breaks).
Flag what looks wrong before time runs out. Scoring is **distance-based**:
a flag near the true anomaly earns partial credit that fades with
distance, not an all-or-nothing exact match. After each case, compare your
picks to three real statistical detectors (rolling z-score, IQR, a
seasonal-diff method) run against the same data.

### 📈 Forecast Call
Five rounds, no timer. See a real trend with the final stretch hidden,
predict the next value, and get scored by percentage error against what
actually happened. A different analytical skill than anomaly detection —
forecasting from a visible pattern — built on the exact same data engine.

### Progression
A lightweight local rank system (`web/src/game-logic/profile.js`) tracks
lifetime points across both modes and shows an "investigator rank" on the
home screen (Rookie Investigator → Master Detective) — purely cosmetic,
no effect on scoring, just a reason to come back.

## How it works

1. **Data generation** — happens entirely client-side, no backend, no
   pre-built files. Each mode's generator (`anomalyGenerator.js` /
   `forecastGenerator.js`) picks a random template, randomizes its
   parameters, and (for Anomaly Hunt) injects labeled anomalies.
2. **Large, forgiving click targets** — every data point in Anomaly Hunt
   has an invisible larger hit-circle under the visible dot, so you don't
   need pixel-perfect precision to flag a point.
3. **Distance/error-based scoring in both modes** — Anomaly Hunt uses a
   credit radius around each true anomaly; Forecast Call uses a
   percentage-error band. Both fade smoothly from full credit to zero
   rather than an exact-match cliff. See `docs/methodology.md` for the
   exact formulas.
4. **Statistical comparison** — after an Anomaly Hunt case, three
   lightweight detectors run against the same series so you can see where
   your judgment agreed or disagreed with a model.
5. Finish all rounds, save your score to a local leaderboard (kept
   separately per mode), and start a **new investigation** for entirely
   new data.

See [`docs/methodology.md`](docs/methodology.md) for the full statistical
reasoning behind both modes.

## Repo structure

```
anomaly-hunt/
├── data-pipeline/                   # Python reference implementation (see note below)
│   ├── source_data/                  # synthetic starter series
│   ├── generate_sample_data.py
│   ├── inject_anomalies.py
│   ├── detect_anomalies.py           # includes full STL decomposition via statsmodels
│   └── build_levels.py
├── web/                               # the game — fully self-contained
│   ├── src/game-logic/
│   │   ├── businessMetrics.js        # shared: RNG, templates, formatting -- used by both modes
│   │   ├── anomalyGenerator.js       # Anomaly Hunt: injects labeled anomalies
│   │   ├── forecastGenerator.js      # Forecast Call: hides the ending of a clean series
│   │   ├── scoring.js                # Anomaly Hunt distance-based scoring
│   │   ├── forecastScoring.js        # Forecast Call percentage-error scoring
│   │   ├── detectClient.js           # z-score / IQR / weekly-diff detectors
│   │   ├── leaderboard.js            # localStorage leaderboard, per mode
│   │   └── profile.js                # lifetime points + investigator rank
│   ├── src/components/
│   │   ├── HomeScreen.jsx            # mode selection + rank badge
│   │   ├── AnomalyHuntGame.jsx       # full Anomaly Hunt game loop
│   │   ├── ForecastCallGame.jsx      # full Forecast Call game loop
│   │   ├── ChartLevel.jsx            # Anomaly Hunt's interactive chart
│   │   └── ForecastChart.jsx         # Forecast Call's chart
│   └── src/App.jsx                   # thin router between home and the two modes
├── docs/methodology.md               # statistical reasoning behind both modes
├── .github/workflows/deploy.yml      # auto-deploys to GitHub Pages on push
└── LICENSE
```

## Getting started

**Quickest way — one script does everything:**

```bash
git clone https://github.com/<your-username>/anomaly-hunt.git
cd anomaly-hunt
./start.sh        # Mac/Linux
start.bat         # Windows (or just double-click the file)
```

**Or manually, same result:**

```bash
git clone https://github.com/<your-username>/anomaly-hunt.git
cd anomaly-hunt/web
npm install
npm run dev
```

Either way, both game modes generate their own data live in the browser
— **no Python step, no separate data-build step, nothing to run before
`npm run dev`.** That's different from an early version of this project,
which used pre-built Python-generated level files; that approach was
replaced when data generation moved fully client-side, and the old
build steps no longer apply.

Open the local dev URL Vite prints once either command finishes.

To deploy for real, push to `main` — the included GitHub Actions workflow
builds and deploys to GitHub Pages automatically (enable Pages in your
repo's Settings → Pages → Source: GitHub Actions).

## About the Python pipeline

`data-pipeline/` is kept as a **reference implementation**, not a build
dependency of the live game. It demonstrates the same anomaly-injection
and detection logic (plus a proper STL decomposition via `statsmodels`,
too heavy to ship to the browser) in a batch/notebook-friendly form.

```bash
cd data-pipeline
pip install -r requirements.txt
python generate_sample_data.py
python build_levels.py
```

## Known limitations

- **All data is synthetic**, generated procedurally in the browser — not
  real business data, and isn't claiming to be. The goal is realistic
  *shape* (seasonality, trend, noise), not real-world accuracy.
- The **weekly-seasonal-diff detector** (JS, live in the game) is a
  lightweight stand-in for proper seasonal decomposition — the Python
  reference implementation's full STL decomposition is more rigorous but
  too heavy for a browser.
- The **credit radius / error bands** are fixed values, not tuned per
  metric — every template gets the same tolerance regardless of its
  natural noise level.
- **Leaderboards and rank are local to one browser** (`localStorage`) —
  no identity, no cross-device sync.
- Forecast Call always predicts exactly one value 14 days past the
  visible window — no adjustable forecast horizon yet.

## What's in the app now

- **Anomaly Hunt** — 5 timed cases, distance-based scoring, and a full
  "Human vs Machine" comparison: toggleable chart layers let you show/hide
  your own flags, the true anomalies, and each of 3 statistical detectors
  independently, alongside a real precision/recall/F1 table (your score
  computed with the exact same methodology as the detectors, not a
  different metric dressed up to look comparable)
- **Forecast Call** — a 5-question multiple-choice forecasting challenge
  (direction, range, magnitude, pattern, or business-interpretation
  questions, randomly selected), with a confidence stake (low/medium/high)
  that amplifies both the reward for being right and the penalty for
  being wrong
- **Daily Challenge** — one deterministic, date-seeded case shared by
  everyone who plays that day, no backend required — the date itself is
  the random seed
- **Investigator profile** — real derived statistics (accuracy, false
  alarm rate, a "statistical reasoning" skill comparing your F1 to the
  average detector's) computed from actual per-case results, not
  hard-coded progress
- **Investigation history** — every completed case, either mode, logged
  locally with a sequential case ID

## Roadmap / good first issues

- [ ] Add more business-metric templates for even more variety
- [ ] Add a shared online leaderboard (small serverless function + DB)
- [ ] Add difficulty-adaptive level selection based on player performance
- [ ] Add an adjustable forecast horizon to Forecast Call
- [ ] Port an STL-quality seasonal decomposition to JS to replace the weekly-diff stand-in
- [ ] Add a third mode: a **Data Quality** challenge (spotting missing
  values, duplicates, invalid records, timestamp problems in synthetic
  tabular data) — deliberately not started yet, to keep the two existing
  modes the focus rather than spreading across three half-finished ones

Contributions welcome — open an issue or PR.

## License

MIT — see [LICENSE](LICENSE).
