"""
generate_sample_data.py

Generates realistic, clean (anomaly-free) synthetic time series so the
full pipeline (inject -> detect -> build levels) runs out of the box
with zero external downloads.

IMPORTANT: this is synthetic starter data, not real business data. It's
built to have plausible seasonality/trend/noise so the game works
immediately after cloning the repo -- but for a genuinely credible
portfolio piece, swap these for real public datasets before publishing.
See source_data/README.md for suggested real sources.

Each series is generated with realistic business context (units, scale,
typical seasonality) so the game has something meaningful to show the
player, not just an unlabeled line.
"""

import numpy as np
import pandas as pd
from pathlib import Path

OUT_DIR = Path(__file__).parent / "source_data"
OUT_DIR.mkdir(parents=True, exist_ok=True)

N_DAYS = 180


def _dates():
    return pd.date_range("2024-01-01", periods=N_DAYS, freq="D")


def generate_daily_revenue(seed: int = 10):
    """A mid-size e-commerce store's daily revenue, in USD."""
    rng = np.random.default_rng(seed)
    dates = _dates()
    t = np.arange(N_DAYS)

    trend = 8000 + t * 12
    weekly_seasonality = 1800 * np.sin(2 * np.pi * (t - 2) / 7)  # weekend peak
    noise = rng.normal(0, 350, N_DAYS)

    values = trend + weekly_seasonality + noise
    return pd.DataFrame({"date": dates, "value": np.round(np.clip(values, 0, None), 2)})


def generate_active_users(seed: int = 20):
    """A B2B SaaS product's daily active users."""
    rng = np.random.default_rng(seed)
    dates = _dates()
    t = np.arange(N_DAYS)

    base = 3200 + t * 6
    weekday_pattern = np.where(dates.dayofweek < 5, 400, -900)  # workday tool, quiet weekends
    noise = rng.normal(0, 90, N_DAYS)

    values = base + weekday_pattern + noise
    return pd.DataFrame({"date": dates, "value": np.round(np.clip(values, 0, None), 0)})


def generate_support_tickets(seed: int = 30):
    """Daily new customer support tickets opened."""
    rng = np.random.default_rng(seed)
    dates = _dates()
    t = np.arange(N_DAYS)

    base = 85 + 0.05 * t
    weekday_pattern = np.where(dates.dayofweek < 5, 15, -35)
    noise = rng.normal(0, 6, N_DAYS)

    values = base + weekday_pattern + noise
    return pd.DataFrame({"date": dates, "value": np.round(np.clip(values, 0, None), 0)})


def generate_defect_rate(seed: int = 40):
    """A manufacturing line's daily defect rate, as a percentage."""
    rng = np.random.default_rng(seed)
    dates = _dates()

    base = 2.1
    noise = rng.normal(0, 0.15, N_DAYS)
    values = np.clip(base + noise, 0, None)
    return pd.DataFrame({"date": dates, "value": np.round(values, 2)})


def generate_response_time(seed: int = 50):
    """A web application's average API response time, in milliseconds."""
    rng = np.random.default_rng(seed)
    dates = _dates()
    t = np.arange(N_DAYS)

    base = 220 + 0.15 * t
    weekly_load = 25 * np.sin(2 * np.pi * (t - 1) / 7)
    noise = rng.normal(0, 8, N_DAYS)

    values = base + weekly_load + noise
    return pd.DataFrame({"date": dates, "value": np.round(np.clip(values, 50, None), 1)})


if __name__ == "__main__":
    generate_daily_revenue().to_csv(OUT_DIR / "daily_revenue.csv", index=False)
    generate_active_users().to_csv(OUT_DIR / "active_users.csv", index=False)
    generate_support_tickets().to_csv(OUT_DIR / "support_tickets.csv", index=False)
    generate_defect_rate().to_csv(OUT_DIR / "defect_rate.csv", index=False)
    generate_response_time().to_csv(OUT_DIR / "response_time.csv", index=False)
    print(f"Generated 5 synthetic starter datasets in {OUT_DIR}")
