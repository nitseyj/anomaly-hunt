import styles from './Input.module.css';

export function Input({ label, hint, className = '', ...rest }) {
  return (
    <label className={styles.wrap}>
      {label && <span className={styles.label}>{label}</span>}
      <input className={`${styles.input} ${className}`} {...rest} />
      {hint && <span className={styles.hint}>{hint}</span>}
    </label>
  );
}

export function TextArea({ label, hint, className = '', ...rest }) {
  return (
    <label className={styles.wrap}>
      {label && <span className={styles.label}>{label}</span>}
      <textarea className={`${styles.input} ${styles.textarea} ${className}`} {...rest} />
      {hint && <span className={styles.hint}>{hint}</span>}
    </label>
  );
}
