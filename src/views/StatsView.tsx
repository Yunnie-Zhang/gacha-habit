import { useState } from 'react';
import { useStore } from '../store';
import { Heatmap, TagBars, TrendChart } from '../components/charts';
import { DayDetailModal } from '../components/modals';
import { monthStats } from '../lib/logic';
import { fmt, todayStr } from '../lib/date';

export function StatsView() {
  const projects = useStore((s) => s.projects);
  const checkins = useStore((s) => s.checkins);
  const [day, setDay] = useState<string | null>(null);
  const now = new Date();
  const st = monthStats(projects, checkins, now.getFullYear(), now.getMonth(), todayStr());

  const tiles = [
    {
      label: '本月总分',
      value: fmt(st.total),
      cls: st.total > 0 ? 'pos' : st.total < 0 ? 'neg' : '',
      sub: `日均 ${fmt(st.avg)} 分`,
    },
    {
      label: '强制打卡完成率',
      value: `${st.rate}%`,
      cls: st.rate >= 80 ? 'pos' : '',
      sub: `成功 ${st.done} · 失败 ${st.fail} · 遗漏 ${st.miss}`,
    },
    {
      label: '本月最佳单日',
      value: st.best ? fmt(st.best.v) : '—',
      cls: st.best ? 'pos' : '',
      sub: st.best ? `${st.best.ds.slice(5).replace('-', '/')} 这天` : '暂无',
    },
  ];

  return (
    <section className="view">
      <div className="kpi-row">
        {tiles.map((t) => (
          <div className="kpi" key={t.label}>
            <div className="label">{t.label}</div>
            <div className={`value ${t.cls}`}>{t.value}</div>
            <div className="sub">{t.sub}</div>
          </div>
        ))}
      </div>
      <Heatmap onOpenDay={setDay} />
      <TrendChart />
      <TagBars />
      {day && <DayDetailModal ds={day} onClose={() => setDay(null)} />}
    </section>
  );
}
