import styles from './Stat.module.css';

export function StatRow({ children }) {
  return <div className={styles.row}>{children}</div>;
}

export function Stat({ label, value, warn = false }) {
  return (
    <div className={styles.stat}>
      <span className={styles.label}>{label}</span>
      <span className={[styles.value, warn ? styles.warn : ''].filter(Boolean).join(' ')}>{value}</span>
    </div>
  );
}
