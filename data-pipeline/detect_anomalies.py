"""
detect_anomalies.py

Implements real, standard anomaly-detection methods, run AFTER the player
guesses so the game can show "here's what a statistical model would have
flagged" as a teaching moment. Also used to sanity-check that injected
anomalies are actually statistically detectable (i.e. the game is fair).

Methods:
  - rolling_zscore:   flags points where a rolling z-score exceeds a threshold
  - iqr:               flags points outside 1.5x IQR of a rolling window
  - stl_residual:       decomposes trend/seasonality/residual, flags large residuals

These are intentionally simple, well-known methods (not deep learning) —
the point is transparency and teachability, matching how a BI analyst
would actually first approach this problem before reaching for anything
more complex.
"""

import numpy as np
import pandas as pd

try:
    from statsmodels.tsa.seasonal import STL
    _STATSMODELS_AVAILABLE = True
except ImportError:
    _STATSMODELS_AVAILABLE = False


def rolling_zscore_detect(values: np.ndarray, window: int = 14, threshold: float = 3.0) -> np.ndarray:
    """Returns a boolean array flagging points with |rolling z-score| > threshold."""
    s = pd.Series(values)
    rolling_mean = s.rolling(window, center=True, min_periods=1).mean()
    rolling_std = s.rolling(window, center=True, min_periods=1).std().replace(0, np.nan)
    z_scores = (s - rolling_mean) / rolling_std
    return (z_scores.abs() > threshold).fillna(False).to_numpy()


def iqr_detect(values: np.ndarray, window: int = 30, k: float = 1.5) -> np.ndarray:
    """Returns a boolean array flagging points outside k * IQR of a rolling window."""
    s = pd.Series(values)
    q1 = s.rolling(window, center=True, min_periods=5).quantile(0.25)
    q3 = s.rolling(window, center=True, min_periods=5).quantile(0.75)
    iqr = q3 - q1
    lower = q1 - k * iqr
    upper = q3 + k * iqr
    return ((s < lower) | (s > upper)).fillna(False).to_numpy()


def stl_residual_detect(values: np.ndarray, period: int = 7, threshold: float = 3.0) -> np.ndarray:
    """
    Decomposes the series into trend + seasonal + residual via STL, then
    flags points where the residual is a statistical outlier. Best method
    for series with strong seasonality (e.g. day-of-week retail patterns),
    where a plain z-score would falsely flag normal seasonal peaks.
    """
    if not _STATSMODELS_AVAILABLE:
        print("  [detect_anomalies] statsmodels not installed — skipping STL "
              "detection (pip install statsmodels to enable it).")
        return np.zeros(len(values), dtype=bool)

    if len(values) < period * 2:
        return np.zeros(len(values), dtype=bool)

    s = pd.Series(values).interpolate()
    stl = STL(s, period=period, robust=True).fit()
    resid = stl.resid
    resid_std = resid.std()
    if resid_std == 0 or np.isnan(resid_std):
        return np.zeros(len(values), dtype=bool)

    z = (resid - resid.mean()) / resid_std
    return (z.abs() > threshold).to_numpy()


def evaluate_against_ground_truth(detected_flags: np.ndarray, ground_truth_anomalies: list[dict], tolerance: int = 2):
    """
    Computes precision/recall/F1 comparing a detector's flagged indices
    against the ground-truth anomaly ranges (with a small tolerance window,
    since flagging a point 1-2 days off from the true anomaly start is
    still a meaningful catch).
    """
    detected_idxs = set(np.where(detected_flags)[0].tolist())

    true_idxs = set()
    for anomaly in ground_truth_anomalies:
        for i in range(anomaly["start_index"] - tolerance, anomaly["end_index"] + tolerance + 1):
            true_idxs.add(i)

    true_positives = len(detected_idxs & true_idxs)
    false_positives = len(detected_idxs - true_idxs)
    false_negatives = len(true_idxs - detected_idxs)

    precision = true_positives / (true_positives + false_positives) if (true_positives + false_positives) else 0.0
    recall = true_positives / (true_positives + false_negatives) if (true_positives + false_negatives) else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0

    return {"precision": round(precision, 3), "recall": round(recall, 3), "f1": round(f1, 3)}


def run_all_detectors(values: np.ndarray) -> dict:
    return {
        "rolling_zscore": rolling_zscore_detect(values).tolist(),
        "iqr": iqr_detect(values).tolist(),
        "stl_residual": stl_residual_detect(values).tolist(),
    }
