import { useState } from 'react';
import { getProfile, getDerivedStats, getRank, getNextRankThreshold } from '../game-logic/profile.js';
import { resetAllLocalData } from '../game-logic/resetData.js';

function SkillBar({ label, pct }) {
  const displayPct = pct ?? 0;
  return (
    <div className="dd-skill-bar">
      <div className="dd-skill-bar-header">
        <span>{label}</span>
        <span>{pct === null ? 'No data yet' : `${pct}%`}</span>
      </div>
      <div className="dd-skill-bar-track">
        <div className="dd-skill-bar-fill" style={{ width: `${displayPct}%` }} />
      </div>
    </div>
  );
}

/**
 * ProfileScreen
 *
 * Every number here is derived from real recorded per-case results
 * (see profile.js) -- there is no placeholder or fabricated progress.
 * A stat shows "No data yet" rather than 0% when the player hasn't
 * played that mode, since those aren't the same thing.
 */
export default function ProfileScreen({ onExit }) {
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [justReset, setJustReset] = useState(false);
  const profile = getProfile();
  const stats = getDerivedStats(profile);
  const rank = getRank(profile.lifetimePoints);
  const nextThreshold = getNextRankThreshold(profile.lifetimePoints);

  function handleReset() {
    resetAllLocalData();
    setConfirmingReset(false);
    setJustReset(true);
  }

  return (
    <div className="dd-shell">
      <div className="dd-topbar">
        <button className="dd-wordmark dd-wordmark--link" onClick={onExit}>
          ← Anomaly Hunt
        </button>
      </div>

      <div className="dd-rank-badge" style={{ marginBottom: 24 }}>
        <span className="dd-rank-title">{rank}</span>
        <span className="dd-rank-detail">
          {profile.lifetimePoints} lifetime pts
          {nextThreshold !== null && ` · ${nextThreshold - profile.lifetimePoints} to next rank`}
        </span>
      </div>

      <div className="dd-report-grid" style={{ marginBottom: 28 }}>
        <div className="dd-report-stat">
          <span className="dd-report-stat-label">Cases solved</span>
          <span className="dd-report-stat-value">{stats.casesSolved}</span>
        </div>
        <div className="dd-report-stat">
          <span className="dd-report-stat-label">Anomaly accuracy</span>
          <span className="dd-report-stat-value">{stats.anomalyAccuracyPct === null ? '—' : `${stats.anomalyAccuracyPct}%`}</span>
        </div>
        <div className="dd-report-stat">
          <span className="dd-report-stat-label">Forecast accuracy</span>
          <span className="dd-report-stat-value">
            {stats.forecastAccuracyPct === null ? '—' : `${stats.forecastAccuracyPct}%`}
          </span>
        </div>
        <div className="dd-report-stat">
          <span className="dd-report-stat-label">False alarm rate</span>
          <span className="dd-report-stat-value">
            {stats.falseAlarmRatePct === null ? '—' : `${stats.falseAlarmRatePct}%`}
          </span>
        </div>
      </div>

      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Skills</h3>
      <SkillBar label="Anomaly detection" pct={stats.anomalyAccuracyPct} />
      <SkillBar label="Forecasting" pct={stats.forecastAccuracyPct} />
      <SkillBar label="Statistical reasoning" pct={stats.reasoningPct} />

      <p className="dd-methodology-note" style={{ marginTop: 20 }}>
        Statistical reasoning compares your F1 score against the average of the three detectors on
        every case you've played — 50% means matching the detectors on average, higher means
        consistently beating them.
      </p>

      <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--danger)' }}>Danger zone</h3>
        {justReset ? (
          <p style={{ fontSize: 13, color: 'var(--ink-muted)' }}>
            All local data cleared. Your rank, history, and leaderboards are reset.
          </p>
        ) : !confirmingReset ? (
          <button className="dd-btn" onClick={() => setConfirmingReset(true)}>
            Reset all local data
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: 'var(--ink-muted)' }}>
              This clears your rank, lifetime points, history, and both leaderboards. Cannot be
              undone.
            </span>
            <button
              className="dd-btn"
              style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
              onClick={handleReset}
            >
              Confirm reset
            </button>
            <button className="dd-btn" onClick={() => setConfirmingReset(false)}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
