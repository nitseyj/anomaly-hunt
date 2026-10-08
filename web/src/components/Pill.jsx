import styles from './Pill.module.css';

const COLOR_VAR = {
  easy: 'var(--success)',
  medium: 'var(--warning)',
  hard: 'var(--danger)',
  info: 'var(--accent-2)',
};

export function Pill({ tone = 'info', children }) {
  return (
    <span className={styles.pill} style={{ color: COLOR_VAR[tone] ?? COLOR_VAR.info }}>
      {children}
    </span>
  );
}
