# Source data

By default, `python generate_sample_data.py` fills this folder with
**synthetic** starter series (retail sales, website traffic, stock prices)
so the pipeline runs end-to-end with zero external downloads.

For a genuinely credible published game, replace these with real public
data before running `build_levels.py`. Good free sources:

- **Retail sales:** [Walmart Sales Forecasting (Kaggle)](https://www.kaggle.com/datasets/mikhail1681/walmart-sales),
  [Superstore Sales](https://www.kaggle.com/datasets/vivek468/superstore-dataset-final)
- **Website traffic:** [Wikipedia Web Traffic Time Series (Kaggle)](https://www.kaggle.com/c/web-traffic-time-series-forecasting)
- **Stock prices:** any ticker via [Yahoo Finance](https://finance.yahoo.com/) CSV export, or the free [Stooq](https://stooq.com/) CSV API

## Expected format

Any source CSV just needs two columns:

```csv
date,value
2024-01-01,1023.50
2024-01-02,1041.20
...
```

Rename columns or pass `--date-col`/`--value-col`-style overrides if your
source uses different names (see `inject_anomalies.py`'s `load_series()`).
