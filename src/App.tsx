import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from './store';
import { GachaModal } from './components/GachaModal';
import type { GachaItem } from './components/GachaModal';
import { SettlementModal } from './components/modals';
import { Icon } from './components/Icon';
import { TodayView } from './views/TodayView';
import { StatsView } from './views/StatsView';
import { ProjectsView } from './views/ProjectsView';
import { unlockAudio } from './lib/sound';

type Tab = 'today' | 'stats' | 'projects';

const TABS: { id: Tab; ico: string; label: string }[] = [
  { id: 'today', ico: 'cap', label: '今日' },
  { id: 'stats', ico: 'chart', label: '统计' },
  { id: 'projects', ico: 'sliders', label: '管理' },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('today');
  const [gacha, setGacha] = useState<GachaItem[] | null>(null);
  const [toastMsg, setToastMsg] = useState('');
  const toastTimer = useRef(0);

  const pendingSettle = useStore((s) => s.pendingSettleView);
  const dismissSettlement = useStore((s) => s.dismissSettlement);
  const soundOn = useStore((s) => s.soundOn);
  const toggleSound = useStore((s) => s.toggleSound);

  // 打卡点击是用户手势，在此同步解锁音频自动播放
  const openGacha = useCallback((items: GachaItem[]) => {
    unlockAudio();
    setGacha(items);
  }, []);

  const toast = useCallback((m: string) => {
    setToastMsg(m);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(''), 2200);
  }, []);

  // 日结引擎：启动时补结算；每 30s 与页面回到前台时检查跨天
  useEffect(() => {
    const run = () => useStore.getState().runSettlement();
    run();
    const t = window.setInterval(run, 30000);
    const onVis = () => {
      if (!document.hidden) run();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  return (
    <>
      <header className="app-header">
        <div className="brand">扭蛋打卡</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            className="icobtn"
            onClick={() => {
              toggleSound();
              if (!soundOn) unlockAudio();
            }}
            aria-label="音效开关"
            title="音效开关"
          >
            <Icon name={soundOn ? 'sound' : 'mute'} size={17} />
          </button>
        </div>
      </header>

      <main>
        {tab === 'today' && <TodayView openGacha={openGacha} />}
        {tab === 'stats' && <StatsView />}
        {tab === 'projects' && <ProjectsView toast={toast} />}
      </main>

      <nav className="tabbar">
        <div className="inner">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
              <Icon name={t.ico} size={19} />
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {gacha && <GachaModal queue={gacha} onClose={() => setGacha(null)} />}
      {pendingSettle && <SettlementModal items={pendingSettle} onClose={dismissSettlement} />}
      <div id="toast" className={toastMsg ? 'show' : ''}>
        {toastMsg}
      </div>
    </>
  );
}
