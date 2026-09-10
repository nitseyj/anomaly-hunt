import { useState } from 'react';
import HomeScreen from './components/HomeScreen.jsx';
import AnomalyHuntGame from './components/AnomalyHuntGame.jsx';
import ForecastCallGame from './components/ForecastCallGame.jsx';
import ProfileScreen from './components/ProfileScreen.jsx';
import HistoryScreen from './components/HistoryScreen.jsx';
import DailyChallengeGame from './components/DailyChallengeGame.jsx';

export default function App() {
  const [mode, setMode] = useState(null); // null | 'anomaly_hunt' | 'forecast_call' | 'profile' | 'history' | 'daily_challenge'

  if (mode === 'anomaly_hunt') {
    return <AnomalyHuntGame onExit={() => setMode(null)} />;
  }
  if (mode === 'forecast_call') {
    return <ForecastCallGame onExit={() => setMode(null)} />;
  }
  if (mode === 'daily_challenge') {
    return <DailyChallengeGame onExit={() => setMode(null)} />;
  }
  if (mode === 'profile') {
    return <ProfileScreen onExit={() => setMode(null)} />;
  }
  if (mode === 'history') {
    return <HistoryScreen onExit={() => setMode(null)} />;
  }
  return <HomeScreen onSelectMode={setMode} />;
}
