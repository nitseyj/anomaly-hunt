import { useState } from 'react';
import ForecastChart from './ForecastChart.jsx';
import { generateForecast, FORECAST_ROUND_COUNT } from '../game-logic/forecastGenerator.js';
import { scoreForecast, FORECAST_FULL_CREDIT_PCT, FORECAST_ZERO_CREDIT_PCT } from '../game-logic/forecastScoring.js';
import { formatValue } from '../game-logic/businessMetrics.js';
import { getScores, submitScore } from '../game-logic/leaderboard.js';
import { recordGameResult } from '../game-logic/profile.js';

const MODE = 'forecast_call';

// Stages: 'briefing' -> 'guessing' -> 'result' -> (loop) -> 'gameover'
export default function ForecastCallGame({ onExit }) {
  const [stage, setStage] = useState('briefing');
  const [roundIdx, setRoundIdx] = useState(0);
  const [round, setRound] = useState(() => generateForecast([]));
  const [usedTemplates, setUsedTemplates] = useState([round.templateId]);
  const [guessInput, setGuessInput] = useState('');
  const [result, setResult] = useState(null);
  const [totalPoints, setTotalPoints] = useState(0);
  const [scores, setScores] = useState(getScores(MODE));
  const [roundHistory, setRoundHistory] = useState([]);

  function loadRound(priorUsedTemplates) {
    const next = generateForecast(priorUsedTemplates);
    setRound(next);
    setUsedTemplates([...priorUsedTemplates, next.templateId]);
    setGuessInput('');
    setResult(null);
  }

  function submitGuess() {
    const guess = parseFloat(guessInput);
    if (isNaN(guess)) return;
    const scored = scoreForecast(guess, round.actualValue);
    setResult({ guess, ...scored });
    setTotalPoints((prev) => prev + scored.points);
    setRoundHistory((prev) => [
      ...prev,
      {
        levelName: round.case_name,
        guess,
        actual: round.actualValue,
        errorPct: scored.errorPct,
        points: scored.points,
      },
    ]);
    setStage('result');
  }

  function nextRound() {
    if (roundIdx + 1 < FORECAST_ROUND_COUNT) {
      setRoundIdx((i) => i + 1);
      loadRound(usedTemplates);
      setStage('briefing');
    } else {
      recordGameResult(MODE, totalPoints);
      setStage('gameover');
    }
  }

  function finishGame(playerName) {
    const updated = submitScore(MODE, playerName, totalPoints, FORECAST_ROUND_COUNT);
    setScores(updated);
  }

  function playAgain() {
    setRoundIdx(0);
    setTotalPoints(0);
    setRoundHistory([]);
    setScores(getScores(MODE));
    loadRound([]);
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

  return (
    <div className="dd-shell">
      <div className="dd-topbar">
        <button className="dd-wordmark dd-wordmark--link" onClick={onExit}>
          ← Anomaly Hunt
        </button>
        <span className="dd-progress">
          Round {roundIdx + 1} of {FORECAST_ROUND_COUNT}
          <span className="dd-pill dd-pill--info">forecast</span>
        </span>
      </div>

      <div className="dd-scenario">
        <h2>{round.case_name}</h2>
        <p>{round.scenario}</p>
      </div>

      <div className="dd-chart-panel">
        <ForecastChart
          visibleSeries={round.visibleSeries}
          unit={round.unit}
          yLabel={round.y_label}
          targetDate={round.targetDate}
          guessValue={result?.guess ?? null}
          actualValue={stage === 'result' ? round.actualValue : null}
        />
        <p className="dd-chart-caption">
          {stage === 'briefing' || stage === 'guessing'
            ? `What will ${round.y_label.toLowerCase()} be on ${round.targetDate}? Base your call on the trend above.`
            : 'Blue dot = your call. Green star = what actually happened.'}
        </p>
      </div>

      {stage !== 'result' && (
        <div className="dd-actions">
          <input
            type="number"
            step="any"
            placeholder={`Your prediction (${round.unit === 'usd' ? '$' : ''}${round.unit === 'percent' ? '%' : ''})`}
            value={guessInput}
            onChange={(e) => setGuessInput(e.target.value)}
            style={{
              flex: 1,
              padding: '9px 12px',
              border: '1px solid var(--border-strong)',
              borderRadius: 6,
              fontSize: 14,
            }}
          />
          <button className="dd-btn dd-btn--primary" onClick={submitGuess} disabled={guessInput === ''}>
            Lock in prediction
          </button>
        </div>
      )}

      {stage === 'result' && (
        <>
          <div className="dd-result">
            <h3>Forecast result</h3>
            <p className="dd-result-line">
              You called <strong>{formatValue(result.guess, round.unit)}</strong> · Actual was{' '}
              <strong>{formatValue(round.actualValue, round.unit)}</strong> · Off by{' '}
              <strong>{result.errorPct}%</strong> · <strong>{result.points} pts</strong>
            </p>
            <p className="dd-methodology-note">
              Full credit within {FORECAST_FULL_CREDIT_PCT}% error, zero credit at {FORECAST_ZERO_CREDIT_PCT}%
              or more — partial credit fades linearly in between.
            </p>
          </div>
          <div className="dd-actions">
            <span />
            <button className="dd-btn dd-btn--primary" onClick={nextRound}>
              {roundIdx + 1 < FORECAST_ROUND_COUNT ? 'Next round' : 'Finish forecasting'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function downloadCsv(roundHistory, totalPoints) {
  const header = 'Round,Metric,Your Call,Actual,Error %,Points\n';
  const rows = roundHistory
    .map((r, i) => `${i + 1},"${r.levelName}",${r.guess},${r.actual},${r.errorPct},${r.points}`)
    .join('\n');
  const footer = `\nTotal,,,,,${totalPoints}\n`;
  const csv = header + rows + footer;

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `forecast-call-report-${new Date().toISOString().slice(0, 10)}.csv`;
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
      <h1 style={{ marginTop: 16 }}>Forecasting complete</h1>
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
          New round
        </button>
        <button className="dd-btn" onClick={() => downloadCsv(roundHistory, totalPoints)}>
          Download report (CSV)
        </button>
      </div>

      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Round summary</h3>
      <ul className="dd-leaderboard" style={{ marginBottom: 32 }}>
        {roundHistory.map((r, i) => (
          <li key={i}>
            <span>
              {i + 1}. {r.levelName} — off by {r.errorPct}%
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
