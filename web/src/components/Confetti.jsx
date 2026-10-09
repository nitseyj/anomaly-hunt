/**
 * Confetti.jsx
 *
 * A short burst of colored shards from the center of whatever it's
 * mounted inside. Purely decorative, self-removing -- the parent just
 * mounts it conditionally for ~1.2s and can unmount it after.
 */
import { motion } from 'motion/react';
import styles from './Confetti.module.css';

const COLORS = ['#00f0c0', '#4da8ff', '#ffb547', '#ff4d6a'];
const COUNT = 24;

export function Confetti() {
  const shards = Array.from({ length: COUNT }, (_, i) => {
    const angle = (i / COUNT) * Math.PI * 2 + Math.random() * 0.4;
    const distance = 80 + Math.random() * 140;
    return {
      id: i,
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      rotate: Math.random() * 360,
      color: COLORS[i % COLORS.length],
      delay: Math.random() * 0.08,
    };
  });

  return (
    <div className={styles.wrap}>
      {shards.map((s) => (
        <motion.span
          key={s.id}
          className={styles.shard}
          style={{ background: s.color }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
          animate={{ x: s.x, y: s.y, opacity: 0, rotate: s.rotate, scale: 0.4 }}
          transition={{ duration: 0.9 + Math.random() * 0.3, delay: s.delay, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}
