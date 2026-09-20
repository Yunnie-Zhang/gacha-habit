import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { Checkin, Project } from '../types';
import { useStore } from '../store';
import { randInt } from '../lib/rng';
import { CountUp } from '../components/CountUp';
import { ConfirmModal } from '../components/modals';
import { Icon } from '../components/Icon';
import { activeProjects, dayTotal, recKey, rollLabel, scoreFrac, scoreTier, streak } from '../lib/logic';
import { BAND_NEG, BAND_PALETTE, BAND_REST } from '../lib/palette';
import { burst, quake, sparkTrail, tipPop } from '../lib/fx';
import { playPop, playReveal, tick, unlockAudio } from '../lib/sound';
import { todayStr } from '../lib/date';

const GROW_MS = 2200; // 卡片生长时长（慢速留悬念）
const VANISH_MS = 320; // 点按后卡片消失时长
const HOLD_MS = 1000; // 分数揭晓后原地停留时长

interface Anim {
  id: string;
  mode: 'checkin' | 'giveup';
  score: number;
}

/** 卡片目标长度：最小 55% 宽（小分也尽量长），最大横贯全宽不超出屏幕 */
function bandWidth(p: Project, score: number, mode: 'checkin' | 'giveup', wrapW: number): number {
  const frac = Math.min(1, Math.max(0, scoreFrac(p, score, mode)));
  const minW = Math.max(240, wrapW * 0.55);
  return Math.round(minW + frac * (wrapW - minW));
}

const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** 页头日期，与设计稿一致："Mon, 21 September" */
function enDate(): string {
  const d = new Date();
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
  return `${wd}, ${d.getDate()} ${MONTHS_EN[d.getMonth()]}`;
}

export function TodayView() {
  const projects = useStore((s) => s.projects);
  const tags = useStore((s) => s.tags);
  const checkins = useStore((s) => s.checkins);
  const commitCheckin = useStore((s) => s.commitCheckin);
  const soundOn = useStore((s) => s.soundOn);
  const toggleSound = useStore((s) => s.toggleSound);
  const [filter, setFilter] = useState('all');
  const [confirm, setConfirm] = useState<{ text: string; cb: () => void } | null>(null);
  const [anim, setAnim] = useState<Anim | null>(null);
  const [wrapW, setWrapW] = useState(0);

  const stackRef = useRef<HTMLDivElement>(null);
  const heroNumRef = useRef<HTMLDivElement>(null);
  const els = useRef(new Map<string, HTMLDivElement>());
  const lastRects = useRef(new Map<string, DOMRect>());
  /** 正在「停留→下放」的卡片 id：期间排除出通用 FLIP */
  const flying = useRef<string | null>(null);

  const ds = todayStr();
  const act = activeProjects(projects, ds);
  const total = dayTotal(checkins, ds);
  let done = 0;
  for (const p of act) if (checkins[recKey(p.id, ds)]?.status === 'done') done++;
  const recOf = (p: Project) => checkins[recKey(p.id, ds)];
  // 卡片颜色按项目顺序从莫兰迪色板取，相邻项目必不同色
  const colorOf = (p: Project) => {
    const i = projects.findIndex((x) => x.id === p.id);
    return BAND_PALETTE[(i < 0 ? 0 : i) % BAND_PALETTE.length];
  };
  const list = act.filter((p) => filter === 'all' || p.tagIds.includes(filter));
  const todo = list.filter((p) => !recOf(p) || recOf(p)!.status === 'rest');
  const finished = list
    .filter((p) => recOf(p) && recOf(p)!.status !== 'rest')
    .sort((a, b) => recOf(b)!.score - recOf(a)!.score); // 完成卡按分数从大到小往下排

  // 容器宽度（卡片长度按它归一）
  useLayoutEffect(() => {
    const measure = () => setWrapW(stackRef.current?.clientWidth ?? 0);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // 打卡/认输动画：卡片消失 → 从左（认输从右）重新长出，终端迸星，揭晓时落账
  useEffect(() => {
    if (!anim) return;
    const el = els.current.get(anim.id)!;
    const p = projects.find((x) => x.id === anim.id);
    if (!p) {
      setAnim(null);
      return;
    }

    // 揭晓：分数弹在原位卡片终端，原地停留；随后落账并移到下方
    const reveal = () => {
      const s = document.createElement('div');
      s.className = 'b-score';
      s.innerHTML = `<span class="v">${anim.score > 0 ? `+${anim.score}` : anim.score}</span><span class="lb">${rollLabel(p, anim.score)}</span>`;
      el.appendChild(s);
      s.animate(
        [
          { transform: 'translateY(-50%) scale(.4)', opacity: '0' },
          { transform: 'translateY(-50%) scale(1)', opacity: '1' },
        ],
        { duration: 380, easing: 'cubic-bezier(.3,1.9,.5,1)' },
      );
      tipPop(el, dir);
      playReveal(scoreTier(p, anim.score));
      if (anim.score > 0) {
        const r = heroNumRef.current?.getBoundingClientRect();
        if (r) {
          burst(r.left + r.width / 2, r.top + r.height / 2, 26);
        }
      } else {
        quake();
      }
      // 停留 1s：落账并移到下方排序位（落位卡直接就位，不滑行）
      timers.push(
        window.setTimeout(() => {
          s.remove();
          flying.current = anim.id;
          commitCheckin(anim.id, ds, anim.score, anim.mode === 'checkin' ? 'done' : 'failed');
          setAnim(null);
          window.setTimeout(() => {
            flying.current = null;
          }, 600);
        }, HOLD_MS),
      );
    };

    // 卡片已不在页上（如切换筛选/项目数 0）或系统要求减弱动态：直接落账
    if (!el || wrapW <= 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      commitCheckin(anim.id, ds, anim.score, anim.mode === 'checkin' ? 'done' : 'failed');
      setAnim(null);
      return;
    }

    const dir: 1 | -1 = anim.mode === 'checkin' ? 1 : -1;
    const target = bandWidth(p, anim.score, anim.mode, wrapW);
    const timers: number[] = [];
    playPop();
    const vanish = el.animate(
      [{ opacity: 1, transform: 'scaleX(1)' }, { opacity: 0, transform: 'scaleX(.92)' }],
      { duration: VANISH_MS - 40, easing: 'ease', fill: 'forwards' },
    );
    timers.push(
      window.setTimeout(() => {
        vanish.cancel();
        el.style.width = '0px';
        void el.offsetWidth; // 锁定起点，保证从 0 长出
        const grow = el.animate([{ width: '0px' }, { width: `${target}px` }], {
          duration: GROW_MS,
          easing: 'cubic-bezier(.3,.6,.2,1)',
          fill: 'forwards',
        });
        sparkTrail(el, dir, GROW_MS);
        // 悬念棘轮咔哒声：节奏加速、音调渐升
        const N = 16;
        for (let i = 0; i < N; i++) {
          const prog = i / (N - 1);
          timers.push(window.setTimeout(() => tick(prog), GROW_MS * 0.92 * (1 - Math.pow(1 - prog, 1.8))));
        }
        timers.push(
          window.setTimeout(
            () => {
              grow.cancel();
              el.style.width = `${target}px`;
              reveal();
            },
            GROW_MS + 20,
          ),
        );
      }, VANISH_MS),
    );
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anim, wrapW]);

  // 落位：其余卡片平滑闭合；落位卡直接就位（不滑行、不与其他卡重叠）
  useLayoutEffect(() => {
    for (const [id, el] of els.current) {
      const now = el.getBoundingClientRect();
      const prev = lastRects.current.get(id);
      if (
        prev &&
        !anim &&
        flying.current !== id &&
        (prev.left !== now.left || prev.top !== now.top)
      ) {
        el.animate(
          [
            { transform: `translate(${prev.left - now.left}px, ${prev.top - now.top}px)` },
            { transform: 'none' },
          ],
          { duration: 520, easing: 'cubic-bezier(.3,1,.4,1)' },
        );
      }
      lastRects.current.set(id, now);
    }
  });

  const startReveal = (p: Project, mode: 'checkin' | 'giveup') => {
    if (anim) return;
    unlockAudio();
    const score =
      mode === 'checkin' ? randInt(p.posMin, p.posMax) : -randInt(p.negMin ?? 0, p.negMax ?? 0);
    setAnim({ id: p.id, mode, score });
  };

  const bindRef = (id: string) => (el: HTMLDivElement | null) => {
    // 卸载时保留 lastRects 里的旧位置，供「原地停留→逐行下放」使用
    if (el) els.current.set(id, el);
    else els.current.delete(id);
  };

  return (
    <div className="today-page">
      <header className="t-hd">
        <div className="t-hd-in">
          <div>
            <div className="hi">
              hi，<em>Yunnie</em>
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
            <div className="t-avatar">Y</div>
          </div>
        </div>
      </header>

      <div className="t-sheet">
        <div className="t-sheet-in">
          <div className="t-card">
            <div className="lb">今日分数</div>
            <div className="num" ref={heroNumRef}>
              <CountUp value={total} />
            </div>
            <div className="sub">
              已完成 {done} / {act.length} · 连续 {streak(checkins, ds)} 天 🔥
            </div>
          </div>

          <div className="filter-row">
        <button className={`chip ${filter === 'all' ? 'sel' : ''}`} onClick={() => setFilter('all')}>
          全部
        </button>
        {tags.map((t) => (
          <button key={t.id} className={`chip ${filter === t.id ? 'sel' : ''}`} onClick={() => setFilter(t.id)}>
            <i style={{ background: t.color }} />
            {t.name}
          </button>
        ))}
      </div>

      <div className="stack" ref={stackRef}>
        {todo.length + finished.length === 0 && (
          <div className="empty-note">
            {projects.length ? '这个筛选下没有项目' : '还没有项目，去「管理」页新建一个'}
          </div>
        )}
        {todo.map((p) => (
          <Band
            key={p.id}
            p={p}
            rec={recOf(p)}
            color={colorOf(p)}
            wrapW={wrapW}
            animating={anim?.id === p.id}
            animMode={anim?.id === p.id ? anim.mode : undefined}
            busy={!!anim}
            innerRef={bindRef(p.id)}
            onCheckin={() => startReveal(p, 'checkin')}
            onGiveup={() =>
              setConfirm({
                text: `确定认输「${p.name}」吗？将立即摇出负分（-${p.negMin ?? 0} ~ -${p.negMax ?? 0}）。`,
                cb: () => startReveal(p, 'giveup'),
              })
            }
          />
        ))}
        {finished.map((p) => (
          <Band
            key={p.id}
            p={p}
            rec={recOf(p)}
            color={colorOf(p)}
            wrapW={wrapW}
            animating={false}
            busy={!!anim}
            innerRef={bindRef(p.id)}
            onCheckin={() => {}}
            onGiveup={() => {}}
          />
        ))}
      </div>

          {confirm && (
            <ConfirmModal
              text={confirm.text}
              onYes={() => {
                const cb = confirm.cb;
                setConfirm(null);
                cb();
              }}
              onNo={() => setConfirm(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Band({
  p,
  rec,
  color,
  wrapW,
  animating,
  animMode,
  busy,
  innerRef,
  onCheckin,
  onGiveup,
}: {
  p: Project;
  rec?: Checkin;
  color: string;
  wrapW: number;
  animating: boolean;
  animMode?: 'checkin' | 'giveup';
  busy: boolean;
  innerRef: (el: HTMLDivElement | null) => void;
  onCheckin: () => void;
  onGiveup: () => void;
}) {
  const isRest = rec?.status === 'rest';
  const failed = rec?.status === 'failed';
  // 认输卡在生长动画期间就要右锚定并变黑（从右往左长）
  const neg = failed || (animating && animMode === 'giveup');
  const bg = neg ? BAND_NEG : isRest ? BAND_REST : color;
  const style: CSSProperties = { background: bg };
  if (rec && !isRest && wrapW > 0) {
    style.width = bandWidth(p, rec.score, failed ? 'giveup' : 'checkin', wrapW);
  }
  return (
    <div
      ref={innerRef}
      className={`band${neg ? ' neg' : ''}${isRest ? ' rest' : ''}${animating ? ' is-anim' : ''}`}
      style={style}
    >
      <div className="b-head">
        <Icon name={p.icon} size={15} />
        <span className="b-name">{p.name}</span>
        {p.mandatory && <span className="b-must">必</span>}
      </div>
      {!rec && (
        <div className="b-rg">
          +{p.posMin} ~ +{p.posMax}
          {p.mandatory ? ` · 负 -${p.negMin ?? 0} ~ -${p.negMax ?? 0}` : ''}
        </div>
      )}
      {rec && !isRest && (
        <div className="b-score">
          <span className="v">{rec.score > 0 ? `+${rec.score}` : rec.score}</span>
          <span className="lb">{failed && rec.via === 'auto' ? '日结扣分' : rollLabel(p, rec.score)}</span>
        </div>
      )}
      {isRest ? (
        <div className="b-acts">
          <span className="rest-chip">休 息</span>
        </div>
      ) : (
        !rec && (
          <div className="b-acts">
            {p.mandatory && (
              <button className="b-link danger" disabled={busy} onClick={onGiveup}>
                认输
              </button>
            )}
            <button className="btn-check" disabled={busy} onClick={onCheckin}>
              打卡
            </button>
          </div>
        )
      )}
    </div>
  );
}

export function TagChips({ tagIds }: { tagIds: string[] }) {
  const tags = useStore((s) => s.tags);
  return (
    <>
      {tagIds.map((id) => {
        const t = tags.find((x) => x.id === id);
        if (!t) return null;
        return (
          <span className="tagchip" key={id}>
            <i style={{ background: t.color }} />
            {t.name}
          </span>
        );
      })}
    </>
  );
}
