import { useState } from 'react';
import HomeScreen from './components/HomeScreen.jsx';
import AnomalyHuntGame from './components/AnomalyHuntGame.jsx';
import ForecastCallGame from './components/ForecastCallGame.jsx';

export default function App() {
  const [mode, setMode] = useState(null); // null | 'anomaly_hunt' | 'forecast_call'

  if (mode === 'anomaly_hunt') {
    return <AnomalyHuntGame onExit={() => setMode(null)} />;
  }
  if (mode === 'forecast_call') {
    return <ForecastCallGame onExit={() => setMode(null)} />;
  }
  return <HomeScreen onSelectMode={setMode} />;
}
