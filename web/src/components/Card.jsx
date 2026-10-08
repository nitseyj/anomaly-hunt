import { motion } from 'motion/react';
import styles from './Card.module.css';

/** A clickable panel with a diagonal light-sweep on hover and a spring
 * lift -- used for the home-screen mode cards and the daily card. */
export function Card({ children, onClick, highlight = false, className = '', ...props }) {
  const cls = [styles.card, highlight ? styles.highlight : '', className].filter(Boolean).join(' ');
  return (
    <motion.button
      type="button"
      className={cls}
      onClick={onClick}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: 'spring', stiffness: 350, damping: 26 }}
      {...props}
    >
      <span className={styles.sheen} aria-hidden="true" />
      {children}
    </motion.button>
  );
}

/** A static (non-interactive) panel for grouping content. */
export function Panel({ children, className = '', ...props }) {
  return (
    <div className={[styles.panel, className].filter(Boolean).join(' ')} {...props}>
      {children}
    </div>
  );
}
