import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import styles from './InfoHint.module.css';

// A hover/focus-triggered glossary tooltip -- not a native `title`
// attribute, since those render inconsistently across browsers and
// don't work at all on touch. Portaled to document.body: `position:
// fixed` normally resolves against the viewport, but the table rows it
// lives inside (DataTable's `motion.tr`) carry their own CSS transform
// for their mount animation, which makes any `fixed` descendant resolve
// against THAT box instead -- a portal sidesteps it entirely, same fix
// as the overflow:hidden table wrapper would otherwise clip it.
export function InfoHint({ text }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const triggerRef = useRef(null);

  function show() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setCoords({ x: rect.left + rect.width / 2, y: rect.top });
    setOpen(true);
  }
  function hide() {
    setOpen(false);
  }

  return (
    <span className={styles.wrap}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-label={`More info: ${text}`}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={(e) => {
          e.stopPropagation();
          if (open) hide();
          else show();
        }}
      >
        i
      </button>
      {createPortal(
        <AnimatePresence>
          {open && coords && (
            // Positioning (fixed + the translate that centers/lifts the
            // tooltip above the trigger) lives on this plain, unanimated
            // anchor -- Motion sets its own `transform` inline for the
            // slide-in below, and an inline style always wins over a CSS
            // class, so putting both on the same element would silently
            // cancel the positioning transform the moment Motion touched it.
            <span className={styles.tooltipAnchor} style={{ left: coords.x, top: coords.y }}>
              <motion.span
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.12 }}
                className={styles.tooltip}
                role="tooltip"
              >
                {text}
              </motion.span>
            </span>
          )}
        </AnimatePresence>,
        document.body
      )}
    </span>
  );
}
