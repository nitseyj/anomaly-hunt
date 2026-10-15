/**
 * RankLadder.jsx
 *
 * A horizontal progression ladder through the 5 analyst ranks, with the
 * current rank highlighted and a filled track showing progress toward
 * the next one. Replaces a player having to infer their standing from a
 * single rank-name string with an actual sense of "how far along."
 */
import { motion } from 'motion/react';
import { RANKS } from '../engine/profile.js';
import styles from './RankLadder.module.css';

export function RankLadder({ rankIndex, rankProgress, pointsToNextRank, nextRank }) {
  return (
    <div className={styles.wrap}>
      <div className={styles.track}>
        <div className={styles.trackFill}>
          <motion.div
            className={styles.trackFillBar}
            initial={{ width: 0 }}
            animate={{ width: `${((rankIndex + rankProgress) / (RANKS.length - 1)) * 100}%` }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
        {RANKS.map((rank, i) => {
          const state = i < rankIndex ? 'done' : i === rankIndex ? 'current' : 'locked';
          // The first/last node sit exactly at the track's 0%/100% edge --
          // a centered label there overflows past the card boundary and
          // gets clipped. Anchor edge labels inward (left-aligned at the
          // start, right-aligned at the end) instead of centering them.
          const edge = i === 0 ? 'start' : i === RANKS.length - 1 ? 'end' : 'middle';
          return (
            <div
              key={rank.name}
              className={`${styles.nodeWrap} ${styles[`edge-${edge}`]}`}
              style={{ left: `${(i / (RANKS.length - 1)) * 100}%` }}
            >
              <span className={`${styles.node} ${styles[state]}`} />
              <span className={`${styles.nodeLabel} ${styles[state]}`}>{rank.name}</span>
            </div>
          );
        })}
      </div>
      {nextRank && (
        <p className={styles.hint}>
          <strong>{pointsToNextRank.toLocaleString()} pts</strong> to {nextRank}
        </p>
      )}
    </div>
  );
}
