import { useCountUp } from '../engine/useCountUp.js';
import styles from './Stat.module.css';

export function Stat({ label, value, suffix = '', decimals = 0, tone = 'default' }) {
  const animated = useCountUp(typeof value === 'number' ? value : 0, { decimals });
  const display = typeof value === 'number' ? animated.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : value;

  return (
    <div className={styles.stat}>
      <span className={styles.label}>{label}</span>
      <span className={`${styles.value} ${styles[tone]}`}>
        {display}
        {suffix}
      </span>
    </div>
  );
}
