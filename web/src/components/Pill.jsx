import styles from './Pill.module.css';

export function Pill({ children, tone = 'neutral', className = '' }) {
  return <span className={`${styles.pill} ${styles[tone]} ${className}`}>{children}</span>;
}
