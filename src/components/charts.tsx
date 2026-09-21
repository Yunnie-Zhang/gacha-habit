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
import { BAND_PALETTE, HEAT_NEG, HEAT_POS, TAG_COLOR_FALLBACK } from '../lib/palette';
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

/* ============ 周期趋势（皮粉平滑曲线，绕零基线双向） ============ */

/** 单调三次样条（Fritsch–Carlson，同 d3 curveMonotoneX）：平滑且不在点间过冲 */
function monotonePath(xs: number[], ys: number[]): string {
  const n = xs.length;
  if (n < 2) return '';
  const dxs: number[] = [];
  const ms: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dxs.push(xs[i + 1] - xs[i]);
    ms.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  }
  const ts: number[] = [ms[0]];
  for (let i = 1; i < n - 1; i++) {
    if (ms[i - 1] * ms[i] <= 0) {
      ts.push(0); // 极值点处切线归平，避免过冲
    } else {
      const dx0 = dxs[i - 1];
      const dx1 = dxs[i];
      const common = dx0 + dx1;
      ts.push((3 * common) / ((common + dx1) / ms[i - 1] + (common + dx0) / ms[i]));
    }
  }
  ts.push(ms[n - 2]);
  let d = `M${xs[0]},${ys[0]}`;
  for (let i = 0; i < n - 1; i++) {
    const cx = dxs[i] / 3;
    d += `C${(xs[i] + cx).toFixed(2)},${(ys[i] + ts[i] * cx).toFixed(2)} ${(xs[i + 1] - cx).toFixed(2)},${(ys[i + 1] - ts[i + 1] * cx).toFixed(2)} ${xs[i + 1].toFixed(2)},${ys[i + 1]}`;
  }
  return d;
}

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

export function TrendChart({
  points,
  onOpenDay,
}: {
  points: TrendPoint[];
  /** 传入则点击曲线打开该日明细（仅日粒度传） */
  onOpenDay?: (ds: string) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  const [hov, setHov] = useState<number | null>(null);

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

  const showAllLabels = points.length <= 16;
  let best: TrendPoint | null = null;
  let worst: TrendPoint | null = null;
  for (const d of points) {
    if (!best || d.total > best.total) best = d;
    if (!worst || d.total < worst.total) worst = d;
  }

  const xOf = (i: number) => padL + i * iw + iw / 2;
  const yOf = (v: number) => (v >= 0 ? y0 - (v / maxPos) * upH : y0 + (-v / maxNeg) * dnH);
  const xs = points.map((_, i) => xOf(i));
  const ys = points.map((d) => yOf(d.total));
  /** 曲线只画到当前进度（key ≤ 今天），未来日期留白不画平线 */
  const lastIdx = points.reduce((acc, d, i) => (d.key <= todayStr() ? i : acc), -1);
  const cxs = xs.slice(0, lastIdx + 1);
  const cys = ys.slice(0, lastIdx + 1);
  const curve = monotonePath(cxs, cys);
  const hover = hov !== null && hov <= lastIdx ? points[hov] : null;

  const tipLeft = boxRef.current ? boxRef.current.getBoundingClientRect().left + w / 2 - 80 : 0;
  const tipTop = boxRef.current ? boxRef.current.getBoundingClientRect().top - 78 : 0;

  return (
    <div className="trend-box" ref={boxRef} onMouseLeave={() => setHov(null)}>
      <svg viewBox={`0 0 ${w} ${H}`} width={w} height={H}>
        {ticks(maxPos, -1).map(({ v, y }) => (
          <g key={`p${v}`}>
            <line className="gl" x1={padL} x2={w - padR} y1={y} y2={y} strokeWidth="1" />
            <text className="tk" x={padL - 6} y={y + 3} textAnchor="end" fontSize="10" style={{ fontVariantNumeric: 'tabular-nums' }}>
              +{v}
            </text>
          </g>
        ))}
        {ticks(maxNeg, 1).map(({ v, y }) => (
          <g key={`n${v}`}>
            <line className="gl" x1={padL} x2={w - padR} y1={y} y2={y} strokeWidth="1" />
            <text className="tk" x={padL - 6} y={y + 3} textAnchor="end" fontSize="10" style={{ fontVariantNumeric: 'tabular-nums' }}>
              -{v}
            </text>
          </g>
        ))}
        <line className="bl" x1={padL} x2={w - padR} y1={y0} y2={y0} strokeWidth="1" />

        {/* 皮粉曲线 + 相对零基线的面积晕染（止于今天，未来留白） */}
        {curve && (
          <path className="curve-area" d={`${curve} L${cxs[cxs.length - 1]},${y0} L${cxs[0]},${y0} Z`} />
        )}
        {curve && <path className="curve" d={curve} />}
        {cxs.length === 1 && <circle className="dot" cx={cxs[0]} cy={cys[0]} r={4} />}

        {points.map((d, i) => {
          const showLabel = showAllLabels || i % 5 === 4 || i === points.length - 1;
          return (
            <g key={d.key}>
              <rect
                x={padL + i * iw}
                y={padT}
                width={iw}
                height={plotH}
                fill="transparent"
                style={{ cursor: onOpenDay ? 'pointer' : undefined }}
                onMouseEnter={i <= lastIdx ? () => setHov(i) : undefined}
                onClick={onOpenDay && i <= lastIdx ? () => onOpenDay(d.key) : undefined}
              />
              {showLabel && (
                <text
                  className={`tk${d.key === todayStr() ? ' tk-today' : ''}`}
                  x={xOf(i)}
                  y={H - 8}
                  textAnchor="middle"
                  fontSize="10"
                >
                  {d.label}
                </text>
              )}
            </g>
          );
        })}

        {/* 十字线 + 悬浮点 / 当前进度点 */}
        {hover && <line className="xh" x1={xOf(hov!)} x2={xOf(hov!)} y1={padT} y2={H - padB} />}
        {hov !== null && hov <= lastIdx && <circle className="dot" cx={xs[hov]} cy={ys[hov]} r={4} />}
        {lastIdx >= 0 && <circle className="dot dot-today" cx={xs[lastIdx]} cy={ys[lastIdx]} r={4.5} />}

        {best && best.total > 0 && (
          <text
            className="ext"
            x={xOf(points.indexOf(best))}
            y={Math.max(yOf(best.total) - 10, 11)}
            textAnchor="middle"
            fontSize="11"
            fontWeight="700"
          >
            {fmt(best.total)}
          </text>
        )}
        {worst && worst.total < 0 && (
          <text
            className="ext"
            x={xOf(points.indexOf(worst))}
            y={Math.min(yOf(worst.total) + 17, 167)} /* 钳在 x 轴日期带之上 */
            textAnchor="middle"
            fontSize="11"
            fontWeight="700"
          >
            {fmt(worst.total)}
          </text>
        )}
        {(!best || best.total <= 0) && (!worst || worst.total >= 0) && (
          <text className="tk" x={padL} y={y0 - 8} fontSize="12">
            该周期暂无积分记录
          </text>
        )}
      </svg>
      {hover && (
        <div className="tip" style={{ left: tipLeft, top: tipTop, width: 160 }}>
          <span className="t-date">{hover.tip}</span>
          <span className={`t-val ${hover.total > 0 ? 'pos' : hover.total < 0 ? 'neg' : ''}`}>
            {hover.total === 0 ? '—' : fmt(hover.total)}
          </span>
          <span className="t-sub">{hover.records} 条记录</span>
        </div>
      )}
    </div>
  );
}

/* ============ 得分构成（标签 / 项目发散排行：零轴居中，正分向右、负分向左） ============ */

interface CompRow {
  id: string;
  name: string;
  /** 实体色：标签用标签色，项目用首页横条卡的莫兰迪色（颜色跟实体走） */
  color: string;
  ico?: string;
  total: number;
}

export function CompositionPanel({ from, to }: { from: string; to: string }) {
  const checkins = useStore((s) => s.checkins);
  const projects = useStore((s) => s.projects);
  const tags = useStore((s) => s.tags);
  const [mode, setMode] = useState<'tag' | 'proj'>('tag');

  const rows: CompRow[] = useMemo(() => {
    if (mode === 'tag') {
      return tagTotals(projects, checkins, tags, from, to).map((r) => ({
        id: r.tag ? r.tag.id : 'none',
        name: r.tag ? r.tag.name : '无标签',
        color: r.tag ? r.tag.color : TAG_COLOR_FALLBACK,
        total: r.total,
      }));
    }
    return projectTotals(projects, checkins, from, to).map((r) => {
      const i = projects.findIndex((x) => x.id === r.project.id);
      return {
        id: r.project.id,
        name: r.project.name,
        color: BAND_PALETTE[(i < 0 ? 0 : i) % BAND_PALETTE.length],
        ico: r.project.icon,
        total: r.total,
      };
    });
  }, [mode, projects, checkins, tags, from, to]);

  const posMax = Math.max(0, ...rows.map((r) => r.total));
  const negMax = Math.max(0, ...rows.map((r) => -r.total));
  const span = posMax + negMax;
  const zeroPct = span > 0 ? (negMax / span) * 100 : 0;

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>得分构成</h3>
        <div className="seg">
          <button className={mode === 'tag' ? 'sel' : ''} onClick={() => setMode('tag')}>标签</button>
          <button className={mode === 'proj' ? 'sel' : ''} onClick={() => setMode('proj')}>项目</button>
        </div>
      </div>
      {rows.length === 0 && <div className="zero-note">这一期还是白纸</div>}
      {rows.map((r) => {
        const w = span > 0 ? (Math.abs(r.total) / span) * 100 : 0;
        const pos = r.total >= 0;
        return (
          <div className="div-row" key={r.id}>
            <div className="name">
              {r.ico ? <Icon name={r.ico} size={13} /> : <i style={{ background: r.color }} />}
              {r.name}
            </div>
            <div className="div-track">
              <i className="axis" style={{ left: `${zeroPct}%` }} aria-hidden="true" />
              {r.total !== 0 && (
                <div
                  className={`bar ${pos ? 'bar-pos' : 'bar-neg'}`}
                  style={{
                    left: pos ? `${zeroPct}%` : `${zeroPct - w}%`,
                    width: `${Math.max(1.5, w)}%`,
                    background: r.color,
                  }}
                />
              )}
            </div>
            <div className={`val ${r.total > 0 ? 'pos' : r.total < 0 ? 'neg' : ''}`}>{fmt(r.total)}</div>
          </div>
        );
      })}
    </div>
  );
}
