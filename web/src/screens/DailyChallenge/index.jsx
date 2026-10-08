import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import AnomalyChart from '../../charts/AnomalyChart.jsx';
import { DaySlider } from '../../components/DaySlider.jsx';
import { ObservationPanel, FlaggedList } from '../../components/ObservationPanel.jsx';
import { DataTable } from '../../components/DataTable.jsx';
import { ResultBreakdown } from '../../components/ResultBreakdown.jsx';
import { PageShell, TopBar } from '../../components/PageShell.jsx';
import { Button } from '../../components/Button.jsx';
import { Panel } from '../../components/Card.jsx';
import { Pill } from '../../components/Pill.jsx';
import { Stat, StatRow } from '../../components/Stat.jsx';
import { Confetti } from '../../components/Confetti.jsx';
import { getTodayChallenge, getTodayResult, saveTodayResult } from '../../engine/daily.js';
import { scoreAnomalyHunt, MAX_FLAGS_PER_CASE, TIME_LIMIT_SECONDS } from '../../engine/scoring.js';
import { runAllDetectors, evaluateFlags } from '../../engine/detectors.js';
import { recordAnomalyCase } from '../../engine/profile.js';
import { addHistoryEntry } from '../../engine/history.js';
import styles from '../AnomalyHunt/AnomalyHunt.module.css';

const LAYER_ITEMS = [
  { key: 'yours', label: 'Your selections', color: 'var(--accent)' },
  { key: 'actual', label: 'Actual anomalies', color: 'var(--success)' },
  { key: 'rolling_zscore', label: 'Rolling Z-Score', color: 'var(--detector-zscore)' },
  { key: 'rolling_iqr', label: 'Rolling IQR', color: 'var(--detector-iqr)' },
  { key: 'weekly_seasonal_diff', label: 'Seasonal Diff', color: 'var(--detector-seasonal)' },
];

export default function DailyChallengeScreen({ onExit }) {
  const [caseFile] = useState(() => getTodayChallenge());
  const [priorResult, setPriorResult] = useState(() => getTodayResult());
  const [stage, setStage] = useState(priorResult ? 'already-played' : 'briefing');
  const [selectedIndices, setSelectedIndices] = useState(new Set());
  const [focusedIndex, setFocusedIndex] = useState(null);
  const [yGuesses, setYGuesses] = useState({});
  const [showTable, setShowTable] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(TIME_LIMIT_SECONDS);
  const [result, setResult] = useState(null);
  const [detectorResults, setDetectorResults] = useState(null);
  const [humanScore, setHumanScore] = useState(null);
  const [layers, setLayers] = useState({ yours: true, actual: true, rolling_zscore: false, rolling_iqr: false, weekly_seasonal_diff: false });
  const timerRef = useRef(null);
  const atFlagCap = selectedIndices.size >= MAX_FLAGS_PER_CASE;

  function toggleIndex(idx) {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else if (next.size < MAX_FLAGS_PER_CASE) next.add(idx);
      return next;
    });
  }

  const submitGuesses = useCallback(() => {
    if (result) return;
    clearInterval(timerRef.current);
    const scored = scoreAnomalyHunt([...selectedIndices], caseFile.groundTruth, secondsRemaining, caseFile.series, yGuesses);
    setResult(scored);

    const playerFlags = caseFile.series.map((_, i) => selectedIndices.has(i));
    const detectorResultsForCase = runAllDetectors(caseFile.series.map((p) => p.value), caseFile.groundTruth);
    const humanEval = evaluateFlags(playerFlags, caseFile.groundTruth);
    setDetectorResults(detectorResultsForCase);
    setHumanScore(humanEval);

    const detectorF1s = Object.values(detectorResultsForCase.scores).map((s) => s.f1);
    const avgDetectorF1 = detectorF1s.reduce((a, b) => a + b, 0) / detectorF1s.length;
    recordAnomalyCase({ accuracyPoints: scored.accuracyPoints, falseAlarms: scored.falseAlarms, totalFlags: selectedIndices.size, humanF1: humanEval.f1, avgDetectorF1 });
    addHistoryEntry({ mode: 'daily_challenge', metric: caseFile.label, difficulty: caseFile.difficulty, score: scored.points, accuracy: scored.accuracyPoints });
    const saved = saveTodayResult({ score: scored.points, anomaliesFound: scored.anomaliesFound, anomaliesTotal: scored.anomaliesFound + scored.anomaliesMissed });
    setPriorResult(saved);
    setStage('result');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseFile, selectedIndices, secondsRemaining, yGuesses, result]);

  useEffect(() => {
    if (stage !== 'playing') return;
    timerRef.current = setInterval(() => {
      setSecondsRemaining((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current);
          submitGuesses();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  if (stage === 'already-played') {
    return (
      <PageShell>
        <TopBar onBack={onExit} right={<Pill tone="hard">daily</Pill>} />
        <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 12 }}>Today's case is closed</h1>
        <Confetti trigger={priorResult && priorResult.score >= 60} />
        <p style={{ color: 'var(--ink-muted)', marginBottom: 20 }}>
          You already played today's investigation — one attempt per day. Come back tomorrow for a new case.
        </p>
        <StatRow>
          <Stat label="Score" value={`${priorResult.score} pts`} />
          <Stat label="Found" value={`${priorResult.anomaliesFound}/${priorResult.anomaliesTotal}`} />
        </StatRow>
        <Button variant="primary" onClick={onExit}>
          Back home
        </Button>
      </PageShell>
    );
  }

  const missedIndices = new Set(result ? result.hits.filter((h) => h.matchedIndex === null).map((h) => h.anomalyIndex) : []);

  return (
    <PageShell>
      <TopBar onBack={onExit} right={<Pill tone="hard">daily · {caseFile.dailyLabel}</Pill>} />
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
        <Panel className={styles.scenario}>
          <h2>{caseFile.title}</h2>
          <p>{caseFile.brief}</p>
        </Panel>

        <div className={styles.chartPanel}>
          <AnomalyChart
            series={caseFile.series}
            unit={caseFile.unit}
            label={caseFile.label}
            selectedIndices={selectedIndices}
            yGuesses={yGuesses}
            onThrow={stage === 'playing' ? (idx, value) => { setFocusedIndex(idx); setYGuesses((p) => ({ ...p, [idx]: value })); toggleIndex(idx); } : undefined}
            focusedIndex={focusedIndex}
            revealData={stage === 'result' ? { hits: result.hits, missedIndices } : null}
            detectorFlagsByType={stage === 'result' ? detectorResults?.flagsByDetector : null}
            layers={layers}
            disabled={stage !== 'playing'}
          />
          <p className={styles.caption}>
            {stage === 'result' ? 'Toggle layers below to compare your flags against the true anomalies and each statistical detector.' : "Drag a dart onto the chart and release to flag that spot."}
          </p>
        </div>

        {stage === 'playing' && <DaySlider series={caseFile.series} unit={caseFile.unit} focusedIndex={focusedIndex} onChange={setFocusedIndex} />}

        {stage === 'briefing' && (
          <div className={styles.actions}>
            <span className={styles.hint}>Hard difficulty, one attempt. {TIME_LIMIT_SECONDS} seconds once you start.</span>
            <Button variant="primary" onClick={() => { setStage('playing'); setSecondsRemaining(TIME_LIMIT_SECONDS); }}>
              Open case file
            </Button>
          </div>
        )}

        {stage === 'playing' && (
          <div className={styles.obsRow}>
            <ObservationPanel series={caseFile.series} unit={caseFile.unit} focusedIndex={focusedIndex} onFocusChange={setFocusedIndex} selectedIndices={selectedIndices} onToggleFocused={() => toggleIndex(focusedIndex)} atFlagCap={atFlagCap} />
            <FlaggedList series={caseFile.series} unit={caseFile.unit} selectedIndices={selectedIndices} onToggle={toggleIndex} />
          </div>
        )}

        {stage === 'playing' && (
          <button className={styles.tableToggle} onClick={() => setShowTable((v) => !v)}>
            {showTable ? '▾' : '▸'} {showTable ? 'Hide' : 'Show'} data table
          </button>
        )}
        {stage === 'playing' && showTable && (
          <DataTable series={caseFile.series} unit={caseFile.unit} selectedIndices={selectedIndices} focusedIndex={focusedIndex} onRowClick={(idx) => { setFocusedIndex(idx); toggleIndex(idx); }} atFlagCap={atFlagCap} />
        )}

        {stage === 'playing' && (
          <StatRow>
            <Stat label="Time remaining" value={`0:${String(secondsRemaining).padStart(2, '0')}`} warn={secondsRemaining <= 10} />
            <Stat label="Flagged" value={selectedIndices.size} />
          </StatRow>
        )}

        {stage === 'playing' && (
          <div className={styles.actions}>
            <span />
            <Button variant="primary" onClick={submitGuesses}>
              Submit findings
            </Button>
          </div>
        )}

        {stage === 'result' && (
          <div className={styles.layerRow}>
            {LAYER_ITEMS.map((it) => (
              <label key={it.key} className={styles.layerToggle}>
                <input type="checkbox" checked={!!layers[it.key]} onChange={(e) => setLayers((prev) => ({ ...prev, [it.key]: e.target.checked }))} />
                <span className={styles.swatch} style={{ background: it.color }} />
                {it.label}
              </label>
            ))}
          </div>
        )}

        {stage === 'result' && (
          <StatRow>
            <Stat label="Found" value={`${result.anomaliesFound}/${result.anomaliesFound + result.anomaliesMissed}`} />
            <Stat label="False alarms" value={result.falseAlarms} />
            <Stat label="Points earned" value={result.points} />
          </StatRow>
        )}

        {stage === 'result' && <ResultBreakdown result={result} detectorResults={detectorResults} humanScore={humanScore} caseFile={caseFile} />}

        {stage === 'result' && (
          <div className={styles.actions}>
            <span />
            <Button variant="primary" onClick={onExit}>
              Done
            </Button>
          </div>
        )}
      </motion.div>
    </PageShell>
  );
}
