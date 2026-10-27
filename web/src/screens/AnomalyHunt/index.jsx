import { useEffect, useState } from 'react';
import { PageShell } from '../../components/PageShell.jsx';
import { ObservationPanel } from '../../components/ObservationPanel.jsx';
import { ReadyGate } from '../../components/ReadyGate.jsx';
import { CaseRevealPanel } from '../../components/CaseRevealPanel.jsx';
import { AnomalyChart } from '../../charts/AnomalyChart.jsx';
import { Button } from '../../components/Button.jsx';
import { ResultBreakdown } from '../../components/ResultBreakdown.jsx';
import { generateAnomalyCase, generateCaseFromSeries, DIFFICULTY_SEQUENCE } from '../../engine/case.js';
import { ANOMALY_TYPE_SHORT_LABELS } from '../../engine/anomalies.js';

// Enough days seeded up front for the rolling detectors' windows to have
// real data to work with (rollingIqrDetect's default window is 20;
// windowExcluding already handles partial windows at the series edges,
// so seeding a bit under that is fine) -- a live-replay case that opened
// with zero days visible would have nothing on the chart to even orient to.
const LIVE_REPLAY_SEED_DAYS = 14;
import { scoreAnomalyHunt, TIME_LIMIT_SECONDS, MAX_FLAGS_PER_CASE } from '../../engine/scoring.js';
import { runAllDetectors } from '../../engine/detectors.js';
import { useFlagging } from '../../engine/useFlagging.js';
import { useCountdownTimer } from '../../engine/useCountdownTimer.js';
import { addHistoryEntry } from '../../engine/history.js';
import { pushToast } from '../../engine/toastBus.js';
import { requestConfirm } from '../../engine/confirmBus.js';
import heroPhoto from '../../assets/photos/anomaly-satellite.jpg';
import styles from './styles.module.css';

export function AnomalyHunt({ onNavigate, importedSeries = null, importedMeta = null, practiceType = null }) {
  const [caseIndex, setCaseIndex] = useState(0);
  const [currentCase, setCurrentCase] = useState(null);
  const [usedTemplateIds, setUsedTemplateIds] = useState([]);
  const [revealed, setRevealed] = useState(false);
  const [result, setResult] = useState(null);
  const [detectorData, setDetectorData] = useState(null);
  const [caseResults, setCaseResults] = useState([]);
  const [finished, setFinished] = useState(false);
  const [started, setStarted] = useState(false);
  const [liveMode, setLiveMode] = useState(false);
  const [revealedCount, setRevealedCount] = useState(LIVE_REPLAY_SEED_DAYS);

  const { flags, yGuessMap, placeFlag, removeFlag, resetFlags } = useFlagging();
  const timer = useCountdownTimer(TIME_LIMIT_SECONDS, () => {
    if (!revealed && currentCase) handleReveal();
  });

  const totalCases = importedSeries ? 1 : DIFFICULTY_SEQUENCE.length;

  useEffect(() => {
    prepareCase(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Loads the case and its brief, but leaves the clock untouched --
  // nothing starts ticking until the player clicks through the
  // ReadyGate, so landing on a fresh case never ambushes them with a
  // countdown they haven't had a chance to read the brief for yet.
  function prepareCase(idx) {
    timer.stop();
    const difficulty = DIFFICULTY_SEQUENCE[idx % DIFFICULTY_SEQUENCE.length];
    const newCase = importedSeries
      ? generateCaseFromSeries(importedSeries, importedMeta?.unit, difficulty, importedMeta?.title)
      : generateAnomalyCase(difficulty, usedTemplateIds, null, practiceType);
    setUsedTemplateIds((prev) => [...prev, newCase.templateId]);
    setCurrentCase(newCase);
    resetFlags();
    timer.reset();
    setRevealed(false);
    setResult(null);
    setDetectorData(null);
    setStarted(false);
    setLiveMode(false);
    setRevealedCount(LIVE_REPLAY_SEED_DAYS);
  }

  function beginCase() {
    setStarted(true);
    timer.start();
  }

  function beginLiveCase() {
    setLiveMode(true);
    setStarted(true);
    timer.start();
  }

  function handleReveal() {
    timer.stop();
    const values = currentCase.series.map((p) => p.value);
    const scoreResult = scoreAnomalyHunt(flags.map((f) => f.index), currentCase.groundTruth, timer.secondsLeft, currentCase.series, yGuessMap);
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

    if (scoreResult.anomaliesMissed === 0 && scoreResult.falseAlarms === 0) {
      pushToast({ title: 'Clean Sweep', detail: 'Every anomaly flagged, zero false alarms.' });
    } else if (scoreResult.points >= 80) {
      pushToast({ title: 'Strong Case Work', detail: `+${scoreResult.points} points` });
    }
  }

  function handleNext() {
    if (caseIndex + 1 >= totalCases) {
      setFinished(true);
      return;
    }
    const nextIdx = caseIndex + 1;
    setCaseIndex(nextIdx);
    prepareCase(nextIdx);
  }

  async function handleExit() {
    if (!revealed && (flags.length > 0 || caseIndex > 0)) {
      const ok = await requestConfirm({
        title: 'Leave this investigation?',
        message:
          "Your progress on this case won't be saved — only a completed investigation is added to your match log. Opening Anomaly Hunt again starts a brand new case, not this one.",
        confirmLabel: 'Leave',
        cancelLabel: 'Stay',
      });
      if (!ok) return;
    }
    timer.stop();
    onNavigate('home', { skipGuard: true });
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
          <Button variant="primary" onClick={() => onNavigate('home', { skipGuard: true })}>Back to home</Button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      eyebrow={
        practiceType
          ? `Anomaly Hunt — Practice: ${ANOMALY_TYPE_SHORT_LABELS[practiceType]} — Case ${caseIndex + 1} of ${totalCases}`
          : `Anomaly Hunt — Case ${caseIndex + 1} of ${totalCases}`
      }
      title={revealed ? 'Case review' : 'Find what broke.'}
      photo={{
        src: heroPhoto,
        caption: "Somewhere in this signal, something doesn't belong. You get one pass before the window closes.",
        credit: 'Photo — Stephan Widua / Unsplash',
      }}
      actions={
        <div className={styles.timerWrap}>
          <Button variant="ghost" size="sm" onClick={handleExit}>Exit</Button>
          {started && <span className={`${styles.timerValue} ${timer.secondsLeft <= 10 ? styles.timerUrgent : ''}`}>{timer.secondsLeft}s</span>}
        </div>
      }
    >
      <ObservationPanel title={currentCase.title} brief={currentCase.brief} difficulty={currentCase.difficulty} label={currentCase.label} />

      {!started && (
        <ReadyGate
          detail={`You'll have ${TIME_LIMIT_SECONDS} seconds once the clock starts. Read the brief above, then start when you're ready. "Start live replay" reveals the case one day at a time instead of all at once, for practicing real-time judgement.`}
          buttonLabel="Start case"
          onStart={beginCase}
          secondaryLabel="Start live replay"
          onSecondaryStart={beginLiveCase}
        />
      )}

      {started && (
        <>
          <div className={styles.chartWrap}>
            <AnomalyChart
              series={currentCase.series}
              unit={currentCase.unit}
              flags={flags}
              maxFlags={MAX_FLAGS_PER_CASE}
              onPlaceFlag={placeFlag}
              onRemoveFlag={removeFlag}
              groundTruth={currentCase.groundTruth}
              revealed={revealed}
              detectorFlags={detectorData?.combinedFlags}
              rollingBandStats={detectorData?.statsByDetector?.rolling_zscore}
              visibleCount={liveMode && !revealed ? revealedCount : null}
              disabled={revealed}
            />
          </div>

          {!revealed && (
            <div className={styles.controls}>
              <p className={styles.hint}>
                {liveMode && `Day ${revealedCount} of ${currentCase.series.length} revealed. `}
                Click or drag-throw onto the chart to flag a point (or focus the chart and use arrow keys + Enter). Up to {MAX_FLAGS_PER_CASE} flags.
              </p>
              {liveMode && revealedCount < currentCase.series.length ? (
                <Button variant="primary" onClick={() => setRevealedCount((c) => Math.min(c + 1, currentCase.series.length))}>
                  Next day →
                </Button>
              ) : (
                <Button variant="primary" onClick={handleReveal}>
                  {liveMode ? 'Reached today — lock in' : 'Lock in'}
                </Button>
              )}
            </div>
          )}
        </>
      )}

      {revealed && result && (
        <CaseRevealPanel
          result={result}
          detectorData={detectorData}
          series={currentCase.series}
          footer={
            <Button variant="primary" onClick={handleNext}>
              {caseIndex + 1 >= totalCases ? 'Finish' : 'Next case →'}
            </Button>
          }
        />
      )}
    </PageShell>
  );
}
