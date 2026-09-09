/**
 * ScoreBoard
 *
 * A quiet inline stat row — time remaining, flagged count, and (after
 * submission) anomalies found and points earned.
 */
export default function ScoreBoard({ secondsRemaining, selectedCount, result }) {
  return (
    <div className="dd-stat-row">
      <div className="dd-stat">
        <span className="dd-stat-label">Time remaining</span>
        <span className={`dd-stat-value ${secondsRemaining <= 10 ? 'dd-stat-value--warn' : ''}`}>
          0:{String(secondsRemaining).padStart(2, '0')}
        </span>
      </div>
      <div className="dd-stat">
        <span className="dd-stat-label">Flagged</span>
        <span className="dd-stat-value">{selectedCount}</span>
      </div>
      {result && (
        <>
          <div className="dd-stat">
            <span className="dd-stat-label">Found</span>
            <span className="dd-stat-value">
              {result.anomaliesFound}/{result.anomaliesFound + result.anomaliesMissed}
            </span>
          </div>
          <div className="dd-stat">
            <span className="dd-stat-label">False alarms</span>
            <span className="dd-stat-value">{result.falseAlarms}</span>
          </div>
          <div className="dd-stat">
            <span className="dd-stat-label">Points earned</span>
            <span className="dd-stat-value">{result.points}</span>
          </div>
        </>
      )}
    </div>
  );
}
