import type { CheckinMap, Project, RestDay, Tag } from '../types';
import { addDays, dstr, dsOf } from './date';

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

/** 区间内每天逐日聚合回调（含首尾，自动截至 today 之前） */
function eachDay(from: string, to: string, today: string, fn: (ds: string) => void): number {
  const last = to <= today ? to : today;
  let days = 0;
  if (from > last) return 0;
  for (let ds = from; ; ds = addDays(ds, 1)) {
    fn(ds);
    days++;
    if (ds >= last) break;
  }
  return days;
}

export function rangeTotal(checkins: CheckinMap, from: string, to: string, today: string): number {
  let s = 0;
  eachDay(from, to, today, (ds) => {
    s += dayTotal(checkins, ds);
  });
  return s;
}

export function recordsInRange(checkins: CheckinMap, from: string, to: string): number {
  let n = 0;
  for (const k in checkins) {
    const ds = k.split('|')[1];
    if (ds >= from && ds <= to) n++;
  }
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

/** 全历史最大单日正/负总分（用于热力图分档阈值，保证跨视图颜色一致） */
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

export type ScoreTier =
  | 'jackpot' | 'great' | 'good' | 'small' | 'zero'
  | 'neg-small' | 'neg-mid' | 'neg-big' | 'neg-huge';

/** 扭蛋分级（音效与文案共用同一阈值） */
export function scoreTier(p: Project, score: number): ScoreTier {
  if (score === 0) return 'zero';
  if (score > 0) {
    const r = score / Math.max(p.posMax, 1);
    if (score === p.posMax || r >= 0.85) return 'jackpot';
    if (r >= 0.6) return 'great';
    if (r >= 0.3) return 'good';
    return 'small';
  }
  const r = -score / Math.max(p.negMax ?? 1, 1);
  if (r >= 0.85) return 'neg-huge';
  if (r >= 0.6) return 'neg-big';
  if (r >= 0.3) return 'neg-mid';
  return 'neg-small';
}

export interface PendingSettlement {
  date: string;
  projectId: string;
}

/** 卡片生长长度归一：0(最短)~1(横贯全宽)，打卡与认输各自按区间归一 */
export function scoreFrac(p: Project, score: number, mode: 'checkin' | 'giveup'): number {
  if (mode === 'checkin') return p.posMax > p.posMin ? (score - p.posMin) / (p.posMax - p.posMin) : 1;
  const negMin = p.negMin ?? 0;
  const negMax = p.negMax ?? 0;
  return negMax > negMin ? (-score - negMin) / (negMax - negMin) : 1;
}

/** 打卡/认输结果文案（与 playReveal 音效分级共用同一阈值） */
export function rollLabel(p: Project, score: number): string {
  if (score === 0) return '😶 零蛋，免费的快乐';
  if (score > 0) {
    const max = Math.max(p.posMax, 1);
    const r = score / max;
    if (score === p.posMax) return '🎯 满分抽出！！';
    if (r >= 0.85) return '✨ 欧皇附体！！';
    if (r >= 0.6) return '🎉 欧气满满！';
    if (r >= 0.3) return '👍 不错不错';
    return '🙂 积分入账';
  }
  const max = Math.max(p.negMax ?? 1, 1);
  const r = -score / max;
  if (r >= 0.85) return '💔 心态崩了…';
  if (r >= 0.6) return '😱 大失血！';
  if (r >= 0.3) return '🥲 小亏一场';
  return '😅 止血成功';
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
  const minDs = dataMinDate(projects, checkins, today);
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

/* ============ 报表周期 ============ */

export type PeriodType = 'week' | 'month' | 'year';

/** 周期区间：offset 0=当前周/月/年，正数往过去推 */
export function periodRange(
  type: PeriodType,
  offset: number,
  today: string,
): { from: string; to: string; label: string } {
  const t = new Date(today + 'T12:00:00');
  if (type === 'week') {
    const monday = new Date(t);
    monday.setDate(t.getDate() - ((t.getDay() + 6) % 7) - offset * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return {
      from: dstr(monday),
      to: dstr(sunday),
      label: `${monday.getMonth() + 1}/${monday.getDate()} – ${sunday.getMonth() + 1}/${sunday.getDate()}`,
    };
  }
  if (type === 'month') {
    const first = new Date(t.getFullYear(), t.getMonth() - offset, 1);
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
    return {
      from: dstr(first),
      to: dstr(last),
      label: `${first.getFullYear()}年${first.getMonth() + 1}月`,
    };
  }
  const y = t.getFullYear() - offset;
  return { from: `${y}-01-01`, to: `${y}-12-31`, label: `${y}年` };
}

export interface PeriodStats {
  total: number;
  /** 已度过的天数（用于日均） */
  days: number;
  avg: number;
  doneAll: number;
  mDone: number;
  mFail: number;
  miss: number;
  rate: number;
  best: { ds: string; v: number } | null;
}

/** 任意周期汇总：总分/日均/强制完成率/最佳单日等 */
export function periodStats(
  projects: Project[],
  checkins: CheckinMap,
  from: string,
  to: string,
  today: string,
): PeriodStats {
  let total = 0;
  let doneAll = 0;
  let mDone = 0;
  let mFail = 0;
  let miss = 0;
  let bestDs = '';
  let bestV = -Infinity;
  const days = eachDay(from, to, today, (ds) => {
    const t = dayTotal(checkins, ds);
    total += t;
    if (t > bestV) {
      bestV = t;
      bestDs = ds;
    }
    for (const p of activeProjects(projects, ds)) {
      const r = checkins[recKey(p.id, ds)];
      if (r?.status === 'done') doneAll++;
      if (!p.mandatory) continue;
      if (!r) {
        // 今天还没过完，未打卡不算遗漏（日结次日才追溯结算）
        if (ds !== today) miss++;
      } else if (r.status === 'done') mDone++;
      else if (r.status === 'failed') mFail++;
    }
  });
  const denom = mDone + mFail + miss;
  return {
    total,
    days,
    avg: days > 0 ? Math.round(total / days) : 0,
    doneAll,
    mDone,
    mFail,
    miss,
    rate: denom > 0 ? Math.round((mDone / denom) * 100) : 0,
    best: bestV > 0 ? { ds: bestDs, v: bestV } : null,
  };
}

export interface TagTotal {
  tag: Tag | null;
  total: number;
}

/** 周期内各标签净分（未打标签的项目归入「无标签」），单次扫描 */
export function tagTotals(
  projects: Project[],
  checkins: CheckinMap,
  tags: Tag[],
  from: string,
  to: string,
): TagTotal[] {
  const totals: Record<string, number> = {};
  const order: string[] = [];
  for (const k in checkins) {
    const [pid, ds] = k.split('|');
    if (ds < from || ds > to) continue;
    const p = projects.find((x) => x.id === pid);
    if (!p) continue;
    const ids = p.tagIds.length > 0 ? p.tagIds : ['none'];
    for (const id of ids) {
      if (!(id in totals)) {
        totals[id] = 0;
        order.push(id);
      }
      totals[id] += checkins[k].score;
    }
  }
  return order
    .map((id) => ({
      tag: id === 'none' ? null : tags.find((t) => t.id === id) ?? null,
      total: totals[id],
    }))
    .sort((a, b) => b.total - a.total);
}

/** 周期内各项目净分排行（有记录才入榜；已删除项目的记录无法归属，不计） */
export function projectTotals(
  projects: Project[],
  checkins: CheckinMap,
  from: string,
  to: string,
): { project: Project; total: number }[] {
  const totals = new Map<string, number>();
  for (const k in checkins) {
    const [pid, ds] = k.split('|');
    if (ds < from || ds > to) continue;
    totals.set(pid, (totals.get(pid) ?? 0) + checkins[k].score);
  }
  const out: { project: Project; total: number }[] = [];
  for (const p of projects) {
    if (!totals.has(p.id)) continue;
    out.push({ project: p, total: totals.get(p.id)! });
  }
  return out.sort((a, b) => b.total - a.total);
}

export function dataMinDate(projects: Project[], checkins: CheckinMap, today: string): string {
  let min = today;
  for (const k in checkins) {
    const ds = k.split('|')[1];
    if (ds < min) min = ds;
  }
  for (const p of projects) if (p.createdAt < min) min = p.createdAt;
  return min;
}

/** 近 n 天日期串（含今天），升序 */
export function lastNDays(n: number, today: string): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(today, -i));
  return out;
}

/** 某年 12 个月的 [from, to] 区间 */
export function monthRangesOfYear(y: number): { from: string; to: string }[] {
  return Array.from({ length: 12 }, (_, i) => ({
    from: dsOf(y, i, 1),
    to: dstr(new Date(y, i + 1, 0)),
  }));
}

/* ============ 放假兑换（独立账本，不进每日积分流水） ============ */

/** 定价：4 × 近 30 天日均 |总分|（截至昨天） */
export const REST_WINDOW = 30;
export const REST_MULT = 4;
/** 兑换解锁：使用历史满 7 天 */
export const REST_UNLOCK_DAYS = 7;
/** 每月最多兑换天数 */
export const REST_MONTHLY_LIMIT = 5;

/** 兑换一日放假的积分价格；0 记录保底 1 分（解锁与否由 restPurchaseState 判定） */
export function restDayPrice(checkins: CheckinMap, today: string): number {
  let absSum = 0;
  for (let i = 1; i <= REST_WINDOW; i++) absSum += Math.abs(dayTotal(checkins, addDays(today, -i)));
  return Math.max(1, Math.round((absSum / REST_WINDOW) * REST_MULT));
}

export function allTimeTotal(checkins: CheckinMap): number {
  let s = 0;
  for (const k in checkins) s += checkins[k].score;
  return s;
}

/** 可用余额 = 累计总分 − 累计放假消耗 */
export function restBalance(checkins: CheckinMap, restDays: RestDay[]): number {
  return allTimeTotal(checkins) - restDays.reduce((a, r) => a + r.cost, 0);
}

export function restDaysUsedInMonth(restDays: RestDay[], today: string): number {
  const ym = today.slice(0, 7);
  let n = 0;
  for (const r of restDays) if (r.ds.slice(0, 7) === ym) n++;
  return n;
}

/** 今天是否已有实质记录（打卡/认输/日结扣分）——放假只能兑「干净」的今天 */
export function dayHasActiveRecords(checkins: CheckinMap, ds: string): boolean {
  for (const k in checkins) {
    if (!k.endsWith('|' + ds)) continue;
    if (checkins[k].status !== 'rest') return true;
  }
  return false;
}

export interface RestPurchaseState {
  /** 兑换价格；未解锁时为 null */
  price: number | null;
  canBuy: boolean;
  /** 不可兑换时的简短原因（用于禁用态按钮） */
  reason: string;
}

/** 今天能否兑换放假：解锁 → 额度 → 今天干净 → 余额足够 */
export function restPurchaseState(
  projects: Project[],
  checkins: CheckinMap,
  restDays: RestDay[],
  today: string,
): RestPurchaseState {
  const minDs = dataMinDate(projects, checkins, today);
  const days = Math.floor(
    (Date.parse(today + 'T12:00:00') - Date.parse(minDs + 'T12:00:00')) / 86400000,
  );
  if (days < REST_UNLOCK_DAYS) {
    return {
      price: null,
      canBuy: false,
      reason: `再坚持 ${REST_UNLOCK_DAYS - days} 天解锁`,
    };
  }
  const price = restDayPrice(checkins, today);
  if (restDays.some((r) => r.ds === today)) {
    return { price, canBuy: false, reason: '今天已在放假' };
  }
  if (restDaysUsedInMonth(restDays, today) >= REST_MONTHLY_LIMIT) {
    return { price, canBuy: false, reason: '本月额度用完' };
  }
  if (dayHasActiveRecords(checkins, today)) {
    return { price, canBuy: false, reason: '今天已有记录' };
  }
  if (restBalance(checkins, restDays) < price) {
    return { price, canBuy: false, reason: '余额不足' };
  }
  return { price, canBuy: true, reason: '' };
}

/** 全历史最长连续天数（休息/放假日不断签） */
export function longestStreak(projects: Project[], checkins: CheckinMap, today: string): number {
  const minDs = dataMinDate(projects, checkins, today);
  let cur = 0;
  let max = 0;
  for (let ds = minDs; ds <= today; ds = addDays(ds, 1)) {
    if (dayQualifies(checkins, ds)) {
      cur++;
      if (cur > max) max = cur;
    } else {
      cur = 0;
    }
  }
  return max;
}
