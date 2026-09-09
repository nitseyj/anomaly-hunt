import { useState, useEffect, useCallback, useRef } from 'react';
import ChartLevel from './ChartLevel.jsx';
import ScoreBoard from './ScoreBoard.jsx';
import HintPanel, { HINT_COST } from './HintPanel.jsx';
import { scoreRound, TIME_LIMIT, CREDIT_RADIUS } from '../game-logic/scoring.js';
import { getScores, submitScore } from '../game-logic/leaderboard.js';
import { generateCase, DIFFICULTY_SEQUENCE } from '../game-logic/anomalyGenerator.js';
import { runAllDetectors } from '../game-logic/detectClient.js';
import { recordGameResult } from '../game-logic/profile.js';

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
  const [secondsRemaining, setSecondsRemaining] = useState(TIME_LIMIT);
  const [result, setResult] = useState(null);
  const [detectorResults, setDetectorResults] = useState(null);
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
    setSecondsRemaining(TIME_LIMIT);
    setResult(null);
    setDetectorResults(null);
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
    setDetectorResults(runAllDetectors(caseFile.series.map((p) => p.value), caseFile.ground_truth_anomalies));
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
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
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

      <div className="dd-scenario">
        <h2>{caseFile.case_name}</h2>
        <p>{caseFile.scenario}</p>
      </div>

      <div className="dd-chart-panel">
        <ChartLevel
          series={caseFile.series}
          unit={caseFile.unit}
          yLabel={caseFile.y_label}
          selectedIndices={selectedIndices}
          onToggleIndex={stage === 'playing' ? toggleIndex : () => {}}
          revealData={stage === 'result' ? { hits: result.hits, missedIndices } : null}
          showRollingAverage={hintUsed && stage !== 'result'}
          detectorFlags={stage === 'result' ? detectorResults?.combinedFlags : null}
        />
      </div>

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
          <ResultBreakdown result={result} detectorResults={detectorResults} hintUsed={hintUsed} caseFile={caseFile} />
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

function ResultBreakdown({ result, detectorResults, hintUsed, caseFile }) {
  return (
    <div className="dd-result">
      <h3>Case findings</h3>
      <p className="dd-result-line">
        Found <strong>{result.anomaliesFound}</strong> of {result.anomaliesFound + result.anomaliesMissed} true
        anomalies · <strong>{result.falseAlarms}</strong> false alarms
        {result.falseAlarmPenalty > 0 && ` (−${result.falseAlarmPenalty} pts)`} · Accuracy{' '}
        <strong>{result.accuracyPoints}</strong> pts · Speed bonus <strong>+{result.speedBonus}</strong>
        {hintUsed && ' · Hint used (−15 pts)'}
      </p>
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
      <details className="dd-details">
        <summary>What a statistical model would have flagged</summary>
        <ul className="dd-detector-list">
          {detectorResults &&
            Object.entries(detectorResults.scores).map(([name, s]) => (
              <li key={name}>
                <span>{name.replace(/_/g, ' ')}</span>
                <span>
                  precision {(s.precision * 100).toFixed(0)}% · recall {(s.recall * 100).toFixed(0)}% · F1{' '}
                  {s.f1.toFixed(2)}
                </span>
              </li>
            ))}
        </ul>
        <p className="dd-methodology-note">
          Amber triangles on the chart above show where 2 or more of these three detectors agreed
          something was unusual. See <code>docs/methodology.md</code> for how each method works.
        </p>
      </details>
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

  return (
    <div className="dd-gameover">
      <button className="dd-wordmark dd-wordmark--link" onClick={onExit}>
        ← Anomaly Hunt
      </button>
      <h1 style={{ marginTop: 16 }}>Investigation closed</h1>
      <div className="dd-score">{totalPoints} pts</div>

      {!submitted ? (
        <div className="dd-name-input">
          <input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
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
