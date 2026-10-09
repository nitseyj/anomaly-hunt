import { Pill } from './Pill.jsx';
import styles from './ObservationPanel.module.css';

export function ObservationPanel({ title, brief, difficulty, label, extra }) {
  return (
    <div className={styles.panel}>
      <div className={styles.row}>
        <Pill tone="signal">{label}</Pill>
        <Pill tone={difficulty === 'hard' ? 'alert' : difficulty === 'medium' ? 'warn' : 'neutral'}>{difficulty}</Pill>
      </div>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.brief}>{brief}</p>
      {extra}
    </div>
  );
}
