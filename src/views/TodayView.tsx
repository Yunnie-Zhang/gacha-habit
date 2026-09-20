import { useState } from 'react';
import type { CheckinMap, Project } from '../types';
import { useStore } from '../store';
import type { GachaItem } from '../components/GachaModal';
import { CountUp } from '../components/CountUp';
import { ConfirmModal } from '../components/modals';
import { Icon } from '../components/Icon';
import { activeProjects, dayTotal, recKey, streak } from '../lib/logic';
import { todayStr } from '../lib/date';

export function TodayView({ openGacha }: { openGacha: (items: GachaItem[]) => void }) {
  const projects = useStore((s) => s.projects);
  const tags = useStore((s) => s.tags);
  const checkins = useStore((s) => s.checkins);
  const toggleRest = useStore((s) => s.toggleRest);
  const [filter, setFilter] = useState('all');
  const [confirm, setConfirm] = useState<{ text: string; cb: () => void } | null>(null);

  const ds = todayStr();
  const act = activeProjects(projects, ds);
  const total = dayTotal(checkins, ds);
  let done = 0;
  let restN = 0;
  for (const p of act) {
    const r = checkins[recKey(p.id, ds)];
    if (r?.status === 'done') done++;
    if (r?.status === 'rest') restN++;
  }
  const list = act.filter((p) => filter === 'all' || p.tagIds.includes(filter));
  const todo = list.filter((p) => {
    const r = checkins[recKey(p.id, ds)];
    return !r || r.status === 'rest';
  });
  const finished = list.filter((p) => {
    const r = checkins[recKey(p.id, ds)];
    return r && r.status !== 'rest';
  });

  const giveUp = (p: Project) => {
    setConfirm({
      text: `确定认输「${p.name}」吗？将立即摇出负分（-${p.negMin ?? 0} ~ -${p.negMax ?? 0}）。`,
      cb: () => openGacha([{ project: p, mode: 'giveup' }]),
    });
  };

  return (
    <section className="view">
      <div className="today-head">
        <div className="h-date">{Number(ds.slice(5, 7))}月{Number(ds.slice(8, 10))}日<small>星期{'日一二三四五六'[new Date().getDay()]}</small></div>
        <div className="sumline">
          <span className={`big ${total > 0 ? 'pos' : total < 0 ? 'neg' : ''}`}><CountUp value={total} /></span>
          <span className="cap">今日总分</span>
          <span className="streak-pill">🔥 连续 {streak(checkins, ds)} 天</span>
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

      <div className="sec-t">待打卡<span className="more">{todo.length ? `${todo.length} 项` : '全部完成 ✓'}</span></div>
      <div className="list">
        {todo.length === 0 && <div className="empty-note">{projects.length ? '这个筛选下没有待打卡的项目' : '还没有项目，去「管理」页新建一个'}</div>}
        {todo.map((p) => (
          <TaskRow
            key={p.id}
            p={p}
            checkins={checkins}
            onCheckin={() => openGacha([{ project: p, mode: 'checkin' }])}
            onRest={() => toggleRest(p.id)}
            onGiveup={() => giveUp(p)}
          />
        ))}
      </div>

      <div className="sec-t">已完成<span className="more">{finished.length ? `${finished.length} 项` : '暂无'}</span></div>
      <div className="list">
        {finished.length === 0 && <div className="empty-note">今天还没有完成的项目</div>}
        {finished.map((p) => (
          <TaskRow
            key={p.id}
            p={p}
            checkins={checkins}
            onCheckin={() => openGacha([{ project: p, mode: 'checkin' }])}
            onRest={() => toggleRest(p.id)}
            onGiveup={() => giveUp(p)}
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
    </section>
  );
}

function TaskRow({
  p,
  checkins,
  onCheckin,
  onRest,
  onGiveup,
}: {
  p: Project;
  checkins: CheckinMap;
  onCheckin: () => void;
  onRest: () => void;
  onGiveup: () => void;
}) {
  const rec = checkins[recKey(p.id, todayStr())];
  const isRest = rec?.status === 'rest';
  return (
    <div className={`task${rec && rec.status !== 'rest' ? ' done' : ''}`}>
      <div className="tico"><Icon name={p.icon} size={20} /></div>
      <div className="meta">
        <div className="nm">
          {p.name}
          {p.mandatory && <span className="must">必</span>}
        </div>
        <div className="rg">
          +{p.posMin} ~ +{p.posMax}
          {p.mandatory && ` · 负 -${p.negMin ?? 0} ~ -${p.negMax ?? 0}`}
        </div>
      </div>
      <div className="acts">
        {!rec && (
          <>
            <button className="btn-invest" onClick={onCheckin}>打卡</button>
            {p.mandatory && (
              <div className="mini-ops">
                <button className="linkop" onClick={onRest}>休息</button>
                <button className="linkop danger" onClick={onGiveup}>认输</button>
              </div>
            )}
          </>
        )}
        {rec?.status === 'done' && (
          <div className="res"><span className="sc pos">{`+${rec.score}`}</span><span className="lb">打卡成功</span></div>
        )}
        {rec?.status === 'failed' && (
          <div className="res"><span className="sc neg">{rec.score}</span><span className="lb">{rec.via === 'auto' ? '日结扣分' : '主动认输'}</span></div>
        )}
        {isRest && (
          <>
            <span className="rest-chip">休 息</span>
            <button className="linkop" onClick={onRest}>取消休息</button>
          </>
        )}
      </div>
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
