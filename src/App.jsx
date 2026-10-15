import { useEffect, useRef, useState } from 'react';
import Home from './screens/Home.jsx';
import Memories from './screens/Memories.jsx';
import Insights from './screens/Insights.jsx';
import Settings from './screens/Settings.jsx';
import PromptPicker from './components/PromptPicker.jsx';
import EntryEditor from './components/EntryEditor.jsx';
import EntryViewer from './components/EntryViewer.jsx';
import StreakCard from './components/StreakCard.jsx';
import MoodSheet from './components/MoodSheet.jsx';
import DaySheet from './components/DaySheet.jsx';
import RecapViewer from './components/RecapViewer.jsx';
import LockScreen from './components/LockScreen.jsx';
import { InstallGuide, Welcome } from './components/Onboarding.jsx';
import { hasPasscode } from './lib/passcode.js';
import { isStandalone, shouldInstall } from './lib/platform.js';
import { db, entriesOn, getSetting, setSetting } from './lib/db.js';
import { loadRecap, recapId } from './lib/recap.js';
import { HomeIcon, InsightsIcon, MemoriesIcon, PlusIcon, SettingsIcon } from './components/Icons.jsx';

const TABS = [
  { id: 'home', label: 'Home', Icon: HomeIcon },
  { id: 'memories', label: 'Memories', Icon: MemoriesIcon },
  { id: 'insights', label: 'Insights', Icon: InsightsIcon },
  { id: 'settings', label: 'Settings', Icon: SettingsIcon },
];

let sessionCounter = 0;
const RELOCK_AFTER_MS = 60 * 1000;

const installSkipped = () => {
  try {
    return sessionStorage.getItem('glimmer.installSkipped') === '1';
  } catch {
    return false;
  }
};

export default function App({ boot }) {
  const [tab, setTab] = useState('home');
  const [locked, setLocked] = useState(boot.locked);
  const [welcome, setWelcome] = useState(isStandalone() && !boot.onboarded);
  const [install, setInstall] = useState(shouldInstall() && !installSkipped() ? 'start' : null); // 'start' | 'help'
  const hiddenAt = useRef(null);

  // Lock again when she comes back after a minute or more away.
  useEffect(() => {
    const onVis = async () => {
      if (document.visibilityState === 'hidden') hiddenAt.current = Date.now();
      else if (hiddenAt.current && Date.now() - hiddenAt.current > RELOCK_AFTER_MS && (await hasPasscode())) setLocked(true);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const closeInstall = () => {
    if (install === 'start') {
      try {
        sessionStorage.setItem('glimmer.installSkipped', '1');
      } catch {
        /* private mode */
      }
    }
    setInstall(null);
  };
  const finishWelcome = () => {
    setSetting('onboarded', true);
    setWelcome(false);
  };
  const [picker, setPicker] = useState(null); // { date? } while the "+" sheet is open
  const [editor, setEditor] = useState(null); // { key, entry?, prompt?, date? }
  const [viewerId, setViewerId] = useState(null);
  const [day, setDay] = useState(null); // { date, onlyIds? }
  const [mood, setMood] = useState(null); // { date, thenCelebrate? }
  const [celebrate, setCelebrate] = useState(false);
  const [recap, setRecap] = useState(null);

  const openRecap = async (range) => {
    const built = await loadRecap(range);
    setRecap(built);
    const seen = await getSetting('seenRecaps', []);
    if (!seen.includes(recapId(range))) await setSetting('seenRecaps', [...seen, recapId(range)]);
  };

  const openPicker = (date) => setPicker({ date });
  const startEntry = (prompt, date = picker?.date) => {
    setPicker(null);
    setEditor({ key: ++sessionCounter, prompt, date });
  };
  const editEntry = (entry) => {
    setViewerId(null);
    setEditor({ key: ++sessionCounter, entry });
  };
  const writeFor = (date) => {
    setDay(null);
    openPicker(date);
  };

  // New entry -> (first entry of that day? ask for the mood) -> gentle streak card.
  const onSaved = async (entry, isNew) => {
    setEditor(null);
    if (!isNew) return;
    const [dayRow, count] = await Promise.all([db.days.get(entry.date), entriesOn(entry.date).then((list) => list.length)]);
    if (!dayRow && count === 1) setMood({ date: entry.date, thenCelebrate: true });
    else setCelebrate(true);
  };
  const moodDone = () => {
    if (mood?.thenCelebrate) setCelebrate(true);
    setMood(null);
  };

  const openEntry = (e) => setViewerId(e.id);

  const screens = {
    home: (
      <Home onWrite={(p) => startEntry(p, undefined)} onPick={() => openPicker()} onOpenEntry={openEntry} onMood={(date) => setMood({ date })}
        onOpenRecap={openRecap}
        onGoSettings={() => setTab('settings')}
        onShowInstall={() => setInstall('help')}
      />
    ),
    memories: <Memories onOpenDay={(date, onlyIds) => setDay({ date, onlyIds })} />,
    insights: <Insights onOpenRecap={openRecap} />,
    settings: <Settings onShowInstall={() => setInstall('help')} />,
  };

  return (
    <div className="app">
      <main className="scroller" key={tab}>
        {screens[tab]}
      </main>

      <nav className="tabbar" aria-label="Main">
        {TABS.slice(0, 2).map((t) => (
          <TabButton key={t.id} t={t} active={tab === t.id} onClick={() => setTab(t.id)} />
        ))}
        <div className="fab-slot">
          <button className="fab" onClick={() => openPicker()} aria-label="New entry">
            <PlusIcon size={28} />
          </button>
        </div>
        {TABS.slice(2).map((t) => (
          <TabButton key={t.id} t={t} active={tab === t.id} onClick={() => setTab(t.id)} />
        ))}
      </nav>

      <DaySheet request={day} onClose={() => setDay(null)} onOpenEntry={openEntry} onWrite={writeFor} onMood={(date) => setMood({ date })} />
      <PromptPicker open={!!picker} onClose={() => setPicker(null)} onPick={(p) => startEntry(p)} />
      <EntryEditor session={editor} onClose={() => setEditor(null)} onSaved={onSaved} />
      <EntryViewer entryId={viewerId} onClose={() => setViewerId(null)} onEdit={editEntry} />
      <MoodSheet request={mood} onDone={moodDone} />
      {recap && <RecapViewer key={recap.id} recap={recap} onClose={() => setRecap(null)} />}
      {celebrate && <StreakCard onContinue={() => setCelebrate(false)} />}
      {welcome && !locked && <Welcome onDone={finishWelcome} />}
      {install && <InstallGuide onClose={closeInstall} closeLabel={install === 'help' ? 'Got it' : undefined} />}
      {locked && <LockScreen onUnlock={() => setLocked(false)} />}
    </div>
  );
}

function TabButton({ t, active, onClick }) {
  const { Icon } = t;
  return (
    <button className={`tab ${active ? 'active' : ''}`} onClick={onClick} aria-current={active ? 'page' : undefined}>
      <Icon size={24} />
      <span>{t.label}</span>
    </button>
  );
}
