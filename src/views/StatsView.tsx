import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { Heatmap, ProjectBars, TagBars, TrendChart } from '../components/charts';
import type { TrendPoint } from '../components/charts';
import { DayDetailModal } from '../components/modals';
import {
  dataMinDate,
  dayTotal,
  monthRangesOfYear,
  periodRange,
  periodStats,
  rangeTotal,
  recordsCount,
  recordsInRange,
  type PeriodType,
} from '../lib/logic';
import { addDays, fmt, todayStr, weekdayCN } from '../lib/date';

export function StatsView() {
  const projects = useStore((s) => s.projects);
  const checkins = useStore((s) => s.checkins);
  const [type, setType] = useState<PeriodType>('month');
  const [offset, setOffset] = useState(0);
  const [day, setDay] = useState<string | null>(null);

  const today = todayStr();
  const range = periodRange(type, offset, today);
  const minDate = useMemo(() => dataMinDate(projects, checkins, today), [projects, checkins, today]);
  const canPrev = periodRange(type, offset + 1, today).from >= minDate;
  const st = useMemo(
    () => periodStats(projects, checkins, range.from, range.to, today),
    [projects, checkins, range.from, range.to, today],
  );

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

  const tiles = [
    {
      label: '总分',
      value: fmt(st.total),
      cls: st.total > 0 ? 'pos' : st.total < 0 ? 'neg' : '',
      sub: `日均 ${fmt(st.avg)} 分`,
    },
    {
      label: '强制打卡完成率',
      value: `${st.rate}%`,
      cls: st.rate >= 80 ? 'pos' : '',
      sub: `成功 ${st.mDone} · 失败 ${st.mFail} · 遗漏 ${st.miss}`,
    },
    {
      label: '打卡次数',
      value: String(st.doneAll),
      cls: '',
      sub: `扣分 ${st.mFail} 次`,
    },
    {
      label: '最佳单日',
      value: st.best ? fmt(st.best.v) : '—',
      cls: st.best ? 'pos' : '',
      sub: st.best ? `${st.best.ds.slice(5).replace('-', '/')} 这天` : '暂无',
    },
  ];

  return (
    <section className="view">
      <div className="filter-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['week', 'month', 'year'] as PeriodType[]).map((t) => (
            <button
              key={t}
              className={`chip ${type === t ? 'sel' : ''}`}
              onClick={() => {
                setType(t);
                setOffset(0);
              }}
            >
              {t === 'week' ? '本周' : t === 'month' ? '本月' : '本年'}
            </button>
          ))}
        </div>
        <div className="heat-nav">
          <button aria-label="上一期" disabled={!canPrev} onClick={() => setOffset((o) => o + 1)}>‹</button>
          <span>{range.label}</span>
          <button aria-label="下一期" disabled={offset === 0} onClick={() => setOffset((o) => Math.max(0, o - 1))}>›</button>
        </div>
      </div>

      <div className="kpi-row">
        {tiles.map((t) => (
          <div className="kpi" key={t.label}>
            <div className="label">{t.label}</div>
            <div className={`value ${t.cls}`}>{t.value}</div>
            <div className="sub">{t.sub}</div>
          </div>
        ))}
      </div>

      <div className="panel">
        <h3>总分趋势 · {range.label}</h3>
        <TrendChart points={trendPoints} />
      </div>
      <TagBars from={range.from} to={range.to} title={`标签得分分布 · ${range.label}`} />
      <ProjectBars from={range.from} to={range.to} title={`项目得分排行 · ${range.label}`} />
      <Heatmap onOpenDay={setDay} />
      {day && <DayDetailModal ds={day} onClose={() => setDay(null)} />}
    </section>
  );
}
