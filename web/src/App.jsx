import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Home } from './screens/Home/index.jsx';
import { AnomalyHunt } from './screens/AnomalyHunt/index.jsx';
import { ForecastCall } from './screens/ForecastCall/index.jsx';
import { DailyChallenge } from './screens/DailyChallenge/index.jsx';
import { Profile } from './screens/Profile/index.jsx';
import { History } from './screens/History/index.jsx';
import { Import } from './screens/Import/index.jsx';
import { BootSequence } from './BootSequence.jsx';
import { CommandPalette } from './components/CommandPalette.jsx';

const SCREEN_VARIANTS = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
};

export default function App() {
  const [booted, setBooted] = useState(() => sessionStorage.getItem('ah2-booted') === '1');
  const [screen, setScreen] = useState('home');
  const [importedSeries, setImportedSeries] = useState(null);
  const [importedMeta, setImportedMeta] = useState(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(e) {
      const isK = e.key === 'k' || e.key === 'K';
      if ((e.metaKey || e.ctrlKey) && isK) {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (booted) {
      try {
        sessionStorage.setItem('ah2-booted', '1');
      } catch {
        // storage unavailable -- boot sequence will just replay each visit
      }
    }
  }, [booted]);

  function navigate(next) {
    if (next !== 'anomaly') {
      setImportedSeries(null);
      setImportedMeta(null);
    }
    setScreen(next);
  }

  function startImported(series, meta) {
    setImportedSeries(series);
    setImportedMeta(meta);
    setScreen('anomaly');
  }

  if (!booted) {
    return <BootSequence onComplete={() => setBooted(true)} />;
  }

  const screens = {
    home: <Home onNavigate={navigate} />,
    anomaly: <AnomalyHunt key={importedSeries ? 'imported' : 'random'} onNavigate={navigate} importedSeries={importedSeries} importedMeta={importedMeta} />,
    forecast: <ForecastCall onNavigate={navigate} />,
    daily: <DailyChallenge onNavigate={navigate} />,
    profile: <Profile onNavigate={navigate} />,
    history: <History onNavigate={navigate} />,
    import: <Import onNavigate={navigate} onStartImported={startImported} />,
  };

  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div
          key={screen}
          variants={SCREEN_VARIANTS}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          {screens[screen]}
        </motion.div>
      </AnimatePresence>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onNavigate={navigate} />
    </>
  );
}
