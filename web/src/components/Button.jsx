import { motion } from 'motion/react';
import styles from './Button.module.css';

export function Button({ variant = 'default', children, className = '', ...props }) {
  const cls = [styles.btn, variant === 'primary' ? styles.primary : '', className].filter(Boolean).join(' ');
  return (
    <motion.button
      className={cls}
      whileTap={props.disabled ? undefined : { scale: 0.96 }}
      whileHover={props.disabled ? undefined : { y: -1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      {...props}
    >
      {children}
    </motion.button>
  );
}
