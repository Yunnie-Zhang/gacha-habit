import { useState } from 'react';
import type { Project } from '../types';
import { useStore } from '../store';
import { EMOJIS } from '../lib/palette';
import { ConfirmModal, Modal } from './modals';

/** 新建 / 编辑项目表单 */
export function ProjectForm({ editing, onClose }: { editing: Project | null; onClose: () => void }) {
  const tags = useStore((s) => s.tags);
  const [name, setName] = useState(editing?.name ?? '');
  const [emoji, setEmoji] = useState(editing?.emoji ?? '🎯');
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
    if (!nm) {
      setErr('请填写项目名称');
      return;
    }
    if (!(pmin >= 0 && pmax >= 0) || pmin > pmax) {
      setErr('正分区间无效（需 0 ≤ min ≤ max）');
      return;
    }
    if (mandatory && (!(nmin >= 0 && nmax >= 0) || nmin > nmax)) {
      setErr('负分区间无效（需 0 ≤ min ≤ max）');
      return;
    }
    const patch = {
      name: nm,
      emoji,
      tagIds: [...tagIds],
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
    const t = useStore.getState().addTag(newTag);
    if (t) setTagIds((s) => new Set(s).add(t.id));
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
        <div className="emoji-grid">
          {EMOJIS.map((e) => (
            <button key={e} type="button" className={e === emoji ? 'sel' : ''} onClick={() => setEmoji(e)}>
              {e}
            </button>
          ))}
        </div>
      </div>

      <div className="f-row">
        <label>标签（可多选）</label>
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
          <button type="button" className={`switch ${mandatory ? 'on' : ''}`} aria-label="强制打卡开关" onClick={() => setMandatory((v) => !v)} />
        </div>
        <div className="hint">开启后：当天不打卡，日结时系统静默扣分；也可主动「认输」或设「休息日」。</div>
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
