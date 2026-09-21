import { useRef, useState } from 'react';
import type { Project } from '../types';
import { useStore } from '../store';
import { ProjectForm } from '../components/ProjectForm';
import { TagChips } from './TodayView';
import { ConfirmModal } from '../components/modals';
import { Icon } from '../components/Icon';

export function ProjectsView({ toast }: { toast: (m: string) => void }) {
  const projects = useStore((s) => s.projects);
  const tags = useStore((s) => s.tags);
  const setArchived = useStore((s) => s.setArchived);
  // undefined=关闭，null=新建，Project=编辑
  const [form, setForm] = useState<Project | null | undefined>(undefined);
  const [confirm, setConfirm] = useState<{ text: string; cb: () => void } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const saveRename = (id: string) => {
    const ok = useStore.getState().renameTag(id, renameVal);
    if (!ok) {
      toast('重命名失败：名称为空或已存在');
      return;
    }
    setRenaming(null);
    toast('已重命名');
  };

  const exportData = () => {
    const { tags, projects, checkins } = useStore.getState();
    const blob = new Blob([JSON.stringify({ v: 1, exportedAt: new Date().toISOString(), tags, projects, checkins }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gacha-habit-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('已导出备份文件');
  };

  const importData = (file: File) => {
    file
      .text()
      .then((text) => {
        const ok = useStore.getState().importAll(JSON.parse(text));
        if (!ok) {
          toast('导入失败：文件格式不正确');
          return;
        }
        useStore.getState().runSettlement();
        toast('导入成功');
      })
      .catch(() => toast('导入失败：无法解析文件'));
  };

  const active = projects.filter((p) => !p.archived);
  const archived = projects.filter((p) => p.archived);

  return (
    <section className="view">
      <div className="row-between">
        <h2>管理</h2>
        <button className="btn primary small" onClick={() => setForm(null)}>
          ＋ 新建项目
        </button>
      </div>

      {active.length === 0 && <div className="note">还没有项目。先建一个（比如「🌙 早睡」，强制打卡，正分 0~200，负分 50~200），今天就能摇第一抽。</div>}
      {active.map((p) => (
        <div className="proj-item" key={p.id}>
          <div className="emoji"><Icon name={p.icon} size={22} /></div>
          <div className="proj-meta">
            <div className="pname">
              {p.name}
              {p.cadence !== 'daily' && (
                <span className="badge-force">
                  {p.cadence === 'weekly' ? '每周' : '每月'}
                  {(p.target ?? 1) > 1 ? ` ${p.target} 次` : ''}
                </span>
              )}
              {p.mandatory && <span className="badge-force">强制</span>}
            </div>
            <div className="ptags">
              <TagChips tagIds={p.tagIds} />
            </div>
            <div className="prange">
              打卡 +{p.posMin} ~ +{p.posMax}
              {p.mandatory && ` · 失败 -${p.negMin ?? 0} ~ -${p.negMax ?? 0}`}
            </div>
          </div>
          <div className="proj-ops">
            <button className="btn small" onClick={() => setForm(p)}>
              编辑
            </button>
            <button
              className="btn small"
              onClick={() => {
                setArchived(p.id, true);
                toast(`已归档「${p.name}」，今天起不再结算`);
              }}
            >
              归档
            </button>
            <button
              className="btn small danger"
              onClick={() =>
                setConfirm({
                  text: `删除「${p.name}」？历史积分保留在统计中，但今天起不再结算。日常暂停建议用「归档」。`,
                  cb: () => {
                    useStore.getState().deleteProject(p.id);
                    toast('已删除');
                  },
                })
              }
            >
              删除
            </button>
          </div>
        </div>
      ))}

      <div className="row-between" style={{ marginTop: 20 }}>
        <h2 style={{ fontSize: 15, color: 'var(--ink-2)' }}>标签管理</h2>
      </div>
      {tags.length === 0 && <div className="note">还没有标签。在新建/编辑项目时可以创建。</div>}
      {tags.map((t) => {
        const used = projects.filter((p) => p.tagIds.includes(t.id)).length;
        return (
          <div className="proj-item" key={t.id}>
            <i style={{ width: 12, height: 12, borderRadius: 3, background: t.color, flex: 'none' }} />
            {renaming === t.id ? (
              <input
                className="rename-input"
                value={renameVal}
                maxLength={8}
                autoFocus
                onChange={(e) => setRenameVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    saveRename(t.id);
                  }
                  if (e.key === 'Escape') setRenaming(null);
                }}
              />
            ) : (
              <div className="proj-meta">
                <div className="pname">{t.name}</div>
                <div className="prange">{used} 个项目使用</div>
              </div>
            )}
            <div className="proj-ops">
              {renaming === t.id ? (
                <>
                  <button className="btn small primary" onClick={() => saveRename(t.id)}>
                    保存
                  </button>
                  <button className="btn small" onClick={() => setRenaming(null)}>
                    取消
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="btn small"
                    onClick={() => {
                      setRenaming(t.id);
                      setRenameVal(t.name);
                    }}
                  >
                    重命名
                  </button>
                  <button
                    className="btn small danger"
                    onClick={() =>
                      setConfirm({
                        text: `删除标签「${t.name}」？将从 ${used} 个项目中移除，项目本身和历史积分不受影响。`,
                        cb: () => {
                          useStore.getState().deleteTag(t.id);
                          toast('已删除标签');
                        },
                      })
                    }
                  >
                    删除
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}

      {archived.length > 0 && (
        <>
          <div className="row-between" style={{ marginTop: 20 }}>
            <h2 style={{ fontSize: 15, color: 'var(--ink-2)' }}>已归档</h2>
          </div>
          {archived.map((p) => (
            <div className="proj-item archived" key={p.id}>
              <div className="emoji"><Icon name={p.icon} size={22} /></div>
              <div className="proj-meta">
                <div className="pname">
                  {p.name}
                  <span className="badge-arch">已归档</span>
                </div>
                <div className="prange">归档于 {p.archivedAt ?? '—'}，历史积分仍计入统计</div>
              </div>
              <div className="proj-ops">
                <button
                  className="btn small"
                  onClick={() => {
                    setArchived(p.id, false);
                    toast(`已恢复「${p.name}」`);
                  }}
                >
                  恢复
                </button>
              </div>
            </div>
          ))}
        </>
      )}

      <div className="row-between" style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 15, color: 'var(--ink-2)' }}>数据</h2>
      </div>
      <div className="data-ops">
        <button className="btn small" onClick={exportData}>
          ⬇️ 导出备份
        </button>
        <button className="btn small" onClick={() => fileRef.current?.click()}>
          ⬆️ 导入恢复
        </button>
        <button
          className="btn small"
          onClick={() =>
            setConfirm({
              text: '载入 70 天演示数据？将覆盖当前全部数据（建议先导出备份）。',
              cb: () => {
                useStore.getState().resetAll(true);
                toast('已载入演示数据');
              },
            })
          }
        >
          🎲 载入演示数据
        </button>
        <button
          className="btn small danger"
          onClick={() =>
            setConfirm({
              text: '清空全部数据？此操作不可撤销（建议先导出备份）。',
              cb: () => {
                useStore.getState().resetAll(false);
                toast('已清空');
              },
            })
          }
        >
          🗑 清空数据
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importData(f);
            e.target.value = '';
          }}
        />
      </div>

      {form !== undefined && <ProjectForm editing={form} onClose={() => setForm(undefined)} />}
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
