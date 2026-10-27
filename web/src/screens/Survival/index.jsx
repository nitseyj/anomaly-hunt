/**
 * Survival/index.jsx
 *
 * Endless mode: cases keep coming with rising difficulty
 * (survivalSettingsForWave(), see case.js/anomalies.js) until a wave is
 * missed, which ends the run. False alarms still cost points via the
 * normal penalty but don't end the run by themselves -- only missing a
 * real anomaly does, so a misclick isn't punished twice. Reaching wave N
 * (even the one that ends the run) counts as "got to wave N" for the
 * best-run stat, the usual survival-game convention.
 *
 * Deliberately a separate screen rather than another AnomalyHunt prop --
 * AnomalyHunt already juggles imported data / practice type / live
 * replay, and Survival's shape (unbounded waves, a different end
 * condition, a different progress indicator, a different game-over
 * screen) is enough of a departure to follow the Daily Challenge
 * precedent instead: a new screen reusing the same shared chart/
 * flagging/timer/reveal plumbing.
 */
import { useEffect, useState } from 'react';
import { PageShell } from '../../components/PageShell.jsx';
import { ObservationPanel } from '../../components/ObservationPanel.jsx';
import { ReadyGate } from '../../components/ReadyGate.jsx';
import { CaseRevealPanel } from '../../components/CaseRevealPanel.jsx';
import { AnomalyChart } from '../../charts/AnomalyChart.jsx';
import { Button } from '../../components/Button.jsx';
import { ResultBreakdown } from '../../components/ResultBreakdown.jsx';
import { generateSurvivalCase } from '../../engine/case.js';
import { scoreAnomalyHunt, TIME_LIMIT_SECONDS, MAX_FLAGS_PER_CASE } from '../../engine/scoring.js';
import { runAllDetectors } from '../../engine/detectors.js';
import { useFlagging } from '../../engine/useFlagging.js';
import { useCountdownTimer } from '../../engine/useCountdownTimer.js';
import { addHistoryEntry } from '../../engine/history.js';
import { getProfile } from '../../engine/profile.js';
import { pushToast } from '../../engine/toastBus.js';
import { requestConfirm } from '../../engine/confirmBus.js';
import heroPhoto from '../../assets/photos/anomaly-satellite.jpg';
import styles from './styles.module.css';

export function Survival({ onNavigate }) {
  const [wave, setWave] = useState(1);
  const [currentCase, setCurrentCase] = useState(null);
  const [usedTemplateIds, setUsedTemplateIds] = useState([]);
  const [revealed, setRevealed] = useState(false);
  const [result, setResult] = useState(null);
  const [detectorData, setDetectorData] = useState(null);
  const [waveResults, setWaveResults] = useState([]);
  const [runOver, setRunOver] = useState(false);
  const [started, setStarted] = useState(false);
  // The best run BEFORE the run currently in progress started, so the
  // run-over screen can compare this run's result against it. Re-read on
  // every "Try again" (handleTryAgain below), not just once at mount --
  // a lazy-initializer-only read would freeze this at whatever the best
  // was before the FIRST run of the session, silently going stale after
  // every run after that one.
  const [bestWaveBeforeRun, setBestWaveBeforeRun] = useState(() => getProfile().bestSurvivalWave);

  const { flags, yGuessMap, placeFlag, removeFlag, resetFlags } = useFlagging();
  const timer = useCountdownTimer(TIME_LIMIT_SECONDS, () => {
    if (!revealed && currentCase) handleReveal();
  });

  useEffect(() => {
    prepareCase(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function prepareCase(w) {
    timer.stop();
    const newCase = generateSurvivalCase(w, usedTemplateIds);
    setUsedTemplateIds((prev) => [...prev, newCase.templateId]);
    setCurrentCase(newCase);
    resetFlags();
    timer.reset();
    setRevealed(false);
    setResult(null);
    setDetectorData(null);
    setStarted(false);
  }

  function beginCase() {
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
    setWaveResults((prev) => [...prev, { case: currentCase, score: scoreResult }]);

    const survived = scoreResult.anomaliesMissed === 0;
    addHistoryEntry({
      mode: 'survival',
      caseTitle: currentCase.title,
      difficulty: currentCase.difficulty,
      wave,
      points: scoreResult.points,
      anomaliesFound: scoreResult.anomaliesFound,
      anomaliesMissed: scoreResult.anomaliesMissed,
      hits: scoreResult.hits,
      survived,
    });

    if (!survived) {
      pushToast({ title: 'Run over', detail: `Reached wave ${wave}.` });
    } else if (wave % 5 === 0) {
      pushToast({ title: `Wave ${wave} cleared`, detail: 'The pace is picking up.' });
    }
  }

  function handleNextWave() {
    const next = wave + 1;
    setWave(next);
    prepareCase(next);
  }

  function handleTryAgain() {
    setBestWaveBeforeRun(getProfile().bestSurvivalWave);
    setWave(1);
    setWaveResults([]);
    setRunOver(false);
    prepareCase(1);
  }

  async function handleExit() {
    if (!revealed && (flags.length > 0 || wave > 1)) {
      const ok = await requestConfirm({
        title: 'Leave this run?',
        message:
          "Only completed waves are already in your match log -- the wave in progress won't be saved. Opening Survival again starts a brand new run from wave 1.",
        confirmLabel: 'Leave',
        cancelLabel: 'Stay',
      });
      if (!ok) return;
    }
    timer.stop();
    onNavigate('home', { skipGuard: true });
  }

  if (!currentCase) return null;

  if (runOver) {
    const totalPoints = waveResults.reduce((sum, w) => sum + w.score.points, 0);
    const bestWave = Math.max(bestWaveBeforeRun, wave);
    return (
      <PageShell eyebrow="Survival — Run over" title={`Reached wave ${wave}.`}>
        <ResultBreakdown
          total={totalPoints}
          totalLabel="Run score"
          rows={waveResults.map((w, i) => ({ label: `Wave ${i + 1}: ${w.case.title}`, value: w.score.points }))}
        />
        <p className={styles.summaryLine}>
          Best run: wave {bestWave}
          {bestWave === wave && bestWave > bestWaveBeforeRun ? ' — new best.' : '.'}
        </p>
        <div className={styles.nextRow}>
          <Button variant="ghost" onClick={() => onNavigate('home', { skipGuard: true })}>Back to home</Button>
          <Button variant="primary" onClick={handleTryAgain}>Try again</Button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      eyebrow={`Survival — Wave ${wave}`}
      title={revealed ? 'Wave review' : 'Hold the line.'}
      photo={{
        src: heroPhoto,
        caption: 'One miss ends it. Every wave past the last is a new best.',
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
          detail={`You'll have ${TIME_LIMIT_SECONDS} seconds once the clock starts. One miss ends the run — false alarms still cost points but won't end it by themselves.${bestWaveBeforeRun > 0 ? ` Your best run so far: wave ${bestWaveBeforeRun}.` : ''}`}
          buttonLabel="Start wave"
          onStart={beginCase}
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
              disabled={revealed}
            />
          </div>

          {!revealed && (
            <div className={styles.controls}>
              <p className={styles.hint}>
                Click or drag-throw onto the chart to flag a point (or focus the chart and use arrow keys + Enter). Up to {MAX_FLAGS_PER_CASE} flags.
              </p>
              <Button variant="primary" onClick={handleReveal}>Lock in</Button>
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
            result.anomaliesMissed === 0 ? (
              <Button variant="primary" onClick={handleNextWave}>Next wave →</Button>
            ) : (
              <Button variant="primary" onClick={() => setRunOver(true)}>End run</Button>
            )
          }
        />
      )}
    </PageShell>
  );
}
