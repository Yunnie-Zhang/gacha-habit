import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { CompositionPanel, Heatmap, TrendChart } from '../components/charts';
import type { TrendPoint } from '../components/charts';
import { DayDetailModal } from '../components/modals';
import { CountUp } from '../components/CountUp';
import { Icon } from '../components/Icon';
import {
  REST_MONTHLY_LIMIT,
  dataMinDate,
  dayTotal,
  longestStreak,
  monthRangesOfYear,
  periodRange,
  periodStats,
  rangeTotal,
  recordsCount,
  recordsInRange,
  restBalance,
  restDaysUsedInMonth,
  streak,
  type PeriodType,
} from '../lib/logic';
import { addDays, fmt, todayStr, weekdayCN } from '../lib/date';

const PERIOD_TEXT = {
  week: { seg: '周', hero: '本周', prev: '上周' },
  month: { seg: '月', hero: '本月', prev: '上月' },
  year: { seg: '年', hero: '本年', prev: '去年' },
} as const;

export function StatsView() {
  const projects = useStore((s) => s.projects);
  const checkins = useStore((s) => s.checkins);
  const restDays = useStore((s) => s.restDays);
  const [type, setType] = useState<PeriodType>('month');
  const [offset, setOffset] = useState(0);
  const [day, setDay] = useState<string | null>(null);

  const today = todayStr();
  const range = periodRange(type, offset, today);
  const prevRange = periodRange(type, offset + 1, today);
  const minDate = useMemo(() => dataMinDate(projects, checkins, today), [projects, checkins, today]);
  const canPrev = prevRange.from >= minDate;
  const st = useMemo(
    () => periodStats(projects, checkins, range.from, range.to, today),
    [projects, checkins, range.from, range.to, today],
  );
  /** 环比基线：当前周期没过完时只比上期同期（前 st.days 天），避免月初必然飘红 */
  const prevTotal = useMemo(() => {
    const sameTo = addDays(prevRange.from, Math.max(0, st.days - 1));
    const to = sameTo < prevRange.to ? sameTo : prevRange.to;
    return periodStats(projects, checkins, prevRange.from, to, today).total;
  }, [projects, checkins, prevRange.from, prevRange.to, st.days, today]);
  /** 上期有任何记录才显示环比，否则视为「首期」 */
  const hasPrev = recordsInRange(checkins, prevRange.from, prevRange.to) > 0;
  const delta = st.total - prevTotal;

  const balance = restBalance(checkins, restDays);
  const used = restDaysUsedInMonth(restDays, today);
  const curStreak = streak(checkins, today);
  const longest = useMemo(() => longestStreak(projects, checkins, today), [projects, checkins, today]);
  const mDenom = st.mDone + st.mFail + st.miss;
  /** 完成率计量条：≥80 皮粉深阶 / 50–79 琥珀 / <50 赭墨，轨道用同色浅阶 */
  const meterColor = st.rate >= 80 ? '#c96f5e' : st.rate >= 50 ? '#d9973f' : '#8a4936';
  const rateSub =
    mDenom > 0
      ? `成功 ${st.mDone} · 失败 ${st.mFail} · 遗漏 ${st.miss}`
      : '暂无已结算的强制项';

  const trendPoints: TrendPoint[] = useMemo(() => {
    if (type === 'year') {
      const y = Number(range.from.slice(0, 4));
      return monthRangesOfYear(y).map((mr, i) => ({
        key: mr.from,
        label: `${i + 1}月`,
        total: rangeTotal(checkins, mr.from, mr.to, today),
        records: recordsInRange(checkins, mr.from, mr.to),
        tip: `${y}年${i + 1}月`,
      }));
    }
    const pts: TrendPoint[] = [];
    for (let ds = range.from; ds <= range.to; ds = addDays(ds, 1)) {
      pts.push({
        key: ds,
        label:
          type === 'week'
            ? `${Number(ds.slice(5, 7))}/${Number(ds.slice(8, 10))}`
            : String(Number(ds.slice(8, 10))),
        total: dayTotal(checkins, ds),
        records: recordsCount(checkins, ds),
        tip: `${ds.slice(5).replace('-', '/')} 星期${weekdayCN(ds)}`,
      });
    }
    return pts;
  }, [type, range.from, range.to, checkins, today]);

  return (
    <section className="view">
      <div className="stat-filter">
        <div className="seg">
          {(['week', 'month', 'year'] as PeriodType[]).map((t) => (
            <button
              key={t}
              className={type === t ? 'sel' : ''}
              onClick={() => {
                setType(t);
                setOffset(0);
              }}
            >
              {PERIOD_TEXT[t].seg}
            </button>
          ))}
        </div>
        <div className="heat-nav">
          <button aria-label="上一期" disabled={!canPrev} onClick={() => setOffset((o) => o + 1)}>‹</button>
          <span>{range.label}</span>
          <button aria-label="下一期" disabled={offset === 0} onClick={() => setOffset((o) => Math.max(0, o - 1))}>›</button>
        </div>
      </div>

      {/* 主卡：周期总分（唯一的 Hero）+ 环比 */}
      <div className="hero-card">
        <div className="hero-top">
          <span className="hero-lb">{PERIOD_TEXT[type].hero}总分</span>
          {hasPrev ? (
            <span className={`delta ${delta > 0 ? 'pos' : delta < 0 ? 'neg' : ''}`}>
              <Icon name={delta >= 0 ? 'tup' : 'tdn'} size={12} strokeWidth={2.4} />
              {fmt(delta)} · 较{PERIOD_TEXT[type].prev}
              {offset === 0 ? '同期' : ''}
            </span>
          ) : (
            <span className="delta">首期</span>
          )}
        </div>
        <div className={`hero-num ${st.total > 0 ? 'pos' : st.total < 0 ? 'neg' : ''}`}>
          <CountUp value={st.total} />
        </div>
        <div className="hero-sub">
          日均 {fmt(st.avg)} 分 · {st.doneAll} 次打卡
        </div>
        <div className="hero-sub2">
          可用余额 {balance} 分 · 本月放假 {used}/{REST_MONTHLY_LIMIT}
        </div>
      </div>

      <div className="tiles">
        <div className="tile">
          <div className="label">强制完成率</div>
          <div className="value">{mDenom > 0 ? `${st.rate}%` : '—'}</div>
          {mDenom > 0 && (
            <div className="meter" style={{ background: `${meterColor}26` }}>
              <i style={{ width: `${st.rate}%`, background: meterColor }} />
            </div>
          )}
          <div className="sub">{rateSub}</div>
        </div>
        <div className="tile">
          <div className="label">
            <Icon name="fire" size={11} />
            连续打卡
          </div>
          <div className="value">{curStreak} 天</div>
          <div className="sub">最长连续 {longest} 天</div>
        </div>
        {st.best ? (
          <button className="tile tile-link" onClick={() => setDay(st.best!.ds)}>
            <div className="label">最佳单日</div>
            <div className="value pos">{fmt(st.best.v)}</div>
            <div className="sub">
              {st.best.ds.slice(5).replace('-', '/')} 周{weekdayCN(st.best.ds)} · 点看明细
            </div>
          </button>
        ) : (
          <div className="tile">
            <div className="label">最佳单日</div>
            <div className="value">—</div>
            <div className="sub">暂无</div>
          </div>
        )}
      </div>

      <div className="panel">
        <h3>总分趋势 · {range.label}</h3>
        <TrendChart points={trendPoints} onOpenDay={type === 'year' ? undefined : setDay} />
      </div>
      <Heatmap onOpenDay={setDay} />
      <CompositionPanel from={range.from} to={range.to} />
      {day && <DayDetailModal ds={day} onClose={() => setDay(null)} />}
    </section>
  );
}
