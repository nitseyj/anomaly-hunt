/**
 * Card.jsx
 *
 * `tilt` turns the card into a mouse-tracking 3D surface: rotateX/rotateY
 * driven by cursor position relative to the card's own center, eased
 * through a spring so it settles rather than snapping when the cursor
 * leaves. Plain cards (most of the UI) skip all of this and cost nothing.
 */
import { useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import styles from './Card.module.css';

export function Card({ children, tilt = false, glow = false, className = '', as: As = 'div', ...rest }) {
  const ref = useRef(null);
  const rawRotX = useMotionValue(0);
  const rawRotY = useMotionValue(0);
  const rotateX = useSpring(rawRotX, { stiffness: 220, damping: 22 });
  const rotateY = useSpring(rawRotY, { stiffness: 220, damping: 22 });
  const glowX = useMotionValue(50);
  const glowY = useMotionValue(50);

  const handleMove = (e) => {
    if (!tilt || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    rawRotY.set((px - 0.5) * 14);
    rawRotX.set((0.5 - py) * 14);
    glowX.set(px * 100);
    glowY.set(py * 100);
  };

  const handleLeave = () => {
    rawRotX.set(0);
    rawRotY.set(0);
  };

  const background = useTransform([glowX, glowY], ([gx, gy]) =>
    glow ? `radial-gradient(circle at ${gx}% ${gy}%, rgba(0, 240, 192, 0.14), transparent 60%)` : undefined
  );

  const Component = motion[As] || motion.div;

  return (
    <Component
      ref={ref}
      className={`${styles.card} ${className}`}
      style={tilt ? { rotateX, rotateY, transformPerspective: 800 } : undefined}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      {...rest}
    >
      {glow && <motion.div className={styles.glowLayer} style={{ background }} />}
      <div className={styles.content}>{children}</div>
    </Component>
  );
}
