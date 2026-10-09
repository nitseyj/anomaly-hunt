import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PageShell } from '../../components/PageShell.jsx';
import { ObservationPanel } from '../../components/ObservationPanel.jsx';
import { AnomalyChart } from '../../charts/AnomalyChart.jsx';
import { Button } from '../../components/Button.jsx';
import { DataTable } from '../../components/DataTable.jsx';
import { ResultBreakdown } from '../../components/ResultBreakdown.jsx';
import { StampBadge } from '../../components/StampBadge.jsx';
import { Confetti } from '../../components/Confetti.jsx';
import { generateAnomalyCase, generateCaseFromSeries, DIFFICULTY_SEQUENCE } from '../../engine/case.js';
import { scoreAnomalyHunt, TIME_LIMIT_SECONDS, MAX_FLAGS_PER_CASE } from '../../engine/scoring.js';
import { runAllDetectors, DETECTOR_META } from '../../engine/detectors.js';
import { addHistoryEntry } from '../../engine/history.js';
import styles from './styles.module.css';

export function AnomalyHunt({ onNavigate, importedSeries = null, importedMeta = null }) {
  const [caseIndex, setCaseIndex] = useState(0);
  const [currentCase, setCurrentCase] = useState(null);
  const [usedTemplateIds, setUsedTemplateIds] = useState([]);
  const [flags, setFlags] = useState([]);
  const [secondsLeft, setSecondsLeft] = useState(TIME_LIMIT_SECONDS);
  const [revealed, setRevealed] = useState(false);
  const [result, setResult] = useState(null);
  const [detectorData, setDetectorData] = useState(null);
  const [caseResults, setCaseResults] = useState([]);
  const [finished, setFinished] = useState(false);
  const timerRef = useRef(null);

  const totalCases = importedSeries ? 1 : DIFFICULTY_SEQUENCE.length;

  useEffect(() => {
    startCase(0);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startCase(idx) {
    clearInterval(timerRef.current);
    const difficulty = DIFFICULTY_SEQUENCE[idx % DIFFICULTY_SEQUENCE.length];
    const newCase = importedSeries
      ? generateCaseFromSeries(importedSeries, importedMeta?.unit, difficulty, importedMeta?.title)
      : generateAnomalyCase(difficulty, usedTemplateIds);
    setUsedTemplateIds((prev) => [...prev, newCase.templateId]);
    setCurrentCase(newCase);
    setFlags([]);
    setSecondsLeft(TIME_LIMIT_SECONDS);
    setRevealed(false);
    setResult(null);
    setDetectorData(null);

    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  useEffect(() => {
    if (secondsLeft === 0 && !revealed && currentCase) {
      handleReveal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  const yGuessMap = useMemo(() => {
    const map = {};
    flags.forEach((f) => (map[f.index] = f.value));
    return map;
  }, [flags]);

  function handlePlaceFlag(index, value) {
    setFlags((prev) => (prev.length >= MAX_FLAGS_PER_CASE ? prev : [...prev, { index, value }]));
  }

  function handleRemoveFlag(index) {
    setFlags((prev) => prev.filter((f) => f.index !== index));
  }

  function handleReveal() {
    clearInterval(timerRef.current);
    const values = currentCase.series.map((p) => p.value);
    const scoreResult = scoreAnomalyHunt(flags.map((f) => f.index), currentCase.groundTruth, secondsLeft, currentCase.series, yGuessMap);
    const detectors = runAllDetectors(values, currentCase.groundTruth);
    setResult(scoreResult);
    setDetectorData(detectors);
    setRevealed(true);
    setCaseResults((prev) => [...prev, { case: currentCase, score: scoreResult }]);

    addHistoryEntry({
      mode: 'anomaly_hunt',
      caseTitle: currentCase.title,
      difficulty: currentCase.difficulty,
      points: scoreResult.points,
      anomaliesFound: scoreResult.anomaliesFound,
      anomaliesMissed: scoreResult.anomaliesMissed,
      hits: scoreResult.hits,
    });
  }

  function handleNext() {
    if (caseIndex + 1 >= totalCases) {
      setFinished(true);
      return;
    }
    const nextIdx = caseIndex + 1;
    setCaseIndex(nextIdx);
    startCase(nextIdx);
  }

  function handleExit() {
    if (!revealed && (flags.length > 0 || caseIndex > 0)) {
      if (!window.confirm('Leave this investigation? Your progress on this session will be lost.')) return;
    }
    clearInterval(timerRef.current);
    onNavigate('home');
  }

  if (!currentCase) return null;

  if (finished) {
    const totalPoints = caseResults.reduce((sum, c) => sum + c.score.points, 0);
    const totalFound = caseResults.reduce((sum, c) => sum + c.score.anomaliesFound, 0);
    const totalMissed = caseResults.reduce((sum, c) => sum + c.score.anomaliesMissed, 0);
    return (
      <PageShell eyebrow="Anomaly Hunt — Session complete" title="Investigation closed.">
        <ResultBreakdown
          total={totalPoints}
          totalLabel="Session score"
          rows={caseResults.map((c, i) => ({ label: `Case ${i + 1}: ${c.case.title}`, value: c.score.points }))}
        />
        <p className={styles.summaryLine}>
          {totalFound} anomalies found · {totalMissed} missed across {caseResults.length} cases.
        </p>
        <div className={styles.nextRow}>
          <Button variant="primary" onClick={() => onNavigate('home')}>Back to home</Button>
        </div>
      </PageShell>
    );
  }

  const detectorRows = detectorData
    ? [
        { key: 'human', method: 'You', ...pseudoHumanEval(result) },
        ...Object.entries(detectorData.scores).map(([key, s]) => ({ key, method: DETECTOR_META[key].label, ...s })),
      ]
    : [];

  return (
    <PageShell
      eyebrow={`Anomaly Hunt — Case ${caseIndex + 1} of ${totalCases}`}
      title={revealed ? 'Case review' : 'Find what broke.'}
      actions={
        <div className={styles.timerWrap}>
          <Button variant="ghost" size="sm" onClick={handleExit}>Exit</Button>
          <span className={`${styles.timerValue} ${secondsLeft <= 10 ? styles.timerUrgent : ''}`}>{secondsLeft}s</span>
        </div>
      }
    >
      <ObservationPanel title={currentCase.title} brief={currentCase.brief} difficulty={currentCase.difficulty} label={currentCase.label} />

      <div className={styles.chartWrap}>
        <AnomalyChart
          series={currentCase.series}
          unit={currentCase.unit}
          flags={flags}
          maxFlags={MAX_FLAGS_PER_CASE}
          onPlaceFlag={handlePlaceFlag}
          onRemoveFlag={handleRemoveFlag}
          groundTruth={currentCase.groundTruth}
          revealed={revealed}
          detectorFlags={detectorData?.combinedFlags}
          disabled={revealed}
        />
      </div>

      {!revealed && (
        <div className={styles.controls}>
          <p className={styles.hint}>Click or drag-throw onto the chart to flag a point. Up to {MAX_FLAGS_PER_CASE} flags.</p>
          <Button variant="primary" onClick={handleReveal}>Lock in</Button>
        </div>
      )}

      <AnimatePresence>
        {revealed && result && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className={styles.reveal}>
            <div className={styles.stampRow}>
              <StampBadge
                text={result.anomaliesMissed === 0 && result.falseAlarms === 0 ? 'Clean Sweep' : result.points >= 60 ? 'Case Closed' : 'Needs Review'}
                tone={result.points >= 60 ? 'signal' : 'warn'}
              />
              {result.points >= 80 && <Confetti />}
            </div>

            <div className={styles.revealGrid}>
              <ResultBreakdown
                total={result.points}
                rows={[
                  { label: 'Accuracy', value: result.accuracyPoints },
                  { label: 'False alarm penalty', value: -result.falseAlarmPenalty },
                  { label: 'Speed bonus', value: result.speedBonus },
                ]}
              />
              <div className={styles.compareWrap}>
                <h4 className={styles.compareTitle}>Human vs. Machine</h4>
                <DataTable
                  highlightRowIndex={0}
                  columns={[
                    { key: 'method', label: 'Method' },
                    { key: 'precision', label: 'Precision', render: (r) => r.precision.toFixed(2) },
                    { key: 'recall', label: 'Recall', render: (r) => r.recall.toFixed(2) },
                    { key: 'f1', label: 'F1', render: (r) => r.f1.toFixed(2) },
                  ]}
                  rows={detectorRows}
                />
              </div>
            </div>

            <div className={styles.nextRow}>
              <Button variant="primary" onClick={handleNext}>
                {caseIndex + 1 >= totalCases ? 'Finish' : 'Next case →'}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageShell>
  );
}

function pseudoHumanEval(result) {
  if (!result) return { precision: 0, recall: 0, f1: 0 };
  const tp = result.anomaliesFound;
  const fp = result.falseAlarms;
  const fn = result.anomaliesMissed;
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  return { precision, recall, f1 };
}
