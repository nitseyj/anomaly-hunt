/**
 * PageShell.jsx
 *
 * Per-screen header + content wrapper, rendered inside AppShell's main
 * pane. The ambient background (radar, grain, backdrop glow) now lives
 * once in AppShell, not remounted here per screen -- this component is
 * just the header block and a content column, deliberately left-aligned
 * rather than centered so the asymmetric negative space on the right
 * (where the ambient background shows through) is part of the layout,
 * not dead space to fill.
 *
 * An optional `photo` turns the header into a case-file cover: a dark
 * duotone-treated banner (never a plain stock-photo drop -- the scrim
 * keeps it reading as the same cold, teal-lit field-ops console as
 * everything else) with the title set directly over it, plus a short
 * in-world caption line and a small photo credit.
 */
import { CornerBrackets } from './CornerBrackets.jsx';
import styles from './PageShell.module.css';

export function PageShell({ children, eyebrow, title, subtitle, actions, wide = false, photo }) {
  return (
    <div className={`${styles.content} ${wide ? styles.wide : ''}`}>
      {(eyebrow || title) &&
        (photo ? (
          <header className={styles.heroHeader}>
            <img src={photo.src} alt="" className={styles.heroImage} />
            <div className={styles.heroScrim} />
            <CornerBrackets />
            <div className={styles.heroTopBar}>
              {actions ? <div className={styles.heroActions}>{actions}</div> : <span />}
              {photo.credit && <span className={styles.heroCredit}>{photo.credit}</span>}
            </div>
            <div className={styles.heroText}>
              {eyebrow && <div className={styles.eyebrow}>{eyebrow}</div>}
              {title && <h1 className={styles.title}>{title}</h1>}
              {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
              {photo.caption && <p className={styles.heroCaption}>{photo.caption}</p>}
            </div>
          </header>
        ) : (
          <header className={styles.header}>
            <div>
              {eyebrow && <div className={styles.eyebrow}>{eyebrow}</div>}
              {title && <h1 className={styles.title}>{title}</h1>}
              {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
            </div>
            {actions && <div className={styles.actions}>{actions}</div>}
          </header>
        ))}
      {children}
    </div>
  );
}
