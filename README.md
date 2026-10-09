# 🔍 Anomaly Hunt

![License](https://img.shields.io/badge/license-MIT-blue)
![Stack](https://img.shields.io/badge/stack-React%20%7C%20Vite%20%7C%20Motion%20%7C%20D3-blueviolet)

An open-source field-investigations game for practicing real BI/analytics
skills: spotting anomalies in business data, forecasting where a trend
goes next, and comparing your own judgement to real statistical methods.
Every case is procedurally generated in the browser — no two playthroughs
look the same, and no server ever sees your data.

**[Play the live demo →](#)** *(add your GitHub Pages link here after deploying)*

## Three investigations, one engine

All three modes are built on the same procedurally-generated
business-metric library (`web/src/engine/metrics.js`) — seven metric
templates (revenue, active users, support tickets, defect rate, response
time, ad ROAS, churn rate), each randomized every time, so the underlying
data engine is shared rather than duplicated per mode.

### 🕵️ Anomaly Hunt
Five cases, 45 seconds each. A business metric is shown with 1–3 injected
anomalies (point spikes, level shifts, missing-data gaps, trend breaks).
Click, or press-drag-release a dart onto the chart to flag what looks
wrong before time runs out. Scoring is **distance-based**: a flag near
the true anomaly earns partial credit that fades with distance — both in
days and in value — not an all-or-nothing exact match (up to 6 flags per
case). After each case, compare your picks to three real statistical
detectors (rolling z-score, rolling IQR, a weekly-seasonal-diff method)
run against the same data, with a real precision/recall/F1 "Human vs
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
A lightweight local rank system (`web/src/engine/profile.js`) derives
lifetime stats purely from your match history (`web/src/engine/history.js`)
— total score, hunt/forecast accuracy, best forecast streak, daily
streak, and per-anomaly-type detection skill — and shows an analyst rank
on the home screen (Rookie Analyst → Chief Investigator). Everything is
a live projection of the history log, never stored separately, so it can
never drift out of sync. History and local-only "personal best" boards
(`leaderboard.js`) live entirely in `localStorage`; clearing it from the
History screen gives you a clean slate.

## The interaction

The chart itself is the only input: **click a point to flag it, or
press and drag a dart onto the chart and release** — the dart follows
your cursor with real spring physics while held, and snaps to the
nearest day on release, reading its position back from the exact same
scale the line is drawn with, so "lands exactly on the curve" is
structural rather than something re-verified by hand per case. A second
tap on a flagged point removes it.

## How it works

1. **Data generation** — happens entirely client-side, no backend, no
   pre-built files. Each mode's generator (`case.js` / `forecast.js` /
   `daily.js`) picks a random metric template, randomizes its
   parameters, and (for Anomaly Hunt) injects labeled anomalies spaced
   far enough apart that no single flag can double-count credit.
2. **Distance-based scoring in Anomaly Hunt, confidence-calibrated
   scoring in Forecast Call** — both fade smoothly rather than using an
   exact-match cliff or a flat right/wrong.
3. **Statistical comparison** — after an Anomaly Hunt case, three
   lightweight detectors run against the same series, with the point
   under test always excluded from its own baseline window (a naive
   rolling window otherwise lets one strong outlier vouch for its own
   normalcy), so you can see where your judgment agreed or disagreed
   with a transparent model.
4. Finish all rounds and the session score is broken down case by case,
   then logged to your local match history.

## Repo structure

```
anomaly-hunt/
├── web/                                 # the game — fully self-contained
│   ├── src/engine/                     # the game's logic, zero UI code
│   │   ├── rng.js                      # seedable PRNG (mulberry32) + Gaussian sampler
│   │   ├── metrics.js                  # business-metric templates, formatting, unit floors
│   │   ├── anomalies.js                # injects labeled anomalies (spaced to avoid double credit)
│   │   ├── detectors.js                # z-score / IQR / weekly-diff, self-exclusion built in
│   │   ├── scoring.js                  # Anomaly Hunt distance-based + Forecast confidence scoring
│   │   ├── case.js                     # builds one playable round from a template or imported data
│   │   ├── daily.js                    # date-seeded deterministic Daily Challenge
│   │   ├── forecast.js                 # Forecast Call: builds the MCQ + distractors
│   │   ├── dataImport.js               # parses an imported CSV/JSON series
│   │   └── profile.js / leaderboard.js / history.js   # localStorage persistence
│   ├── src/charts/                     # hand-rolled d3-scale/d3-shape charts, no chart library
│   │   ├── useChartScales.js           # the ONE exact-domain scale every marker shares
│   │   ├── AnomalyChart.jsx            # press-drag-release dart, reveal layers, detector overlay
│   │   ├── ForecastChart.jsx           # cutoff fog panel + scanline reveal
│   │   └── ChartGrid.jsx / SeriesPath.jsx
│   ├── src/components/                 # shared design-system pieces (Button, Card, Pill, …)
│   ├── src/screens/                    # one folder per screen: Home, AnomalyHunt, ForecastCall,
│   │                                    #   DailyChallenge, Profile, History, Import
│   ├── src/design/                     # tokens.css, animations.css
│   └── src/App.jsx                     # screen switcher + page-transition shell
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
browser — nothing to run before `npm run dev`.

Open the local dev URL Vite prints once either command finishes.

To deploy for real, push to `main` — the included GitHub Actions workflow
builds and deploys to GitHub Pages automatically (enable Pages in your
repo's Settings → Pages → Source: GitHub Actions).

## Known limitations

- **All data is synthetic**, generated procedurally in the browser — not
  real business data, and isn't claiming to be. The goal is realistic
  *shape* (seasonality, trend, noise), not real-world accuracy.
- The **weekly-seasonal-diff detector** is a lightweight stand-in for
  proper seasonal decomposition (e.g. STL) — simple enough to run live
  in the browser, not a research-grade method.
- The **credit radius (Anomaly Hunt) and confidence multipliers
  (Forecast Call)** are fixed values, not tuned per metric or per
  player.
- **Profile, history, and personal bests are local to one browser**
  (`localStorage`) — no identity, no cross-device sync.
- Forecast Call always forecasts the same fixed fraction of the series —
  no adjustable forecast horizon yet.

## Roadmap / good first issues

- [ ] Add more business-metric templates for even more variety
- [ ] Add a shared online leaderboard (small serverless function + DB)
- [ ] Add difficulty-adaptive level selection based on player performance
- [ ] Add an adjustable forecast horizon to Forecast Call
- [ ] Port a higher-fidelity seasonal decomposition to JS
- [ ] Add a third mode: a **Data Quality** challenge (spotting missing
  values, duplicates, invalid records, timestamp problems in synthetic
  tabular data) — deliberately not started yet, to keep the existing
  modes the focus rather than spreading across several half-finished ones

Contributions welcome — open an issue or PR.

## License

MIT — see [LICENSE](LICENSE).
