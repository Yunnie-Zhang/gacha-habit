import { useState } from 'react';
import type { Cadence, Project } from '../types';
import { useStore } from '../store';
import { ICON_KEYS } from '../lib/icons';
import { Icon } from './Icon';
import { ConfirmModal, Modal } from './modals';

const CADENCE_ITEMS: { v: Cadence; label: string }[] = [
  { v: 'daily', label: '每日' },
  { v: 'weekly', label: '每周' },
  { v: 'monthly', label: '每月' },
];

/** 强制打卡的结算时机说明（按频率） */
const SETTLE_HINT: Record<Cadence, string> = {
  daily: '当天不打卡，日结时系统静默扣分；也可主动「认输」',
  weekly: '周日结算：本周没打满次数，按缺口次数静默扣分，期间随时可继续打卡',
  monthly: '月底结算：本月没打满次数，按缺口次数静默扣分，期间随时可继续打卡',
};

/** 新建 / 编辑项目表单 */
export function ProjectForm({ editing, onClose }: { editing: Project | null; onClose: () => void }) {
  const tags = useStore((s) => s.tags);
  const [name, setName] = useState(editing?.name ?? '');
  const [icon, setIcon] = useState(editing?.icon ?? 'target');
  const [cadence, setCadence] = useState<Cadence>(editing?.cadence ?? 'daily');
  const [target, setTarget] = useState(String(editing?.target ?? 1));
  const [tagIds, setTagIds] = useState<Set<string>>(new Set(editing?.tagIds ?? []));
  const [posMin, setPosMin] = useState(String(editing?.posMin ?? 0));
  const [posMax, setPosMax] = useState(String(editing?.posMax ?? 200));
  const [mandatory, setMandatory] = useState(!!editing?.mandatory);
  const [negMin, setNegMin] = useState(String(editing?.negMin ?? 50));
  const [negMax, setNegMax] = useState(String(editing?.negMax ?? 200));
  const [newTag, setNewTag] = useState('');
  const [err, setErr] = useState('');
  const [delAsk, setDelAsk] = useState(false);

  const save = () => {
    const nm = name.trim();
    const pmin = Math.round(Number(posMin));
    const pmax = Math.round(Number(posMax));
    const nmin = Math.round(Number(negMin));
    const nmax = Math.round(Number(negMax));
    const tgt = Math.round(Number(target));
    if (!nm) {
      setErr('请填写项目名称');
      return;
    }
    if (!(pmin >= 0 && pmax >= 0) || pmin > pmax) {
      setErr('正分区间无效（需 0 ≤ min ≤ max）');
      return;
    }
    if (cadence !== 'daily' && !(tgt >= 1 && tgt <= 31)) {
      setErr('每周期打卡次数无效（需 1 ~ 31）');
      return;
    }
    if (mandatory && (!(nmin >= 0 && nmax >= 0) || nmin > nmax)) {
      setErr('负分区间无效（需 0 ≤ min ≤ max）');
      return;
    }
    const patch = {
      name: nm,
      icon,
      tagIds: [...tagIds],
      cadence,
      target: cadence === 'daily' ? undefined : tgt,
      posMin: pmin,
      posMax: pmax,
      mandatory,
      negMin: mandatory ? nmin : undefined,
      negMax: mandatory ? nmax : undefined,
    };
    if (editing) useStore.getState().updateProject(editing.id, patch);
    else useStore.getState().addProject(patch);
    onClose();
  };

  const addNewTag = () => {
    const name = newTag.trim();
    if (!name) return;
    // 已存在的标签直接选中，不重复创建
    const existing = tags.find((t) => t.name === name);
    if (existing) {
      setTagIds((s) => new Set(s).add(existing.id));
    } else {
      const t = useStore.getState().addTag(name);
      if (t) setTagIds((s) => new Set(s).add(t.id));
    }
    setNewTag('');
  };

  return (
    <Modal onClose={onClose}>
      <h3>{editing ? '编辑项目' : '新建项目'}</h3>

      <div className="f-row">
        <label>项目名称</label>
        <input type="text" value={name} maxLength={20} placeholder="例如：早睡" onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="f-row">
        <label>选个图标</label>
        <div className="icon-grid">
          {ICON_KEYS.map((k) => (
            <button key={k} type="button" className={k === icon ? 'sel' : ''} onClick={() => setIcon(k)}>
              <Icon name={k} size={19} />
            </button>
          ))}
        </div>
      </div>

      <div className="f-row">
        <label>标签（可多选 · 点上方胶囊选中已保存的标签）</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {tags.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`chip ${tagIds.has(t.id) ? 'sel' : ''}`}
              onClick={() =>
                setTagIds((s) => {
                  const n = new Set(s);
                  if (n.has(t.id)) n.delete(t.id);
                  else n.add(t.id);
                  return n;
                })
              }
            >
              <i style={{ background: t.color }} />
              {t.name}
            </button>
          ))}
          {tags.length === 0 && <span className="note" style={{ margin: 0 }}>暂无标签，在下面添加</span>}
        </div>
        <div className="newtag-line">
          <input
            type="text"
            value={newTag}
            maxLength={8}
            placeholder="新标签名，回车添加"
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addNewTag();
              }
            }}
          />
          <button className="btn small" type="button" onClick={addNewTag}>
            添加
          </button>
        </div>
      </div>

      <div className="f-row">
        <label>打卡频率</label>
        <div style={{ display: 'flex', gap: 6 }}>
          {CADENCE_ITEMS.map((c) => (
            <button
              key={c.v}
              type="button"
              className={`chip ${cadence === c.v ? 'sel' : ''}`}
              onClick={() => setCadence(c.v)}
            >
              {c.label}
            </button>
          ))}
        </div>
        {cadence !== 'daily' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 9 }}>
              <span style={{ fontSize: 13, color: 'var(--sub)' }}>每{cadence === 'weekly' ? '周' : '月'}需打卡</span>
              <input
                type="number"
                value={target}
                min={1}
                max={31}
                style={{ width: 64 }}
                onChange={(e) => setTarget(e.target.value)}
              />
              <span style={{ fontSize: 13, color: 'var(--sub)' }}>次（期内随时打，可同日连打）</span>
            </div>
            <div className="hint">整{cadence === 'weekly' ? '周' : '月'}挂在今日列表，达标后保留在已完成区到周期结束。</div>
          </>
        )}
      </div>

      <div className="f-row">
        <label>打卡成功 · 正分区间</label>
        <div className="range-inputs">
          <input type="number" value={posMin} min={0} max={9999} onChange={(e) => setPosMin(e.target.value)} />
          <span>~</span>
          <input type="number" value={posMax} min={0} max={9999} onChange={(e) => setPosMax(e.target.value)} />
        </div>
      </div>

      <div className="f-row">
        <div className="switch-line">
          <label style={{ margin: 0 }}>⚡ 强制打卡（未完成将扣分）</label>
          <button
            type="button"
            className={`switch ${mandatory ? 'on' : ''}`}
            aria-label="强制打卡开关"
            onClick={() => {
              // 打开强制时，负分区间默认与当前正分区间一致，用户可再调整
              if (!mandatory) {
                setNegMin(posMin);
                setNegMax(posMax);
              }
              setMandatory(!mandatory);
            }}
          />
        </div>
        <div className="hint">开启后：{SETTLE_HINT[cadence]}。</div>
      </div>

      {mandatory && (
        <div className="f-row">
          <label>未完成 · 负分区间（从 0 起含免罚概率）</label>
          <div className="range-inputs">
            <input type="number" value={negMin} min={0} max={9999} onChange={(e) => setNegMin(e.target.value)} />
            <span>~</span>
            <input type="number" value={negMax} min={0} max={9999} onChange={(e) => setNegMax(e.target.value)} />
          </div>
        </div>
      )}

      <div className="f-error">{err}</div>
      <div className="f-foot">
        <button className="btn" onClick={onClose}>
          取消
        </button>
        {editing && (
          <button className="btn danger" onClick={() => setDelAsk(true)}>
            删除
          </button>
        )}
        <button className="btn primary" onClick={save}>
          保存
        </button>
      </div>

      {delAsk && editing && (
        <ConfirmModal
          text={`删除「${editing.name}」？历史积分保留在统计中，但今天起不再结算。`}
          onYes={() => {
            useStore.getState().deleteProject(editing.id);
            onClose();
          }}
          onNo={() => setDelAsk(false)}
        />
      )}
    </Modal>
  );
}
