/**
 * PageShell.jsx
 *
 * The outer frame every screen renders inside: a fixed scanline/grain
 * backdrop with subtle cursor-parallax depth, a top status bar, and a
 * centered content column. AnimatePresence in App.jsx handles the
 * transition between whichever screen sits inside this.
 */
import { useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { RadarField } from './RadarField.jsx';
import styles from './PageShell.module.css';

export function PageShell({ children, eyebrow, title, subtitle, actions, wide = false }) {
  const ref = useRef(null);
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const px = useSpring(rawX, { stiffness: 60, damping: 20 });
  const py = useSpring(rawY, { stiffness: 60, damping: 20 });
  const bgX = useTransform(px, (v) => v * 14);
  const bgY = useTransform(py, (v) => v * 14);

  const handleMove = (e) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    rawX.set(e.clientX / vw - 0.5);
    rawY.set(e.clientY / vh - 0.5);
  };

  return (
    <div className={styles.shell} ref={ref} onMouseMove={handleMove}>
      <motion.div className={styles.backdrop} style={{ x: bgX, y: bgY }} />
      <RadarField />
      <div className={styles.grain} />
      <div className={styles.scanline} />

      <div className={`${styles.content} ${wide ? styles.wide : ''}`}>
        {(eyebrow || title) && (
          <header className={styles.header}>
            <div>
              {eyebrow && <div className={styles.eyebrow}>{eyebrow}</div>}
              {title && <h1 className={styles.title}>{title}</h1>}
              {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
            </div>
            {actions && <div className={styles.actions}>{actions}</div>}
          </header>
        )}
        {children}
      </div>
    </div>
  );
}
