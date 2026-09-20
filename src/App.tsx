import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from './store';
import { GachaModal } from './components/GachaModal';
import type { GachaItem } from './components/GachaModal';
import { SettlementModal } from './components/modals';
import { TodayView } from './views/TodayView';
import { StatsView } from './views/StatsView';
import { ProjectsView } from './views/ProjectsView';
import { unlockAudio } from './lib/sound';

type Tab = 'today' | 'stats' | 'projects';

const TABS: { id: Tab; ico: string; label: string }[] = [
  { id: 'today', ico: '🎁', label: '今日' },
  { id: 'stats', ico: '📊', label: '统计' },
  { id: 'projects', ico: '⚙️', label: '项目' },
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

  const now = new Date();
  const header = `${now.getMonth() + 1}月${now.getDate()}日 星期${'日一二三四五六'[now.getDay()]}`;

  return (
    <>
      <header className="app-header">
        <div className="brand">
          <svg viewBox="0 0 120 150" aria-hidden="true">
            <path d="M10 72 A50 50 0 0 1 110 72 Z" fill="#f59e0b" />
            <rect x="6" y="66" width="108" height="12" rx="6" fill="#fbbf24" />
            <path d="M10 78 H110 V102 Q110 128 60 128 Q10 128 10 102 Z" fill="#fef3c7" />
          </svg>
          扭蛋打卡
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            className="btn small ghost"
            onClick={() => {
              toggleSound();
              if (!soundOn) unlockAudio();
            }}
            aria-label="音效开关"
            title="音效开关"
          >
            {soundOn ? '🔊' : '🔇'}
          </button>
          <div className="header-date">{header}</div>
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
              <span className="ico">{t.ico}</span>
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
