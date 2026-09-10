import { useState } from 'react';
import ForecastChart from './ForecastChart.jsx';
import { generateForecast, FORECAST_ROUND_COUNT, FORECAST_HIDDEN_DAYS } from '../game-logic/forecastGenerator.js';
import { scoreForecastAnswer, CONFIDENCE_LEVELS } from '../game-logic/forecastScoring.js';
import { getScores, submitScore } from '../game-logic/leaderboard.js';
import { recordGameResult, recordForecastCase } from '../game-logic/profile.js';
import { addHistoryEntry } from '../game-logic/history.js';
import { useCountUp } from '../game-logic/useCountUp.js';
import ConfettiBurst from './ConfettiBurst.jsx';

const MODE = 'forecast_call';
const CONFIDENCE_LABELS = { low: 'Low', medium: 'Medium', high: 'High' };

// Stages: 'answering' -> 'result' -> (loop) -> 'gameover'
export default function ForecastCallGame({ onExit }) {
  const [stage, setStage] = useState('answering');
  const [roundIdx, setRoundIdx] = useState(0);
  const [round, setRound] = useState(() => generateForecast([]));
  const [usedTemplates, setUsedTemplates] = useState([round.templateId]);
  const [selectedOption, setSelectedOption] = useState(null);
  const [confidence, setConfidence] = useState(null);
  const [result, setResult] = useState(null);
  const [totalPoints, setTotalPoints] = useState(0);
  const [scores, setScores] = useState(getScores(MODE));
  const [roundHistory, setRoundHistory] = useState([]);

  function loadRound(priorUsedTemplates) {
    const next = generateForecast(priorUsedTemplates);
    setRound(next);
    setUsedTemplates([...priorUsedTemplates, next.templateId]);
    setSelectedOption(null);
    setConfidence(null);
    setResult(null);
  }

  function submitAnswer() {
    if (selectedOption === null || confidence === null) return;
    const isCorrect = selectedOption === round.correctIndex;
    const scored = scoreForecastAnswer(isCorrect, confidence);
    setResult({ isCorrect, ...scored });
    setTotalPoints((prev) => prev + scored.points);
    recordForecastCase(isCorrect);
    addHistoryEntry({
      mode: 'forecast_call',
      metric: round.y_label,
      questionType: round.questionType,
      score: scored.points,
      isCorrect,
    });
    setRoundHistory((prev) => [
      ...prev,
      {
        levelName: round.case_name,
        questionType: round.questionType,
        yourAnswer: round.options[selectedOption],
        actual: round.options[round.correctIndex],
        isCorrect,
        confidence,
        points: scored.points,
      },
    ]);
    setStage('result');
  }

  function nextRound() {
    if (roundIdx + 1 < FORECAST_ROUND_COUNT) {
      setRoundIdx((i) => i + 1);
      loadRound(usedTemplates);
      setStage('answering');
    } else {
      recordGameResult(MODE, Math.max(0, totalPoints));
      setStage('gameover');
    }
  }

  function finishGame(playerName) {
    const updated = submitScore(MODE, playerName, Math.max(0, totalPoints), FORECAST_ROUND_COUNT);
    setScores(updated);
  }

  function playAgain() {
    setRoundIdx(0);
    setTotalPoints(0);
    setRoundHistory([]);
    setScores(getScores(MODE));
    loadRound([]);
    setStage('answering');
  }

  if (stage === 'gameover') {
    return (
      <GameOverScreen
        totalPoints={Math.max(0, totalPoints)}
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
          Case {roundIdx + 1} of {FORECAST_ROUND_COUNT}
          <span className="dd-pill dd-pill--info">forecast</span>
        </span>
      </div>

      <div className="dd-scenario dd-fade-slide-in" key={`scenario-${round.genId}`}>
        <h2>{round.case_name}</h2>
        <p>{round.scenario}</p>
      </div>

      <div className="dd-chart-panel dd-fade-slide-in" key={`chart-panel-${round.genId}`}>
        <ForecastChart
          key={round.genId}
          visibleSeries={round.visibleSeries}
          futureSeries={round.futureSeries}
          unit={round.unit}
          yLabel={round.y_label}
          targetDate={round.targetDate}
          revealed={stage === 'result'}
        />
        <p className="dd-chart-caption">
          {stage === 'answering'
            ? `Only history up to the cutoff is shown. Predict the next ${FORECAST_HIDDEN_DAYS} days from the trend above.`
            : 'Dashed green line shows what actually happened after the cutoff.'}
        </p>
      </div>

      {stage === 'answering' && (
        <McqPanel
          round={round}
          selectedOption={selectedOption}
          onSelectOption={setSelectedOption}
          confidence={confidence}
          onSelectConfidence={setConfidence}
          onSubmit={submitAnswer}
        />
      )}

      {stage === 'result' && (
        <>
          <ForecastResult result={result} round={round} selectedOption={selectedOption} confidence={confidence} />
          <div className="dd-actions">
            <span />
            <button className="dd-btn dd-btn--primary" onClick={nextRound}>
              {roundIdx + 1 < FORECAST_ROUND_COUNT ? 'Next case' : 'Finish forecasting'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function McqPanel({ round, selectedOption, onSelectOption, confidence, onSelectConfidence, onSubmit }) {
  const canSubmit = selectedOption !== null && confidence !== null;

  return (
    <div className="dd-mcq-panel dd-fade-slide-in">
      <p className="dd-mcq-question">{round.question}</p>
      <div className="dd-mcq-options">
        {round.options.map((opt, i) => (
          <button
            key={i}
            className={`dd-mcq-option ${selectedOption === i ? 'dd-mcq-option--selected' : ''}`}
            onClick={() => onSelectOption(i)}
          >
            <span className="dd-mcq-option-letter">{String.fromCharCode(65 + i)}</span>
            <span>{opt}</span>
          </button>
        ))}
      </div>

      <p className="dd-mcq-confidence-label">How confident are you?</p>
      <div className="dd-confidence-row">
        {CONFIDENCE_LEVELS.map((level) => (
          <button
            key={level}
            className={`dd-confidence-btn ${confidence === level ? 'dd-confidence-btn--selected' : ''}`}
            onClick={() => onSelectConfidence(level)}
          >
            {CONFIDENCE_LABELS[level]}
          </button>
        ))}
      </div>

      <div className="dd-actions">
        <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
          Higher confidence raises both the reward and the penalty.
        </span>
        <button className="dd-btn dd-btn--primary" onClick={onSubmit} disabled={!canSubmit}>
          Lock in forecast
        </button>
      </div>
    </div>
  );
}

function ForecastResult({ result, round, selectedOption, confidence }) {
  const bigWin = result.isCorrect && confidence === 'high';

  return (
    <div className="dd-result dd-fade-slide-in">
      <ConfettiBurst trigger={bigWin} />
      <h3>{result.isCorrect ? 'Correct call' : 'Missed call'}</h3>
      <p className="dd-result-line">
        Your prediction <strong>{round.options[selectedOption]}</strong> · Actual{' '}
        <strong>{round.options[round.correctIndex]}</strong>
      </p>
      <p className="dd-result-line">
        Confidence <strong>{CONFIDENCE_LABELS[confidence]}</strong> ({result.multiplier}×) ·{' '}
        <strong style={{ color: result.points >= 0 ? 'var(--success)' : 'var(--danger)' }}>
          {result.points >= 0 ? '+' : ''}
          {result.points} pts
        </strong>
      </p>
      <p className="dd-methodology-note">{round.explanation}</p>
    </div>
  );
}

function downloadCsv(roundHistory, totalPoints) {
  const header = 'Case,Question Type,Your Answer,Actual,Correct,Confidence,Points\n';
  const rows = roundHistory
    .map(
      (r, i) =>
        `${i + 1},"${r.levelName}",${r.questionType},"${r.yourAnswer}","${r.actual}",${r.isCorrect},${r.confidence},${r.points}`
    )
    .join('\n');
  const footer = `\nTotal,,,,,,${totalPoints}\n`;
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
  const correctCount = roundHistory.filter((r) => r.isCorrect).length;
  const displayedScore = useCountUp(totalPoints, 1100);
  const strongSession = roundHistory.length > 0 && correctCount / roundHistory.length >= 0.6;

  return (
    <div className="dd-gameover">
      <button className="dd-wordmark dd-wordmark--link" onClick={onExit}>
        ← Anomaly Hunt
      </button>
      <h1 style={{ marginTop: 16 }}>Forecasting complete</h1>
      <div className="dd-score-wrap">
        <ConfettiBurst trigger={strongSession} />
        <div className="dd-score">{displayedScore} pts</div>
      </div>
      <p style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: -16, marginBottom: 20 }}>
        {correctCount} of {roundHistory.length} calls correct
      </p>

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
          New forecast session
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
              {i + 1}. {r.levelName} — {r.isCorrect ? 'correct' : 'incorrect'} ({r.confidence} confidence)
            </span>
            <span>
              {r.points >= 0 ? '+' : ''}
              {r.points} pts
            </span>
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
