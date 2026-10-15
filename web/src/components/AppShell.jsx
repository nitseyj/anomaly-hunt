/**
 * AppShell.jsx
 *
 * Replaces the old pattern (every screen centers its own header in a
 * floating column, remounting the background effects each time) with a
 * persistent "ops console": a fixed sidebar for navigation and live
 * status, and a main pane that owns the ambient background ONCE instead
 * of per-screen -- so the radar/grain/scanline don't visibly restart on
 * every navigation, and content can use the full remaining width
 * asymmetrically instead of being centered in a fixed-width column.
 */
import { motion } from 'motion/react';
import { RadarField } from './RadarField.jsx';
import { IconBadge, HomeIcon, AnomalyIcon, ForecastIcon, DailyIcon, ProfileIcon, HistoryIcon, ImportIcon } from './ModeIcon.jsx';
import { getProfile } from '../engine/profile.js';
import { getTodayResult } from '../engine/daily.js';
import styles from './AppShell.module.css';

const PRIMARY_NAV = [
  { id: 'home', label: 'Home', Icon: HomeIcon },
  { id: 'anomaly', label: 'Anomaly Hunt', Icon: AnomalyIcon },
  { id: 'forecast', label: 'Forecast Call', Icon: ForecastIcon },
  { id: 'daily', label: 'Daily Challenge', Icon: DailyIcon },
];

const SECONDARY_NAV = [
  { id: 'profile', label: 'Profile', Icon: ProfileIcon },
  { id: 'history', label: 'Match log', Icon: HistoryIcon },
  { id: 'import', label: 'Import data', Icon: ImportIcon },
];

export function AppShell({ screen, onNavigate, children }) {
  const profile = getProfile();
  const dailyDone = Boolean(getTodayResult());

  return (
    <div className={styles.shell}>
      <div className={styles.backdrop} />
      <RadarField />
      <div className={styles.grain} />

      <nav className={styles.sidebar} aria-label="Main">
        <button className={styles.brand} onClick={() => onNavigate('home')} aria-label="Anomaly Hunt — go to home">
          <span className={styles.brandMark} />
          <span className={styles.brandText}>
            ANOMALY
            <br />
            HUNT
          </span>
        </button>

        <div className={styles.navGroup}>
          {PRIMARY_NAV.map((item) => (
            <NavItem key={item.id} item={item} active={screen === item.id} onNavigate={onNavigate} badge={item.id === 'daily' && dailyDone} />
          ))}
        </div>

        <div className={styles.navDivider} />

        <div className={styles.navGroup}>
          {SECONDARY_NAV.map((item) => (
            <NavItem key={item.id} item={item} active={screen === item.id} onNavigate={onNavigate} />
          ))}
        </div>

        <div className={styles.sidebarFooter}>
          <button className={styles.rankCard} onClick={() => onNavigate('profile')}>
            <span className={styles.rankLabel}>Field rank</span>
            <span className={styles.rankValue}>{profile.rank}</span>
            <span className={styles.rankScore}>{profile.totalScore.toLocaleString()} pts</span>
          </button>
        </div>
      </nav>

      <main className={styles.main}>{children}</main>
    </div>
  );
}

function NavItem({ item, active, onNavigate, badge }) {
  const { Icon } = item;
  return (
    <button
      className={`${styles.navItem} ${active ? styles.navItemActive : ''}`}
      onClick={() => onNavigate(item.id)}
      aria-label={item.label}
      aria-current={active ? 'page' : undefined}
    >
      {active && <motion.span layoutId="nav-active" className={styles.navActiveBar} transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
      <IconBadge size={32} className={styles.navIcon}>
        <Icon />
      </IconBadge>
      <span className={styles.navLabel}>{item.label}</span>
      {badge && <span className={styles.navBadge} />}
    </button>
  );
}
