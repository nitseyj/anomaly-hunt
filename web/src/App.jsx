import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import HomeScreen from './screens/Home/index.jsx';
import AnomalyHuntScreen from './screens/AnomalyHunt/index.jsx';
import ForecastCallScreen from './screens/ForecastCall/index.jsx';
import DailyChallengeScreen from './screens/DailyChallenge/index.jsx';
import ProfileScreen from './screens/Profile/index.jsx';
import HistoryScreen from './screens/History/index.jsx';
import ImportScreen from './screens/Import/index.jsx';
import { generateCaseFromSeries } from './engine/case.js';

const SCREENS = {
  home: HomeScreen,
  anomaly_hunt: AnomalyHuntScreen,
  forecast_call: ForecastCallScreen,
  daily_challenge: DailyChallengeScreen,
  profile: ProfileScreen,
  history: HistoryScreen,
  import: ImportScreen,
};

export default function App() {
  const [mode, setMode] = useState('home');
  const [importedCase, setImportedCase] = useState(null);

  function handleImported(series, unit) {
    setImportedCase(generateCaseFromSeries(series, unit, 'medium', 'Custom Data Investigation'));
    setMode('anomaly_hunt');
  }

  function exitAnomalyHunt() {
    setImportedCase(null);
    setMode('home');
  }

  const Screen = SCREENS[mode] ?? HomeScreen;
  const props =
    mode === 'home'
      ? { onSelectMode: setMode }
      : mode === 'anomaly_hunt'
        ? { onExit: exitAnomalyHunt, importedCase }
        : mode === 'import'
          ? { onImported: handleImported, onExit: () => setMode('home') }
          : { onExit: () => setMode('home') };

  return (
    <>
      <div className="ambient-glow" />
      <div className="ambient-grain" />
      <AnimatePresence mode="wait">
        <motion.div key={mode} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
          <Screen {...props} />
        </motion.div>
      </AnimatePresence>
    </>
  );
}
