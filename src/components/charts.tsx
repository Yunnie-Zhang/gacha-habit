import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import {
  dataMinDate,
  dayMaxTotals,
  dayTotal,
  heatLevel,
  projectTotals,
  rangeTotal,
  recordsCount,
  recordsInRange,
  tagTotals,
} from '../lib/logic';
import { addDays, daysInMonth, dsOf, fmt, monthKeyOf, pad, todayStr, weekdayCN } from '../lib/date';
import { HEAT_NEG, HEAT_POS, TAG_PALETTE } from '../lib/palette';
import { Icon } from './Icon';

/* ============ 热力图（月 / 年双视图，周一开头） ============ */

export function Heatmap({ onOpenDay }: { onOpenDay: (ds: string) => void }) {
  const checkins = useStore((s) => s.checkins);
  const projects = useStore((s) => s.projects);
  const now = new Date();
  const t = todayStr();
  const [view, setView] = useState<'month' | 'year'>('month');
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [tip, setTip] = useState<{ x: number; y: number; ds: string } | null>(null);

  const { maxPos, maxNeg } = useMemo(() => dayMaxTotals(checkins), [checkins]);
  const minMonth = useMemo(() => monthKeyOf(dataMinDate(projects, checkins, t)), [projects, checkins, t]);
  const minYear = Number(minMonth.slice(0, 4));
  const curMonthKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const ymKey = `${ym.y}-${pad(ym.m + 1)}`;

  const cellCls = (ds: string): string => {
    const total = dayTotal(checkins, ds);
    const has = recordsCount(checkins, ds) > 0;
    return [
      'heat-cell',
      !has ? 'none' : total > 0 ? `p${heatLevel(total, maxPos)}` : total < 0 ? `n${heatLevel(-total, maxNeg)}` : '',
      ds === t ? 'today' : '',
    ]
      .filter(Boolean)
      .join(' ');
  };

  const showTip = (el: HTMLElement, ds: string) => {
    const r = el.getBoundingClientRect();
    const w = 150;
    const x = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 8));
    const y = r.top > 90 ? r.top - 84 : r.bottom + 8;
    setTip({ x, y, ds });
  };

  /* ---- 月视图网格 ---- */
  const dim = daysInMonth(ym.y, ym.m);
  const offset = (new Date(ym.y, ym.m, 1).getDay() + 6) % 7;
  const monthCols: (string | null)[][] = [];
  let col: (string | null)[] = [];
  for (let i = 0; i < offset; i++) col.push(null);
  for (let d = 1; d <= dim; d++) {
    if (col.length === 7) {
      monthCols.push(col);
      col = [];
    }
    col.push(dsOf(ym.y, ym.m, d));
  }
  while (col.length < 7) col.push(null);
  monthCols.push(col);

  /* ---- 年视图网格（补齐首周，未来日期留空） ---- */
  const jan1 = `${ym.y}-01-01`;
  const dec31 = `${ym.y}-12-31`;
  const yearStart = addDays(jan1, -((new Date(jan1 + 'T12:00:00').getDay() + 6) % 7));
  const yearCols: (string | null)[][] = [];
  const monthLabels: { col: number; label: string }[] = [];
  let ds = yearStart;
  let ci = 0;
  let lastM = -1;
  while (ds <= dec31) {
    const c: (string | null)[] = [];
    for (let i = 0; i < 7; i++) {
      c.push(ds >= jan1 && ds <= dec31 && ds <= t ? ds : null);
      ds = addDays(ds, 1);
    }
    const firstValid = c.find((d): d is string => d !== null);
    if (firstValid) {
      const m = Number(firstValid.slice(5, 7)) - 1;
      if (m !== lastM) {
        monthLabels.push({ col: ci, label: `${m + 1}月` });
        lastM = m;
      }
    }
    yearCols.push(c);
    ci++;
  }

  const nav = (dir: -1 | 1) => {
    if (view === 'month') {
      let m = ym.m + dir;
      let y = ym.y;
      if (m < 0) {
        m = 11;
        y--;
      }
      if (m > 11) {
        m = 0;
        y++;
      }
      if (`${y}-${pad(m + 1)}` < minMonth || `${y}-${pad(m + 1)}` > curMonthKey) return;
      setYm({ y, m });
    } else {
      const y = ym.y + dir;
      if (y < minYear || y > now.getFullYear()) return;
      setYm({ y, m: 0 });
    }
  };

  const canPrev = view === 'month' ? ymKey > minMonth : ym.y > minYear;
  const canNext = view === 'month' ? ymKey < curMonthKey : ym.y < now.getFullYear();

  const tipTotal = tip ? dayTotal(checkins, tip.ds) : 0;
  const tipN = tip ? recordsCount(checkins, tip.ds) : 0;
  const cols = view === 'month' ? monthCols : yearCols;

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>打卡热力图</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="seg">
            <button className={view === 'month' ? 'sel' : ''} onClick={() => setView('month')}>月</button>
            <button className={view === 'year' ? 'sel' : ''} onClick={() => setView('year')}>年</button>
          </div>
          <div className="heat-nav">
            <button aria-label="上一期" disabled={!canPrev} onClick={() => nav(-1)}>‹</button>
            <span>{view === 'month' ? `${ym.y} 年 ${ym.m + 1} 月` : `${ym.y} 年`}</span>
            <button aria-label="下一期" disabled={!canNext} onClick={() => nav(1)}>›</button>
          </div>
        </div>
      </div>
      <div className="heat-scroll">
        {view === 'year' && (
          <div className="heat-months">
            {monthLabels.map((ml) => (
              <span key={ml.label} style={{ left: ml.col * 18 }}>{ml.label}</span>
            ))}
          </div>
        )}
        <div className={`heatmap${view === 'year' ? ' heatmap-sm' : ''}`}>
          <div className="heat-weekdays">
            {['一', '二', '三', '四', '五', '六', '日'].map((d) => (
              <div key={d} className="heat-wd">{d}</div>
            ))}
          </div>
          {cols.map((week, wi) => (
            <div key={wi} className="heat-col">
              {week.map((d, ri) => {
                if (!d) return <button key={ri} className="heat-cell blank" tabIndex={-1} aria-hidden="true" />;
                return (
                  <button
                    key={d}
                    className={cellCls(d)}
                    onMouseEnter={(e) => showTip(e.currentTarget, d)}
                    onMouseLeave={() => setTip(null)}
                    onFocus={(e) => showTip(e.currentTarget, d)}
                    onBlur={() => setTip(null)}
                    onClick={() => {
                      setTip(null);
                      onOpenDay(d);
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="heat-legend">
        <span>亏损</span>
        {[2, 1, 0].map((i) => (
          <span key={`n${i}`} className="sw" style={{ background: HEAT_NEG[i] }} />
        ))}
        <span className="sw" style={{ background: 'var(--heat-none)' }} />
        <span>无记录</span>
        {HEAT_POS.map((c) => (
          <span key={c} className="sw" style={{ background: c }} />
        ))}
        <span>盈利</span>
      </div>
      {tip && (
        <div className="tip" style={{ left: tip.x, top: tip.y, width: 150 }}>
          <span className="t-date">
            {tip.ds.slice(5).replace('-', '/')} 星期{weekdayCN(tip.ds)}
          </span>
          <span className={`t-val ${tipTotal > 0 ? 'pos' : tipTotal < 0 ? 'neg' : ''}`}>
            {tipTotal === 0 ? '—' : fmt(tipTotal)}
          </span>
          <span className="t-sub">{tipN > 0 ? `${tipN} 条记录 · 点击看明细` : '无记录'}</span>
        </div>
      )}

      <details className="table-view">
        <summary>{view === 'month' ? '查看本月数据表' : '查看本年各月汇总表'}</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{view === 'month' ? '日期' : '月份'}</th>
                {view === 'month' && <th>星期</th>}
                <th>总分</th>
                <th>记录</th>
              </tr>
            </thead>
            <tbody>
              {view === 'month'
                ? Array.from({ length: dim }, (_, i) => dsOf(ym.y, ym.m, i + 1))
                    .filter((d) => recordsCount(checkins, d) > 0)
                    .map((d) => {
                      const v = dayTotal(checkins, d);
                      return (
                        <tr key={d}>
                          <td>{d.slice(5).replace('-', '/')}</td>
                          <td>周{weekdayCN(d)}</td>
                          <td className={`num ${v > 0 ? 'pos' : v < 0 ? 'neg' : ''}`}>{fmt(v)}</td>
                          <td className="num">{recordsCount(checkins, d)}</td>
                        </tr>
                      );
                    })
                : Array.from({ length: 12 }, (_, i) => {
                    const mf = `${ym.y}-${pad(i + 1)}-01`;
                    const mt = dsOf(ym.y, i, daysInMonth(ym.y, i));
                    const v = rangeTotal(checkins, mf, mt, t);
                    const n = recordsInRange(checkins, mf, mt);
                    return (
                      <tr key={mf}>
                        <td>{ym.y}年{i + 1}月</td>
                        <td className={`num ${v > 0 ? 'pos' : v < 0 ? 'neg' : ''}`}>{n === 0 ? '—' : fmt(v)}</td>
                        <td className="num">{n}</td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

/* ============ 周期趋势（绕零基线双向柱状图） ============ */

export interface TrendPoint {
  /** 唯一键（日期或月份首日） */
  key: string;
  /** x 轴短标签 */
  label: string;
  total: number;
  records: number;
  /** 悬浮提示标题 */
  tip: string;
}

export function TrendChart({ points }: { points: TrendPoint[] }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  const [tip, setTip] = useState<{ p: TrendPoint } | null>(null);

  useEffect(() => {
    const update = () => {
      if (boxRef.current) setW(Math.max(320, boxRef.current.clientWidth));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const H = 200;
  const padL = 40;
  const padR = 6;
  const padT = 16;
  const padB = 26;
  const plotH = H - padT - padB;
  const upH = plotH / 2;
  const dnH = plotH / 2;
  const maxPos = Math.max(1, ...points.map((d) => d.total));
  const maxNeg = Math.max(1, ...points.map((d) => -d.total));
  const y0 = padT + upH;
  const iw = (w - padL - padR) / Math.max(1, points.length);

  const stepOf = (max: number) => {
    const raw = max / 2;
    const steps = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
    for (const s of steps) if (raw <= s) return s;
    return 2000;
  };
  const ticks = (max: number, dir: -1 | 1) => {
    const out: { v: number; y: number }[] = [];
    const step = stepOf(max);
    for (let v = step; v <= max * 1.001; v += step) {
      out.push({ v, y: y0 + dir * (v / max) * (dir < 0 ? upH : dnH) });
    }
    return out;
  };

  const bw = Math.min(20, iw * 0.6);
  const showAllLabels = points.length <= 16;
  let best: TrendPoint | null = null;
  let worst: TrendPoint | null = null;
  for (const d of points) {
    if (!best || d.total > best.total) best = d;
    if (!worst || d.total < worst.total) worst = d;
  }

  const tipLeft = boxRef.current ? boxRef.current.getBoundingClientRect().left + w / 2 - 80 : 0;
  const tipTop = boxRef.current ? boxRef.current.getBoundingClientRect().top - 78 : 0;

  return (
    <div className="trend-box" ref={boxRef} onMouseLeave={() => setTip(null)}>
      <svg viewBox={`0 0 ${w} ${H}`} width={w} height={H}>
        {ticks(maxPos, -1).map(({ v, y }) => (
          <g key={`p${v}`}>
            <line x1={padL} x2={w - padR} y1={y} y2={y} stroke="#242c4e" strokeWidth="1" />
            <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="10" fill="#7c86a8" style={{ fontVariantNumeric: 'tabular-nums' }}>
              +{v}
            </text>
          </g>
        ))}
        {ticks(maxNeg, 1).map(({ v, y }) => (
          <g key={`n${v}`}>
            <line x1={padL} x2={w - padR} y1={y} y2={y} stroke="#242c4e" strokeWidth="1" />
            <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="10" fill="#7c86a8" style={{ fontVariantNumeric: 'tabular-nums' }}>
              -{v}
            </text>
          </g>
        ))}
        <line x1={padL} x2={w - padR} y1={y0} y2={y0} stroke="#3a4570" strokeWidth="1" />

        {points.map((d, i) => {
          const x = padL + i * iw + (iw - bw) / 2;
          let bar = null;
          if (d.total > 0) {
            const h = Math.max(2, (d.total / maxPos) * upH);
            bar = (
              <path
                key={`b${d.key}`}
                className="bar-p"
                d={`M${x},${y0} L${x},${y0 - h + 4} Q${x},${y0 - h} ${x + 4},${y0 - h} L${x + bw - 4},${y0 - h} Q${x + bw},${y0 - h} ${x + bw},${y0 - h + 4} L${x + bw},${y0} Z`}
              />
            );
          } else if (d.total < 0) {
            const h = Math.max(2, (-d.total / maxNeg) * dnH);
            bar = (
              <path
                key={`b${d.key}`}
                className="bar-n"
                d={`M${x},${y0} L${x},${y0 + h - 4} Q${x},${y0 + h} ${x + 4},${y0 + h} L${x + bw - 4},${y0 + h} Q${x + bw},${y0 + h} ${x + bw},${y0 + h - 4} L${x + bw},${y0} Z`}
              />
            );
          }
          const showLabel = showAllLabels || i % 5 === 4 || i === points.length - 1;
          return (
            <g key={d.key}>
              {bar}
              <rect
                x={padL + i * iw}
                y={padT}
                width={iw}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setTip({ p: d })}
              />
              {showLabel && (
                <text
                  x={padL + i * iw + iw / 2}
                  y={H - 8}
                  textAnchor="middle"
                  fontSize="10"
                  fill={d.key === todayStr() ? '#fbbf24' : '#7c86a8'}
                >
                  {d.label}
                </text>
              )}
            </g>
          );
        })}

        {best && best.total > 0 && (
          <ExtLabel p={best} i={points.indexOf(best)} n={points.length} x0={padL} iw={iw} y0={y0} maxPos={maxPos} maxNeg={maxNeg} upH={upH} dnH={dnH} />
        )}
        {worst && worst.total < 0 && (
          <ExtLabel p={worst} i={points.indexOf(worst)} n={points.length} x0={padL} iw={iw} y0={y0} maxPos={maxPos} maxNeg={maxNeg} upH={upH} dnH={dnH} />
        )}
        {(!best || best.total <= 0) && (!worst || worst.total >= 0) && (
          <text x={padL} y={y0 - 8} fontSize="12" fill="#7c86a8">
            该周期暂无积分记录
          </text>
        )}
      </svg>
      {tip && (
        <div className="tip" style={{ left: tipLeft, top: tipTop, width: 160 }}>
          <span className="t-date">{tip.p.tip}</span>
          <span className={`t-val ${tip.p.total > 0 ? 'pos' : tip.p.total < 0 ? 'neg' : ''}`}>
            {tip.p.total === 0 ? '—' : fmt(tip.p.total)}
          </span>
          <span className="t-sub">{tip.p.records} 条记录</span>
        </div>
      )}
    </div>
  );
}

function ExtLabel(props: {
  p: TrendPoint;
  i: number;
  n: number;
  x0: number;
  iw: number;
  y0: number;
  maxPos: number;
  maxNeg: number;
  upH: number;
  dnH: number;
}) {
  const { p, i, x0, iw, y0, maxPos, maxNeg, upH, dnH } = props;
  // 负分标签钳制在 x 轴日期带之上，避免与日期文字重叠
  const y =
    p.total > 0
      ? y0 - (p.total / maxPos) * upH - 6
      : Math.min(y0 + (Math.abs(p.total) / maxNeg) * dnH + 14, 170);
  return (
    <text x={x0 + i * iw + iw / 2} y={y} textAnchor="middle" fontSize="11" fontWeight="700" fill="#eceffb">
      {fmt(p.total)}
    </text>
  );
}

/* ============ 横向条形行（标签 / 项目共用） ============ */

function HBarRow({
  name,
  color,
  value,
  maxAbs,
  ico,
}: {
  name: string;
  color: string;
  value: number;
  maxAbs: number;
  ico?: string;
}) {
  return (
    <div className="tag-row">
      <div className="name">
        {ico ? <Icon name={ico} size={13} /> : <i style={{ background: color }} />}
        {name}
      </div>
      <div className="track">
        <div
          className="bar"
          style={{
            width: `${Math.max(2, (Math.abs(value) / maxAbs) * 100)}%`,
            background: color,
            opacity: value < 0 ? 0.55 : 1,
          }}
        />
      </div>
      <div className="val">{fmt(value)}</div>
    </div>
  );
}

export function TagBars({ from, to, title }: { from: string; to: string; title: string }) {
  const checkins = useStore((s) => s.checkins);
  const projects = useStore((s) => s.projects);
  const tags = useStore((s) => s.tags);
  const rows = useMemo(() => tagTotals(projects, checkins, tags, from, to), [projects, checkins, tags, from, to]);
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.total)));

  return (
    <div className="panel">
      <h3>{title}</h3>
      {rows.length === 0 && <div className="zero-note">该周期暂无数据</div>}
      {rows.map((r, i) => (
        <HBarRow
          key={r.tag ? r.tag.id : `none${i}`}
          name={r.tag ? r.tag.name : '无标签'}
          color={r.tag ? r.tag.color : '#8b93ad'}
          value={r.total}
          maxAbs={maxAbs}
        />
      ))}
    </div>
  );
}

/** 项目净分排行：单一系列，统一用分类色板 1 号蓝 */
export function ProjectBars({ from, to, title }: { from: string; to: string; title: string }) {
  const checkins = useStore((s) => s.checkins);
  const projects = useStore((s) => s.projects);
  const rows = useMemo(() => projectTotals(projects, checkins, from, to), [projects, checkins, from, to]);
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.total)));

  return (
    <div className="panel">
      <h3>{title}</h3>
      {rows.length === 0 && <div className="zero-note">该周期暂无数据</div>}
      {rows.map((r) => (
        <HBarRow
          key={r.project.id}
          name={r.project.name}
          color={TAG_PALETTE[0]}
          value={r.total}
          maxAbs={maxAbs}
          ico={r.project.icon}
        />
      ))}
    </div>
  );
}
