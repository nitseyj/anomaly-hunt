import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { line as d3line, curveCatmullRom } from 'd3-shape';
import { scaleLinear } from 'd3-scale';
import { PageShell } from '../../components/PageShell.jsx';
import { Card } from '../../components/Card.jsx';
import { Button } from '../../components/Button.jsx';
import { TextArea, Input } from '../../components/Input.jsx';
import { parseImportedData } from '../../engine/dataImport.js';
import heroPhoto from '../../assets/photos/import-droplets.jpg';
import styles from './styles.module.css';

const UNIT_OPTIONS = ['usd', 'count', 'percent', 'ms', 'roas'];
const PREVIEW_WIDTH = 500;
const PREVIEW_HEIGHT = 80;

export function Import({ onStartImported }) {
  const [text, setText] = useState('');
  const [filename, setFilename] = useState('');
  const [title, setTitle] = useState('');
  const [unit, setUnit] = useState('count');
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const preview = useMemo(() => {
    if (!text.trim()) return null;
    try {
      return parseImportedData(text, filename);
    } catch {
      return null;
    }
  }, [text, filename]);

  function readFile(file) {
    if (!file) return;
    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result));
    reader.readAsText(file);
  }

  function handleFile(e) {
    readFile(e.target.files?.[0]);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragActive(false);
    readFile(e.dataTransfer.files?.[0]);
  }

  function handleLaunch() {
    try {
      const series = parseImportedData(text, filename);
      setError(null);
      onStartImported(series, { unit, title });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <PageShell
      eyebrow="Bring Your Own Data"
      title="Investigate your own series."
      subtitle="Upload a CSV or JSON file with a date column and a numeric value column. Everything stays in your browser."
      photo={{
        src: heroPhoto,
        caption: "Bring your own signal. The unit doesn't only work manufactured cases.",
        credit: 'Photo — Max Bender / Unsplash',
      }}
    >
      <Card className={styles.card}>
        <label
          className={`${styles.fileLabel} ${dragActive ? styles.fileLabelActive : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
        >
          <input type="file" accept=".csv,.json,text/csv,application/json" onChange={handleFile} className={styles.fileInput} />
          <span className={styles.fileIcon}>↓</span>
          <span>{filename || (dragActive ? 'Drop it here' : 'Drop a .csv or .json file, or click to browse')}</span>
        </label>

        <TextArea
          label="Or paste raw CSV/JSON"
          placeholder={'date,value\n2024-01-01,120\n2024-01-02,131\n...'}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        <AnimatePresence>
          {preview && (
            <motion.div
              className={styles.preview}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
            >
              <div className={styles.previewHead}>
                <span className={styles.previewLabel}>Parsed preview</span>
                <span className={styles.previewMeta}>
                  {preview.length} rows · {preview[0].date} → {preview[preview.length - 1].date}
                </span>
              </div>
              <PreviewSparkline series={preview} />
            </motion.div>
          )}
        </AnimatePresence>

        <div className={styles.row}>
          <Input label="Case title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Custom Data Investigation" />
          <label className={styles.unitPicker}>
            <span className={styles.unitLabel}>Unit</span>
            <select value={unit} onChange={(e) => setUnit(e.target.value)} className={styles.select}>
              {UNIT_OPTIONS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </label>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.footer}>
          <Button variant="primary" onClick={handleLaunch} disabled={!text.trim()}>
            Start investigation →
          </Button>
        </div>
      </Card>
    </PageShell>
  );
}

function PreviewSparkline({ series }) {
  const values = series.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.1 || Math.abs(max) * 0.1 || 1;
  const x = scaleLinear().domain([0, series.length - 1]).range([4, PREVIEW_WIDTH - 4]);
  const y = scaleLinear().domain([min - pad, max + pad]).range([PREVIEW_HEIGHT - 4, 4]);
  const path = d3line()
    .x((_, i) => x(i))
    .y((d) => y(d.value))
    .curve(curveCatmullRom.alpha(0.5))(series);

  return (
    <svg viewBox={`0 0 ${PREVIEW_WIDTH} ${PREVIEW_HEIGHT}`} className={styles.sparkline} preserveAspectRatio="none">
      <path d={path} fill="none" className={styles.sparklinePath} />
    </svg>
  );
}
