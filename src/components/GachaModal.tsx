import { useEffect, useRef, useState } from 'react';
import type { Project } from '../types';
import { randInt } from '../lib/rng';
import { fmt, todayStr } from '../lib/date';
import { burst, quake } from '../lib/fx';
import { cancelSounds, playCollect, playPop, playReveal, tick } from '../lib/sound';
import { scoreTier } from '../lib/logic';
import { useStore } from '../store';

export interface GachaItem {
  project: Project;
  mode: 'checkin' | 'giveup';
}

type Phase = 'drop' | 'shake' | 'open' | 'reveal' | 'done';

function rollLabel(p: Project, score: number): string {
  if (score === 0) return '😶 零蛋，免费的快乐';
  if (score > 0) {
    const max = Math.max(p.posMax, 1);
    const r = score / max;
    if (score === p.posMax) return '🎯 满分抽出！！';
    if (r >= 0.85) return '✨ 欧皇附体！！';
    if (r >= 0.6) return '🎉 欧气满满！';
    if (r >= 0.3) return '👍 不错不错';
    return '🙂 积分入账';
  }
  const max = Math.max(p.negMax ?? 1, 1);
  const r = -score / max;
  if (r >= 0.85) return '💔 心态崩了…';
  if (r >= 0.6) return '😱 大失血！';
  if (r >= 0.3) return '🥲 小亏一场';
  return '😅 止血成功';
}

/**
 * 扭蛋弹窗：掉落 → 悬念摇晃 → 爆开 → 数字滚动 → 收下。
 * 分数在「爆开」瞬间落账（当天锁定）；「跳过动画」立即落账并直达结果。
 */
export function GachaModal({ queue, onClose }: { queue: GachaItem[]; onClose: () => void }) {
  const [idx, setIdx] = useState(0);
  const item = queue[idx];
  const [phase, setPhase] = useState<Phase>('drop');
  const [score, setScore] = useState(0);
  const [disp, setDisp] = useState(0);
  const committed = useRef(false);
  const rafRef = useRef(0);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    const p = item.project;
    const s =
      item.mode === 'checkin'
        ? randInt(p.posMin, p.posMax)
        : -randInt(p.negMin ?? 0, p.negMax ?? 0);
    setScore(s);
    setDisp(0);
    committed.current = false;
    setPhase('drop');
    const shakeMs = 1500 + Math.floor(Math.random() * 600);
    const t: number[] = [
      window.setTimeout(() => setPhase('shake'), 260),
      // 摇晃棘轮咔哒声：节奏加速、音调渐升
      ...Array.from({ length: 13 }, (_, i) => {
        const prog = i / 12;
        const at = 260 + shakeMs * 0.92 * (1 - Math.pow(1 - prog, 1.8));
        return window.setTimeout(() => tick(prog), at);
      }),
      window.setTimeout(() => {
        setPhase('open');
        playPop();
        if (!committed.current) {
          useStore
            .getState()
            .commitCheckin(p.id, todayStr(), s, item.mode === 'checkin' ? 'done' : 'failed');
          committed.current = true;
        }
      }, 280 + shakeMs),
      window.setTimeout(() => setPhase('reveal'), 280 + shakeMs + 330),
    ];
    timersRef.current = t;
    return () => {
      t.forEach(clearTimeout);
      cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  useEffect(() => {
    if (phase !== 'reveal') return;
    const target = score;
    const p = item.project;
    playReveal(scoreTier(p, target));
    if (target > 0) {
      const cap = document.querySelector('.capsule');
      const big = target >= 0.85 * p.posMax;
      const at = () => {
        const r = cap?.getBoundingClientRect();
        if (r) burst(r.left + r.width / 2, r.top + r.height / 2, big ? 48 : 26);
      };
      at();
      if (big) window.setTimeout(at, 260);
    } else {
      quake();
    }
    const t0 = performance.now();
    const fr = (t: number) => {
      const k = Math.min(1, (t - t0) / 850);
      const e = 1 - Math.pow(1 - k, 3);
      setDisp(Math.round(target * e));
      if (k < 1) rafRef.current = requestAnimationFrame(fr);
      else setPhase('done');
    };
    rafRef.current = requestAnimationFrame(fr);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (!item) return null;

  const commit = () => {
    if (committed.current) return;
    useStore
      .getState()
      .commitCheckin(
        item.project.id,
        todayStr(),
        score,
        item.mode === 'checkin' ? 'done' : 'failed',
      );
    committed.current = true;
  };

  const skip = () => {
    timersRef.current.forEach(clearTimeout);
    cancelSounds();
    commit();
    cancelAnimationFrame(rafRef.current);
    setDisp(score);
    setPhase('done');
    playReveal(scoreTier(item.project, score));
  };

  const collect = () => {
    playCollect();
    if (idx + 1 < queue.length) setIdx(idx + 1);
    else onClose();
  };

  const stageCls = [
    phase === 'drop' ? 'drop' : '',
    phase === 'shake' ? 'shaking' : '',
    phase === 'open' || phase === 'reveal' || phase === 'done' ? 'open' : '',
    phase === 'reveal' || phase === 'done' ? 'reveal' : '',
    phase === 'done' ? 'done' : '',
    score < 0 ? 'neg' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="overlay">
      <div className="modal gacha-modal">
        <div id="gachaTitle">{item.mode === 'giveup' ? '认输结算' : '打卡抽奖'}</div>
        <div id="gachaProject">
          {item.project.emoji} {item.project.name}
        </div>
        <div id="gachaStage" className={stageCls}>
          <div className="rays" />
          <div className="capwrap">
            <div className="flash" />
            <svg className="capsule" viewBox="0 0 120 150" aria-hidden="true">
              <defs>
                <linearGradient id="gTop" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#fde68a" />
                  <stop offset="1" stopColor="#f59e0b" />
                </linearGradient>
                <linearGradient id="gBot" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#fffbeb" />
                  <stop offset="1" stopColor="#fcd34d" />
                </linearGradient>
                <linearGradient id="gTopN" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#94a3b8" />
                  <stop offset="1" stopColor="#475569" />
                </linearGradient>
                <linearGradient id="gBotN" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#cbd5e1" />
                  <stop offset="1" stopColor="#64748b" />
                </linearGradient>
              </defs>
              <g className="cap-top">
                <path d="M10 72 A50 50 0 0 1 110 72 Z" />
                <rect x="6" y="66" width="108" height="12" rx="6" />
                <ellipse cx="40" cy="40" rx="13" ry="7" fill="#fff" opacity=".35" transform="rotate(-30 40 40)" />
                <text x="80" y="44" fontSize="17" fill="#fff" opacity=".92">✦</text>
              </g>
              <g className="cap-bot">
                <path d="M10 78 H110 V102 Q110 128 60 128 Q10 128 10 102 Z" />
              </g>
            </svg>
          </div>
          <div id="gachaNumber" className={score > 0 ? 'pos' : score < 0 ? 'neg' : ''}>
            {fmt(disp)}
          </div>
          <div id="gachaLabel">{phase === 'reveal' || phase === 'done' ? rollLabel(item.project, score) : ''}</div>
          <div className="gacha-actions">
            {phase === 'done' ? (
              <button className="btn primary" style={{ minWidth: 170 }} onClick={collect}>
                收下
              </button>
            ) : (
              <button className="linkbtn" onClick={skip}>
                跳过动画
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
