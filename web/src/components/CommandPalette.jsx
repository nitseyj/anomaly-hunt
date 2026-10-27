/**
 * CommandPalette.jsx
 *
 * A ⌘K / Ctrl+K quick-navigation overlay -- jump to any screen without
 * leaving the keyboard. Filtering, arrow-key selection, and Enter-to-go
 * are all local state here; actual navigation is handed back up via
 * onNavigate so this component stays screen-agnostic.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import styles from './CommandPalette.module.css';

const DESTINATIONS = [
  { id: 'home', label: 'Home', hint: 'Mode select' },
  { id: 'anomaly', label: 'Anomaly Hunt', hint: '5 cases · 45s each' },
  { id: 'forecast', label: 'Forecast Call', hint: '5 rounds · untimed' },
  { id: 'daily', label: 'Daily Challenge', hint: 'Today’s shared case' },
  { id: 'survival', label: 'Survival', hint: 'Endless · escalating difficulty' },
  { id: 'profile', label: 'Profile', hint: 'Rank & stats' },
  { id: 'history', label: 'Match log', hint: 'Past investigations' },
  { id: 'import', label: 'Bring your own data', hint: 'CSV / JSON import' },
];

export function CommandPalette({ open, onClose, onNavigate }) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const lastFocusedRef = useRef(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DESTINATIONS;
    return DESTINATIONS.filter((d) => d.label.toLowerCase().includes(q) || d.hint.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    if (open) {
      lastFocusedRef.current = document.activeElement;
      setQuery('');
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      lastFocusedRef.current?.focus?.();
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  function go(id) {
    onNavigate(id);
    onClose();
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[activeIndex]) go(results[activeIndex].id);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={styles.backdrop}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
        >
          <motion.div
            className={styles.panel}
            role="dialog"
            aria-modal="true"
            aria-label="Jump to a screen"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.inputRow}>
              <span className={styles.prompt}>/</span>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Jump to a screen…"
                aria-label="Jump to a screen"
                aria-autocomplete="list"
                className={styles.input}
              />
              <span className={styles.kbd}>esc</span>
            </div>

            <ul className={styles.list}>
              {results.length === 0 && <li className={styles.empty}>No matches.</li>}
              {results.map((d, i) => (
                <li key={d.id}>
                  <button
                    className={`${styles.item} ${i === activeIndex ? styles.itemActive : ''}`}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => go(d.id)}
                  >
                    <span className={styles.itemLabel}>{d.label}</span>
                    <span className={styles.itemHint}>{d.hint}</span>
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
