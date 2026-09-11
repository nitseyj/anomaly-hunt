import { useState, useEffect, useCallback, useRef } from 'react';
import ChartLevel from './ChartLevel.jsx';
import { ObservationPanel, FlaggedList, DaySlider } from './ObservationPanel.jsx';
import { DataTable } from './DataTable.jsx';
import ScoreBoard from './ScoreBoard.jsx';
import HintPanel, { HINT_COST } from './HintPanel.jsx';
import { scoreRound, TIME_LIMIT, MAX_FLAGS_PER_CASE } from '../game-logic/scoring.js';
import { getTodayChallenge, getTodayResult, saveTodayResult, getLocalDateKey } from '../game-logic/dailyChallenge.js';
import { runAllDetectors, evaluateDetector } from '../game-logic/detectClient.js';
import { recordAnomalyCase } from '../game-logic/profile.js';
import { addHistoryEntry } from '../game-logic/history.js';
import { DETECTOR_META } from '../game-logic/chartTheme.js';
import { useCountUp } from '../game-logic/useCountUp.js';
import ConfettiBurst from './ConfettiBurst.jsx';

const ANOMALY_TYPE_LABELS = {
  point_spike: 'Point spike',
  level_shift: 'Level shift',
  missing_gap: 'Missing data gap',
  trend_break: 'Trend break',
};

/**
 * DailyChallengeGame
 *
 * A single deterministic case, the same for everyone today. One attempt
 * per calendar day -- if the player already played today, this shows
 * their saved result instead of letting them replay for a better score.
 */
export default function DailyChallengeGame({ onExit }) {
  const [dateKey, setDateKey] = useState(() => getLocalDateKey());
  const [caseFile, setCaseFile] = useState(() => getTodayChallenge());
  const [priorResult, setPriorResult] = useState(() => getTodayResult());

  const [stage, setStage] = useState(priorResult ? 'already-played' : 'briefing');
  const [selectedIndices, setSelectedIndices] = useState(new Set());
  const [focusedIndex, setFocusedIndex] = useState(null);
  const [yGuesses, setYGuesses] = useState({});
  const [showTable, setShowTable] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(TIME_LIMIT);
  const [result, setResult] = useState(null);
  const [detectorResults, setDetectorResults] = useState(null);
  const [humanScore, setHumanScore] = useState(null);
  const [hintUsed, setHintUsed] = useState(false);
  const [layers, setLayers] = useState({
    yours: true,
    actual: true,
    rolling_zscore: false,
    iqr: false,
    weekly_seasonal_diff: false,
  });

  // The case is cached in React state (not recomputed every render), so a
  // player who leaves this screen open across local midnight would
  // otherwise keep seeing yesterday's case indefinitely. A lightweight
  // check on tab focus/visibility -- not a running timer -- catches that.
  // Only safe to swap the case before the player has actually started
  // answering; once mid-round, leave it alone until they finish.
  useEffect(() => {
    function checkForNewDay() {
      if (stage !== 'briefing' && stage !== 'already-played') return;
      const freshKey = getLocalDateKey();
      if (freshKey !== dateKey) {
        setDateKey(freshKey);
        const freshCase = getTodayChallenge();
        const freshResult = getTodayResult();
        setCaseFile(freshCase);
        setPriorResult(freshResult);
        setStage(freshResult ? 'already-played' : 'briefing');
        setSelectedIndices(new Set());
        setFocusedIndex(null);
        setYGuesses({});
      }
    }
    document.addEventListener('visibilitychange', checkForNewDay);
    window.addEventListener('focus', checkForNewDay);
    return () => {
      document.removeEventListener('visibilitychange', checkForNewDay);
      window.removeEventListener('focus', checkForNewDay);
    };
  }, [dateKey, stage]);

  const timerRef = useRef(null);
  const submitGuessesRef = useRef(() => {});

  const submitGuesses = useCallback(() => {
    if (result) return;
    clearInterval(timerRef.current);
    const scored = scoreRound(
      [...selectedIndices],
      caseFile.ground_truth_anomalies,
      secondsRemaining,
      caseFile.series,
      yGuesses
    );
    const finalPoints = Math.max(0, scored.points - (hintUsed ? HINT_COST : 0));
    setResult({ ...scored, points: finalPoints });

    const detectorResultsForCase = runAllDetectors(caseFile.series.map((p) => p.value), caseFile.ground_truth_anomalies);
    const playerFlags = caseFile.series.map((_, i) => selectedIndices.has(i));
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
      mode: 'daily_challenge',
      metric: caseFile.y_label,
      difficulty: caseFile.difficulty,
      score: finalPoints,
      accuracy: scored.accuracyPoints,
    });
    saveTodayResult({
      score: finalPoints,
      anomaliesFound: scored.anomaliesFound,
      anomaliesTotal: scored.anomaliesFound + scored.anomaliesMissed,
      metric: caseFile.y_label,
      caseId: caseFile.dailyCaseId,
    });

    setStage('result');
  }, [caseFile, selectedIndices, secondsRemaining, hintUsed, result, yGuesses]);

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

  function handleTableRowClick(idx) {
    setFocusedIndex(idx);
    toggleIndex(idx);
  }

  function handleDartThrow(idx, guessedValue) {
    setFocusedIndex(idx);
    setYGuesses((prev) => ({ ...prev, [idx]: guessedValue }));
    toggleIndex(idx);
  }

  if (stage === 'already-played') {
    return (
      <div className="dd-shell">
        <div className="dd-topbar">
          <button className="dd-wordmark dd-wordmark--link" onClick={onExit}>
            ← Anomaly Hunt
          </button>
        </div>
        <div className="dd-intro dd-fade-slide-in" style={{ margin: '48px auto', maxWidth: 480, padding: 0 }}>
          <h1 style={{ fontSize: 22 }}>Today's investigation is closed</h1>
          <p>
            You've already submitted today's daily challenge (<span className="dd-mono">CASE {priorResult.caseId}</span>
            , {priorResult.metric}). Come back tomorrow for a new one.
          </p>
          <div className="dd-score" style={{ fontSize: 32 }}>
            {priorResult.score} pts
          </div>
          <p style={{ fontSize: 13, color: 'var(--ink-muted)' }}>
            Found {priorResult.anomaliesFound} of {priorResult.anomaliesTotal} anomalies.
          </p>
        </div>
      </div>
    );
  }

  const missedIndices = new Set(
    result ? result.hits.filter((h) => h.matchedIndex === null).map((h) => h.anomalyIndex) : []
  );

  return (
    <div className="dd-shell">
      <div className="dd-topbar">
        <button className="dd-wordmark dd-wordmark--link" onClick={onExit}>
          ← Anomaly Hunt
        </button>
        <span className="dd-progress">
          <span className="dd-mono">CASE {caseFile.dailyCaseId}</span>
          <span className="dd-pill dd-pill--hard">daily</span>
        </span>
      </div>

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
          onDartThrow={stage === 'playing' ? handleDartThrow : () => {}}
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

      {stage !== 'briefing' && (
        <ScoreBoard secondsRemaining={secondsRemaining} selectedCount={selectedIndices.size} result={result} />
      )}

      {stage === 'briefing' && (
        <div className="dd-actions">
          <span style={{ fontSize: 13, color: 'var(--ink-muted)' }}>
            One attempt today. You'll have {TIME_LIMIT} seconds once you start.
          </span>
          <button className="dd-btn dd-btn--primary" onClick={() => setStage('playing')}>
            Open today's case
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
        <div className="dd-result dd-fade-slide-in">
          <ConfettiBurst trigger={result.accuracyPoints >= 80 && result.falseAlarms === 0} />
          <h3>Today's result</h3>
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
              <span className="dd-report-stat-label">Points</span>
              <span className="dd-report-stat-value">{result.points}</span>
            </div>
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
          {humanScore && detectorResults && (
            <>
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
                  <tr className="dd-hvm-row--human">
                    <td>You</td>
                    <td>{Math.round(humanScore.precision * 100)}%</td>
                    <td>{Math.round(humanScore.recall * 100)}%</td>
                    <td>{humanScore.f1.toFixed(2)}</td>
                  </tr>
                  {Object.entries(detectorResults.scores).map(([name, s]) => (
                    <tr key={name}>
                      <td>{DETECTOR_META[name]?.label ?? name}</td>
                      <td>{Math.round(s.precision * 100)}%</td>
                      <td>{Math.round(s.recall * 100)}%</td>
                      <td>{s.f1.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          <p style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 16 }}>
            Come back tomorrow for a new daily case.
          </p>
        </div>
      )}
    </div>
  );
}
