import type { CheckinMap, Project, Tag } from '../types';
import { addDays, dsOf, daysInMonth } from './date';

export const recKey = (pid: string, ds: string) => `${pid}|${ds}`;

/** 当天可操作的项目（未归档且已创建） */
export function activeProjects(projects: Project[], ds: string): Project[] {
  return projects.filter((p) => !p.archived && p.createdAt <= ds);
}

export function dayTotal(checkins: CheckinMap, ds: string): number {
  let s = 0;
  for (const k in checkins) if (k.endsWith('|' + ds)) s += checkins[k].score;
  return s;
}

export function recordsCount(checkins: CheckinMap, ds: string): number {
  let n = 0;
  for (const k in checkins) if (k.endsWith('|' + ds)) n++;
  return n;
}

/** 连续天数判定：至少 1 个打卡成功，或设了休息（休息日不断签） */
export function dayQualifies(checkins: CheckinMap, ds: string): boolean {
  for (const k in checkins) {
    if (!k.endsWith('|' + ds)) continue;
    const st = checkins[k].status;
    if (st === 'done' || st === 'rest') return true;
  }
  return false;
}

export function streak(checkins: CheckinMap, today: string): number {
  let d = today;
  if (!dayQualifies(checkins, d)) d = addDays(d, -1);
  let s = 0;
  while (dayQualifies(checkins, d)) {
    s++;
    d = addDays(d, -1);
  }
  return s;
}

/** 全历史最大单日正/负总分（用于热力图分档阈值，保证跨月颜色一致） */
export function dayMaxTotals(checkins: CheckinMap): { maxPos: number; maxNeg: number } {
  let maxPos = 0;
  let maxNeg = 0;
  const byDate: Record<string, number> = {};
  for (const k in checkins) {
    const ds = k.split('|')[1];
    byDate[ds] = (byDate[ds] || 0) + checkins[k].score;
  }
  for (const ds in byDate) {
    const v = byDate[ds];
    if (v > maxPos) maxPos = v;
    if (-v > maxNeg) maxNeg = -v;
  }
  return { maxPos, maxNeg };
}

/** 0~3 档：>=85% 最大值→3，>=35%→2，否则 1 */
export function heatLevel(v: number, max: number): number {
  if (max <= 0) return 1;
  const r = v / max;
  return r >= 0.85 ? 3 : r >= 0.35 ? 2 : 1;
}

export interface PendingSettlement {
  date: string;
  projectId: string;
}

/**
 * 待日结清单：minDate ~ 昨天里，强制且当时有效、既没打卡也没休息的记录。
 * 按设计日结为静默扣分，此处只算账，不打分。
 */
export function computePendingSettlements(
  projects: Project[],
  checkins: CheckinMap,
  today: string,
): PendingSettlement[] {
  let minDs = today;
  for (const p of projects) if (p.createdAt < minDs) minDs = p.createdAt;
  for (const k in checkins) {
    const ds = k.split('|')[1];
    if (ds < minDs) minDs = ds;
  }
  const out: PendingSettlement[] = [];
  for (let ds = minDs; ds < today; ds = addDays(ds, 1)) {
    for (const p of projects) {
      if (!p.mandatory) continue;
      if (p.createdAt > ds) continue;
      if (p.archivedAt && p.archivedAt <= ds) continue;
      if (!checkins[recKey(p.id, ds)]) out.push({ date: ds, projectId: p.id });
    }
  }
  return out;
}

export interface MonthStats {
  total: number;
  avg: number;
  done: number;
  fail: number;
  miss: number;
  rate: number;
  best: { ds: string; v: number } | null;
}

/** 本月（截至今天）汇总：强制项目完成率、最佳单日等 */
export function monthStats(
  projects: Project[],
  checkins: CheckinMap,
  y: number,
  m: number,
  today: string,
): MonthStats {
  const dim = daysInMonth(y, m);
  const monthEnd = dsOf(y, m, dim);
  const lastDay = monthEnd <= today ? dim : Number(today.slice(8, 10));
  let total = 0;
  let done = 0;
  let fail = 0;
  let miss = 0;
  let best: { ds: string; v: number } | null = null;
  for (let d = 1; d <= lastDay; d++) {
    const ds = dsOf(y, m, d);
    const t = dayTotal(checkins, ds);
    total += t;
    if (!best || t > best.v) best = { ds, v: t };
    for (const p of activeProjects(projects, ds)) {
      if (!p.mandatory) continue;
      const r = checkins[recKey(p.id, ds)];
      if (!r) miss++;
      else if (r.status === 'done') done++;
      else if (r.status === 'failed') fail++;
    }
  }
  const denom = done + fail + miss;
  return {
    total,
    avg: lastDay > 0 ? Math.round(total / lastDay) : 0,
    done,
    fail,
    miss,
    rate: denom > 0 ? Math.round((done / denom) * 100) : 0,
    best: best && best.v > 0 ? best : null,
  };
}

export interface TagTotal {
  tag: Tag | null;
  total: number;
}

/** 本月各标签净分（未打标签的项目归入「无标签」） */
export function tagMonthTotals(
  projects: Project[],
  checkins: CheckinMap,
  tags: Tag[],
  y: number,
  m: number,
  today: string,
): TagTotal[] {
  const dim = daysInMonth(y, m);
  const monthEnd = dsOf(y, m, dim);
  const lastDay = monthEnd <= today ? dim : Number(today.slice(8, 10));
  const totals: Record<string, number> = {};
  const order: string[] = [];
  for (let d = 1; d <= lastDay; d++) {
    const ds = dsOf(y, m, d);
    for (const p of activeProjects(projects, ds)) {
      const r = checkins[recKey(p.id, ds)];
      if (!r) continue;
      const ids = p.tagIds.length > 0 ? p.tagIds : ['none'];
      for (const id of ids) {
        if (!(id in totals)) {
          totals[id] = 0;
          order.push(id);
        }
        totals[id] += r.score;
      }
    }
  }
  return order
    .map((id) => ({
      tag: id === 'none' ? null : tags.find((t) => t.id === id) ?? null,
      total: totals[id],
    }))
    .sort((a, b) => b.total - a.total);
}

/** 近 n 天日期串（含今天），升序 */
export function lastNDays(n: number, today: string): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(today, -i));
  return out;
}

/** 数据里最早月份键 'YYYY-MM'（热力图可回翻的下限） */
export function dataMinMonth(projects: Project[], checkins: CheckinMap, today: string): string {
  let min = today;
  for (const k in checkins) {
    const ds = k.split('|')[1];
    if (ds < min) min = ds;
  }
  for (const p of projects) if (p.createdAt < min) min = p.createdAt;
  return min.slice(0, 7);
}
