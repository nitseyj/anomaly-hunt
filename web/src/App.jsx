import { lazy, Suspense, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { BootSequence } from './BootSequence.jsx';
import { AppShell } from './components/AppShell.jsx';
import { CommandPalette } from './components/CommandPalette.jsx';
import { ScreenTransition } from './components/ScreenTransition.jsx';
import { ScreenLoader } from './components/ScreenLoader.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import { ToastHub } from './components/ToastHub.jsx';
import { ConfirmDialog } from './components/ConfirmDialog.jsx';
import { requestConfirm } from './engine/confirmBus.js';

// Each screen (and everything it alone pulls in -- the chart code,
// mode-specific engine logic) loads as its own chunk the first time it's
// visited, instead of all 7 screens' code shipping in one bundle up
// front just to render Home. `.then` unwraps the named export into the
// default shape React.lazy expects, without changing how each screen
// module is written/exported everywhere else it's imported from (tests,
// etc.) to a default export just for this.
const Home = lazy(() => import('./screens/Home/index.jsx').then((m) => ({ default: m.Home })));
const AnomalyHunt = lazy(() => import('./screens/AnomalyHunt/index.jsx').then((m) => ({ default: m.AnomalyHunt })));
const ForecastCall = lazy(() => import('./screens/ForecastCall/index.jsx').then((m) => ({ default: m.ForecastCall })));
const DailyChallenge = lazy(() => import('./screens/DailyChallenge/index.jsx').then((m) => ({ default: m.DailyChallenge })));
const Profile = lazy(() => import('./screens/Profile/index.jsx').then((m) => ({ default: m.Profile })));
const History = lazy(() => import('./screens/History/index.jsx').then((m) => ({ default: m.History })));
const Import = lazy(() => import('./screens/Import/index.jsx').then((m) => ({ default: m.Import })));

const LIVE_SCREENS = ['anomaly', 'forecast', 'daily'];

// A horizontal swoosh instead of a plain fade: the new screen sweeps in
// from the left (the same direction the sidebar nav sits in, and the
// same direction ScreenTransition's radar beam already travels), while
// the outgoing one continues rightward as it fades, so the two motions
// read as one continuous left-to-right sweep rather than a crossfade.
// The slight scale dip + spring (not a tween) is what gives it weight --
// same spring family as the sidebar's active-nav bar, so the one
// full-screen motion in the app and the small chrome ones feel like the
// same hand drew them, not two different transition systems bolted
// together.
const SCREEN_VARIANTS = {
  initial: { opacity: 0, x: -36, scale: 0.98 },
  animate: { opacity: 1, x: 0, scale: 1 },
  exit: { opacity: 0, x: 36, scale: 1.012 },
};

const SCREEN_TRANSITION = {
  x: { type: 'spring', stiffness: 480, damping: 42, mass: 0.9 },
  scale: { type: 'spring', stiffness: 480, damping: 42, mass: 0.9 },
  opacity: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
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

  async function navigate(next, opts = {}) {
    // Screens with their own "leave with unsaved progress?" confirm (the
    // Exit button, or a post-reveal "Back to home") pass skipGuard so the
    // player is never asked twice. Sidebar nav has no such local check, so
    // it's the one path that needs this guard -- without it, clicking a
    // sidebar link mid-case would silently abandon a timed round.
    if (!opts.skipGuard && LIVE_SCREENS.includes(screen) && next !== screen) {
      const ok = await requestConfirm({
        title: 'Leave this investigation?',
        message:
          "Your progress on this case won't be saved — only a completed investigation is added to your match log. Opening this mode again starts a brand new case, not this one.",
        confirmLabel: 'Leave',
        cancelLabel: 'Stay',
      });
      if (!ok) return;
    }
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
      <AppShell screen={screen} onNavigate={navigate}>
        <AnimatePresence mode="wait">
          <motion.div
            key={screen}
            variants={SCREEN_VARIANTS}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={SCREEN_TRANSITION}
          >
            <ErrorBoundary onReset={() => navigate('home', { skipGuard: true })}>
              <Suspense fallback={<ScreenLoader />}>{screens[screen]}</Suspense>
            </ErrorBoundary>
          </motion.div>
        </AnimatePresence>
      </AppShell>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onNavigate={navigate} />
      <ScreenTransition triggerKey={screen} />
      <ToastHub />
      <ConfirmDialog />
    </>
  );
}
