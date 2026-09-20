import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import {
  dataMinMonth,
  dayMaxTotals,
  dayTotal,
  heatLevel,
  lastNDays,
  recordsCount,
  tagMonthTotals,
} from '../lib/logic';
import { daysInMonth, dsOf, fmt, pad, todayStr, weekdayCN } from '../lib/date';
import { HEAT_NEG, HEAT_POS } from '../lib/palette';

/* ============ 热力图（月视图，周一开头） ============ */

export function Heatmap({ onOpenDay }: { onOpenDay: (ds: string) => void }) {
  const checkins = useStore((s) => s.checkins);
  const projects = useStore((s) => s.projects);
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [tip, setTip] = useState<{ x: number; y: number; ds: string } | null>(null);

  const { maxPos, maxNeg } = useMemo(() => dayMaxTotals(checkins), [checkins]);
  const minMonth = useMemo(() => dataMinMonth(projects, checkins, todayStr()), [projects, checkins]);
  const curMonthKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const ymKey = `${ym.y}-${pad(ym.m + 1)}`;

  const dim = daysInMonth(ym.y, ym.m);
  const offset = (new Date(ym.y, ym.m, 1).getDay() + 6) % 7;
  const t = todayStr();
  const monthRows = Array.from({ length: dim }, (_, i) => dsOf(ym.y, ym.m, i + 1)).filter(
    (ds) => recordsCount(checkins, ds) > 0,
  );

  const cols: (string | null)[][] = [];
  let col: (string | null)[] = [];
  for (let i = 0; i < offset; i++) col.push(null);
  for (let d = 1; d <= dim; d++) {
    if (col.length === 7) {
      cols.push(col);
      col = [];
    }
    col.push(dsOf(ym.y, ym.m, d));
  }
  while (col.length < 7) col.push(null);
  cols.push(col);

  const nav = (dir: -1 | 1) => {
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
    const key = `${y}-${pad(m + 1)}`;
    if (key < minMonth || key > curMonthKey) return;
    setYm({ y, m });
  };

  const showTip = (el: HTMLElement, ds: string) => {
    const r = el.getBoundingClientRect();
    const w = 150;
    const x = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 8));
    const y = r.top > 90 ? r.top - 84 : r.bottom + 8;
    setTip({ x, y, ds });
  };

  const tipTotal = tip ? dayTotal(checkins, tip.ds) : 0;
  const tipN = tip ? recordsCount(checkins, tip.ds) : 0;

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>打卡热力图</h3>
        <div className="heat-nav">
          <button aria-label="上一月" disabled={ymKey <= minMonth} onClick={() => nav(-1)}>‹</button>
          <span>{ym.y} 年 {ym.m + 1} 月</span>
          <button aria-label="下一月" disabled={ymKey >= curMonthKey} onClick={() => nav(1)}>›</button>
        </div>
      </div>
      <div className="heat-scroll">
        <div className="heatmap">
          <div className="heat-weekdays">
            {['一', '二', '三', '四', '五', '六', '日'].map((d) => (
              <div key={d} className="heat-wd">{d}</div>
            ))}
          </div>
          {cols.map((week, ci) => (
            <div key={ci} className="heat-col">
              {week.map((ds, ri) => {
                if (!ds) return <button key={ri} className="heat-cell blank" tabIndex={-1} aria-hidden="true" />;
                const total = dayTotal(checkins, ds);
                const has = recordsCount(checkins, ds) > 0;
                const cls = [
                  'heat-cell',
                  !has ? 'none' : total > 0 ? `p${heatLevel(total, maxPos)}` : total < 0 ? `n${heatLevel(-total, maxNeg)}` : '',
                  ds === t ? 'today' : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <button
                    key={ds}
                    className={cls}
                    onMouseEnter={(e) => showTip(e.currentTarget, ds)}
                    onMouseLeave={() => setTip(null)}
                    onFocus={(e) => showTip(e.currentTarget, ds)}
                    onBlur={() => setTip(null)}
                    onClick={() => {
                      setTip(null);
                      onOpenDay(ds);
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
        <summary>查看本月数据表</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>日期</th>
                <th>星期</th>
                <th>总分</th>
                <th>记录</th>
              </tr>
            </thead>
            <tbody>
              {monthRows.map((ds) => {
                const v = dayTotal(checkins, ds);
                return (
                  <tr key={ds}>
                    <td>{ds.slice(5).replace('-', '/')}</td>
                    <td>周{weekdayCN(ds)}</td>
                    <td className={`num ${v > 0 ? 'pos' : v < 0 ? 'neg' : ''}`}>{fmt(v)}</td>
                    <td className="num">{recordsCount(checkins, ds)}</td>
                  </tr>
                );
              })}
              {monthRows.length === 0 && (
                <tr>
                  <td colSpan={4} className="zero-note">本月暂无记录</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

/* ============ 每日总分趋势（近 30 天，绕零基线双向柱） ============ */

interface DayPoint {
  ds: string;
  total: number;
  n: number;
}

export function TrendChart() {
  const checkins = useStore((s) => s.checkins);
  const boxRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  const [tip, setTip] = useState<{ d: DayPoint } | null>(null);

  useEffect(() => {
    const update = () => {
      if (boxRef.current) setW(Math.max(320, boxRef.current.clientWidth));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const data: DayPoint[] = useMemo(
    () => lastNDays(30, todayStr()).map((ds) => ({ ds, total: dayTotal(checkins, ds), n: recordsCount(checkins, ds) })),
    [checkins],
  );

  const H = 200;
  const padL = 40;
  const padR = 6;
  const padT = 16;
  const padB = 26;
  const plotH = H - padT - padB;
  const upH = plotH / 2;
  const dnH = plotH / 2;
  const maxPos = Math.max(1, ...data.map((d) => d.total));
  const maxNeg = Math.max(1, ...data.map((d) => -d.total));
  const y0 = padT + upH;
  const iw = (w - padL - padR) / data.length;

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
  let best: DayPoint | null = null;
  let worst: DayPoint | null = null;
  for (const d of data) {
    if (!best || d.total > best.total) best = d;
    if (!worst || d.total < worst.total) worst = d;
  }

  const showTip = (d: DayPoint) => {
    const r = boxRef.current?.getBoundingClientRect();
    if (!r) return;
    setTip({ d });
    // 位置在渲染后由 tip 元素自身样式控制：图表上方居中
  };

  const tipLeft = boxRef.current ? boxRef.current.getBoundingClientRect().left + w / 2 - 80 : 0;
  const tipTop = boxRef.current ? boxRef.current.getBoundingClientRect().top - 78 : 0;

  return (
    <div className="panel">
      <h3>每日总分 · 近 30 天</h3>
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

          {data.map((d, i) => {
            const x = padL + i * iw + (iw - bw) / 2;
            let bar = null;
            if (d.total > 0) {
              const h = Math.max(2, (d.total / maxPos) * upH);
              bar = (
                <path
                  key={`b${d.ds}`}
                  className="bar-p"
                  d={`M${x},${y0} L${x},${y0 - h + 4} Q${x},${y0 - h} ${x + 4},${y0 - h} L${x + bw - 4},${y0 - h} Q${x + bw},${y0 - h} ${x + bw},${y0 - h + 4} L${x + bw},${y0} Z`}
                />
              );
            } else if (d.total < 0) {
              const h = Math.max(2, (-d.total / maxNeg) * dnH);
              bar = (
                <path
                  key={`b${d.ds}`}
                  className="bar-n"
                  d={`M${x},${y0} L${x},${y0 + h - 4} Q${x},${y0 + h} ${x + 4},${y0 + h} L${x + bw - 4},${y0 + h} Q${x + bw},${y0 + h} ${x + bw},${y0 + h - 4} L${x + bw},${y0} Z`}
                />
              );
            }
            return (
              <g key={d.ds}>
                {bar}
                <rect
                  x={padL + i * iw}
                  y={padT}
                  width={iw}
                  height={plotH}
                  fill="transparent"
                  onMouseEnter={() => showTip(d)}
                />
                {(i % 5 === 4 || i === data.length - 1) && (
                  <text
                    x={padL + i * iw + iw / 2}
                    y={H - 8}
                    textAnchor="middle"
                    fontSize="10"
                    fill={d.ds === todayStr() ? '#fbbf24' : '#7c86a8'}
                  >
                    {Number(d.ds.slice(5, 7))}/{Number(d.ds.slice(8, 10))}
                  </text>
                )}
              </g>
            );
          })}

          {best && best.total > 0 && (
            <ExtLabel d={best} i={data.indexOf(best)} x0={padL} iw={iw} y0={y0} maxPos={maxPos} maxNeg={maxNeg} upH={upH} dnH={dnH} />
          )}
          {worst && worst.total < 0 && (
            <ExtLabel d={worst} i={data.indexOf(worst)} x0={padL} iw={iw} y0={y0} maxPos={maxPos} maxNeg={maxNeg} upH={upH} dnH={dnH} />
          )}
        </svg>
        {best && best.total <= 0 && worst && worst.total >= 0 && (
          <div className="zero-note">近 30 天暂无积分记录</div>
        )}
      </div>
      {tip && (
        <div className="tip" style={{ left: tipLeft, top: tipTop, width: 160 }}>
          <span className="t-date">
            {tip.d.ds.slice(5).replace('-', '/')} 星期{weekdayCN(tip.d.ds)}
          </span>
          <span className={`t-val ${tip.d.total > 0 ? 'pos' : tip.d.total < 0 ? 'neg' : ''}`}>
            {tip.d.total === 0 ? '—' : fmt(tip.d.total)}
          </span>
          <span className="t-sub">{tip.d.n} 条记录</span>
        </div>
      )}
    </div>
  );
}

function ExtLabel(props: {
  d: DayPoint;
  i: number;
  x0: number;
  iw: number;
  y0: number;
  maxPos: number;
  maxNeg: number;
  upH: number;
  dnH: number;
}) {
  const { d, i, x0, iw, y0, maxPos, maxNeg, upH, dnH } = props;
  // 负分标签钳制在 x 轴日期带之上，避免与日期文字重叠
  const y =
    d.total > 0
      ? y0 - (d.total / maxPos) * upH - 6
      : Math.min(y0 + (Math.abs(d.total) / maxNeg) * dnH + 14, 170);
  return (
    <text x={x0 + i * iw + iw / 2} y={y} textAnchor="middle" fontSize="11" fontWeight="700" fill="#eceffb">
      {fmt(d.total)}
    </text>
  );
}

/* ============ 标签得分分布（本月净分） ============ */

export function TagBars() {
  const checkins = useStore((s) => s.checkins);
  const projects = useStore((s) => s.projects);
  const tags = useStore((s) => s.tags);
  const now = new Date();
  const rows = useMemo(
    () => tagMonthTotals(projects, checkins, tags, now.getFullYear(), now.getMonth(), todayStr()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projects, checkins, tags],
  );
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.total)));

  return (
    <div className="panel">
      <h3>标签得分分布 · 本月净分</h3>
      {rows.length === 0 && <div className="zero-note">本月暂无数据</div>}
      {rows.map((r, i) => (
        <div className="tag-row" key={r.tag ? r.tag.id : `none${i}`}>
          <div className="name">
            <i style={{ background: r.tag ? r.tag.color : '#8b93ad' }} />
            {r.tag ? r.tag.name : '无标签'}
          </div>
          <div className="track">
            <div
              className="bar"
              style={{
                width: `${Math.max(2, (Math.abs(r.total) / maxAbs) * 100)}%`,
                background: r.tag ? r.tag.color : '#8b93ad',
                opacity: r.total < 0 ? 0.55 : 1,
              }}
            />
          </div>
          <div className="val">{fmt(r.total)}</div>
        </div>
      ))}
    </div>
  );
}
