import { useState } from 'react';
import { motion } from 'motion/react';
import ForecastChart from '../../charts/ForecastChart.jsx';
import { PageShell, TopBar } from '../../components/PageShell.jsx';
import { Button } from '../../components/Button.jsx';
import { Panel } from '../../components/Card.jsx';
import { Pill } from '../../components/Pill.jsx';
import { Confetti } from '../../components/Confetti.jsx';
import { generateForecastRound, FORECAST_ROUND_COUNT, FORECAST_HIDDEN_DAYS } from '../../engine/forecast.js';
import { scoreForecastAnswer, FORECAST_CONFIDENCE_LEVELS } from '../../engine/scoring.js';
import { getScores, submitScore } from '../../engine/leaderboard.js';
import { recordGameResult, recordForecastCase } from '../../engine/profile.js';
import { addHistoryEntry } from '../../engine/history.js';
import { useCountUp } from '../../engine/useCountUp.js';
import styles from './ForecastCall.module.css';

const MODE = 'forecast_call';
const CONFIDENCE_LABELS = { low: 'Low', medium: 'Medium', high: 'High' };

export default function ForecastCallScreen({ onExit }) {
  const [roundIdx, setRoundIdx] = useState(0);
  const [usedTemplates, setUsedTemplates] = useState([]);
  const [round, setRound] = useState(() => generateForecastRound([]));
  const [selectedOption, setSelectedOption] = useState(null);
  const [confidence, setConfidence] = useState(null);
  const [result, setResult] = useState(null);
  const [totalPoints, setTotalPoints] = useState(0);
  const [scores, setScores] = useState(getScores(MODE));
  const [roundHistory, setRoundHistory] = useState([]);
  const [gameOver, setGameOver] = useState(false);

  function submitAnswer() {
    if (selectedOption === null || confidence === null) return;
    const isCorrect = selectedOption === round.correctIndex;
    const scored = scoreForecastAnswer(isCorrect, confidence);
    setResult({ isCorrect, ...scored });
    setTotalPoints((p) => p + scored.points);
    recordForecastCase(isCorrect);
    addHistoryEntry({ mode: 'forecast_call', metric: round.label, questionType: round.questionType, score: scored.points, isCorrect });
    setRoundHistory((prev) => [...prev, { title: round.title, questionType: round.questionType, isCorrect, confidence, points: scored.points }]);
  }

  function nextRound() {
    if (roundIdx + 1 < FORECAST_ROUND_COUNT) {
      const next = generateForecastRound(usedTemplates);
      setUsedTemplates((prev) => [...prev, next.templateId]);
      setRoundIdx((i) => i + 1);
      setRound(next);
      setSelectedOption(null);
      setConfidence(null);
      setResult(null);
    } else {
      recordGameResult(MODE, Math.max(0, totalPoints));
      setGameOver(true);
    }
  }

  if (gameOver) {
    return (
      <ForecastGameOver
        totalPoints={Math.max(0, totalPoints)}
        scores={scores}
        roundHistory={roundHistory}
        onExit={onExit}
        onSubmitName={(name) => setScores(submitScore(MODE, name, Math.max(0, totalPoints), FORECAST_ROUND_COUNT))}
      />
    );
  }

  return (
    <PageShell>
      <TopBar onBack={onExit} right={<>Case {roundIdx + 1} of {FORECAST_ROUND_COUNT} <Pill tone="info">forecast</Pill></>} />
      <motion.div key={round.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
        <Panel className={styles.scenario}>
          <h2>{round.title}</h2>
          <p>{round.brief}</p>
        </Panel>

        <div className={styles.chartPanel}>
          <ForecastChart visibleSeries={round.visibleSeries} futureSeries={round.futureSeries} unit={round.unit} label={round.label} revealed={!!result} />
          <p className={styles.caption}>
            {!result ? `Only history up to the cutoff is shown. Predict the next ${FORECAST_HIDDEN_DAYS} days from the trend above.` : 'Dashed green line shows what actually happened after the cutoff.'}
          </p>
        </div>

        {!result && (
          <div className={styles.mcqPanel}>
            <p className={styles.question}>{round.question}</p>
            <div className={styles.options}>
              {round.options.map((opt, i) => (
                <button key={i} className={[styles.option, selectedOption === i ? styles.optionSelected : ''].filter(Boolean).join(' ')} onClick={() => setSelectedOption(i)}>
                  <span className={styles.optionLetter}>{String.fromCharCode(65 + i)}</span>
                  <span>{opt}</span>
                </button>
              ))}
            </div>

            <p className={styles.confidenceLabel}>How confident are you?</p>
            <div className={styles.confidenceRow}>
              {FORECAST_CONFIDENCE_LEVELS.map((level) => (
                <button key={level} className={[styles.confidenceBtn, confidence === level ? styles.confidenceSelected : ''].filter(Boolean).join(' ')} onClick={() => setConfidence(level)}>
                  {CONFIDENCE_LABELS[level]}
                </button>
              ))}
            </div>

            <div className={styles.actions}>
              <span className={styles.hint}>Higher confidence raises both the reward and the penalty.</span>
              <Button variant="primary" onClick={submitAnswer} disabled={selectedOption === null || confidence === null}>
                Lock in forecast
              </Button>
            </div>
          </div>
        )}

        {result && (
          <>
            <Panel className={styles.resultPanel}>
              <Confetti trigger={result.isCorrect && confidence === 'high'} />
              <h3>{result.isCorrect ? 'Correct call' : 'Missed call'}</h3>
              <p className={styles.resultLine}>
                Your prediction <strong>{round.options[selectedOption]}</strong> · Actual <strong>{round.options[round.correctIndex]}</strong>
              </p>
              <p className={styles.resultLine}>
                Confidence <strong>{CONFIDENCE_LABELS[confidence]}</strong> ({result.multiplier}×) ·{' '}
                <strong className={result.points >= 0 ? styles.success : styles.danger}>
                  {result.points >= 0 ? '+' : ''}
                  {result.points} pts
                </strong>
              </p>
              <p className={styles.note}>{round.explanation}</p>
            </Panel>
            <div className={styles.actions}>
              <span />
              <Button variant="primary" onClick={nextRound}>
                {roundIdx + 1 < FORECAST_ROUND_COUNT ? 'Next case' : 'Finish forecasting'}
              </Button>
            </div>
          </>
        )}
      </motion.div>
    </PageShell>
  );
}

function ForecastGameOver({ totalPoints, scores, roundHistory, onSubmitName, onExit }) {
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const correctCount = roundHistory.filter((r) => r.isCorrect).length;
  const displayedScore = useCountUp(totalPoints, 1100);
  const strongSession = roundHistory.length > 0 && correctCount / roundHistory.length >= 0.6;

  return (
    <PageShell>
      <TopBar onBack={onExit} />
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Forecasting complete</h1>
      <div className={styles.scoreWrap}>
        <Confetti trigger={strongSession} />
        <div className={styles.score}>{displayedScore} pts</div>
      </div>
      <p style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: -16, marginBottom: 20 }}>
        {correctCount} of {roundHistory.length} calls correct
      </p>

      {!submitted ? (
        <div className={styles.nameRow}>
          <input className={styles.nameInput} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
          <Button variant="primary" onClick={() => { onSubmitName(name); setSubmitted(true); }}>
            Save score
          </Button>
        </div>
      ) : (
        <p style={{ fontSize: 13, color: 'var(--ink-muted)', marginBottom: 24 }}>Saved to this browser's leaderboard.</p>
      )}

      <Button variant="primary" onClick={onExit} style={{ marginBottom: 32 }}>
        Done
      </Button>

      <h3 style={{ fontSize: 14, marginBottom: 8 }}>Round summary</h3>
      <ul className={styles.leaderboard} style={{ marginBottom: 32 }}>
        {roundHistory.map((r, i) => (
          <li key={i}>
            <span>
              {i + 1}. {r.title} — {r.isCorrect ? 'correct' : 'incorrect'} ({r.confidence} confidence)
            </span>
            <span>
              {r.points >= 0 ? '+' : ''}
              {r.points} pts
            </span>
          </li>
        ))}
      </ul>

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
