/**
 * ModeIcon.jsx
 *
 * Stroke-based line icons for the three modes, replacing emoji (which
 * render inconsistently across platforms and read as a placeholder,
 * not a designed mark). Each sits inside IconBadge for a consistent
 * circular backdrop.
 */
import styles from './ModeIcon.module.css';

export function IconBadge({ children, className = '', size }) {
  const style = size ? { width: size, height: size } : undefined;
  return (
    <span className={`${styles.badge} ${className}`} style={style}>
      {children}
    </span>
  );
}

export function AnomalyIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={styles.icon}>
      <circle cx="16" cy="16" r="11" stroke="currentColor" strokeWidth="1.4" opacity="0.4" />
      <circle cx="16" cy="16" r="6.5" stroke="currentColor" strokeWidth="1.4" opacity="0.6" />
      <line x1="16" y1="2" x2="16" y2="7" stroke="currentColor" strokeWidth="1.4" opacity="0.4" />
      <line x1="16" y1="25" x2="16" y2="30" stroke="currentColor" strokeWidth="1.4" opacity="0.4" />
      <line x1="2" y1="16" x2="7" y2="16" stroke="currentColor" strokeWidth="1.4" opacity="0.4" />
      <line x1="25" y1="16" x2="30" y2="16" stroke="currentColor" strokeWidth="1.4" opacity="0.4" />
      <path d="M21 11 L23.5 8.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="21" cy="11" r="2.4" fill="currentColor" />
    </svg>
  );
}

export function ForecastIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={styles.icon}>
      <path d="M4 22 L11 15 L15.5 19 L22 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 10 L28 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="1 4" opacity="0.6" />
      <circle cx="22" cy="10" r="2.2" fill="currentColor" />
      <circle cx="28" cy="6" r="1.6" fill="none" stroke="currentColor" strokeWidth="1.4" opacity="0.7" />
    </svg>
  );
}

export function DailyIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={styles.icon}>
      <rect x="4" y="6" width="24" height="22" rx="3" stroke="currentColor" strokeWidth="1.6" />
      <line x1="4" y1="12" x2="28" y2="12" stroke="currentColor" strokeWidth="1.6" />
      <line x1="10" y1="2.5" x2="10" y2="8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="22" y1="2.5" x2="22" y2="8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M9 20 L13 20 L15 17 L18 23 L20 20 L23 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
    </svg>
  );
}

export function SurvivalIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={styles.icon}>
      <path d="M16 4 L27 8 V15 C27 22 22 27 16 29 C10 27 5 22 5 15 V8 Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M9 17 L13 17 L15 13 L18 21 L20 17 L23 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
    </svg>
  );
}

export function HomeIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={styles.icon}>
      <path d="M5 15 L16 5 L27 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 13 V27 H24 V13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="13.5" y="18" width="5" height="9" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function ProfileIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={styles.icon}>
      <circle cx="16" cy="11" r="5.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5 27 C5 20.5 9.8 17 16 17 C22.2 17 27 20.5 27 27" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function HistoryIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={styles.icon}>
      <path d="M6 16 A10 10 0 1 1 9 23" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M6 10 V16 H12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 11 V16 L20 19" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ImportIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={styles.icon}>
      <path d="M16 4 V20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M10 14 L16 20 L22 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 23 V27 H26 V23" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
