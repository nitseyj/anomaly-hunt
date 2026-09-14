const HINT_COST = 15;

/**
 * HintPanel
 *
 * Spending points for a hint keeps the mechanic tied to real analyst
 * trade-offs — a quick statistical check costs time/effort, same as here.
 */
export default function HintPanel({ onUseHint, hintUsed, disabled }) {
  return (
    <button className="dd-btn" onClick={onUseHint} disabled={disabled || hintUsed}>
      {hintUsed ? 'Hint used' : `Use hint (−${HINT_COST} pts)`}
    </button>
  );
}

export { HINT_COST };
