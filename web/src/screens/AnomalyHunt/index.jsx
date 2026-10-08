import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import AnomalyChart from '../../charts/AnomalyChart.jsx';
import { DaySlider } from '../../components/DaySlider.jsx';
import { ObservationPanel, FlaggedList } from '../../components/ObservationPanel.jsx';
import { DataTable } from '../../components/DataTable.jsx';
import { ResultBreakdown } from '../../components/ResultBreakdown.jsx';
import { PageShell, TopBar } from '../../components/PageShell.jsx';
import { Button } from '../../components/Button.jsx';
import { Card, Panel } from '../../components/Card.jsx';
import { Pill } from '../../components/Pill.jsx';
import { Stat, StatRow } from '../../components/Stat.jsx';
import { Confetti } from '../../components/Confetti.jsx';
import { generateAnomalyCase, DIFFICULTY_SEQUENCE } from '../../engine/case.js';
import { scoreAnomalyHunt, MAX_FLAGS_PER_CASE, TIME_LIMIT_SECONDS } from '../../engine/scoring.js';
import { runAllDetectors, evaluateFlags } from '../../engine/detectors.js';
import { getScores, submitScore } from '../../engine/leaderboard.js';
import { recordGameResult, recordAnomalyCase } from '../../engine/profile.js';
import { addHistoryEntry } from '../../engine/history.js';
import { useCountUp } from '../../engine/useCountUp.js';
import styles from './AnomalyHunt.module.css';

const MODE = 'anomaly_hunt';
const ROUND_COUNT = DIFFICULTY_SEQUENCE.length;

export default function AnomalyHuntScreen({ onExit, importedCase }) {
  const [roundIdx, setRoundIdx] = useState(0);
  const [usedTemplates, setUsedTemplates] = useState([]);
  const [caseFile, setCaseFile] = useState(() => importedCase ?? generateAnomalyCase(DIFFICULTY_SEQUENCE[0], []));
  const [stage, setStage] = useState('briefing'); // briefing | playing | result
  const [selectedIndices, setSelectedIndices] = useState(new Set());
  const [focusedIndex, setFocusedIndex] = useState(null);
  const [yGuesses, setYGuesses] = useState({});
  const [showTable, setShowTable] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(TIME_LIMIT_SECONDS);
  const [result, setResult] = useState(null);
  const [detectorResults, setDetectorResults] = useState(null);
  const [humanScore, setHumanScore] = useState(null);
  const [totalPoints, setTotalPoints] = useState(0);
  const [scores, setScores] = useState(getScores(MODE));
  const [roundHistory, setRoundHistory] = useState([]);
  const [gameOver, setGameOver] = useState(false);
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
    setTotalPoints((prev) => prev + scored.points);
    setRoundHistory((prev) => [
      ...prev,
      {
        title: caseFile.title,
        difficulty: caseFile.difficulty,
        anomaliesFound: scored.anomaliesFound,
        anomaliesTotal: scored.anomaliesFound + scored.anomaliesMissed,
        falseAlarms: scored.falseAlarms,
        points: scored.points,
      },
    ]);

    const playerFlags = caseFile.series.map((_, i) => selectedIndices.has(i));
    const detectorResultsForCase = runAllDetectors(caseFile.series.map((p) => p.value), caseFile.groundTruth);
    const humanEval = evaluateFlags(playerFlags, caseFile.groundTruth);
    setDetectorResults(detectorResultsForCase);
    setHumanScore(humanEval);

    const detectorF1s = Object.values(detectorResultsForCase.scores).map((s) => s.f1);
    const avgDetectorF1 = detectorF1s.reduce((a, b) => a + b, 0) / detectorF1s.length;
    recordAnomalyCase({ accuracyPoints: scored.accuracyPoints, falseAlarms: scored.falseAlarms, totalFlags: selectedIndices.size, humanF1: humanEval.f1, avgDetectorF1 });
    addHistoryEntry({ mode: 'anomaly_hunt', metric: caseFile.label, difficulty: caseFile.difficulty, score: scored.points, accuracy: scored.accuracyPoints });

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

  function startCase() {
    setStage('playing');
    setSecondsRemaining(TIME_LIMIT_SECONDS);
  }

  function handleThrow(idx, value) {
    if (stage !== 'playing') return;
    setFocusedIndex(idx);
    setYGuesses((prev) => ({ ...prev, [idx]: value }));
    toggleIndex(idx);
  }

  function handleTableRow(idx) {
    setFocusedIndex(idx);
    toggleIndex(idx);
  }

  function nextCase() {
    if (roundIdx + 1 < ROUND_COUNT) {
      const nextIdx = roundIdx + 1;
      const nextCaseFile = generateAnomalyCase(DIFFICULTY_SEQUENCE[nextIdx], usedTemplates);
      setUsedTemplates((prev) => [...prev, nextCaseFile.templateId]);
      setRoundIdx(nextIdx);
      setCaseFile(nextCaseFile);
      setSelectedIndices(new Set());
      setFocusedIndex(null);
      setYGuesses({});
      setResult(null);
      setDetectorResults(null);
      setHumanScore(null);
      setStage('briefing');
    } else {
      recordGameResult(MODE, totalPoints);
      setGameOver(true);
    }
  }

  if (gameOver) {
    return (
      <GameOverScreen totalPoints={totalPoints} scores={scores} roundHistory={roundHistory} onExit={onExit} onSubmitName={(name) => setScores(submitScore(MODE, name, totalPoints, ROUND_COUNT))} />
    );
  }

  const missedIndices = new Set(result ? result.hits.filter((h) => h.matchedIndex === null).map((h) => h.anomalyIndex) : []);

  return (
    <PageShell topbar={<TopBar onBack={onExit} right={<>Case {roundIdx + 1} of {ROUND_COUNT} <Pill tone={caseFile.difficulty}>{caseFile.difficulty}</Pill></>} />}>
      <AnimatePresence mode="wait">
        <motion.div key={caseFile.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
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
              onThrow={stage === 'playing' ? handleThrow : undefined}
              focusedIndex={focusedIndex}
              revealData={stage === 'result' ? { hits: result.hits, missedIndices } : null}
              detectorFlagsByType={stage === 'result' ? detectorResults?.flagsByDetector : null}
              layers={layers}
              disabled={stage !== 'playing'}
            />
            <p className={styles.caption}>
              {stage === 'result'
                ? 'Toggle layers below to compare your flags against the true anomalies and each statistical detector.'
                : "Drag a dart onto the chart and release to flag that spot — you don't have to hit the line exactly. Drag the slider below for a precise, guided throw instead."}
            </p>
          </div>

          {stage === 'playing' && <DaySlider series={caseFile.series} unit={caseFile.unit} focusedIndex={focusedIndex} onChange={setFocusedIndex} />}

          {stage === 'briefing' && (
            <div className={styles.actions}>
              <span className={styles.hint}>You'll have {TIME_LIMIT_SECONDS} seconds once you start.</span>
              <Button variant="primary" onClick={startCase}>
                Open case file
              </Button>
            </div>
          )}

          {stage === 'playing' && (
            <div className={styles.obsRow}>
              <ObservationPanel
                series={caseFile.series}
                unit={caseFile.unit}
                focusedIndex={focusedIndex}
                onFocusChange={setFocusedIndex}
                selectedIndices={selectedIndices}
                onToggleFocused={() => toggleIndex(focusedIndex)}
                atFlagCap={atFlagCap}
              />
              <FlaggedList series={caseFile.series} unit={caseFile.unit} selectedIndices={selectedIndices} onToggle={toggleIndex} />
            </div>
          )}

          {stage === 'playing' && (
            <button className={styles.tableToggle} onClick={() => setShowTable((v) => !v)}>
              {showTable ? '▾' : '▸'} {showTable ? 'Hide' : 'Show'} data table — browse every day as a list
            </button>
          )}
          {stage === 'playing' && showTable && (
            <DataTable series={caseFile.series} unit={caseFile.unit} selectedIndices={selectedIndices} focusedIndex={focusedIndex} onRowClick={handleTableRow} atFlagCap={atFlagCap} />
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
            <LayerToggles layers={layers} setLayers={setLayers} />
          )}

          {stage === 'result' && (
            <StatRow>
              <Stat label="Flagged" value={selectedIndices.size} />
              <Stat label="Found" value={`${result.anomaliesFound}/${result.anomaliesFound + result.anomaliesMissed}`} />
              <Stat label="False alarms" value={result.falseAlarms} />
              <Stat label="Points earned" value={result.points} />
            </StatRow>
          )}

          {stage === 'result' && <ResultBreakdown result={result} detectorResults={detectorResults} humanScore={humanScore} caseFile={caseFile} />}

          {stage === 'result' && (
            <div className={styles.actions}>
              <span />
              <Button variant="primary" onClick={nextCase}>
                {roundIdx + 1 < ROUND_COUNT ? 'Next case' : 'Close investigation'}
              </Button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </PageShell>
  );
}

function LayerToggles({ layers, setLayers }) {
  const items = [
    { key: 'yours', label: 'Your selections', color: 'var(--accent)' },
    { key: 'actual', label: 'Actual anomalies', color: 'var(--success)' },
    { key: 'rolling_zscore', label: 'Rolling Z-Score', color: 'var(--detector-zscore)' },
    { key: 'rolling_iqr', label: 'Rolling IQR', color: 'var(--detector-iqr)' },
    { key: 'weekly_seasonal_diff', label: 'Seasonal Diff', color: 'var(--detector-seasonal)' },
  ];
  return (
    <div className={styles.layerRow}>
      {items.map((it) => (
        <label key={it.key} className={styles.layerToggle}>
          <input type="checkbox" checked={!!layers[it.key]} onChange={(e) => setLayers((prev) => ({ ...prev, [it.key]: e.target.checked }))} />
          <span className={styles.swatch} style={{ background: it.color }} />
          {it.label}
        </label>
      ))}
    </div>
  );
}

function GameOverScreen({ totalPoints, scores, roundHistory, onSubmitName, onExit }) {
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const displayedScore = useCountUp(Math.max(0, totalPoints), 1100);
  const greatSession = roundHistory.length > 0 && roundHistory.filter((r) => r.points >= 60).length / roundHistory.length >= 0.6;

  return (
    <PageShell>
      <TopBar onBack={onExit} />
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Investigation complete</h1>
      <div className={styles.scoreWrap}>
        <Confetti trigger={greatSession} />
        <div className={styles.score}>{displayedScore} pts</div>
      </div>

      {!submitted ? (
        <div className={styles.nameRow}>
          <input className={styles.nameInput} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
          <Button
            variant="primary"
            onClick={() => {
              onSubmitName(name);
              setSubmitted(true);
            }}
          >
            Save score
          </Button>
        </div>
      ) : (
        <p style={{ fontSize: 13, color: 'var(--ink-muted)', marginBottom: 24 }}>Saved to this browser's leaderboard.</p>
      )}

      <Button variant="primary" onClick={onExit} style={{ marginBottom: 32 }}>
        Done
      </Button>

      <h3 style={{ fontSize: 14, marginBottom: 8 }}>Leaderboard</h3>
      <ul className={styles.leaderboard}>
        {scores.map((s, i) => (
          <li key={i}>
            <span>
              {i + 1}. {s.playerName}
            </span>
            <span>{s.totalPoints} pts</span>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
