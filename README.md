# 🔍 Anomaly Hunt

![License](https://img.shields.io/badge/license-MIT-blue)
![Stack](https://img.shields.io/badge/stack-React%20%7C%20Recharts%20%7C%20Python-blueviolet)

An open-source field-investigations game for practicing real BI/analytics
skills: spotting anomalies in business data, forecasting where a trend
goes next, and comparing your own judgement to real statistical methods.
Every case is procedurally generated in the browser — no two playthroughs
look the same.

**[Play the live demo →](#)** *(add your GitHub Pages link here after deploying)*

## Three investigations, one engine

All three modes are built on the same procedurally-generated
business-metric library (`web/src/game-logic/businessMetrics.js`) — seven
metric templates (revenue, active users, support tickets, defect rate,
response time, ad ROAS, churn rate), each randomized every time, so the
underlying data engine is shared rather than duplicated per mode.

### 🕵️ Anomaly Hunt
Five cases, 45 seconds each. A business metric is shown with 1–3 injected
anomalies (point spikes, level shifts, missing-data gaps, trend breaks).
Flag what looks wrong before time runs out. Scoring is **distance-based**:
a flag near the true anomaly earns partial credit that fades with
distance, not an all-or-nothing exact match (up to 6 flags per case).
After each case, compare your picks to three real statistical detectors
(rolling z-score, IQR, a seasonal-diff method) run against the same data,
with toggleable chart layers and a real precision/recall/F1 "Human vs
Machine" table — your score computed with the exact same methodology as
the detectors, not a different metric dressed up to look comparable.

### 📈 Forecast Call
Five rounds, no timer. See a real trend with the final stretch hidden,
then answer a multiple-choice question about what happens next —
direction, a numeric range, magnitude of change, pattern, or a
business-framed interpretation, picked at random each round. Every
option (the correct answer and the distractors) is computed from the
actual generated data, never hard-coded. Before locking in an answer,
you stake a confidence level (low/medium/high) that amplifies **both**
the reward for being right and the penalty for being wrong — the game
is testing calibrated judgement, not just correctness.

### 📅 Daily Challenge
One deterministic, date-seeded Anomaly Hunt case shared by everyone who
plays that day — the calendar date itself is the random seed, so no
backend or server-assigned puzzle is needed. One attempt per local day.

### Progression
A lightweight local rank system (`web/src/game-logic/profile.js`) tracks
lifetime points across all three modes and shows an "investigator rank"
on the home screen (Rookie Investigator → Master Detective), plus real
derived statistics (accuracy, false alarm rate, a "statistical
reasoning" skill comparing your F1 to the average detector's) — computed
from actual per-case results, never hard-coded progress. Every completed
case is also logged in a local investigation history with a sequential
case ID, and everything can be wiped from Profile → Danger zone if you
want a clean slate.

## How selecting a day works

Anomaly Hunt and Daily Challenge deliberately offer **three different
ways to flag a day**, since no single input method works equally well
for everyone:

1. **The chart** — click near a point; Recharts snaps to the nearest day
   and moves focus there (it does not flag by itself).
2. **The slider** below the chart — a native range input for dragging to
   an exact day with pinpoint accuracy, completely independent of any
   chart click-detection.
3. **The data table** — an expandable list of every day; because a row
   click is never ambiguous the way a chart click can be, clicking a row
   flags/unflags it directly in one action.

Moving focus (via the chart or slider) never flags anything by itself —
the Observation Panel's explicit "Flag this observation" button (or a
table row) is what actually commits a flag. That separation, plus the
6-flag cap, is deliberate: browsing around to compare candidates should
never risk accidentally racking up flags.

## How it works

1. **Data generation** — happens entirely client-side, no backend, no
   pre-built files. Each mode's generator (`anomalyGenerator.js` /
   `forecastGenerator.js` / `dailyChallenge.js`) picks a random template,
   randomizes its parameters, and (for Anomaly Hunt) injects labeled
   anomalies.
2. **Distance-based scoring in Anomaly Hunt, confidence-calibrated
   scoring in Forecast Call** — both fade smoothly rather than using an
   exact-match cliff or a flat right/wrong. See `docs/methodology.md`
   for the exact formulas, including how MCQ answers and distractors are
   generated and independently verified against the real data.
3. **Statistical comparison** — after an Anomaly Hunt case, three
   lightweight detectors run against the same series so you can see
   where your judgment agreed or disagreed with a model.
4. Finish all rounds, save your score to a local leaderboard (kept
   separately per mode), and start a **new investigation** for entirely
   new data.

See [`docs/methodology.md`](docs/methodology.md) for the full statistical
reasoning behind all three modes.

## Repo structure

```
anomaly-hunt/
├── data-pipeline/                     # Python reference implementation (see note below)
│   ├── source_data/                    # synthetic starter series
│   ├── generate_sample_data.py
│   ├── inject_anomalies.py
│   ├── detect_anomalies.py             # includes full STL decomposition via statsmodels
│   └── build_levels.py
├── web/                                 # the game — fully self-contained
│   ├── src/game-logic/
│   │   ├── businessMetrics.js          # shared: RNG, templates, formatting -- used by all 3 modes
│   │   ├── anomalyGenerator.js         # Anomaly Hunt: injects labeled anomalies
│   │   ├── forecastGenerator.js        # Forecast Call: builds the MCQ + distractors
│   │   ├── forecastScoring.js          # Forecast Call: confidence-calibrated scoring
│   │   ├── dailyChallenge.js           # date-seeded deterministic daily case
│   │   ├── scoring.js                  # Anomaly Hunt distance-based scoring + flag cap
│   │   ├── detectClient.js             # z-score / IQR / weekly-diff detectors
│   │   ├── chartTheme.js               # shared chart color constants
│   │   ├── leaderboard.js              # localStorage leaderboard, per mode
│   │   ├── profile.js                  # lifetime points, rank, derived stats
│   │   ├── history.js                  # per-case investigation history log
│   │   ├── resetData.js                # wipes all local game data
│   │   └── useCountUp.js               # animated score count-up hook
│   ├── src/components/
│   │   ├── HomeScreen.jsx              # mode selection, rank badge, daily card
│   │   ├── AnomalyHuntGame.jsx         # full Anomaly Hunt game loop
│   │   ├── ForecastCallGame.jsx        # full Forecast Call game loop
│   │   ├── DailyChallengeGame.jsx      # full Daily Challenge game loop
│   │   ├── ChartLevel.jsx              # Anomaly Hunt's chart (click-to-focus, layered reveal)
│   │   ├── ForecastChart.jsx           # Forecast Call's chart (cutoff + reveal)
│   │   ├── ObservationPanel.jsx        # focused-day panel, prev/next nav, day slider, flagged list
│   │   ├── DataTable.jsx               # alternate unambiguous row-based selection
│   │   ├── ScoreBoard.jsx / HintPanel.jsx
│   │   ├── ProfileScreen.jsx / HistoryScreen.jsx
│   │   └── ConfettiBurst.jsx           # lightweight celebratory burst, no dependency
│   └── src/App.jsx                     # thin router between home and the three modes
├── docs/methodology.md                 # statistical reasoning behind all three modes
├── .github/workflows/deploy.yml        # auto-deploys to GitHub Pages on push
├── start.sh / start.bat                # one-command local run (installs + starts dev server)
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

Either way, all three game modes generate their own data live in the
browser — **no Python step, no separate data-build step, nothing to run
before `npm run dev`.**

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
- The **credit radius (Anomaly Hunt) and confidence multipliers
  (Forecast Call)** are fixed values, not tuned per metric or per
  player.
- **Leaderboards, rank, and history are local to one browser**
  (`localStorage`) — no identity, no cross-device sync.
- Forecast Call always predicts 14 days past the visible window — no
  adjustable forecast horizon yet.

## Roadmap / good first issues

- [ ] Add more business-metric templates for even more variety
- [ ] Add a shared online leaderboard (small serverless function + DB)
- [ ] Add difficulty-adaptive level selection based on player performance
- [ ] Add an adjustable forecast horizon to Forecast Call
- [ ] Port an STL-quality seasonal decomposition to JS to replace the weekly-diff stand-in
- [ ] Add a third mode: a **Data Quality** challenge (spotting missing
  values, duplicates, invalid records, timestamp problems in synthetic
  tabular data) — deliberately not started yet, to keep the existing
  modes the focus rather than spreading across several half-finished ones

Contributions welcome — open an issue or PR.

## License

MIT — see [LICENSE](LICENSE).
