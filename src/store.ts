import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Cadence, Checkin, CheckinMap, Project, RestDay, Tag } from './types';
import { randInt, uid } from './lib/rng';
import { todayStr } from './lib/date';
import { activeProjects, computePendingSettlements, recKey, restPurchaseState } from './lib/logic';
import { generateDemoData } from './lib/demo';
import { TAG_COLOR_FALLBACK, TAG_COLOR_MIGRATE, TAG_PALETTE } from './lib/palette';
import { EMOJI_TO_ICON } from './lib/icons';

export interface SettleItem {
  date: string;
  project: Project;
  score: number;
}

export interface ProjectInput {
  name: string;
  icon: string;
  tagIds: string[];
  cadence: Cadence;
  /** 每周期需打卡次数（仅 weekly/monthly） */
  target?: number;
  posMin: number;
  posMax: number;
  mandatory: boolean;
  negMin?: number;
  negMax?: number;
}

interface Store {
  tags: Tag[];
  projects: Project[];
  checkins: CheckinMap;
  /** 已兑换的放假日（独立账本：消耗不进每日积分流水） */
  restDays: RestDay[];
  /** 待展示的日结结算单（静默扣分后的通知） */
  pendingSettleView: SettleItem[] | null;
  /** 音效开关 */
  soundOn: boolean;

  toggleSound: () => void;

  addTag: (name: string) => Tag | null;
  /** 重命名标签（颜色跟随标签本身不变）；重名返回 false */
  renameTag: (id: string, name: string) => boolean;
  /** 删除标签，并从所有项目中摘除引用（项目本身不受影响） */
  deleteTag: (id: string) => void;
  addProject: (p: ProjectInput) => void;
  updateProject: (id: string, patch: ProjectInput) => void;
  deleteProject: (id: string) => void;
  setArchived: (id: string, archived: boolean) => void;
  toggleRest: (pid: string) => void;
  /** 扭蛋结果落账（打卡/认输），当天锁定不可重摇 */
  commitCheckin: (pid: string, date: string, score: number, status: 'done' | 'failed') => void;
  /** 静默日结：计算待结算项并直接落账，返回后弹结算单 */
  runSettlement: () => void;
  dismissSettlement: () => void;
  /** 用积分兑换今天放假：全天 rest、强制免扣分、不断签；当天封盘不可打卡。资格不足返回 null */
  buyRestDay: () => RestDay | null;
  importAll: (data: unknown) => boolean;
  resetAll: (demo: boolean) => void;
}

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      tags: [],
      projects: [],
      checkins: {},
      restDays: [],
      pendingSettleView: null,
      soundOn: true,

      toggleSound: () => set((s) => ({ soundOn: !s.soundOn })),

      addTag: (name) => {
        const trimmed = name.trim();
        if (!trimmed) return null;
        if (get().tags.some((t) => t.name === trimmed)) return null;
        const tag: Tag = {
          id: uid(),
          name: trimmed,
          color: get().tags.length < TAG_PALETTE.length ? TAG_PALETTE[get().tags.length] : TAG_COLOR_FALLBACK,
        };
        set((s) => ({ tags: [...s.tags, tag] }));
        return tag;
      },

      renameTag: (id, name) => {
        const trimmed = name.trim();
        if (!trimmed) return false;
        if (get().tags.some((t) => t.id !== id && t.name === trimmed)) return false;
        set((s) => ({ tags: s.tags.map((t) => (t.id === id ? { ...t, name: trimmed } : t)) }));
        return true;
      },

      deleteTag: (id) => {
        set((s) => ({
          tags: s.tags.filter((t) => t.id !== id),
          projects: s.projects.map((p) => ({ ...p, tagIds: p.tagIds.filter((x) => x !== id) })),
        }));
      },

      addProject: (p) => {
        const project: Project = {
          ...p,
          id: uid(),
          archived: false,
          createdAt: todayStr(),
        };
        set((s) => ({ projects: [...s.projects, project] }));
      },

      updateProject: (id, patch) => {
        set((s) => ({
          projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        }));
      },

      deleteProject: (id) => {
        // 历史积分保留在 checkins 中，继续计入统计；仅移除项目本体
        set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }));
      },

      setArchived: (id, archived) => {
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id
              ? { ...p, archived, archivedAt: archived ? todayStr() : undefined }
              : p,
          ),
        }));
      },

      toggleRest: (pid) => {
        const k = recKey(pid, todayStr());
        set((s) => {
          const checkins = { ...s.checkins };
          if (checkins[k]?.status === 'rest') delete checkins[k];
          else if (!checkins[k]) checkins[k] = { score: 0, status: 'rest', via: 'user', ts: Date.now() };
          return { checkins };
        });
      },

      commitCheckin: (pid, date, score, status) => {
        set((s) => {
          const k = recKey(pid, date);
          const prev = s.checkins[k];
          // 周/月多次任务连打：同日已有 done → 合并次数与分数
          if (prev && prev.status === 'done' && status === 'done') {
            return {
              checkins: {
                ...s.checkins,
                [k]: { score: prev.score + score, status: 'done', via: 'user', count: (prev.count ?? 1) + 1, ts: Date.now() },
              },
            };
          }
          return { checkins: { ...s.checkins, [k]: { score, status, via: 'user', ts: Date.now() } } };
        });
      },

      runSettlement: () => {
        const { projects, checkins } = get();
        const today = todayStr();
        const pending = computePendingSettlements(projects, checkins, today);
        if (pending.length === 0) return;
        const items: SettleItem[] = pending.map(({ date, projectId, rolls }) => {
          const project = projects.find((p) => p.id === projectId)!;
          // 周/月任务按缺口次数逐次摇负分求和；每日任务摇 1 次
          let neg = 0;
          for (let i = 0, n = Math.max(1, rolls ?? 1); i < n; i++) {
            neg += randInt(project.negMin ?? 0, project.negMax ?? 0);
          }
          return { date, project, score: -neg };
        });
        set((s) => {
          const next = { ...s.checkins };
          for (const it of items) {
            const rec: Checkin = { score: it.score, status: 'failed', via: 'auto', ts: Date.now() };
            next[recKey(it.project.id, it.date)] = rec;
          }
          return { checkins: next, pendingSettleView: items };
        });
      },

      dismissSettlement: () => set({ pendingSettleView: null }),

      buyRestDay: () => {
        const { projects, checkins, restDays } = get();
        const today = todayStr();
        const st = restPurchaseState(projects, checkins, restDays, today);
        if (!st.canBuy || st.price === null) return null;
        const entry: RestDay = { ds: today, cost: st.price, ts: Date.now() };
        set((s) => {
          const next = { ...s.checkins };
          const now = Date.now();
          // 全天封盘：当天所有有效项目盖 rest 记录（日结自动跳过、连续不断签）
          for (const p of activeProjects(projects, today)) {
            const cur = next[recKey(p.id, today)];
            if (cur?.status === 'done' || cur?.status === 'failed') continue; // 资格校验已排除，防御
            next[recKey(p.id, today)] = { score: 0, status: 'rest', via: 'user', ts: now };
          }
          return { checkins: next, restDays: [...s.restDays, entry] };
        });
        return entry;
      },

      importAll: (data) => {
        if (typeof data !== 'object' || data === null) return false;
        const d = data as Partial<{
          v: number;
          tags: Tag[];
          projects: Project[];
          checkins: CheckinMap;
          restDays: RestDay[];
        }>;
        if (
          (d.v !== 1 && d.v !== 2) ||
          !Array.isArray(d.tags) ||
          !Array.isArray(d.projects) ||
          typeof d.checkins !== 'object' ||
          d.checkins === null
        ) {
          return false;
        }
        set({
          tags: d.tags,
          // 旧备份没有 cadence/target：归一化为每日任务
          projects: d.projects.map((p) => ({ ...p, cadence: p.cadence ?? 'daily' })),
          checkins: d.checkins,
          restDays: Array.isArray(d.restDays) ? d.restDays : [],
          pendingSettleView: null,
        });
        return true;
      },

      resetAll: (demo) => {
        if (demo) {
          const d = generateDemoData();
          set({
            tags: d.tags,
            projects: d.projects,
            checkins: d.checkins,
            restDays: d.restDays,
            pendingSettleView: null,
          });
        } else {
          set({ tags: [], projects: [], checkins: {}, restDays: [], pendingSettleView: null });
        }
      },
    }),
    {
      name: 'gacha-habit-v1',
      version: 4,
      migrate: (persisted) => {
        // v0 → v1：项目 emoji 迁移为线性图标 key；v1 → v2：新增放假账本；
        // v2 → v3：标签色降饱和（莫兰迪化，映射见 TAG_COLOR_MIGRATE）；
        // v3 → v4：新增打卡频率 cadence（旧数据默认每日）
        const s = persisted as Partial<Store> & { projects?: Project[] };
        if (s && Array.isArray(s.projects)) {
          s.projects = s.projects.map((p) => ({
            ...p,
            icon: p.icon ?? EMOJI_TO_ICON[(p as unknown as { emoji?: string }).emoji ?? ''] ?? 'target',
            cadence: p.cadence ?? 'daily',
          }));
        }
        if (s && Array.isArray(s.tags)) {
          s.tags = s.tags.map((t) =>
            t && typeof t.color === 'string'
              ? { ...t, color: TAG_COLOR_MIGRATE[t.color.toLowerCase()] ?? t.color }
              : t,
          );
        }
        if (!Array.isArray(s.restDays)) s.restDays = [];
        return s as Store;
      },
      partialize: (s) => ({
        tags: s.tags,
        projects: s.projects,
        checkins: s.checkins,
        restDays: s.restDays,
        soundOn: s.soundOn,
      }),
    },
  ),
);
