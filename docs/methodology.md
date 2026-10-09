# Methodology

This document explains the statistical reasoning behind Anomaly Hunt —
both game modes — so the project reads as a genuine analytics artifact,
not a black box.

## Anomaly types

Four anomaly types are injected (`web/src/engine/anomalies.js`), chosen
because they mirror what a BI analyst actually encounters in real
business data:

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
not just the location where the slope *begins* to change. Adding only a
growing slope from that point forward is mathematically zero deviation
exactly at the flagged index — the one point players are asked to find
would look completely normal. The fix adds an immediate step at the
changepoint (comparable in size to a level shift at the same difficulty)
on top of the continuing slope, so the point is a genuine local outlier
and the shape still reads as an accelerating trend afterward.

Anomaly positions are also spaced apart by more than twice the credit
radius (`pickAnomalyIndices()`), so a single flag can never sit within
credit range of two different anomalies at once — which would silently
double-count that one flag's credit.

## Detection methods

Three classic, transparent statistical methods are used
(`web/src/engine/detectors.js`) — deliberately not deep learning,
because the point of this project is to teach the *reasoning*, not to
chase state-of-the-art accuracy:

- **Rolling z-score**: flags points more than N standard deviations from
  a rolling local mean. Simple, fast, and a reasonable first pass — but
  it struggles with strong seasonality, since a normal seasonal peak can
  look like an outlier to a naive z-score.
- **Rolling IQR (interquartile range)**: flags points outside 1.5x the
  interquartile range of a rolling window. More robust to a few extreme
  values than z-score (since it doesn't use the mean/std directly), but
  shares the same seasonality blind spot.
- **Weekly seasonal diff**: compares each point to the same weekday ~7
  days earlier, then z-scores that difference. A lightweight stand-in
  for proper seasonal decomposition (e.g. STL) — cheap enough to run
  live in the browser with no extra dependency, aimed at catching
  anomalies that a naive z-score would miss inside normal seasonal
  peaks.

Every rolling method **excludes the point under test from its own
baseline window** (`windowExcluding()`). This matters more than it
sounds: on a small window, one strong outlier pulls the window's own
mean toward itself and inflates its own standard deviation, which can
push an obvious spike's z-score *below* threshold purely because it was
allowed to vouch for its own normalcy. Including the point under test
in its own baseline was measured to take point-spike recall from ~1% to
~84% once excluded — this is a correctness-critical detail, not a minor
tuning choice.

## Why the detectors sometimes disagree

This is intentional and left visible in the game, not smoothed over: a
level shift, for instance, often gets under-detected by rolling
z-score (after the first few points at the new level, the "rolling"
window has adjusted and stops flagging anything). The seasonal-aware
method tends to catch shifts more completely in seasonal data. Seeing
detectors disagree — and reasoning about *why* — is closer to real
analytical work than any single "correct" answer would be.

## Detector evaluation: event-based recall

`evaluateFlags()` (`web/src/engine/detectors.js`) scores both the
statistical detectors and the player's own flags — this is what powers
the "Human vs Machine" comparison table. Recall is computed **per
anomaly event**, not per index inside the tolerance window (default ±3):
an anomaly counts as found if at least one flag lands within its
tolerance range, regardless of how many nearby points also got flagged.

This matters because detector algorithms often flag several contiguous
points around a real anomaly, while a single click — human or otherwise
— naturally flags just one point. An index-level recall (dividing by
every index in the tolerance window) would structurally cap a perfect
human player's recall near 15–30%, even when they correctly identified
every anomaly, making the comparison unfair by construction rather than
a genuine test of judgement. Precision remains point-based (each
flagged index is individually judged as a hit or a false alarm), since
that correctly penalizes excess clicking regardless of interaction
style.

## Scoring definition

Scoring is **distance-based, not exact-match** (`web/src/engine/scoring.js`).
Every true anomaly has a credit radius (`CREDIT_RADIUS`, currently 10
index-units) around it:

- A flag exactly on the anomaly earns full credit for that anomaly.
- A flag within the radius earns credit that fades with distance — and
  because a dart throw can also miss vertically, the fade is a genuine
  2D circular falloff combining how many days off *and* how far off in
  value the flagged point was.
- A flag outside every anomaly's radius earns nothing and counts as a
  false alarm, applying a small penalty.
- Only the *closest* flag counts toward each anomaly, so flagging
  several nearby points doesn't stack credit.

This is deliberately more forgiving than exact-match scoring: the game
is testing whether you noticed the right *neighborhood* of the chart,
not whether you can click one specific day among ninety.

**A design choice worth being upfront about**: ground truth marks *where
an anomaly begins*, not every point it affects afterward. A level shift
or trend break technically changes every subsequent value in the series,
but scoring against that entire tail would demand dozens of correct
clicks for one real anomaly — which doesn't match how anomaly-flagging
works in practice (an analyst flags *the moment something changed*, not
every day it stays changed).

A player can flag at most 6 points per case (`MAX_FLAGS_PER_CASE` in
`scoring.js`) — well above any difficulty's true anomaly count (max 3,
on "hard"). This exists purely as a safety net for the UI, not the
scoring model itself: flagging is a deliberate action separate from
browsing the chart, and without a cap, repeatedly flagging while
exploring could silently rack up dozens of flags with no analytical
value and no warning.

## Forecast Call: how the MCQ is generated

Forecast Call doesn't ask for a free-text prediction — it's a multiple-
choice question, and every part of it is computed from the actual
generated series, never hard-coded (`web/src/engine/forecast.js`). The
series is split at a fixed fraction (70% visible, 30% hidden); the
hidden tail is what the question is actually about.

Five question types exist, one picked at random each round:

- **Direction** — does the series trend up, down, or stay flat by the
  end of the hidden tail?
- **Range** — which of three sequential numeric bands will the final
  value land in? The band width is floored (`Math.max(...)`) so it can
  never collapse to a degenerate zero-width option near a metric's
  physical floor — e.g. a defect rate pinned near 0% — which would
  otherwise make a band question unanswerable by construction.
- **Magnitude** — is the move by the end small (<5%), moderate
  (5–20%), or large (>20%)?
- **Pattern** — does the hidden tail keep moving steadily in one
  direction, swing and revert near where it started, or stay choppy
  with no clear direction?
- **Business framing** — from a business standpoint, does the metric
  improve, worsen, or hold steady? This is the one question type that
  depends on which direction is actually "good" for a given metric —
  lower is better for defect rate, response time, support tickets, and
  churn rate, while higher is better for everything else
  (`LOWER_IS_BETTER` in `forecast.js`). Using the chart's display
  *unit* instead of the metric's identity here was a real bug caught
  during this rebuild: `percent` covers both defect rate and churn rate
  (both lower-is-better), and `count` covers both active users
  (higher-is-better) and support tickets (lower-is-better) — the unit
  alone can't tell you which direction is good.

## Forecast Call: confidence-calibrated scoring

Before locking in an answer, the player declares Low/Medium/High
confidence (`web/src/engine/scoring.js`). This isn't decorative — it
multiplies **both** the reward for being right and the penalty for
being wrong:

| Confidence | Correct | Incorrect |
|---|---|---|
| Low (0.8×) | +80 | −16 |
| Medium (1.0×) | +100 | −20 |
| High (1.3×) | +130 | −26 |

A high-confidence wrong answer costs more than a low-confidence wrong
answer — the game is rewarding *calibrated* judgement (knowing when
you're actually sure), not just correctness.

Forecast Call has no timer — it's testing a different skill (reading a
trend and reasoning about where it goes) than Anomaly Hunt's timed
pattern-spotting, and rushing a forecast call doesn't reflect real
analytical judgement the way it might for spotting an obvious outlier.

## Extending this project

- Add a new anomaly type by extending `web/src/engine/anomalies.js`
- Add a new business-metric template to `metrics.js`'s
  `METRIC_TEMPLATES` array — all three modes pick it up automatically
- Add a new detection method by extending `detectors.js`
- Add a new question type to Forecast Call by extending `forecast.js`'s
  `FORECAST_QUESTION_TYPES` and its matching builder function
