/** The branded mark -- a baseline ring with a spike breaking out of it,
 * reused as the favicon too. Rendered inline (not an <img>) so it always
 * matches the current accent tokens with zero extra network request. */
export function LogoMark({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="15" cy="17" r="9.5" fill="none" stroke="var(--accent)" strokeWidth="2.8" />
      <line x1="15" y1="17" x2="24.5" y2="6.5" stroke="var(--accent-secondary)" strokeWidth="2.8" strokeLinecap="round" />
      <circle cx="24.5" cy="6.5" r="3.1" fill="var(--accent-secondary)" />
    </svg>
  );
}
