# Methodology

This document explains the statistical reasoning behind Anomaly Hunt —
both game modes — so the project reads as a genuine analytics artifact,
not a black box.

## Anomaly types

Four anomaly types are injected, chosen because they mirror what a BI
analyst actually encounters in real business data:

| Type | What it looks like | Real-world example |
|---|---|---|
| **Point spike** | A single value jumps far from normal, then returns | A data entry error, a one-day promo spike |
| **Level shift** | The series steps to a new baseline and stays there | A pricing change, a new marketing channel going live |
| **Missing gap** | A stretch of flat/stuck values | A tracking pixel or sensor going down |
| **Trend break** | The slope of the series changes abruptly | A product going viral, a market shock |

Ground truth is recorded as a single index (the moment the anomaly
starts), not a range — see "Scoring definition" below for why.

**A correctness note worth being explicit about**: for a `trend_break`,
the flagged point must itself be visibly different from its neighbors —
not just the location where the slope *begins* to change. An earlier
version only added a growing slope from that point forward, which is
mathematically zero deviation exactly at the flagged index — the one
point players were asked to find looked completely normal. The fix adds
an immediate step at the changepoint (comparable in size to a level
shift at the same difficulty) on top of the continuing slope, so the
point is a genuine local outlier and the shape still reads as an
accelerating trend afterward.

## Detection methods

Three classic, transparent statistical methods are used — deliberately
not deep learning, because the point of this project is to teach the
*reasoning*, not to chase state-of-the-art accuracy. The live game runs
a JavaScript version of each (`web/src/game-logic/detectClient.js`); the
Python reference implementation (`data-pipeline/detect_anomalies.py`)
includes a fuller version of the third method:

- **Rolling z-score**: flags points more than N standard deviations from
  a rolling local mean. Simple, fast, and a reasonable first pass — but
  it struggles with strong seasonality, since a normal seasonal peak can
  look like an outlier to a naive z-score.
- **IQR (interquartile range)**: flags points outside 1.5x the
  interquartile range of a rolling window. More robust to a few extreme
  values than z-score (since it doesn't use the mean/std directly), but
  shares the same seasonality blind spot.
- **Seasonal method**: in the browser, a lightweight **weekly-difference
  z-score** (compares each point to the same weekday ~7 days earlier,
  then z-scores that difference) stands in for proper seasonal
  decomposition — cheap to run client-side with no dependency. The
  Python reference implementation uses a full **STL decomposition**
  (trend + seasonal + residual via `statsmodels`), which is more
  rigorous but too heavy to ship to a browser. Both aim at the same
  goal: catch anomalies that a naive z-score would miss inside normal
  seasonal peaks.

## Why the detectors sometimes disagree

This is intentional and left visible in the game, not smoothed over: a
level shift, for instance, often gets under-detected by rolling z-score
(after the first few points at the new level, the "rolling" window has
adjusted and stops flagging anything). The seasonal-aware method tends
to catch shifts more completely in seasonal data. Seeing detectors
disagree — and reasoning about *why* — is closer to real analytical work
than any single "correct" answer would be.

## Scoring definition

Scoring is **distance-based, not exact-match**. Every true anomaly has a
credit radius (`CREDIT_RADIUS`, currently 6 index-units, in
`web/src/game-logic/scoring.js`) around it:

- A flag exactly on the anomaly earns full credit for that anomaly.
- A flag within the radius earns credit that fades linearly with
  distance — a flag 3 days off (half the radius) earns half credit.
- A flag outside every anomaly's radius earns nothing and counts as a
  false alarm, applying a small penalty.
- Only the *closest* flag counts toward each anomaly, so clicking
  several nearby points doesn't stack credit.

This replaced an earlier exact-match design (still used by the Python
reference implementation's precision/recall/F1 evaluation, run with a
small ±3 tolerance window instead of a smooth radius) — the exact-match
version made dense charts feel unfairly punishing, since a click one day
off from a 90-point series counted as a total miss. The distance-based
version is deliberately more forgiving: the game is testing whether you
noticed the right *neighborhood* of the chart, not whether you can click
one specific day among ninety.

**A design choice worth being upfront about**: ground truth marks *where
an anomaly begins*, not every point it affects afterward. A level shift
or trend break technically changes every subsequent value in the series,
but scoring against that entire tail would demand dozens of correct
clicks for one real anomaly — which doesn't match how anomaly-flagging
works in practice (an analyst flags *the moment something changed*, not
every day it stays changed).

## Forecast Call: scoring definition

Forecast Call scores by **percentage error**, not distance in an index:

- Error at or under 5% earns full credit for the round.
- Error at or over 40% earns nothing.
- Between those, credit fades linearly (`web/src/game-logic/forecastScoring.js`).

The same "full credit near the target, fading to zero, no exact-match
cliff" philosophy as Anomaly Hunt's distance-based scoring — just
measured in percent-of-value instead of chart-index distance, since a
forecast for a $50,000/day revenue series and a 2%/day churn series need
fundamentally different absolute tolerances, but the *same* relative one.

Forecast Call intentionally has no injected anomalies and no timer — it
tests a different skill (reading a trend and extrapolating it) using the
same underlying template library as Anomaly Hunt, with the final 14 days
of a clean series hidden rather than corrupted.

## Extending this project

- Add a new anomaly type (e.g. seasonal amplitude change) by extending
  `web/src/game-logic/anomalyGenerator.js` (and its Python counterpart,
  `data-pipeline/inject_anomalies.py`, if you want it in the reference
  implementation too)
- Add a new business-metric template to `businessMetrics.js`'s
  `TEMPLATES` array — both game modes pick it up automatically
- Add a new detection method by extending `detectClient.js`
  (JS, used live) or `detect_anomalies.py` (Python, reference)
- Add a new game mode by writing a new generator alongside
  `anomalyGenerator.js` / `forecastGenerator.js` that reuses
  `businessMetrics.js`'s `pickTemplate()` and `TEMPLATES`
