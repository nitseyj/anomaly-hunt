import { PageShell } from '../../components/PageShell.jsx';
import { Card } from '../../components/Card.jsx';
import { Stat } from '../../components/Stat.jsx';
import { RankLadder } from '../../components/RankLadder.jsx';
import { RadarSkillChart } from '../../charts/RadarSkillChart.jsx';
import { getProfile } from '../../engine/profile.js';
import heroPhoto from '../../assets/photos/profile-milkyway.jpg';
import styles from './styles.module.css';

export function Profile() {
  const profile = getProfile();

  return (
    <PageShell
      eyebrow="Field Analyst Record"
      title={profile.rank}
      photo={{
        src: heroPhoto,
        caption: 'Every closed case adds a line to your file. This is what the unit knows about you so far.',
        credit: 'Photo — Dennis Zhang / Unsplash',
      }}
    >
      <Card className={styles.rankCard}>
        <RankLadder
          rankIndex={profile.rankIndex}
          rankProgress={profile.rankProgress}
          pointsToNextRank={profile.pointsToNextRank}
          nextRank={profile.nextRank}
        />
      </Card>

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
        <RadarSkillChart skills={profile.skills} />
      </Card>
    </PageShell>
  );
}
