import { useState } from 'react';
import { PageShell } from '../../components/PageShell.jsx';
import { Card } from '../../components/Card.jsx';
import { Button } from '../../components/Button.jsx';
import { TextArea, Input } from '../../components/Input.jsx';
import { parseImportedData } from '../../engine/dataImport.js';
import styles from './styles.module.css';

const UNIT_OPTIONS = ['usd', 'count', 'percent', 'ms', 'roas'];

export function Import({ onNavigate, onStartImported }) {
  const [text, setText] = useState('');
  const [filename, setFilename] = useState('');
  const [title, setTitle] = useState('');
  const [unit, setUnit] = useState('count');
  const [error, setError] = useState(null);

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result));
    reader.readAsText(file);
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
      actions={<Button variant="ghost" size="sm" onClick={() => onNavigate('home')}>← Home</Button>}
    >
      <Card className={styles.card}>
        <label className={styles.fileLabel}>
          <input type="file" accept=".csv,.json,text/csv,application/json" onChange={handleFile} className={styles.fileInput} />
          <span>{filename || 'Choose a .csv or .json file'}</span>
        </label>

        <TextArea
          label="Or paste raw CSV/JSON"
          placeholder={'date,value\n2024-01-01,120\n2024-01-02,131\n...'}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

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
