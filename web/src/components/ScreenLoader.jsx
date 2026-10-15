/**
 * ScreenLoader.jsx
 *
 * Suspense fallback for a lazy-loaded screen chunk (see App.jsx). Screens
 * are code-split so a visit to Home doesn't pull in the chart-heavy code
 * for modes the player hasn't opened yet; this is what briefly shows
 * while that screen's chunk downloads. Small and understated on purpose
 * -- these chunks are tiny and load fast on any real connection, so this
 * just needs to bridge the gap without reading as a broken blank screen.
 */
import styles from './ScreenLoader.module.css';

export function ScreenLoader() {
  return (
    <div className={styles.wrap}>
      <span className={styles.pulse} />
      <span className={styles.label}>Loading</span>
    </div>
  );
}
