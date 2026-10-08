import { useState } from 'react';
import { PageShell, TopBar } from '../../components/PageShell.jsx';
import { Button } from '../../components/Button.jsx';
import { Input, Select } from '../../components/Input.jsx';
import { parseSeriesFile, parseSeriesUrl, downsampleSeries } from '../../engine/dataImport.js';
import styles from './Import.module.css';

const MAX_IMPORT_LENGTH = 90;
const UNITS = [
  { value: 'count', label: 'Count (e.g. users, tickets)' },
  { value: 'usd', label: '$ Currency' },
  { value: 'percent', label: '% Percent' },
  { value: 'ms', label: 'ms Milliseconds' },
  { value: 'roas', label: 'x Ratio' },
];

export default function ImportScreen({ onImported, onExit }) {
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
      setStatus({ type: 'success', message: raw.length > series.length ? `Loaded ${raw.length} rows from ${file.name} — sampled down to ${series.length} evenly-spaced points.` : `Loaded ${series.length} rows from ${file.name}.` });
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
      setStatus({ type: 'success', message: raw.length > series.length ? `Loaded ${raw.length} rows — sampled down to ${series.length} points.` : `Loaded ${series.length} rows.` });
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell>
      <TopBar onBack={onExit} />
      <h1 style={{ fontSize: 22, fontWeight: 650, margin: '16px 0 8px' }}>Import your own data</h1>
      <p style={{ fontSize: 13, color: 'var(--ink-muted)', marginBottom: 24 }}>
        A CSV or JSON file (or a link to one), with two columns: a date and a value. At least 10 rows. Anomalies are injected into your real data the same way as every other case.
      </p>

      <label className={styles.fileButton}>
        Choose a file
        <input type="file" accept=".csv,.json,text/csv,application/json" onChange={handleFile} style={{ display: 'none' }} />
      </label>

      <div className={styles.divider}>or paste a link</div>

      <div className={styles.urlRow}>
        <Input placeholder="https://example.com/data.csv" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} style={{ flex: 1 }} />
        <Button onClick={handleUrlLoad} disabled={loading}>
          Load
        </Button>
      </div>

      {status && <p className={status.type === 'error' ? styles.error : styles.success}>{status.message}</p>}

      {preview && (
        <>
          <div className={styles.unitRow}>
            <label className={styles.unitLabel}>What does this measure?</label>
            <Select value={unit} onChange={(e) => setUnit(e.target.value)}>
              {UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </Select>
          </div>
          <Button variant="primary" onClick={() => onImported(preview, unit)}>
            Start Anomaly Hunt with this data
          </Button>
        </>
      )}
    </PageShell>
  );
}
