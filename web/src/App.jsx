import { useState } from 'react';
import HomeScreen from './components/HomeScreen.jsx';
import AnomalyHuntGame from './components/AnomalyHuntGame.jsx';
import ForecastCallGame from './components/ForecastCallGame.jsx';
import ProfileScreen from './components/ProfileScreen.jsx';
import HistoryScreen from './components/HistoryScreen.jsx';
import DailyChallengeGame from './components/DailyChallengeGame.jsx';
import ImportDataScreen from './components/ImportDataScreen.jsx';

export default function App() {
  const [mode, setMode] = useState(null); // null | 'anomaly_hunt' | 'forecast_call' | 'profile' | 'history' | 'daily_challenge' | 'import'
  const [customImport, setCustomImport] = useState(null); // { series, unit } | null

  function handleImported(series, unit) {
    setCustomImport({ series, unit });
    setMode('anomaly_hunt');
  }

  function exitAnomalyHunt() {
    setCustomImport(null); // next visit to Anomaly Hunt goes back to generated data
    setMode(null);
  }

  if (mode === 'anomaly_hunt') {
    return <AnomalyHuntGame onExit={exitAnomalyHunt} customImport={customImport} />;
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
  if (mode === 'import') {
    return <ImportDataScreen onImported={handleImported} onExit={() => setMode(null)} />;
  }
  return <HomeScreen onSelectMode={setMode} />;
}
