import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { PageShell } from '../../components/PageShell.jsx';
import { ObservationPanel } from '../../components/ObservationPanel.jsx';
import { ReadyGate } from '../../components/ReadyGate.jsx';
import { CaseRevealPanel } from '../../components/CaseRevealPanel.jsx';
import { AnomalyChart } from '../../charts/AnomalyChart.jsx';
import { Button } from '../../components/Button.jsx';
import { Pill } from '../../components/Pill.jsx';
import { ResultBreakdown } from '../../components/ResultBreakdown.jsx';
import { StampBadge } from '../../components/StampBadge.jsx';
import { getTodayChallenge, getTodayResult, saveTodayResult, msUntilNextDaily } from '../../engine/daily.js';
import { scoreAnomalyHunt, TIME_LIMIT_SECONDS, MAX_FLAGS_PER_CASE } from '../../engine/scoring.js';
import { runAllDetectors } from '../../engine/detectors.js';
import { useFlagging } from '../../engine/useFlagging.js';
import { useCountdownTimer } from '../../engine/useCountdownTimer.js';
import { addHistoryEntry } from '../../engine/history.js';
import { getProfile } from '../../engine/profile.js';
import { pushToast } from '../../engine/toastBus.js';
import { requestConfirm } from '../../engine/confirmBus.js';
import heroPhoto from '../../assets/photos/daily-sunrise.jpg';
import styles from './styles.module.css';
import sharedStyles from '../AnomalyHunt/styles.module.css';

function formatCountdown(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const s = String(totalSeconds % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function NextCaseCountdown() {
  const [remaining, setRemaining] = useState(() => msUntilNextDaily());
  useEffect(() => {
    const id = setInterval(() => setRemaining(msUntilNextDaily()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className={styles.countdown}>
      <span className={styles.countdownLabel}>Next shared case in</span>
      <span className={styles.countdownValue}>{formatCountdown(remaining)}</span>
    </div>
  );
}

export function DailyChallenge({ onNavigate }) {
  const challenge = useMemo(() => getTodayChallenge(), []);
  const existingResult = useMemo(() => getTodayResult(), []);
  const profile = useMemo(() => getProfile(), []);

  const [revealed, setRevealed] = useState(Boolean(existingResult));
  const [result, setResult] = useState(existingResult?.score ?? null);
  const [detectorData, setDetectorData] = useState(null);
  // A past (or already-revealed) attempt has nothing left to "start" --
  // only a fresh attempt goes through the ReadyGate.
  const [started, setStarted] = useState(Boolean(existingResult));

  const { flags, yGuessMap, placeFlag, removeFlag } = useFlagging();
  const timer = useCountdownTimer(TIME_LIMIT_SECONDS, () => {
    if (!revealed) handleReveal();
  });

  function beginChallenge() {
    setStarted(true);
    timer.start();
  }

  function handleReveal() {
    timer.stop();
    const values = challenge.series.map((p) => p.value);
    const scoreResult = scoreAnomalyHunt(flags.map((f) => f.index), challenge.groundTruth, timer.secondsLeft, challenge.series, yGuessMap);
    const detectors = runAllDetectors(values, challenge.groundTruth);
    setResult(scoreResult);
    setDetectorData(detectors);
    setRevealed(true);

    saveTodayResult({ score: scoreResult });
    addHistoryEntry({
      mode: 'daily_challenge',
      caseTitle: challenge.title,
      dailyLabel: challenge.dailyLabel,
      points: scoreResult.points,
      anomaliesFound: scoreResult.anomaliesFound,
      anomaliesMissed: scoreResult.anomaliesMissed,
      hits: scoreResult.hits,
    });

    const streak = getProfile().dailyStreak;
    if (streak > 0 && streak % 3 === 0) {
      pushToast({ title: `${streak}-Day Streak`, detail: "You haven't missed a daily case." });
    } else if (scoreResult.anomaliesMissed === 0 && scoreResult.falseAlarms === 0) {
      pushToast({ title: 'Clean Sweep', detail: 'Every anomaly flagged, zero false alarms.' });
    } else if (scoreResult.points >= 80) {
      pushToast({ title: 'Strong Case Work', detail: `+${scoreResult.points} points` });
    }
  }

  async function handleExit() {
    if (!revealed && flags.length > 0) {
      const ok = await requestConfirm({
        title: 'Leave this investigation?',
        message:
          "Your progress on this case won't be saved — only a completed attempt is added to your match log. Since today's case is the same for everyone, you can come back and try it again before you lock in.",
        confirmLabel: 'Leave',
        cancelLabel: 'Stay',
      });
      if (!ok) return;
    }
    onNavigate('home', { skipGuard: true });
  }

  return (
    <PageShell
      eyebrow={
        <span className={styles.liveEyebrow}>
          <span className={styles.liveDot} />
          Daily Challenge — {challenge.dailyLabel} — synced worldwide
        </span>
      }
      title={revealed ? 'Case review' : "Today's shared case."}
      photo={{
        src: heroPhoto,
        caption: "Same file, same day, every analyst in the unit. No retakes once the sun's up on it.",
        credit: 'Photo — Ivan Mihajlovic / Unsplash',
      }}
      actions={
        <div className={sharedStyles.timerWrap}>
          <Button variant="ghost" size="sm" onClick={handleExit}>Exit</Button>
          {profile.dailyStreak > 0 && <Pill tone="signal">{profile.dailyStreak}-day streak</Pill>}
          {started && !revealed && <span className={`${sharedStyles.timerValue} ${timer.secondsLeft <= 10 ? sharedStyles.timerUrgent : ''}`}>{timer.secondsLeft}s</span>}
        </div>
      }
    >
      <ObservationPanel title={challenge.title} brief={challenge.brief} difficulty={challenge.difficulty} label={challenge.label} />

      {existingResult && !detectorData && result && (
        <motion.div className={styles.alreadyDone} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className={styles.alreadyDoneHead}>
            <StampBadge
              text={result.anomaliesMissed === 0 && result.falseAlarms === 0 ? 'Clean Sweep' : result.points >= 60 ? 'Case Closed' : 'Needs Review'}
              tone={result.points >= 60 ? 'signal' : 'warn'}
            />
            <p className={styles.alreadyDoneText}>
              You already investigated today's shared case — every player sees this exact same data today.
            </p>
          </div>
          <ResultBreakdown
            total={result.points}
            rows={[
              { label: 'Accuracy', value: result.accuracyPoints },
              { label: 'False alarm penalty', value: -result.falseAlarmPenalty },
              { label: 'Speed bonus', value: result.speedBonus },
            ]}
          />
          <NextCaseCountdown />
        </motion.div>
      )}

      {!started && (
        <ReadyGate
          detail={`You'll have ${TIME_LIMIT_SECONDS} seconds once the clock starts. This is today's one shared case — read the brief above, then start when you're ready.`}
          buttonLabel="Start case"
          onStart={beginChallenge}
        />
      )}

      {started && (
        <>
          <div className={sharedStyles.chartWrap}>
            <AnomalyChart
              series={challenge.series}
              unit={challenge.unit}
              flags={flags}
              maxFlags={MAX_FLAGS_PER_CASE}
              onPlaceFlag={placeFlag}
              onRemoveFlag={removeFlag}
              groundTruth={challenge.groundTruth}
              revealed={revealed}
              detectorFlags={detectorData?.combinedFlags}
              disabled={revealed}
            />
          </div>

          {!revealed && (
            <div className={sharedStyles.controls}>
              <p className={sharedStyles.hint}>
                Click or drag-throw onto the chart to flag a point (or focus the chart and use arrow keys + Enter). Up to {MAX_FLAGS_PER_CASE} flags.
              </p>
              <Button variant="primary" onClick={handleReveal}>Lock in</Button>
            </div>
          )}
        </>
      )}

      {revealed && result && detectorData && (
        <CaseRevealPanel
          result={result}
          detectorData={detectorData}
          footer={<Button variant="primary" onClick={() => onNavigate('home', { skipGuard: true })}>Back to home</Button>}
        >
          <NextCaseCountdown />
        </CaseRevealPanel>
      )}
    </PageShell>
  );
}
