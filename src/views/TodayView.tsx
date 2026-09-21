import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { Cadence, Project } from '../types';
import { useStore } from '../store';
import { randInt } from '../lib/rng';
import { CountUp } from '../components/CountUp';
import { ConfirmModal } from '../components/modals';
import { Icon } from '../components/Icon';
import {
  CADENCE_CN,
  SETTLE_CN,
  activeProjects,
  dayTotal,
  periodView,
  rollLabel,
  scoreFrac,
  scoreTier,
  streak,
  type PeriodView,
} from '../lib/logic';
import { BAND_NEG, BAND_PALETTE, BAND_REST } from '../lib/palette';
import { burst, quake, sparkTrail, tipPop } from '../lib/fx';
import { playPop, playReveal, tick, unlockAudio } from '../lib/sound';
import { fmt, todayStr } from '../lib/date';

const GROW_MS = 2200; // 一段生长时长（慢速留悬念：0 → 悬念位）
const PAUSE_MS = 300; // 长到悬念位后的停顿
const ADJUST_MS = 600; // 二段增/缩时长（悬念位 → 真实分位）
const VANISH_MS = 320; // 点按后卡片消失时长
const HOLD_MS = 1000; // 分数揭晓后原地停留时长

const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** 页头日期，与设计稿一致："Mon, 21 September" */
export function enDate(): string {
  const d = new Date();
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
  return `${wd}, ${d.getDate()} ${MONTHS_EN[d.getMonth()]}`;
}

interface Anim {
  id: string;
  mode: 'checkin' | 'giveup';
  score: number;
  decoy: number; // 一段生长的悬念位（区间内随机数）
}

/** 卡片目标长度：最小 55% 宽（小分也尽量长），最大横贯全宽不超出屏幕 */
function bandWidth(p: Project, score: number, mode: 'checkin' | 'giveup', wrapW: number): number {
  const frac = Math.min(1, Math.max(0, scoreFrac(p, score, mode)));
  const minW = Math.max(240, wrapW * 0.55);
  return Math.round(minW + frac * (wrapW - minW));
}

/** 悬念位：区间内再摇一个随机数，尽量避开真实分，保证二段还有增/缩位移 */
function decoyScore(p: Project, mode: 'checkin' | 'giveup', score: number): number {
  const lo = mode === 'checkin' ? p.posMin : (p.negMin ?? 0);
  const hi = mode === 'checkin' ? p.posMax : (p.negMax ?? 0);
  if (hi <= lo) return score; // 固定分：没有悬念位
  let v = randInt(lo, hi);
  for (let i = 0; i < 8 && v === Math.abs(score); i++) v = randInt(lo, hi);
  return mode === 'checkin' ? v : -v;
}

/** 认输扣分：每日任务摇 1 次（周/月任务不设认输，等期末按缺口结算） */
function giveupScore(p: Project): number {
  return -randInt(p.negMin ?? 0, p.negMax ?? 0);
}

export function TodayView() {
  const projects = useStore((s) => s.projects);
  const checkins = useStore((s) => s.checkins);
  const restDays = useStore((s) => s.restDays);
  const tags = useStore((s) => s.tags);
  const commitCheckin = useStore((s) => s.commitCheckin);
  const [confirm, setConfirm] = useState<{ text: string; cb: () => void } | null>(null);
  const [anim, setAnim] = useState<Anim | null>(null);
  const [tagSel, setTagSel] = useState<string | null>(null); // 选中的筛选标签 id，null=全部
  const [cadSel, setCadSel] = useState<'all' | Cadence>('all'); // 选中的频率视图，all=全部
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
  const pvOf = (p: Project) => periodView(p, checkins, ds);
  let done = 0;
  for (const p of act) if (pvOf(p).state === 'done') done++;
  // 放假：账本里有今天 → 全天封盘状态（兑换入口在「兑换」页）
  const isRestDay = restDays.some((r) => r.ds === ds);
  // 标签筛选：只列出今日任务真正用到的标签（按标签保存顺序），避免筛出空列表
  const usedTags = tags.filter((t) => act.some((p) => p.tagIds.includes(t.id)));
  // 选中标签可能已失效（删除/归档后不再被今日任务引用）：退回「全部」
  const effTag = tagSel && usedTags.some((t) => t.id === tagSel) ? tagSel : null;
  const matchTag = (p: Project) => !effTag || p.tagIds.includes(effTag);
  // 频率视图：今日任务里实际存在的频率才出胶囊（只有每日任务时不出现该行）
  const usedCads = (['daily', 'weekly', 'monthly'] as const).filter((c) =>
    act.some((p) => p.cadence === c),
  );
  // 选中频率可能已失效（该频率任务全被归档/删除）：退回「全部」
  const effCad: 'all' | Cadence = cadSel !== 'all' && usedCads.includes(cadSel) ? cadSel : 'all';
  const matchCad = (p: Project) => effCad === 'all' || p.cadence === effCad;
  // 卡片颜色按项目顺序从莫兰迪色板取，相邻项目必不同色
  const colorOf = (p: Project) => {
    const i = projects.findIndex((x) => x.id === p.id);
    return BAND_PALETTE[(i < 0 ? 0 : i) % BAND_PALETTE.length];
  };
  const pvScore = (p: Project) => {
    const pv = pvOf(p);
    return pv.state === 'failed' ? (pv.failedScore ?? 0) : pv.scoreSum;
  };
  // 当前频率 + 标签视图下的列表：先待办（含放假日休息卡）后已完成，完成卡按分数从大到小排
  const todo = act.filter((p) => {
    const st = pvOf(p).state;
    return matchCad(p) && matchTag(p) && (st === 'open' || st === 'rest');
  });
  const finished = act
    .filter((p) => matchCad(p) && matchTag(p) && (pvOf(p).state === 'done' || pvOf(p).state === 'failed'))
    .sort((a, b) => pvScore(b) - pvScore(a));

  // 容器宽度（卡片长度按它归一）
  useLayoutEffect(() => {
    const measure = () => setWrapW(stackRef.current?.clientWidth ?? 0);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // 打卡/认输动画：卡片消失 → 先长到区间内随机悬念位，停顿后再增/缩到真实分位，终端迸星，揭晓时落账
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
          el.style.width = ''; // 清掉动画内联宽度：未达标卡留在待办堆，恢复通栏（已达标卡由 style prop 接管）
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
    const decoyW = bandWidth(p, anim.decoy, anim.mode, wrapW);
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
        // 一段：长到悬念位（区间内随机数）
        const grow1 = el.animate([{ width: '0px' }, { width: `${decoyW}px` }], {
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
        // 停顿 0.3s 后二段：增/缩到真实分位，随即揭晓（迸星不变）
        timers.push(
          window.setTimeout(
            () => {
              grow1.cancel();
              el.style.width = `${decoyW}px`;
              if (Math.abs(target - decoyW) < 1) {
                reveal(); // 悬念位恰为真实分位（固定分等）：停顿后直接揭晓
                return;
              }
              const grow2 = el.animate([{ width: `${decoyW}px` }, { width: `${target}px` }], {
                duration: ADJUST_MS,
                easing: 'cubic-bezier(.3,.7,.3,1)',
                fill: 'forwards',
              });
              sparkTrail(el, dir, ADJUST_MS);
              timers.push(
                window.setTimeout(
                  () => {
                    grow2.cancel();
                    el.style.width = `${target}px`;
                    reveal();
                  },
                  ADJUST_MS + 20,
                ),
              );
            },
            GROW_MS + PAUSE_MS,
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
      mode === 'checkin' ? randInt(p.posMin, p.posMax) : giveupScore(p);
    setAnim({ id: p.id, mode, score, decoy: decoyScore(p, mode, score) });
  };

  const bindRef = (id: string) => (el: HTMLDivElement | null) => {
    // 卸载时保留 lastRects 里的旧位置，供「原地停留→逐行下放」使用
    if (el) els.current.set(id, el);
    else els.current.delete(id);
  };

  return (
    <div className="t-sheet">
      <div className="t-sheet-in">
          <div className="t-card">
            <div className="t-grab" aria-hidden="true" />
            {isRestDay ? (
              <>
                <div className="lb">放假中</div>
                <div className="num rest-hero" ref={heroNumRef}>🏖</div>
                <div className="sub">今日免扣分 · 连续 {streak(checkins, ds)} 天不断签</div>
              </>
            ) : (
              <>
                <div className="lb">今日分数</div>
                <div className="num" ref={heroNumRef}>
                  <CountUp value={total} />
                </div>
                <div className="sub">
                  已完成 {done} / {act.length} · 连续 {streak(checkins, ds)} 天 🔥
                </div>
              </>
            )}
          </div>

          {usedCads.length > 1 && (
            <div className="cad-filter">
              {(['all', ...usedCads] as const).map((c) => (
                <button
                  key={c}
                  className={`chip${effCad === c ? ' sel' : ''}`}
                  disabled={!!anim}
                  onClick={() => setCadSel(c)}
                >
                  {c === 'all' ? '全部' : CADENCE_CN[c]}
                </button>
              ))}
            </div>
          )}

          {usedTags.length > 0 && (
            <div className="tag-filter">
              <button
                className={`chip${effTag === null ? ' sel' : ''}`}
                disabled={!!anim}
                onClick={() => setTagSel(null)}
              >
                全部
              </button>
              {usedTags.map((t) => (
                <button
                  key={t.id}
                  className={`chip${effTag === t.id ? ' sel' : ''}`}
                  disabled={!!anim}
                  onClick={() => setTagSel(effTag === t.id ? null : t.id)}
                >
                  <i style={{ background: t.color }} />
                  {t.name}
                </button>
              ))}
            </div>
          )}

          <div className="stack" ref={stackRef}>
        {todo.length + finished.length === 0 && (
          <div className="empty-note">
            {!projects.length
              ? '还没有项目，去「管理」页新建一个'
              : effCad !== 'all'
                ? `暂无${CADENCE_CN[effCad]}任务`
                : effTag && act.length
                  ? '该标签下今天暂无任务'
                  : '今天没有安排项目'}
          </div>
        )}
        {todo.map((p) => (
          <Band
            key={p.id}
            p={p}
            pv={pvOf(p)}
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
            pv={pvOf(p)}
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
  );
}

function Band({
  p,
  pv,
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
  pv: PeriodView;
  color: string;
  wrapW: number;
  animating: boolean;
  animMode?: 'checkin' | 'giveup';
  busy: boolean;
  innerRef: (el: HTMLDivElement | null) => void;
  onCheckin: () => void;
  onGiveup: () => void;
}) {
  const { state, progress, target, scoreSum, failedScore, failedVia } = pv;
  const multi = target > 1;
  const isRest = state === 'rest';
  const failed = state === 'failed';
  // 认输卡在生长动画期间就要右锚定并变黑（从右往左长）
  const neg = failed || (animating && animMode === 'giveup');
  const bg = neg ? BAND_NEG : isRest ? BAND_REST : color;
  const style: CSSProperties = { background: bg };
  if (state === 'done' && wrapW > 0) {
    style.width = bandWidth(p, scoreSum, 'checkin', wrapW);
  }
  if (state === 'failed' && wrapW > 0) {
    style.width = bandWidth(p, failedScore ?? 0, 'giveup', wrapW);
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
        {p.cadence !== 'daily' && <span className="b-must">{p.cadence === 'weekly' ? '周' : '月'}</span>}
        {multi && <span className="b-must">{progress}/{target}</span>}
        {p.mandatory && <span className="b-must">必</span>}
      </div>
      {state === 'open' && (
        <div className="b-rg">
          {multi ? `已打卡 ${progress}/${target} · ` : ''}
          +{p.posMin} ~ +{p.posMax}
          {p.mandatory ? ` · 负 -${p.negMin ?? 0} ~ -${p.negMax ?? 0}` : ''}
        </div>
      )}
      {state === 'done' && (
        <div className="b-score">
          <span className="v">{fmt(scoreSum)}</span>
          <span className="lb">{multi ? `${progress}/${target} 次` : rollLabel(p, scoreSum)}</span>
        </div>
      )}
      {state === 'failed' && (
        <div className="b-score">
          <span className="v">{fmt(failedScore ?? 0)}</span>
          <span className="lb">{failedVia === 'auto' ? `${SETTLE_CN[p.cadence]}扣分` : rollLabel(p, failedScore ?? 0)}</span>
        </div>
      )}
      {isRest ? (
        <div className="b-acts">
          <span className="rest-chip">休 息</span>
        </div>
      ) : (
        state === 'open' && (
          <div className="b-acts">
            {/* 认输只给每日任务：周/月期间不打就等期末按缺口结算，避免一次认输锁死整期 */}
            {p.mandatory && p.cadence === 'daily' && (
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
