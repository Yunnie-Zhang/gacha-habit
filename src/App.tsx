import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as RPointerEvent,
} from 'react';
import { useStore } from './store';
import { AccountModal, AvatarEditorModal, ConfirmModal, SettlementModal } from './components/modals';
import { AvatarFace } from './components/Avatar';
import { Icon } from './components/Icon';
import { TodayView, enDate } from './views/TodayView';
import { StatsView } from './views/StatsView';
import { ProjectsView } from './views/ProjectsView';
import { AchievementsView, ExchangeView } from './views/ExchangeView';
import { LoginView } from './views/LoginView';
import { useAuth, useCurrentAccount } from './lib/auth';
import { playCollect, playPop, unlockAudio } from './lib/sound';

type Tab = 'stats' | 'exchange' | 'achv' | 'projects';
/** today: 今日纸面铺开 · closing: 正在收回球 · closed: 收成球（露出底衬） */
type Phase = 'open' | 'closing' | 'closed';

const DOCK_H = 62; // dock 条高（与 index.css .dock 同步）
const VALLEY_D = 26; // 凹谷深
const BALL = 56; // 中央圆球直径

/** dock 外轮廓：两端大圆角 + 顶边中央一条平滑凹谷（“凹”字造型）。
 *  路径按实测像素宽生成，避免 viewBox 拉伸把圆角挤变形。 */
function dockPath(w: number): string {
  const vw = Math.max(44, Math.min(68, (w - 200) / 2)); // 谷半宽，窄屏收窄
  const cx = w / 2;
  const k = vw * 0.52; // 贝塞尔两端平直段，保证与顶边相切
  const f = (n: number) => +n.toFixed(1);
  return [
    'M 26 0',
    `L ${f(cx - vw)} 0`,
    `C ${f(cx - vw + k)} 0 ${f(cx - vw * 0.34)} ${VALLEY_D} ${f(cx)} ${VALLEY_D}`,
    `C ${f(cx + vw * 0.34)} ${VALLEY_D} ${f(cx + vw - k)} 0 ${f(cx + vw)} 0`,
    `L ${w - 26} 0`,
    `Q ${w} 0 ${w} 26`,
    `L ${w} ${DOCK_H - 26}`,
    `Q ${w} ${DOCK_H} ${w - 26} ${DOCK_H}`,
    `L 26 ${DOCK_H}`,
    `Q 0 ${DOCK_H} 0 ${DOCK_H - 26}`,
    'L 0 26',
    'Q 0 0 26 0',
    'Z',
  ].join(' ');
}

function Main({ toast, avatarIn }: { toast: (m: string) => void; avatarIn: boolean }) {
  const [tab, setTab] = useState<Tab>('stats');
  const [phase, setPhase] = useState<Phase>('open'); // 启动即铺开今日页
  const account = useCurrentAccount();
  const [acctOpen, setAcctOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [avEditorOpen, setAvEditorOpen] = useState(false);
  const showAvTip = avatarIn && !!account && !account.avatar && !account.avatarTipDismissed;
  const openLogoutConfirm = () => {
    setAcctOpen(false);
    setConfirmLogout(true);
  };
  const doLogout = () => {
    setConfirmLogout(false);
    useAuth.getState().logout();
  };

  const layerRef = useRef<HTMLDivElement>(null);
  const ballRef = useRef<HTMLButtonElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const [dockW, setDockW] = useState(380);

  const moving = useRef(false); // 展开/收起动画进行中
  const pendingExpand = useRef(false);
  const collapseAnim = useRef<Animation | null>(null);
  const drag = useRef<{ pid: number; y0: number; dy: number; lastY: number; lastT: number; v: number } | null>(null);

  const pendingSettle = useStore((s) => s.pendingSettleView);
  const dismissSettlement = useStore((s) => s.dismissSettlement);
  const soundOn = useStore((s) => s.soundOn);
  const toggleSound = useStore((s) => s.toggleSound);

  // 日结引擎：启动时补结算；每 30s 与页面回到前台时检查跨天（Main 仅登录后挂载）
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

  // dock 宽度实测（凹谷路径按像素生成，防拉伸变形）
  useLayoutEffect(() => {
    const measure = () => setDockW(dockRef.current?.clientWidth || 380);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  /** 今日纸面收拢成球时的目标变换：整面缩成一颗贴在球位的圆 */
  const collapsedBox = () => {
    const layer = layerRef.current!;
    const b = ballRef.current!.getBoundingClientRect();
    const r = layer.getBoundingClientRect(); // 含当前拖拽位移，收回永远落回球位
    const d = BALL + 6;
    return {
      dx: b.left + b.width / 2 - (r.left + r.width / 2),
      dy: b.top + b.height / 2 - (r.top + r.height / 2),
      sx: d / layer.offsetWidth,
      sy: d / layer.offsetHeight,
    };
  };

  const clearLayerInline = () => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.style.transform = '';
    layer.style.borderRadius = '';
    layer.style.opacity = '';
  };

  /** 球被“接住”：弹一下 + 轻快双击 */
  const ballCatch = () => {
    playCollect();
    ballRef.current?.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.24)' }, { transform: 'scale(1)' }],
      { duration: 380, easing: 'cubic-bezier(.3,1.6,.4,1)' },
    );
  };

  /** 球 → 今日纸面：从球的位置长成一整面（页头不动） */
  const expandToday = () => {
    if (moving.current || phase !== 'closed') return;
    moving.current = true;
    unlockAudio();
    playPop(); // 胶囊爆开
    ballRef.current?.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(.76)' }, { transform: 'scale(1)' }],
      { duration: 460, easing: 'cubic-bezier(.3,1.4,.4,1)' },
    );
    pendingExpand.current = true;
    setPhase('open');
  };

  // 展开动画在 layout effect 里启动：铺开前一帧起始位就在位，不会闪一帧全页
  useLayoutEffect(() => {
    if (phase !== 'open' || !pendingExpand.current) return;
    pendingExpand.current = false;
    const layer = layerRef.current!;
    collapseAnim.current?.cancel();
    collapseAnim.current = null;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      moving.current = false;
      return;
    }
    const { dx, dy, sx, sy } = collapsedBox();
    const a = layer.animate(
      [
        {
          transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`,
          borderRadius: '999px',
          opacity: '0',
        },
        {
          transform: 'translate(0px, 0px) scale(1, 1)',
          borderRadius: '0px',
          opacity: '1',
        },
      ],
      { duration: 470, easing: 'cubic-bezier(.26,.9,.32,1.04)' },
    );
    a.onfinish = () => {
      a.cancel();
      moving.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  /** 今日纸面 → 球：整面缩回球位，被球接住（全局页头原地不动） */
  const collapseToday = (fromDrag = false) => {
    if (moving.current) return;
    const layer = layerRef.current;
    if (!layer) return;
    moving.current = true;
    setPhase('closing'); // 底衬（统计/管理）先铺好，随纸面收起露出
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      clearLayerInline();
      setPhase('closed');
      moving.current = false;
      ballCatch();
      return;
    }
    const { dx, dy, sx, sy } = collapsedBox();
    const start = fromDrag
      ? {
          transform: layer.style.transform || 'none',
          borderRadius: layer.style.borderRadius || '0px',
          opacity: layer.style.opacity || '1',
        }
      : { transform: 'translate(0px, 0px) scale(1, 1)', borderRadius: '0px', opacity: '1' };
    const a = layer.animate(
      [
        start,
        {
          transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`,
          borderRadius: '999px',
          opacity: '0',
        },
      ],
      { duration: 380, easing: 'cubic-bezier(.55,.06,.6,.24)', fill: 'forwards' },
    );
    collapseAnim.current = a; // 保持停在球位，等下次展开时再撤
    a.onfinish = () => {
      clearLayerInline();
      setPhase('closed');
      moving.current = false;
      ballCatch();
    };
  };

  const toggleToday = () => {
    if (phase === 'open') collapseToday();
    else expandToday();
  };

  const switchTab = (t: Tab) => {
    setTab(t);
    if (phase === 'open') collapseToday();
  };

  /* ---- 拖米黄纸面上边缘（今日分数卡）向下收起，页头不动 ---- */
  const onLayerPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (phase !== 'open' || moving.current) return;
    const t = e.target as HTMLElement;
    if (!t.closest('.t-card') || t.closest('button')) return;
    drag.current = { pid: e.pointerId, y0: e.clientY, dy: 0, lastY: e.clientY, lastT: e.timeStamp, v: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onLayerPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pid) return;
    d.dy = Math.max(0, e.clientY - d.y0); // 只跟下拉，向上不橡皮筋
    const dt = Math.max(1, e.timeStamp - d.lastT);
    d.v = d.v * 0.72 + ((e.clientY - d.lastY) / dt) * 0.28;
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;
    const layer = layerRef.current!;
    const p = Math.min(1, d.dy / window.innerHeight);
    layer.style.transform = `translateY(${(d.dy * (1 - 0.16 * p)).toFixed(1)}px) scale(${(1 - 0.07 * p).toFixed(4)})`;
    layer.style.borderRadius = `${Math.min(34, d.dy * 0.12).toFixed(1)}px`;
    layer.style.opacity = (1 - 0.22 * p).toFixed(3);
  };

  const onLayerPointerUp = (e: RPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pid) return;
    drag.current = null;
    if (d.dy < 4) {
      clearLayerInline();
      return;
    }
    const layer = layerRef.current!;
    if (d.dy > 130 || (d.v > 0.55 && d.dy > 48)) {
      collapseToday(true); // 从当前拖拽位置继续缩回球
      return;
    }
    moving.current = true; // 不够火候：弹回原位
    const a = layer.animate(
      [
        {
          transform: layer.style.transform || 'none',
          borderRadius: layer.style.borderRadius || '0px',
          opacity: layer.style.opacity || '1',
        },
        { transform: 'translate(0px, 0px) scale(1, 1)', borderRadius: '0px', opacity: '1' },
      ],
      { duration: 360, easing: 'cubic-bezier(.3,1.25,.4,1)', fill: 'forwards' },
    );
    a.onfinish = () => {
      a.cancel();
      clearLayerInline();
      moving.current = false;
    };
  };

  return (
    <div className="app-frame">
      {/* 全局页头（皮粉）：所有页面共用，永远固定 */}
      <header className="t-hd">
        <div className="t-hd-in">
          <div>
            <div className="hi">
              hi，<em>{account?.name ?? '…'}</em>
            </div>
            <div className="t-dt">{enDate()}</div>
          </div>
          <div className="t-hd-r">
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
            <div className="av-wrap">
              <button
                className={`t-avatar${avatarIn ? ' avatar-in' : ''}`}
                style={avatarIn ? undefined : { visibility: 'hidden' }}
                onClick={() => setAcctOpen(true)}
                aria-label="账号"
                title="账号"
              >
                <AvatarFace account={account} />
              </button>
              {showAvTip && (
                <div className="av-tip">
                  <button className="av-tip-go" onClick={() => setAvEditorOpen(true)}>
                    修改头像
                  </button>
                  <button className="av-tip-x" onClick={() => useAuth.getState().dismissAvatarTip()}>
                    不再提示
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="app-body">
        {/* 底衬：统计 / 兑换 / 成就 / 管理（同样铺在皮粉页头下的米黄纸面里） */}
        {phase !== 'open' && (
          <div className="base-view">
            <div className="base-sheet">
              <main>
                {tab === 'stats' ? (
                  <StatsView />
                ) : tab === 'exchange' ? (
                  <ExchangeView toast={toast} />
                ) : tab === 'achv' ? (
                  <AchievementsView />
                ) : (
                  <ProjectsView toast={toast} />
                )}
              </main>
            </div>
          </div>
        )}

        {/* 今日纸面：盖在底衬上，点球展开、拖分数卡上边缘收回 */}
        <div
          ref={layerRef}
          className={`today-layer${phase === 'closed' ? ' closed' : ''}${phase === 'closing' ? ' closing' : ''}`}
          onPointerDown={onLayerPointerDown}
          onPointerMove={onLayerPointerMove}
          onPointerUp={onLayerPointerUp}
          onPointerCancel={onLayerPointerUp}
        >
          <TodayView />
        </div>
      </div>

      <nav className="tabbar">
        <div className="dock" ref={dockRef}>
          <svg
            className="dock-bg"
            viewBox={`0 0 ${dockW} ${DOCK_H}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d={dockPath(dockW)} />
          </svg>
          <button
            className={`dock-tab left${phase !== 'open' && tab === 'stats' ? ' active' : ''}`}
            onClick={() => switchTab('stats')}
          >
            <Icon name="chart" size={20} />
            <span>统计</span>
          </button>
          <button
            className={`dock-tab left2${phase !== 'open' && tab === 'exchange' ? ' active' : ''}`}
            onClick={() => switchTab('exchange')}
          >
            <Icon name="ticket" size={20} />
            <span>兑换</span>
          </button>
          <button
            ref={ballRef}
            className={`dock-ball${phase === 'open' ? ' open' : ''}`}
            onClick={toggleToday}
            aria-label={phase === 'open' ? '收起今日' : '展开今日'}
            title={phase === 'open' ? '收起今日' : '展开今日'}
            aria-hidden={phase === 'open'}
            tabIndex={phase === 'open' ? -1 : 0}
          >
            <Icon name="cap" size={24} />
          </button>
          <button
            className={`dock-tab right2${phase !== 'open' && tab === 'achv' ? ' active' : ''}`}
            onClick={() => switchTab('achv')}
          >
            <Icon name="star" size={20} />
            <span>成就</span>
          </button>
          <button
            className={`dock-tab right${phase !== 'open' && tab === 'projects' ? ' active' : ''}`}
            onClick={() => switchTab('projects')}
          >
            <Icon name="sliders" size={20} />
            <span>管理</span>
          </button>
        </div>
      </nav>

      {pendingSettle && <SettlementModal items={pendingSettle} onClose={dismissSettlement} />}
      {acctOpen && (
        <AccountModal
          onClose={() => setAcctOpen(false)}
          onLogout={openLogoutConfirm}
          onEditAvatar={() => {
            setAcctOpen(false);
            setAvEditorOpen(true);
          }}
          toast={toast}
        />
      )}
      {avEditorOpen && <AvatarEditorModal onClose={() => setAvEditorOpen(false)} toast={toast} />}
      {confirmLogout && <ConfirmModal text="退出登录后回到登录页，数据仍保留在本机该账号下。" onYes={doLogout} onNo={() => setConfirmLogout(false)} />}
    </div>
  );
}

/** 登录头像迎宾飞行参数：起飞圆心/直径 + 中央展示的问候语 */
interface FlySpec {
  cx: number;
  cy: number;
  size: number;
  hello: string;
}

const FLY_CENTER_RATIO = 0.4; // 迎宾时头像圆心的屏幕高度占比
const FLY_CENTER_SIZE = 128; // 迎宾时头像放大的直径

/** 登录门卫：未登录只渲染登录页；登录态切换时在绘制前完成数据换仓（rehydrate） */
export default function App() {
  const currentId = useAuth((s) => s.currentId);
  const account = useCurrentAccount();
  const [toastMsg, setToastMsg] = useState('');
  const [flight, setFlight] = useState<FlySpec | null>(null);
  const flyRef = useRef<HTMLDivElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const helloRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef(0);

  const toast = (m: string) => {
    setToastMsg(m);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(''), 2200);
  };

  useLayoutEffect(() => {
    void useStore.persist.rehydrate();
    useStore.setState({ pendingSettleView: null });
  }, [currentId]);

  // 迎宾飞行三段式：①头像放大飞向屏幕中央 → ②问候语浮现并停留 1s →
  // ③幕布揭开、头像缩小飞向页头头像位，落位后真头像以 avatar-in 弹出。
  // 幕布淡入盖住登录页/主界面，让整个流程只聚焦头像；落位前页头头像保持隐藏。
  useLayoutEffect(() => {
    if (!flight || !currentId) return;
    const ghost = flyRef.current;
    const veil = veilRef.current;
    const hello = helloRef.current;
    if (!ghost || !veil || !hello) {
      setFlight(null);
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setFlight(null);
      return;
    }

    let cancelled = false;
    const anims: Animation[] = [];
    const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    const base = flight.size;
    // 当前变换（WAAPI 后续动画会整体覆盖前一个，关键帧需显式接续）
    const cur = { x: 0, y: 0, s: 1 };
    const move = (tx: number, ty: number, scale: number, dur: number, easing: string) => {
      const a = ghost.animate(
        [
          { transform: `translate(${cur.x}px, ${cur.y}px) scale(${cur.s})` },
          { transform: `translate(${tx}px, ${ty}px) scale(${scale})` },
        ],
        { duration: dur, easing, fill: 'forwards' },
      );
      anims.push(a);
      cur.x = tx;
      cur.y = ty;
      cur.s = scale;
      return a.finished;
    };

    (async () => {
      try {
        // 幕布淡入，盖住登录页
        anims.push(veil.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out', fill: 'forwards' }));
        // ① 放大飞向屏幕中央
        const cx1 = window.innerWidth / 2;
        const cy1 = window.innerHeight * FLY_CENTER_RATIO;
        await move(
          cx1 - flight.cx,
          cy1 - flight.cy,
          FLY_CENTER_SIZE / base,
          520,
          'cubic-bezier(.3,.86,.32,1)',
        );
        if (cancelled) return;
        // ② 问候语浮现，停留 1s
        anims.push(
          hello.animate(
            [{ opacity: 0, transform: 'translate(-50%, 10px)' }, { opacity: 1, transform: 'translate(-50%, 0px)' }],
            { duration: 320, easing: 'ease-out', fill: 'forwards' },
          ),
        );
        await sleep(1000);
        if (cancelled) return;
        // ③ 问候语退场、幕布揭开，同时头像缩小飞向页头头像位
        anims.push(hello.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, easing: 'ease-in', fill: 'forwards' }));
        anims.push(veil.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 480, easing: 'ease-in', fill: 'forwards' }));
        const target = document.querySelector('.t-avatar');
        if (!target) {
          setFlight(null);
          return;
        }
        const b = target.getBoundingClientRect();
        await move(
          b.left + b.width / 2 - flight.cx,
          b.top + b.height / 2 - flight.cy,
          b.width / base,
          560,
          'cubic-bezier(.4,.1,.3,1)',
        );
        if (cancelled) return;
        setFlight(null); // 摘掉幽灵/幕布/问候语，页头头像以 avatar-in 弹出
      } catch {
        // 动画被清理取消（组件卸载）：不再推进
        if (!cancelled) setFlight(null);
      }
    })();

    return () => {
      cancelled = true;
      anims.forEach((a) => a.cancel());
    };
  }, [flight, currentId]);

  return (
    <>
      {currentId ? (
        <Main toast={toast} avatarIn={!flight} />
      ) : (
        <LoginView toast={toast} onAvatarFly={setFlight} />
      )}
      <div id="toast" className={toastMsg ? 'show' : ''}>
        {toastMsg}
      </div>
      {flight && account && (
        <>
          <div ref={veilRef} className="fly-veil" />
          <div
            ref={helloRef}
            className="fly-hello"
            style={{ top: window.innerHeight * FLY_CENTER_RATIO + FLY_CENTER_SIZE / 2 + 22 }}
          >
            {flight.hello}
          </div>
          <div
            ref={flyRef}
            className="avatar-fly"
            style={{
              left: flight.cx - flight.size / 2,
              top: flight.cy - flight.size / 2,
              width: flight.size,
              height: flight.size,
              fontSize: flight.size * 0.39,
            }}
          >
            <AvatarFace account={account} />
          </div>
        </>
      )}
    </>
  );
}
