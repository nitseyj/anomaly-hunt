import { PageShell } from '../../components/PageShell.jsx';
import { Card } from '../../components/Card.jsx';
import { Stat } from '../../components/Stat.jsx';
import { SkillBar } from '../../components/SkillBar.jsx';
import { Button } from '../../components/Button.jsx';
import { getProfile } from '../../engine/profile.js';
import styles from './styles.module.css';

export function Profile({ onNavigate }) {
  const profile = getProfile();

  return (
    <PageShell eyebrow="Field Analyst Record" title={profile.rank} actions={<Button variant="ghost" size="sm" onClick={() => onNavigate('home')}>← Home</Button>}>
      <Card className={styles.statsCard}>
        <Stat label="Total score" value={profile.totalScore} tone="signal" />
        <Stat label="Cases played" value={profile.casesPlayed} />
        <Stat label="Hunt accuracy" value={Math.round(profile.huntAccuracy * 100)} suffix="%" />
        <Stat label="Forecast accuracy" value={Math.round(profile.forecastAccuracy * 100)} suffix="%" />
        <Stat label="Best forecast streak" value={profile.bestForecastStreak} />
        <Stat label="Daily streak" value={profile.dailyStreak} suffix=" days" />
      </Card>

      <Card className={styles.skillsCard}>
        <h3 className={styles.sectionTitle}>Detection skill by anomaly type</h3>
        <div className={styles.skillList}>
          <SkillBar label="Point spikes" fraction={profile.skills.pointSpike} />
          <SkillBar label="Level shifts" fraction={profile.skills.levelShift} />
          <SkillBar label="Missing gaps" fraction={profile.skills.missingGap} />
          <SkillBar label="Trend breaks" fraction={profile.skills.trendBreak} />
        </div>
      </Card>
    </PageShell>
  );
}
