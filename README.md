# 🔍 Anomaly Hunt

![License](https://img.shields.io/badge/license-MIT-blue)
![Stack](https://img.shields.io/badge/stack-React%20%7C%20Vite%20%7C%20Motion%20%7C%20D3-blueviolet)

An open-source field-investigations game for practicing real BI/analytics
skills: spotting anomalies in business data, forecasting where a trend
goes next, and comparing your own judgement to real statistical methods.
Every case is procedurally generated in the browser — no two playthroughs
look the same, and no server ever sees your data.

**[Play the live demo →](#)** *(add your GitHub Pages link here after deploying)*

![Home screen — the case manifest, with a themed photo banner and the three modes listed as open cases](docs/screenshots/home.png)

### At a glance

- **Three modes, one shared engine** — Anomaly Hunt (timed), Forecast
  Call (untimed MCQ), Daily Challenge (one shared case a day) — plus a
  fourth way in: bring your own CSV/JSON instead of a generated case.
- **No backend, ever.** Every case is generated in your browser; your
  profile, rank, and match history live in `localStorage` only. Nothing
  you do here is ever sent anywhere.
- **Real statistics, not flavor text.** Three transparent anomaly
  detectors and a genuine precision/recall/F1 comparison against your
  own picks — see [`docs/methodology.md`](docs/methodology.md) for the
  reasoning behind every scoring and detection rule.
- **Tested and hardened**, not just demoed — a Vitest suite covers the
  engine layer (including regression tests for two real, measured bugs
  from development), CI runs that suite before every deploy, and the
  shipped page carries a strict Content-Security-Policy with zero
  relaxations.
- **Keyboard-accessible.** The chart itself — the core interaction — is
  fully operable without a mouse, with live-region announcements for
  screen readers.

### Contents

- [Look and feel](#look-and-feel)
- [Three investigations, one engine](#three-investigations-one-engine)
- [The interaction](#the-interaction)
- [How it works](#how-it-works)
- [Testing, reliability & security](#testing-reliability--security)
- [Repo structure](#repo-structure)
- [Getting started](#getting-started)
- [Known limitations](#known-limitations)
- [Roadmap / good first issues](#roadmap--good-first-issues)
- [License](#license)

## Look and feel

The whole app is framed as a fictional "Field Investigations Unit": a
persistent sidebar console instead of a page-per-screen layout, each
mode opening on a themed case-file banner (a real, credited photo with a
dark teal duotone treatment, never a raw stock-photo drop) and a short
in-world caption tying it back to the unit's story. Before a timed round
actually starts, a **ready screen** lets you read the case brief first —
the clock (Anomaly Hunt, Daily Challenge) never starts ticking until you
click through it, and even untimed Forecast Call gets the same calm
beat before the hidden data locks away. Switching screens in the sidebar
sweeps the new one in with a spring-based "swoosh" rather than a plain
fade.

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

![Anomaly Hunt mid-case — darts flagged on a trend-break and level-shift, with the day-over-day delta strip below the chart](docs/screenshots/anomaly-hunt-gameplay.png)

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

![Forecast Call — a friendly ghost standing in an illustrated fog bank over the hidden tail of the trend, with the MCQ options below](docs/screenshots/forecast-call.png)

### 📅 Daily Challenge
One deterministic, date-seeded Anomaly Hunt case shared by everyone who
plays that day — the calendar date itself is the random seed, so no
backend or server-assigned puzzle is needed. One attempt per local day.

### 📥 Bring your own data
Anomaly Hunt doesn't have to run on a procedurally-generated case — drop
in your own CSV or JSON file (date + numeric value columns, flexible
column-name aliases, tolerant of messy real-world exports including
quoted/thousands-separated numbers, capped at 5 MB) and the unit builds
a case on your real shape instead of a template. To be precise about
what that means: practice irregularities still get woven into your real
values the same way every other case is built — this isn't a tool for
surfacing anomalies that may already be in your data, it's your own
realistic baseline standing in for a template's. Everything stays in
your browser; nothing is uploaded anywhere.

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

![Profile screen — rank progress bar and the per-anomaly-type detection skill radar chart](docs/screenshots/profile.png)

## The interaction

The chart itself is the only input: **click a point to flag it, or
press and drag a dart onto the chart and release** — the dart follows
your cursor with real spring physics while held, and snaps to the
nearest day on release, reading its position back from the exact same
scale the line is drawn with, so "lands exactly on the curve" is
structural rather than something re-verified by hand per case. A second
tap on a flagged point removes it.

The same chart is fully keyboard-operable too: focus it and use **Left
/ Right to move between days, Enter or Space to flag or unflag the
focused one** — a live region announces the day, value, and flagged
state as you move, since the pointer path's visual hover readout alone
wouldn't reach a screen-reader user.

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

![Case review — the accuracy/penalty/speed-bonus breakdown next to the Human vs Machine precision/recall/F1 comparison table](docs/screenshots/anomaly-hunt-reveal.png)

## Testing, reliability & security

```bash
cd web
npm test          # run the suite once
npm run test:watch
```

**Tested.** The engine layer (`web/src/engine/*.js`) — the part that
actually has to be statistically correct — has a
[Vitest](https://vitest.dev) suite covering every module, including two
regression tests for defects that were real, measured bugs during
development and are exactly the kind of thing that could silently
reappear without a test catching them:

- **Self-inclusion bias in the rolling detectors** — a hand-computed
  scenario asserting a window never lets the point under test vouch for
  its own normalcy (see "Detection methods" in
  [`docs/methodology.md`](docs/methodology.md)).
- **The Forecast Call range-question band-width floor** — asserting the
  answer band can never collapse to a degenerate zero-width option on a
  metric pinned near its own floor.

The GitHub Actions deploy workflow runs this suite before every build —
a failing test blocks the deploy, it doesn't just sit unread locally.

**Resilient.** Each screen is lazy-loaded (`React.lazy`) and wrapped in
an error boundary, so a screen that fails to load — or throws — shows a
small in-theme recovery panel with a way back to Home instead of a
blank white screen.

**Hardened.** The shipped page carries a strict
[Content-Security-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
(`default-src 'self'`, no `unsafe-inline`, no `unsafe-eval`) as
defense-in-depth — there's no known XSS vector in the app today (no
`dangerouslySetInnerHTML`, `eval`, or raw `innerHTML` anywhere; every
user-facing string renders through React's auto-escaping JSX), but the
policy means a future regression would be blocked rather than exploited.
The CSV/JSON import path is capped at 5 MB to stop an oversized or
mis-selected file from freezing the tab, and the hand-rolled CSV parser
walks the string char-by-char rather than using regex, so there's no
ReDoS surface there either.

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
│   │   ├── dataImport.js               # parses an imported CSV/JSON series (quote-aware, 5 MB capped)
│   │   ├── profile.js / leaderboard.js / history.js   # localStorage persistence
│   │   ├── useFlagging.js / useCountdownTimer.js   # shared hooks behind Anomaly Hunt + Daily Challenge
│   │   └── *.test.js                   # vitest coverage for every file above — see Testing, reliability & security below
│   ├── src/charts/                     # hand-rolled d3-scale/d3-shape charts, no chart library
│   │   ├── useChartScales.js           # the ONE exact-domain scale every marker shares
│   │   ├── AnomalyChart.jsx            # press-drag-release dart (+ full keyboard path), detector overlay
│   │   ├── ForecastChart.jsx / ChartShadow.jsx   # cutoff + the fog-bank/ghost hidden-region reveal
│   │   ├── RadarSkillChart.jsx         # Profile's per-anomaly-type detection skill chart
│   │   └── ChartGrid.jsx / SeriesPath.jsx
│   ├── src/components/                 # shared design-system pieces (Button, Card, Pill, …)
│   │   ├── AppShell.jsx                # persistent sidebar + ambient background, mounted once
│   │   ├── ReadyGate.jsx               # the "read the brief, then start" pause before a round
│   │   ├── CaseRevealPanel.jsx         # the shared "case closed" block (stamp, breakdown, detector table)
│   │   ├── PageShell.jsx               # per-screen header, incl. the photo case-file banner
│   │   ├── ConfirmDialog.jsx / CommandPalette.jsx / ToastHub.jsx   # modal, ⌘K palette, achievement toasts
│   │   └── ErrorBoundary.jsx / ScreenLoader.jsx   # per-screen crash/chunk-load recovery + lazy-load fallback
│   ├── src/screens/                    # one folder per screen: Home, AnomalyHunt, ForecastCall,
│   │                                    #   DailyChallenge, Profile, History, Import
│   ├── src/assets/photos/              # credited Unsplash photos for each screen's case-file banner
│   ├── src/design/                     # tokens.css (incl. the global focus-ring), animations.css
│   ├── src/App.jsx                     # screen switcher, lazy-loaded per screen, page-transition shell
│   └── vite.config.js                  # also wires up the vitest test runner (`test` block)
├── docs/methodology.md                 # the statistical reasoning behind every scoring/detection rule
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
  (`localStorage`) — no identity, no cross-device sync. Note that
  `localStorage` is scoped per *origin*, not per repo: if you deploy
  other projects to GitHub Pages under the same account, they share
  this same storage namespace (keys here are prefixed `ah2-` to avoid
  accidental collisions, but that's not isolation).
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
