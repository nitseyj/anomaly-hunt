import { getProfile, getRank, getNextRankThreshold } from '../game-logic/profile.js';
import { getTodayResult } from '../game-logic/dailyChallenge.js';

/**
 * HomeScreen
 *
 * Entry point: shows the player's investigator rank (derived from
 * lifetime points across both modes) and lets them choose which
 * challenge to play, or review their profile/history.
 */
export default function HomeScreen({ onSelectMode }) {
  const profile = getProfile();
  const rank = getRank(profile.lifetimePoints);
  const nextThreshold = getNextRankThreshold(profile.lifetimePoints);
  const dailyResult = getTodayResult();

  return (
    <div className="dd-intro dd-intro--home">
      <div className="dd-topbar" style={{ marginBottom: 0 }}>
        <span className="dd-wordmark">Anomaly Hunt</span>
        <span className="dd-progress">
          <button className="dd-btn" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => onSelectMode('profile')}>
            Profile
          </button>
          <button className="dd-btn" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => onSelectMode('history')}>
            History
          </button>
        </span>
      </div>
      <h1 style={{ marginTop: 16 }}>Investigate the signal. Challenge the model. Make the call.</h1>
      <p>
        Every case runs on a freshly generated business metric — no two playthroughs look the
        same. Choose an investigation below.
      </p>

      {profile.gamesPlayed > 0 && (
        <div className="dd-rank-badge">
          <span className="dd-rank-title">{rank}</span>
          <span className="dd-rank-detail">
            {profile.lifetimePoints} lifetime pts
            {nextThreshold !== null && ` · ${nextThreshold - profile.lifetimePoints} to next rank`}
          </span>
        </div>
      )}

      <button className="dd-daily-card" onClick={() => onSelectMode('daily_challenge')}>
        <span>
          <span className="dd-daily-card-title">Daily Investigation</span>
          <span className="dd-daily-card-desc">
            One case, the same for everyone today. Hard difficulty, one attempt.
          </span>
        </span>
        <span className="dd-daily-card-status">
          {dailyResult ? `Completed · ${dailyResult.score} pts` : 'Play today\u2019s case'}
        </span>
      </button>

      <div className="dd-mode-grid">
        <button className="dd-mode-card" onClick={() => onSelectMode('anomaly_hunt')}>
          <span className="dd-mode-title">Anomaly Hunt</span>
          <span className="dd-mode-desc">
            Five cases, 45 seconds each. Spot the anomaly hidden in real-looking business data
            before time runs out, then compare your eye to three statistical detectors.
          </span>
          <span className="dd-mode-meta">Best: {profile.bestAnomalyScore || '—'} pts</span>
        </button>

        <button className="dd-mode-card" onClick={() => onSelectMode('forecast_call')}>
          <span className="dd-mode-title">Forecast Call</span>
          <span className="dd-mode-desc">
            Five cases, no timer. Read the trend, choose the most likely outcome, and stake your
            confidence on it — conviction is rewarded, and it costs you when you're wrong.
          </span>
          <span className="dd-mode-meta">Best: {profile.bestForecastScore || '—'} pts</span>
        </button>
      </div>

      <button className="dd-table-toggle" style={{ marginTop: 4 }} onClick={() => onSelectMode('import')}>
        ▸ Import your own data — run Anomaly Hunt on a real dataset
      </button>
    </div>
  );
}
