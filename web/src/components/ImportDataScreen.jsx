import { useState } from 'react';
import { parseSeriesFile, parseSeriesUrl, downsampleSeries } from '../game-logic/dataImport.js';

const MAX_IMPORT_LENGTH = 90; // matches every other game mode's series length -- keeps chart rendering and anomaly-magnitude tuning consistent regardless of import size

const UNITS = [
  { value: 'count', label: 'Count (e.g. users, tickets)' },
  { value: 'usd', label: '$ Currency' },
  { value: 'percent', label: '% Percent' },
  { value: 'ms', label: 'ms Milliseconds' },
  { value: 'roas', label: 'x Ratio' },
];

/**
 * ImportDataScreen
 *
 * Deliberately minimal: a file picker or a URL, two columns expected
 * (date, value), at least 10 rows. No schema mapping UI, no column
 * picker -- parsing is auto-detected in dataImport.js. Once loaded, the
 * series is handed to Anomaly Hunt via generateCaseFromSeries(), which
 * runs the exact same anomaly injection and scoring as generated data.
 */
export default function ImportDataScreen({ onImported, onExit }) {
  const [urlInput, setUrlInput] = useState('');
  const [unit, setUnit] = useState('count');
  const [status, setStatus] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setStatus(null);
    try {
      const raw = await parseSeriesFile(file);
      const series = downsampleSeries(raw, MAX_IMPORT_LENGTH);
      setPreview(series);
      setStatus({
        type: 'success',
        message:
          raw.length > series.length
            ? `Loaded ${raw.length} rows from ${file.name} — sampled down to ${series.length} evenly-spaced points for smooth gameplay.`
            : `Loaded ${series.length} rows from ${file.name}.`,
      });
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleUrlLoad() {
    if (!urlInput.trim()) return;
    setLoading(true);
    setStatus(null);
    try {
      const raw = await parseSeriesUrl(urlInput.trim());
      const series = downsampleSeries(raw, MAX_IMPORT_LENGTH);
      setPreview(series);
      setStatus({
        type: 'success',
        message:
          raw.length > series.length
            ? `Loaded ${raw.length} rows — sampled down to ${series.length} evenly-spaced points for smooth gameplay.`
            : `Loaded ${series.length} rows from that URL.`,
      });
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="dd-shell">
      <div className="dd-topbar">
        <button className="dd-wordmark dd-wordmark--link" onClick={onExit}>
          ← Anomaly Hunt
        </button>
      </div>

      <h1 style={{ fontSize: 22, fontWeight: 650, margin: '16px 0 8px' }}>Import your own data</h1>
      <p style={{ fontSize: 13, color: 'var(--ink-muted)', marginBottom: 24 }}>
        A CSV or JSON file (or a link to one), with two columns: a date and a value. At least 10
        rows. Anomalies are injected into your real data the same way as every other case.
      </p>

      <div className="dd-import-section">
        <label className="dd-btn dd-btn--primary" style={{ display: 'inline-block', cursor: 'pointer' }}>
          Choose a file
          <input
            type="file"
            accept=".csv,.json,text/csv,application/json"
            onChange={handleFile}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      <div className="dd-import-divider">or paste a link</div>

      <div className="dd-import-section" style={{ display: 'flex', gap: 8 }}>
        <input
          className="dd-input"
          style={{ flex: 1 }}
          placeholder="https://example.com/data.csv"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
        />
        <button className="dd-btn" onClick={handleUrlLoad} disabled={loading}>
          Load
        </button>
      </div>

      {status && (
        <p
          style={{
            fontSize: 13,
            color: status.type === 'error' ? 'var(--danger)' : 'var(--success)',
            marginTop: 12,
          }}
        >
          {status.message}
        </p>
      )}

      {preview && (
        <>
          <div className="dd-import-section">
            <label style={{ fontSize: 13, color: 'var(--ink-muted)', display: 'block', marginBottom: 6 }}>
              What does this measure?
            </label>
            <select className="dd-input" value={unit} onChange={(e) => setUnit(e.target.value)}>
              {UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
          <button className="dd-btn dd-btn--primary" style={{ marginTop: 8 }} onClick={() => onImported(preview, unit)}>
            Start Anomaly Hunt with this data
          </button>
        </>
      )}
    </div>
  );
}
