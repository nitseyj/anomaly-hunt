import { useState, useEffect, useCallback, useRef } from 'react';
import ChartLevel from './ChartLevel.jsx';
import { ObservationPanel, FlaggedList, DaySlider } from './ObservationPanel.jsx';
import { DataTable } from './DataTable.jsx';
import ScoreBoard from './ScoreBoard.jsx';
import HintPanel, { HINT_COST } from './HintPanel.jsx';
import { scoreRound, TIME_LIMIT, CREDIT_RADIUS, MAX_FLAGS_PER_CASE } from '../game-logic/scoring.js';
import { getScores, submitScore } from '../game-logic/leaderboard.js';
import { generateCase, DIFFICULTY_SEQUENCE } from '../game-logic/anomalyGenerator.js';
import { runAllDetectors, evaluateDetector } from '../game-logic/detectClient.js';
import { DETECTOR_META } from '../game-logic/chartTheme.js';
import { recordGameResult, recordAnomalyCase } from '../game-logic/profile.js';
import { addHistoryEntry } from '../game-logic/history.js';
import { useCountUp } from '../game-logic/useCountUp.js';
import ConfettiBurst from './ConfettiBurst.jsx';

const MODE = 'anomaly_hunt';
const ANOMALY_TYPE_LABELS = {
  point_spike: 'Point spike',
  level_shift: 'Level shift',
  missing_gap: 'Missing data gap',
  trend_break: 'Trend break',
};

// Stages: 'briefing' -> 'playing' -> 'result' -> (loop) -> 'gameover'
export default function AnomalyHuntGame({ onExit }) {
  const [stage, setStage] = useState('briefing');
  const [caseIdx, setCaseIdx] = useState(0);
  const [caseFile, setCaseFile] = useState(null);
  const [usedTemplates, setUsedTemplates] = useState([]);

  const [selectedIndices, setSelectedIndices] = useState(new Set());
  const [focusedIndex, setFocusedIndex] = useState(null);
  const [showTable, setShowTable] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(TIME_LIMIT);
  const [result, setResult] = useState(null);
  const [detectorResults, setDetectorResults] = useState(null);
  const [humanScore, setHumanScore] = useState(null);
  const [layers, setLayers] = useState({
    yours: true,
    actual: true,
    rolling_zscore: false,
    iqr: false,
    weekly_seasonal_diff: false,
  });
  const [hintUsed, setHintUsed] = useState(false);
  const [totalPoints, setTotalPoints] = useState(0);
  const [scores, setScores] = useState(getScores(MODE));
  const [roundHistory, setRoundHistory] = useState([]);

  const timerRef = useRef(null);
  const submitGuessesRef = useRef(() => {});
  const totalCases = DIFFICULTY_SEQUENCE.length;

  function loadCase(idx, priorUsedTemplates) {
    const difficulty = DIFFICULTY_SEQUENCE[idx];
    const next = generateCase(difficulty, priorUsedTemplates);
    setCaseFile(next);
    setUsedTemplates([...priorUsedTemplates, next.templateId]);
    setSelectedIndices(new Set());
    setFocusedIndex(null);
    setSecondsRemaining(TIME_LIMIT);
    setResult(null);
    setDetectorResults(null);
    setHumanScore(null);
    setHintUsed(false);
  }

  useEffect(() => {
    loadCase(0, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitGuesses = useCallback(() => {
    if (!caseFile || result) return;
    clearInterval(timerRef.current);
    const scored = scoreRound([...selectedIndices], caseFile.ground_truth_anomalies, secondsRemaining);
    const finalPoints = Math.max(0, scored.points - (hintUsed ? HINT_COST : 0));
    setResult({ ...scored, points: finalPoints });
    setTotalPoints((prev) => prev + finalPoints);
    setRoundHistory((prev) => [
      ...prev,
      {
        levelName: caseFile.case_name,
        difficulty: caseFile.difficulty,
        anomaliesFound: scored.anomaliesFound,
        anomaliesTotal: scored.anomaliesFound + scored.anomaliesMissed,
        falseAlarms: scored.falseAlarms,
        points: finalPoints,
      },
    ]);
    // Score the player's own flags with the SAME precision/recall/F1
    // methodology used for the statistical detectors, so "Human vs
    // Machine" is a genuine apples-to-apples comparison, not the
    // distance-based partial-credit score dressed up differently.
    const playerFlags = caseFile.series.map((_, i) => selectedIndices.has(i));
    const detectorResultsForCase = runAllDetectors(caseFile.series.map((p) => p.value), caseFile.ground_truth_anomalies);
    const humanEval = evaluateDetector(playerFlags, caseFile.ground_truth_anomalies);
    setDetectorResults(detectorResultsForCase);
    setHumanScore(humanEval);

    const detectorF1s = Object.values(detectorResultsForCase.scores).map((s) => s.f1);
    const avgDetectorF1 = detectorF1s.reduce((a, b) => a + b, 0) / detectorF1s.length;
    recordAnomalyCase({
      accuracyPoints: scored.accuracyPoints,
      falseAlarms: scored.falseAlarms,
      totalFlags: selectedIndices.size,
      humanF1: humanEval.f1,
      avgDetectorF1,
    });
    addHistoryEntry({
      mode: 'anomaly_hunt',
      metric: caseFile.y_label,
      difficulty: caseFile.difficulty,
      score: finalPoints,
      accuracy: scored.accuracyPoints,
    });

    setStage('result');
  }, [caseFile, selectedIndices, secondsRemaining, hintUsed, result]);

  useEffect(() => {
    submitGuessesRef.current = submitGuesses;
  }, [submitGuesses]);

  useEffect(() => {
    if (stage !== 'playing') return;
    timerRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          submitGuessesRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [stage]);

  function toggleIndex(idx) {
    if (result) return;
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else if (next.size < MAX_FLAGS_PER_CASE) {
        next.add(idx);
      }
      return next;
    });
  }

  // The data table is unambiguous (a row click can never be "the wrong
  // day" the way a chart click can), so unlike the chart/slider it
  // flags directly in one action instead of only moving focus.
  function handleTableRowClick(idx) {
    setFocusedIndex(idx);
    toggleIndex(idx);
  }

  function nextCase() {
    if (caseIdx + 1 < totalCases) {
      const nextIdx = caseIdx + 1;
      setCaseIdx(nextIdx);
      loadCase(nextIdx, usedTemplates);
      setStage('briefing');
    } else {
      recordGameResult(MODE, totalPoints);
      setStage('gameover');
    }
  }

  function finishGame(playerName) {
    const updated = submitScore(MODE, playerName, totalPoints, totalCases);
    setScores(updated);
  }

  function playAgain() {
    setCaseIdx(0);
    setTotalPoints(0);
    setRoundHistory([]);
    setScores(getScores(MODE));
    loadCase(0, []);
    setStage('briefing');
  }

  if (stage === 'gameover') {
    return (
      <GameOverScreen
        totalPoints={totalPoints}
        scores={scores}
        roundHistory={roundHistory}
        onSubmitName={finishGame}
        onPlayAgain={playAgain}
        onExit={onExit}
      />
    );
  }

  if (!caseFile) {
    return <div className="dd-loading">Loading case…</div>;
  }

  const missedIndices = new Set(
    result ? result.hits.filter((h) => h.matchedIndex === null).map((h) => h.anomalyIndex) : []
  );

  return (
    <div className="dd-shell">
      <Topbar caseIdx={caseIdx} total={totalCases} difficulty={caseFile.difficulty} onExit={onExit} />

      <div className="dd-scenario dd-fade-slide-in" key={`scenario-${caseFile.genId}`}>
        <h2>{caseFile.case_name}</h2>
        <p>{caseFile.scenario}</p>
      </div>

      <div className="dd-chart-panel dd-fade-slide-in" key={`chart-panel-${caseFile.genId}`}>
        <ChartLevel
          key={caseFile.genId}
          series={caseFile.series}
          unit={caseFile.unit}
          yLabel={caseFile.y_label}
          selectedIndices={selectedIndices}
          onPointClick={stage === 'playing' ? setFocusedIndex : () => {}}
          focusedIndex={focusedIndex}
          revealData={stage === 'result' ? { hits: result.hits, missedIndices } : null}
          showRollingAverage={hintUsed && stage !== 'result'}
          detectorFlagsByType={stage === 'result' ? detectorResults?.flagsByDetector : null}
          layers={layers}
        />
        {stage === 'playing' && (
          <DaySlider
            series={caseFile.series}
            unit={caseFile.unit}
            focusedIndex={focusedIndex}
            onChange={setFocusedIndex}
            disabled={!!result}
          />
        )}
      </div>

      {stage === 'playing' && (
        <div className="dd-obs-row">
          <ObservationPanel
            series={caseFile.series}
            unit={caseFile.unit}
            focusedIndex={focusedIndex}
            onFocusChange={setFocusedIndex}
            selectedIndices={selectedIndices}
            onToggleFocused={() => toggleIndex(focusedIndex)}
            disabled={!!result}
            atFlagCap={selectedIndices.size >= MAX_FLAGS_PER_CASE}
          />
          <FlaggedList
            series={caseFile.series}
            unit={caseFile.unit}
            selectedIndices={selectedIndices}
            onToggle={toggleIndex}
            disabled={!!result}
          />
        </div>
      )}

      {stage === 'playing' && (
        <button className="dd-table-toggle" onClick={() => setShowTable((v) => !v)}>
          {showTable ? '▾ Hide data table' : '▸ Show data table — browse every day as a list'}
        </button>
      )}

      {stage === 'playing' && showTable && (
        <DataTable
          series={caseFile.series}
          unit={caseFile.unit}
          selectedIndices={selectedIndices}
          focusedIndex={focusedIndex}
          onRowClick={handleTableRowClick}
          disabled={!!result}
          atFlagCap={selectedIndices.size >= MAX_FLAGS_PER_CASE}
        />
      )}

      {stage === 'result' && <LayerToggles layers={layers} onChange={setLayers} />}

      {stage !== 'briefing' && (
        <ScoreBoard secondsRemaining={secondsRemaining} selectedCount={selectedIndices.size} result={result} />
      )}

      {stage === 'briefing' && (
        <div className="dd-actions">
          <span style={{ fontSize: 13, color: 'var(--ink-muted)' }}>
            You'll have {TIME_LIMIT} seconds once you start. Points within {CREDIT_RADIUS} days of a true
            anomaly still earn partial credit.
          </span>
          <button className="dd-btn dd-btn--primary" onClick={() => setStage('playing')}>
            Open case file
          </button>
        </div>
      )}

      {stage === 'playing' && (
        <div className="dd-actions">
          <HintPanel onUseHint={() => setHintUsed(true)} hintUsed={hintUsed} disabled={!!result} />
          <button className="dd-btn dd-btn--primary" onClick={submitGuesses}>
            Submit findings
          </button>
        </div>
      )}

      {stage === 'result' && (
        <>
          <ResultBreakdown
            result={result}
            detectorResults={detectorResults}
            humanScore={humanScore}
            hintUsed={hintUsed}
            caseFile={caseFile}
          />
          <div className="dd-actions">
            <span />
            <button className="dd-btn dd-btn--primary" onClick={nextCase}>
              {caseIdx + 1 < totalCases ? 'Next case' : 'Close investigation'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Topbar({ caseIdx, total, difficulty, onExit }) {
  return (
    <div className="dd-topbar">
      <button className="dd-wordmark dd-wordmark--link" onClick={onExit}>
        ← Anomaly Hunt
      </button>
      <span className="dd-progress">
        Case {caseIdx + 1} of {total}
        <span className={`dd-pill dd-pill--${difficulty}`}>{difficulty}</span>
      </span>
    </div>
  );
}

function LayerToggles({ layers, onChange }) {
  const items = [
    { key: 'yours', label: 'Your selections' },
    { key: 'actual', label: 'Actual anomalies' },
    { key: 'rolling_zscore', label: DETECTOR_META.rolling_zscore.label, color: DETECTOR_META.rolling_zscore.color },
    { key: 'iqr', label: DETECTOR_META.iqr.label, color: DETECTOR_META.iqr.color },
    {
      key: 'weekly_seasonal_diff',
      label: DETECTOR_META.weekly_seasonal_diff.label,
      color: DETECTOR_META.weekly_seasonal_diff.color,
    },
  ];

  function toggle(key) {
    onChange((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="dd-layer-toggles">
      {items.map((item) => (
        <label key={item.key} className="dd-layer-toggle">
          <input type="checkbox" checked={!!layers[item.key]} onChange={() => toggle(item.key)} />
          {item.color && <span className="dd-layer-swatch" style={{ background: item.color }} />}
          {item.label}
        </label>
      ))}
    </div>
  );
}

function ResultBreakdown({ result, detectorResults, humanScore, hintUsed, caseFile }) {
  const pct = (v) => `${Math.round(v * 100)}%`;
  const greatCase = result.accuracyPoints >= 80 && result.falseAlarms === 0;

  return (
    <div className="dd-result dd-fade-slide-in">
      <ConfettiBurst trigger={greatCase} />
      <h3>Investigation report</h3>

      <div className="dd-report-grid">
        <div className="dd-report-stat">
          <span className="dd-report-stat-label">Accuracy</span>
          <span className="dd-report-stat-value">{result.accuracyPoints}%</span>
        </div>
        <div className="dd-report-stat">
          <span className="dd-report-stat-label">False alarms</span>
          <span className="dd-report-stat-value">{result.falseAlarms}</span>
        </div>
        <div className="dd-report-stat">
          <span className="dd-report-stat-label">Speed bonus</span>
          <span className="dd-report-stat-value dd-report-stat-value--success">+{result.speedBonus}</span>
        </div>
        {(result.falseAlarmPenalty > 0 || hintUsed) && (
          <div className="dd-report-stat">
            <span className="dd-report-stat-label">Deductions</span>
            <span className="dd-report-stat-value dd-report-stat-value--danger">
              −{result.falseAlarmPenalty + (hintUsed ? 15 : 0)}
            </span>
          </div>
        )}
      </div>

      <ul className="dd-detector-list">
        {result.hits.map((h) => (
          <li key={h.anomalyIndex}>
            <span>
              {ANOMALY_TYPE_LABELS[h.type] || h.type} · {caseFile.series[h.anomalyIndex]?.date}
            </span>
            <span>{h.matchedIndex !== null ? `found · ${h.points} pts` : 'missed'}</span>
          </li>
        ))}
      </ul>

      <h4 className="dd-hvm-title">Human vs machine</h4>
      <table className="dd-hvm-table">
        <thead>
          <tr>
            <th></th>
            <th>Precision</th>
            <th>Recall</th>
            <th>F1</th>
          </tr>
        </thead>
        <tbody>
          {humanScore && (
            <tr className="dd-hvm-row--human">
              <td>You</td>
              <td>{pct(humanScore.precision)}</td>
              <td>{pct(humanScore.recall)}</td>
              <td>{humanScore.f1.toFixed(2)}</td>
            </tr>
          )}
          {detectorResults &&
            Object.entries(detectorResults.scores).map(([name, s]) => (
              <tr key={name}>
                <td>{DETECTOR_META[name]?.label ?? name}</td>
                <td>{pct(s.precision)}</td>
                <td>{pct(s.recall)}</td>
                <td>{s.f1.toFixed(2)}</td>
              </tr>
            ))}
        </tbody>
      </table>
      <p className="dd-methodology-note">
        Statistical detectors provide signals rather than absolute truth — different methods
        respond differently to noise, seasonality, and structural change. See{' '}
        <code>docs/methodology.md</code> for how each one works.
      </p>
    </div>
  );
}

function downloadCsv(roundHistory, totalPoints) {
  const header = 'Case,Metric,Difficulty,Anomalies Found,Anomalies Total,False Alarms,Points\n';
  const rows = roundHistory
    .map(
      (r, i) =>
        `${i + 1},"${r.levelName}",${r.difficulty},${r.anomaliesFound},${r.anomaliesTotal},${r.falseAlarms},${r.points}`
    )
    .join('\n');
  const footer = `\nTotal,,,,,,${totalPoints}\n`;
  const csv = header + rows + footer;

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `anomaly-hunt-report-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function GameOverScreen({ totalPoints, scores, roundHistory, onSubmitName, onPlayAgain, onExit }) {
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const displayedScore = useCountUp(totalPoints, 1100);
  const strongSession = roundHistory.length > 0 && totalPoints / roundHistory.length >= 60;

  return (
    <div className="dd-gameover">
      <button className="dd-wordmark dd-wordmark--link" onClick={onExit}>
        ← Anomaly Hunt
      </button>
      <h1 style={{ marginTop: 16 }}>Investigation closed</h1>
      <div className="dd-score-wrap">
        <ConfettiBurst trigger={strongSession} />
        <div className="dd-score">{displayedScore} pts</div>
      </div>

      {!submitted ? (
        <div className="dd-name-input">
          <input className="dd-input" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
          <button
            className="dd-btn dd-btn--primary"
            onClick={() => {
              onSubmitName(name);
              setSubmitted(true);
            }}
          >
            Save score
          </button>
        </div>
      ) : (
        <p style={{ fontSize: 13, color: 'var(--ink-muted)', marginBottom: 24 }}>
          Saved to this browser's leaderboard.
        </p>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 32, flexWrap: 'wrap' }}>
        <button className="dd-btn dd-btn--primary" onClick={onPlayAgain}>
          New investigation
        </button>
        <button className="dd-btn" onClick={() => downloadCsv(roundHistory, totalPoints)}>
          Download audit report (CSV)
        </button>
      </div>

      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Case summary</h3>
      <ul className="dd-leaderboard" style={{ marginBottom: 32 }}>
        {roundHistory.map((r, i) => (
          <li key={i}>
            <span>
              {i + 1}. {r.levelName} ({r.difficulty}) — {r.anomaliesFound}/{r.anomaliesTotal} found,{' '}
              {r.falseAlarms} false alarms
            </span>
            <span>{r.points} pts</span>
          </li>
        ))}
      </ul>

      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Leaderboard</h3>
      <ul className="dd-leaderboard">
        {scores.map((s, i) => (
          <li key={i}>
            <span>
              {i + 1}. {s.playerName}
            </span>
            <span>{s.totalPoints} pts</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
