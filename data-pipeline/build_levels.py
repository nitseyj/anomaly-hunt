"""
build_levels.py

The main pipeline entrypoint: for each source dataset, injects anomalies,
runs all three statistical detectors against the result (to both sanity
check the level is fair, and to precompute the "here's what a model would
have flagged" reveal), and writes a single game-ready level JSON.

Each level also carries business context (a short scenario brief, axis
label, and unit) so the game shows a meaningful chart, not just an
unlabeled line -- this is what makes it read as a business analytics
exercise rather than an abstract puzzle.

Usage:
    python build_levels.py
"""

import json
from pathlib import Path

import numpy as np

from inject_anomalies import load_series, inject_anomalies, DIFFICULTY_SETTINGS
from detect_anomalies import run_all_detectors, evaluate_against_ground_truth

SOURCE_DIR = Path(__file__).parent / "source_data"
LEVELS_DIR = Path(__file__).parent.parent / "levels"
LEVELS_DIR.mkdir(parents=True, exist_ok=True)

# Each entry: source file, display title, business scenario brief,
# y-axis label, difficulty, and a random seed (for reproducible levels).
LEVEL_CONFIG = [
    {
        "source_file": "daily_revenue.csv",
        "level_name": "Q1 Revenue Review",
        "scenario": "You're reviewing daily revenue for an online store. "
                     "Finance flagged that Q1 numbers looked \"off\" somewhere. "
                     "Find the day something broke.",
        "y_label": "Revenue",
        "unit": "usd",
        "difficulty": "easy",
        "seed": 1,
    },
    {
        "source_file": "active_users.csv",
        "level_name": "Product Usage Audit",
        "scenario": "You're checking daily active users for a B2B SaaS product "
                     "ahead of a board update. One or two days look inconsistent "
                     "with the usual pattern — find them.",
        "y_label": "Daily active users",
        "unit": "count",
        "difficulty": "medium",
        "seed": 2,
    },
    {
        "source_file": "support_tickets.csv",
        "level_name": "Support Volume Check",
        "scenario": "Customer support tickets are tracked daily. Ops wants to know "
                     "if there was a real incident hiding in the noise, or if it's "
                     "all normal fluctuation.",
        "y_label": "Tickets opened",
        "unit": "count",
        "difficulty": "medium",
        "seed": 3,
    },
    {
        "source_file": "defect_rate.csv",
        "level_name": "Manufacturing QA Log",
        "scenario": "A factory line logs its daily defect rate. Quality control "
                     "wants confirmation on whether any day breached normal "
                     "tolerances.",
        "y_label": "Defect rate",
        "unit": "percent",
        "difficulty": "hard",
        "seed": 4,
    },
    {
        "source_file": "response_time.csv",
        "level_name": "API Performance Incident",
        "scenario": "Engineering tracks average API response time daily. "
                     "Something in this window may have caused a real "
                     "performance regression — find it before it happens again.",
        "y_label": "Response time",
        "unit": "ms",
        "difficulty": "hard",
        "seed": 5,
    },
]


def build_all_levels():
    manifest = []

    for i, config in enumerate(LEVEL_CONFIG, start=1):
        source_path = SOURCE_DIR / config["source_file"]
        if not source_path.exists():
            print(f"  Skipping {config['level_name']}: {source_path} not found. "
                  f"Run generate_sample_data.py first, or see source_data/README.md.")
            continue

        df = load_series(str(source_path))
        injected_df, ground_truth = inject_anomalies(df, config["difficulty"], seed=config["seed"])

        values = injected_df["value"].to_numpy(dtype=float)
        detector_flags = run_all_detectors(values)

        detector_scores = {
            name: evaluate_against_ground_truth(np.array(flags), ground_truth)
            for name, flags in detector_flags.items()
        }

        level_id = f"level_{i:02d}"
        level = {
            "level_id": level_id,
            "level_name": config["level_name"],
            "scenario": config["scenario"],
            "y_label": config["y_label"],
            "unit": config["unit"],
            "difficulty": config["difficulty"],
            "source_file": config["source_file"],
            "series": [
                {"date": row["date"].strftime("%Y-%m-%d"), "value": round(float(row["value"]), 2)}
                for _, row in injected_df.iterrows()
            ],
            "ground_truth_anomalies": ground_truth,
            "detector_flags": detector_flags,
            "detector_scores": detector_scores,
        }

        out_path = LEVELS_DIR / f"{level_id}.json"
        with open(out_path, "w") as f:
            json.dump(level, f, indent=2)

        print(f"Built {level_id} — '{config['level_name']}' "
              f"({config['difficulty']}, {len(ground_truth)} anomalies) -> {out_path}")
        manifest.append({
            "level_id": level_id,
            "level_name": config["level_name"],
            "difficulty": config["difficulty"],
        })

    manifest_path = LEVELS_DIR / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump({"levels": manifest}, f, indent=2)
    print(f"\nWrote manifest with {len(manifest)} levels -> {manifest_path}")


if __name__ == "__main__":
    build_all_levels()
