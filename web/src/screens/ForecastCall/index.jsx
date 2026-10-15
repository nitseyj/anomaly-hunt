import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PageShell } from '../../components/PageShell.jsx';
import { ObservationPanel } from '../../components/ObservationPanel.jsx';
import { ReadyGate } from '../../components/ReadyGate.jsx';
import { ForecastChart } from '../../charts/ForecastChart.jsx';
import { Button } from '../../components/Button.jsx';
import { Pill } from '../../components/Pill.jsx';
import { StakeGauge } from '../../components/StakeGauge.jsx';
import { ResultBreakdown } from '../../components/ResultBreakdown.jsx';
import { StampBadge } from '../../components/StampBadge.jsx';
import { Confetti } from '../../components/Confetti.jsx';
import { generateAnomalyCase, DIFFICULTY_SEQUENCE } from '../../engine/case.js';
import { generateForecastRound } from '../../engine/forecast.js';
import { scoreForecastAnswer } from '../../engine/scoring.js';
import { createRng, randomSeed } from '../../engine/rng.js';
import { addHistoryEntry } from '../../engine/history.js';
import { pushToast } from '../../engine/toastBus.js';
import { requestConfirm } from '../../engine/confirmBus.js';
import heroPhoto from '../../assets/photos/forecast-fog.jpg';
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
  const [started, setStarted] = useState(false);

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
    setStarted(false);
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

    if (isCorrect && confidence === 'high') {
      pushToast({ title: 'Confident Call Confirmed', detail: `+${scored.points} points at high stake` });
    }
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
          <Button variant="primary" onClick={() => onNavigate('home', { skipGuard: true })}>Back to home</Button>
        </div>
      </PageShell>
    );
  }

  async function handleExit() {
    if (!revealed && (roundIndex > 0 || selectedId)) {
      const ok = await requestConfirm({
        title: 'Leave this investigation?',
        message:
          "Your progress on this round won't be saved — only a completed session is added to your match log. Opening Forecast Call again starts a brand new round, not this one.",
        confirmLabel: 'Leave',
        cancelLabel: 'Stay',
      });
      if (!ok) return;
    }
    onNavigate('home', { skipGuard: true });
  }

  return (
    <PageShell
      eyebrow={`Forecast Call — Round ${roundIndex + 1} of ${ROUNDS}`}
      title={round.prompt}
      photo={{
        src: heroPhoto,
        caption: 'The trail goes dark past this point. Call it before the fog lifts.',
        credit: 'Photo — Jakub Kriz / Unsplash',
      }}
      actions={<Button variant="ghost" size="sm" onClick={handleExit}>Exit</Button>}
    >
      <ObservationPanel title={round.caseData.title} brief={round.caseData.brief} difficulty={round.caseData.difficulty} label={round.caseData.label} />

      {!started && (
        <ReadyGate
          detail="No clock on this one -- take your time with the brief. The hidden tail locks away and the round begins the moment you start."
          buttonLabel="Start round"
          onStart={() => setStarted(true)}
        />
      )}

      {started && (
        <>
          <div className={styles.chartWrap}>
            <ForecastChart visible={round.visible} hidden={round.hidden} unit={round.caseData.unit} revealed={revealed} />
          </div>

          <div className={styles.options}>
            {round.options.map((opt, i) => {
              const letter = String.fromCharCode(65 + i);
              const isSelected = selectedId === opt.id;
              const isCorrect = revealed && opt.id === round.correctId;
              const isWrong = revealed && isSelected && opt.id !== round.correctId;
              return (
                <motion.button
                  key={opt.id}
                  disabled={revealed}
                  onClick={() => setSelectedId(opt.id)}
                  whileTap={!revealed ? { scale: 0.98 } : undefined}
                  className={`${styles.option} ${isSelected ? styles.optionSelected : ''} ${isCorrect ? styles.optionCorrect : ''} ${isWrong ? styles.optionWrong : ''}`}
                >
                  <span className={styles.optionLetter}>{letter}</span>
                  <span className={styles.optionLabel}>{opt.label}</span>
                  <AnimatePresence>
                    {isSelected && !revealed && (
                      <motion.span
                        className={styles.optionCheck}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                      >
                        ✓
                      </motion.span>
                    )}
                  </AnimatePresence>
                  {isCorrect && <span className={styles.optionBadge}>CORRECT</span>}
                  {isWrong && <span className={styles.optionBadgeWrong}>YOUR CALL</span>}
                </motion.button>
              );
            })}
          </div>

          {!revealed && (
            <div className={styles.confidenceRow}>
              <div className={styles.gaugeCol}>
                <span className={styles.confidenceLabel}>Stake your confidence</span>
                <StakeGauge value={confidence} onChange={setConfidence} />
              </div>
              <Button variant="primary" onClick={handleLock} disabled={!selectedId} className={styles.lockBtn}>
                Lock in
              </Button>
            </div>
          )}
        </>
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
