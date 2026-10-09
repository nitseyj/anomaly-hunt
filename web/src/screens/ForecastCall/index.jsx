import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PageShell } from '../../components/PageShell.jsx';
import { ObservationPanel } from '../../components/ObservationPanel.jsx';
import { ForecastChart } from '../../charts/ForecastChart.jsx';
import { Button } from '../../components/Button.jsx';
import { Pill } from '../../components/Pill.jsx';
import { ResultBreakdown } from '../../components/ResultBreakdown.jsx';
import { StampBadge } from '../../components/StampBadge.jsx';
import { Confetti } from '../../components/Confetti.jsx';
import { generateAnomalyCase, DIFFICULTY_SEQUENCE } from '../../engine/case.js';
import { generateForecastRound } from '../../engine/forecast.js';
import { scoreForecastAnswer, FORECAST_CONFIDENCE_LEVELS } from '../../engine/scoring.js';
import { createRng, randomSeed } from '../../engine/rng.js';
import { addHistoryEntry } from '../../engine/history.js';
import styles from './styles.module.css';

const ROUNDS = 5;

export function ForecastCall({ onNavigate }) {
  const [roundIndex, setRoundIndex] = useState(0);
  const [usedTemplateIds, setUsedTemplateIds] = useState([]);
  const [round, setRound] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [confidence, setConfidence] = useState('medium');
  const [revealed, setRevealed] = useState(false);
  const [outcome, setOutcome] = useState(null);
  const [roundResults, setRoundResults] = useState([]);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    startRound(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startRound(idx) {
    const difficulty = DIFFICULTY_SEQUENCE[idx % DIFFICULTY_SEQUENCE.length];
    const caseData = generateAnomalyCase(difficulty, usedTemplateIds, randomSeed());
    setUsedTemplateIds((prev) => [...prev, caseData.templateId]);
    const rng = createRng(randomSeed());
    const nextRound = generateForecastRound(caseData, rng);
    setRound({ ...nextRound, caseData });
    setSelectedId(null);
    setConfidence('medium');
    setRevealed(false);
    setOutcome(null);
  }

  function handleLock() {
    if (!selectedId) return;
    const isCorrect = selectedId === round.correctId;
    const scored = scoreForecastAnswer(isCorrect, confidence);
    setOutcome({ isCorrect, ...scored });
    setRevealed(true);
    setRoundResults((prev) => [...prev, { round, isCorrect, points: scored.points }]);

    addHistoryEntry({
      mode: 'forecast_call',
      caseTitle: round.caseData.title,
      questionType: round.type,
      confidence,
      isCorrect,
      points: scored.points,
    });
  }

  function handleNext() {
    if (roundIndex + 1 >= ROUNDS) {
      setFinished(true);
      return;
    }
    const nextIdx = roundIndex + 1;
    setRoundIndex(nextIdx);
    startRound(nextIdx);
  }

  if (!round) return null;

  if (finished) {
    const totalPoints = roundResults.reduce((sum, r) => sum + r.points, 0);
    const correctCount = roundResults.filter((r) => r.isCorrect).length;
    return (
      <PageShell eyebrow="Forecast Call — Session complete" title="Forecasts logged.">
        <ResultBreakdown
          total={totalPoints}
          totalLabel="Session score"
          rows={roundResults.map((r, i) => ({ label: `Round ${i + 1}: ${r.round.caseData.title}`, value: r.points }))}
        />
        <p className={styles.summaryLine}>
          {correctCount} / {roundResults.length} calls correct.
        </p>
        <div className={styles.nextRow}>
          <Button variant="primary" onClick={() => onNavigate('home')}>Back to home</Button>
        </div>
      </PageShell>
    );
  }

  function handleExit() {
    if (!revealed && (roundIndex > 0 || selectedId)) {
      if (!window.confirm('Leave this investigation? Your progress on this session will be lost.')) return;
    }
    onNavigate('home');
  }

  return (
    <PageShell
      eyebrow={`Forecast Call — Round ${roundIndex + 1} of ${ROUNDS}`}
      title={round.prompt}
      actions={<Button variant="ghost" size="sm" onClick={handleExit}>Exit</Button>}
    >
      <ObservationPanel title={round.caseData.title} brief={round.caseData.brief} difficulty={round.caseData.difficulty} label={round.caseData.label} />

      <div className={styles.chartWrap}>
        <ForecastChart visible={round.visible} hidden={round.hidden} unit={round.caseData.unit} revealed={revealed} />
      </div>

      <div className={styles.options}>
        {round.options.map((opt) => (
          <button
            key={opt.id}
            disabled={revealed}
            onClick={() => setSelectedId(opt.id)}
            className={`${styles.option} ${selectedId === opt.id ? styles.optionSelected : ''} ${
              revealed && opt.id === round.correctId ? styles.optionCorrect : ''
            } ${revealed && selectedId === opt.id && opt.id !== round.correctId ? styles.optionWrong : ''}`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {!revealed && (
        <div className={styles.confidenceRow}>
          <span className={styles.confidenceLabel}>Confidence:</span>
          {FORECAST_CONFIDENCE_LEVELS.map((level) => (
            <button
              key={level}
              onClick={() => setConfidence(level)}
              className={`${styles.confidenceBtn} ${confidence === level ? styles.confidenceActive : ''}`}
            >
              {level}
            </button>
          ))}
          <Button variant="primary" onClick={handleLock} disabled={!selectedId} className={styles.lockBtn}>
            Lock in
          </Button>
        </div>
      )}

      <AnimatePresence>
        {revealed && outcome && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className={styles.reveal}>
            <div className={styles.stampRow}>
              <StampBadge text={outcome.isCorrect ? 'Call Confirmed' : 'Call Missed'} tone={outcome.isCorrect ? 'signal' : 'alert'} />
              {outcome.isCorrect && outcome.points >= 100 && <Confetti />}
            </div>
            <p className={styles.outcomeLine}>
              Final value landed at <strong>{round.finalValue}</strong> — {outcome.isCorrect ? '+' : ''}
              {outcome.points} points at {(outcome.multiplier * 100).toFixed(0)}% stake.
            </p>
            <div className={styles.nextRow}>
              <Button variant="primary" onClick={handleNext}>
                {roundIndex + 1 >= ROUNDS ? 'Finish' : 'Next round →'}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageShell>
  );
}
