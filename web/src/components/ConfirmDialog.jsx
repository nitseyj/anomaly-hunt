/**
 * ConfirmDialog.jsx
 *
 * The styled replacement for window.confirm(), driven by
 * engine/confirmBus.js. Mounted once in App.jsx. Escape cancels, Enter
 * confirms, clicking the backdrop cancels (leaving is the destructive
 * path, so it should never be the easy accidental click) -- and for the
 * same reason, the SAFE "stay/cancel" button is what gets focus by
 * default when the dialog opens, not the destructive one. Focus is
 * trapped to the dialog's two buttons while it's open and restored to
 * whatever triggered it once it closes, so keyboard/screen-reader users
 * never land on background content a modal is supposed to be blocking.
 */
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { subscribeConfirm, resolveConfirm } from '../engine/confirmBus.js';
import styles from './ConfirmDialog.module.css';

export function ConfirmDialog() {
  const [request, setRequest] = useState(null);
  const cancelBtnRef = useRef(null);
  const confirmBtnRef = useRef(null);
  const lastFocusedRef = useRef(null);

  useEffect(() => subscribeConfirm(setRequest), []);

  useEffect(() => {
    if (!request) return;
    lastFocusedRef.current = document.activeElement;
    cancelBtnRef.current?.focus();
    return () => {
      lastFocusedRef.current?.focus?.();
    };
  }, [request]);

  useEffect(() => {
    if (!request) return;
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        resolveConfirm(false);
      } else if (e.key === 'Enter') {
        resolveConfirm(true);
      } else if (e.key === 'Tab') {
        // Only two focusable elements in this dialog -- trap by just
        // bouncing between them instead of querying the DOM for a
        // general focusable-elements list.
        e.preventDefault();
        const onCancel = document.activeElement === cancelBtnRef.current;
        (onCancel ? confirmBtnRef : cancelBtnRef).current?.focus();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [request]);

  return (
    <AnimatePresence>
      {request && (
        <motion.div
          className={styles.backdrop}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={() => resolveConfirm(false)}
        >
          <motion.div
            className={styles.panel}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-message"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.flag} />
            <h3 className={styles.title} id="confirm-dialog-title">
              {request.title}
            </h3>
            <p className={styles.message} id="confirm-dialog-message">
              {request.message}
            </p>
            <div className={styles.actions}>
              <button ref={cancelBtnRef} className={styles.cancelBtn} onClick={() => resolveConfirm(false)}>
                {request.cancelLabel ?? 'Stay'}
              </button>
              <button ref={confirmBtnRef} className={styles.confirmBtn} onClick={() => resolveConfirm(true)}>
                {request.confirmLabel ?? 'Leave'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
