"""
inject_anomalies.py

Takes a clean real-world time series and deliberately injects labeled
anomalies into it. The injected points/ranges are recorded as ground
truth — this is what the game scores player guesses against, and what
detect_anomalies.py is evaluated against too.

Anomaly types (deliberately mirror what a real BI analyst has to spot):
  - point_spike:    a single value jumps far above/below normal range
  - level_shift:    the series steps up/down and STAYS there
  - missing_gap:    a stretch of data goes missing/flat (e.g. tracking outage)
  - trend_break:    the slope of the trend changes abruptly

Usage:
    python inject_anomalies.py --input source_data/retail_sales.csv \
        --output ../levels/level_01.json --difficulty easy
"""

import argparse
import json
import random
from pathlib import Path

import numpy as np
import pandas as pd

ANOMALY_TYPES = ["point_spike", "level_shift", "missing_gap", "trend_break"]

DIFFICULTY_SETTINGS = {
    "easy":   {"n_anomalies": 1, "magnitude_mult": 3.0},
    "medium": {"n_anomalies": 2, "magnitude_mult": 2.0},
    "hard":   {"n_anomalies": 3, "magnitude_mult": 1.3},
}


def load_series(path: str, date_col: str = "date", value_col: str = "value") -> pd.DataFrame:
    df = pd.read_csv(path)
    df[date_col] = pd.to_datetime(df[date_col])
    df = df.sort_values(date_col).reset_index(drop=True)
    return df[[date_col, value_col]].rename(columns={date_col: "date", value_col: "value"})


def inject_point_spike(values: np.ndarray, idx: int, magnitude_mult: float, rng: random.Random) -> np.ndarray:
    std = values.std()
    direction = rng.choice([1, -1])
    values[idx] = values[idx] + direction * std * magnitude_mult * rng.uniform(2, 4)
    return values


def inject_level_shift(values: np.ndarray, idx: int, magnitude_mult: float, rng: random.Random) -> np.ndarray:
    std = values.std()
    direction = rng.choice([1, -1])
    shift = direction * std * magnitude_mult
    values[idx:] = values[idx:] + shift
    return values


def inject_missing_gap(values: np.ndarray, idx: int, gap_len: int = 5) -> np.ndarray:
    end = min(idx + gap_len, len(values))
    # Flatten to the value just before the gap, mimicking a stuck/broken tracker
    values[idx:end] = values[max(idx - 1, 0)]
    return values


def inject_trend_break(values: np.ndarray, idx: int, magnitude_mult: float, rng: random.Random) -> np.ndarray:
    slope = values.std() * magnitude_mult * 0.15
    direction = rng.choice([1, -1])
    ramp = np.arange(len(values) - idx) * slope * direction
    values[idx:] = values[idx:] + ramp
    return values


def inject_anomalies(df: pd.DataFrame, difficulty: str, seed: int | None = None) -> tuple[pd.DataFrame, list[dict]]:
    rng = random.Random(seed)
    np.random.seed(seed)

    settings = DIFFICULTY_SETTINGS[difficulty]
    values = df["value"].to_numpy(dtype=float).copy()
    n = len(values)

    # Keep anomalies away from the very start/end so there's context on both sides
    candidate_idxs = list(range(int(n * 0.15), int(n * 0.85)))
    rng.shuffle(candidate_idxs)
    chosen_idxs = candidate_idxs[: settings["n_anomalies"]]

    ground_truth = []
    for idx in chosen_idxs:
        anomaly_type = rng.choice(ANOMALY_TYPES)

        # NOTE: ground truth marks WHERE an anomaly begins, not every point
        # it affects afterward. A level shift or trend break changes every
        # subsequent value, but the thing a player (or analyst) should
        # actually flag is the moment it started -- scoring against the
        # full tail would demand dozens/hundreds of clicks for one real
        # anomaly, which doesn't match how anomaly-flagging works in
        # practice.
        if anomaly_type == "point_spike":
            values = inject_point_spike(values, idx, settings["magnitude_mult"], rng)
            affected_range = [idx, idx]
        elif anomaly_type == "level_shift":
            values = inject_level_shift(values, idx, settings["magnitude_mult"], rng)
            affected_range = [idx, idx]
        elif anomaly_type == "missing_gap":
            gap_len = rng.randint(3, 7)
            values = inject_missing_gap(values, idx, gap_len)
            affected_range = [idx, min(idx + gap_len, n - 1)]
        else:  # trend_break
            values = inject_trend_break(values, idx, settings["magnitude_mult"], rng)
            affected_range = [idx, idx]

        ground_truth.append({
            "type": anomaly_type,
            "start_index": affected_range[0],
            "end_index": affected_range[1],
            "date": df["date"].iloc[idx].strftime("%Y-%m-%d"),
        })

    out_df = df.copy()
    out_df["value"] = values
    return out_df, ground_truth


def build_level(input_path: str, output_path: str, difficulty: str, seed: int | None, level_name: str):
    df = load_series(input_path)
    injected_df, ground_truth = inject_anomalies(df, difficulty, seed=seed)

    level = {
        "level_name": level_name,
        "difficulty": difficulty,
        "source_file": Path(input_path).name,
        "series": [
            {"date": row["date"].strftime("%Y-%m-%d"), "value": round(float(row["value"]), 2)}
            for _, row in injected_df.iterrows()
        ],
        "ground_truth_anomalies": ground_truth,
    }

    out_path = Path(output_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(level, f, indent=2)

    print(f"Built {level_name} ({difficulty}) with {len(ground_truth)} anomalies -> {out_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Path to clean source CSV (date,value columns)")
    parser.add_argument("--output", required=True, help="Path to write the level JSON")
    parser.add_argument("--difficulty", choices=DIFFICULTY_SETTINGS.keys(), default="medium")
    parser.add_argument("--seed", type=int, default=None)
    parser.add_argument("--level-name", default="Untitled Level")
    args = parser.parse_args()

    build_level(args.input, args.output, args.difficulty, args.seed, args.level_name)
