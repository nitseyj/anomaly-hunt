/**
 * ToastHub.jsx
 *
 * Renders achievement toasts pushed via engine/toastBus.js -- mounted
 * once in App.jsx so it survives screen changes. Each toast
 * auto-dismisses; stacking is handled by AnimatePresence + a plain
 * array, newest on top.
 */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { subscribeToasts } from '../engine/toastBus.js';
import styles from './ToastHub.module.css';

const LIFETIME_MS = 3600;

export function ToastHub() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    return subscribeToasts((toast) => {
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, LIFETIME_MS);
    });
  }, []);

  return (
    <div className={styles.stack} role="status" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            className={`${styles.toast} ${styles[t.tone]}`}
            initial={{ opacity: 0, x: 40, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          >
            <span className={styles.title}>{t.title}</span>
            {t.detail && <span className={styles.detail}>{t.detail}</span>}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
