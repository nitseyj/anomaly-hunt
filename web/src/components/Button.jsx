/**
 * Button.jsx
 *
 * `magnetic` makes the button's content drift a few px toward the
 * cursor on hover and spring back on leave -- a small, cheap
 * "interesting" touch that costs nothing beyond a mousemove listener
 * scoped to this element.
 */
import { useRef } from 'react';
import { motion, useMotionValue, useSpring } from 'motion/react';
import styles from './Button.module.css';

export function Button({ children, variant = 'primary', size = 'md', magnetic = false, icon = null, className = '', ...rest }) {
  const ref = useRef(null);
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, { stiffness: 300, damping: 20 });
  const y = useSpring(rawY, { stiffness: 300, damping: 20 });

  const handleMove = (e) => {
    if (!magnetic || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    rawX.set((e.clientX - rect.left - rect.width / 2) * 0.3);
    rawY.set((e.clientY - rect.top - rect.height / 2) * 0.3);
  };

  const handleLeave = () => {
    rawX.set(0);
    rawY.set(0);
  };

  return (
    <motion.button
      ref={ref}
      className={`${styles.btn} ${styles[variant]} ${styles[size]} ${className}`}
      style={magnetic ? { x, y } : undefined}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      whileTap={{ scale: 0.96 }}
      {...rest}
    >
      {icon && <span className={styles.icon}>{icon}</span>}
      {children}
    </motion.button>
  );
}
