import { getProfile, getRank, getNextRankThreshold } from '../game-logic/profile.js';

/**
 * HomeScreen
 *
 * Entry point: shows the player's investigator rank (derived from
 * lifetime points across both modes) and lets them choose which
 * challenge to play. Purely a router into one of the two game modes.
 */
export default function HomeScreen({ onSelectMode }) {
  const profile = getProfile();
  const rank = getRank(profile.lifetimePoints);
  const nextThreshold = getNextRankThreshold(profile.lifetimePoints);

  return (
    <div className="dd-intro dd-intro--home">
      <span className="dd-wordmark">Anomaly Hunt</span>
      <h1 style={{ marginTop: 16 }}>Field investigations unit</h1>
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

      <div className="dd-mode-grid">
        <button className="dd-mode-card" onClick={() => onSelectMode('anomaly_hunt')}>
          <span className="dd-mode-title">Anomaly Hunt</span>
          <span className="dd-mode-desc">
            Five cases, 45 seconds each. Spot the anomaly hidden in real-looking business data
            before time runs out.
          </span>
          <span className="dd-mode-meta">Best: {profile.bestAnomalyScore || '—'} pts</span>
        </button>

        <button className="dd-mode-card" onClick={() => onSelectMode('forecast_call')}>
          <span className="dd-mode-title">Forecast Call</span>
          <span className="dd-mode-desc">
            Five rounds, no timer. See a trend, predict where it lands next. Scored by how close
            your call is.
          </span>
          <span className="dd-mode-meta">Best: {profile.bestForecastScore || '—'} pts</span>
        </button>
      </div>
    </div>
  );
}
