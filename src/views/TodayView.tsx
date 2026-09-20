import { useState } from 'react';
import type { CheckinMap, Project } from '../types';
import { useStore } from '../store';
import type { GachaItem } from '../components/GachaModal';
import { CountUp } from '../components/CountUp';
import { ConfirmModal } from '../components/modals';
import { activeProjects, dayTotal, recKey, streak } from '../lib/logic';
import { fmt, todayStr } from '../lib/date';

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

  const giveUp = (p: Project) => {
    setConfirm({
      text: `确定认输「${p.name}」吗？将立即摇出负分（-${p.negMin ?? 0} ~ -${p.negMax ?? 0}）。`,
      cb: () => openGacha([{ project: p, mode: 'giveup' }]),
    });
  };

  return (
    <section className="view">
      <div className="hero-card">
        <div>
          <div className="hero-label">今日总分</div>
          <div className={`hero-value ${total > 0 ? 'pos' : total < 0 ? 'neg' : ''}`}>
            <CountUp value={total} />
          </div>
          <div className="hero-sub">
            已打卡 {done}/{act.length}
            {restN > 0 && ` · 休息 ${restN} 个`} · 连续 {streak(checkins, ds)} 天
          </div>
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

      <div className="card-grid">
        {list.length === 0 && (
          <div className="note">{projects.length > 0 ? '这个标签下暂无项目' : '还没有项目，去「项目」页新建一个吧'}</div>
        )}
        {list.map((p) => (
          <ProjectCard
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

function ProjectCard({
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
  return (
    <div className="pcard">
      <div className="top">
        <div className="emoji">{p.emoji}</div>
        <div>
          <div className="pname">
            {p.name}
            {p.mandatory && <span className="badge-force">强制</span>}
          </div>
          <div className="ptags">
            <TagChips tagIds={p.tagIds} />
          </div>
        </div>
      </div>
      <div className="prange">
        打卡 +{p.posMin} ~ +{p.posMax}
        {p.mandatory && ` · 失败 -${p.negMin ?? 0} ~ -${p.negMax ?? 0}`}
      </div>
      <div className="pstate">
        {!rec && (
          <>
            <button className="btn primary small" onClick={onCheckin}>
              🎁 打卡
            </button>
            {p.mandatory && (
              <>
                <button className="btn small" onClick={onRest}>
                  😴 休息
                </button>
                <button className="btn small danger" onClick={onGiveup}>
                  😮‍💨 认输
                </button>
              </>
            )}
          </>
        )}
        {rec?.status === 'done' && <ScoreChip score={rec.score} sub="打卡成功" />}
        {rec?.status === 'failed' && <ScoreChip score={rec.score} sub={rec.via === 'auto' ? '日结扣分' : '主动认输'} />}
        {rec?.status === 'rest' && (
          <>
            <span className="rest-chip">😴 休息中</span>
            <button className="linkbtn" onClick={onRest}>
              取消休息
            </button>
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

function ScoreChip({ score, sub }: { score: number; sub: string }) {
  return (
    <div className={`score-chip ${score > 0 ? 'pos' : score < 0 ? 'neg' : ''}`}>
      <span>{fmt(score)}</span>
      <span className="sub">{sub}</span>
    </div>
  );
}
