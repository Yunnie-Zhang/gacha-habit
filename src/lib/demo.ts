import type { Cadence, CheckinMap, Project, RestDay, Tag } from '../types';
import { todayStr, addDays, monthEndOf, monthStartOf, weekStartOf } from './date';
import { mulberry32, seededInt, uid } from './rng';
import { TAG_PALETTE } from './palette';
import { recKey, restDayPrice, targetOf } from './logic';

/** 生成 70 天可复现的演示数据（今日预置 2 条打卡，9 天前 / 2 天前各放假一天，其余留白可玩） */
export function generateDemoData(): {
  tags: Tag[];
  projects: Project[];
  checkins: CheckinMap;
  restDays: RestDay[];
} {
  const rng = mulberry32(20260920);
  const mkTag = (name: string, color: string): Tag => ({
    id: uid() + Math.floor(rng() * 1e6).toString(36),
    name,
    color,
  });
  const tags = [
    mkTag('健康', TAG_PALETTE[0]),
    mkTag('学习', TAG_PALETTE[1]),
    mkTag('运动', TAG_PALETTE[2]),
    mkTag('生活', TAG_PALETTE[3]),
    mkTag('心态', TAG_PALETTE[4]),
  ];
  const tid = (name: string) => tags.find((t) => t.name === name)!.id;
  const first = addDays(todayStr(), -70);
  const P = (
    name: string,
    ic: string,
    ids: string[],
    posMin: number,
    posMax: number,
    mandatory: boolean,
    negMin?: number,
    negMax?: number,
    cadence: Cadence = 'daily',
    target?: number,
  ): Project => ({
    id: uid() + Math.floor(rng() * 1e6).toString(36),
    name,
    icon: ic,
    tagIds: ids,
    cadence,
    target,
    posMin,
    posMax,
    mandatory,
    negMin,
    negMax,
    archived: false,
    createdAt: first,
  });
  const projects = [
    P('早睡', 'moon', [tid('健康')], 0, 200, true, 50, 200),
    P('晨跑', 'run', [tid('健康'), tid('运动')], 20, 150, false),
    P('读书 30 分钟', 'book', [tid('学习')], 10, 100, false),
    P('健身', 'dumb', [tid('运动')], 30, 180, true, 30, 150),
    P('冥想 10 分钟', 'wind', [tid('心态')], 5, 60, false),
    P('喝水 8 杯', 'drop', [tid('健康')], 5, 50, false),
    P('写日记', 'pen', [tid('生活')], 10, 80, false),
    P('刷手机 < 1 小时', 'phone', [tid('生活')], 0, 120, true, 20, 100),
    P('每周复盘', 'clock', [tid('学习'), tid('心态')], 20, 150, true, 30, 120, 'weekly', 1),
    P('每周运动 3 次', 'heart', [tid('运动')], 10, 100, false, undefined, undefined, 'weekly', 3),
    P('月度断舍离', 'target', [tid('生活')], 30, 200, false, undefined, undefined, 'monthly', 1),
  ];
  const checkins: CheckinMap = {};
  const restDays: RestDay[] = [];
  const base = Date.now();
  const REST_AT = [9, 2]; // 9 天前、2 天前各放假一天
  const restSet = new Set(REST_AT.map((i) => addDays(todayStr(), -i)));
  for (let i = 70; i >= 1; i--) {
    const ds = addDays(todayStr(), -i);
    if (REST_AT.includes(i)) {
      for (const p of projects) {
        checkins[recKey(p.id, ds)] = { score: 0, status: 'rest', via: 'user', ts: base - i * 86400000 };
      }
      continue;
    }
    for (const p of projects) {
      if (p.cadence !== 'daily') continue; // 周/月任务按周期生成（见下）
      if (rng() < (p.mandatory ? 0.8 : 0.7)) {
        checkins[recKey(p.id, ds)] = {
          score: seededInt(rng, p.posMin, p.posMax),
          status: 'done',
          via: 'user',
          ts: base - i * 86400000,
        };
      } else if (p.mandatory && rng() < 0.85) {
        checkins[recKey(p.id, ds)] = {
          score: -seededInt(rng, p.negMin ?? 0, p.negMax ?? 0),
          status: 'failed',
          via: 'auto',
          ts: base - i * 86400000,
        };
      }
    }
  }
  // 周/月任务：按完整周期排布打卡；强制项未达标时在周期末日生成结算失败记录（与结算引擎产出一致）
  for (const p of projects) {
    if (p.cadence === 'daily') continue;
    const target = targetOf(p);
    let ps = p.cadence === 'weekly' ? weekStartOf(first) : monthStartOf(first);
    for (;;) {
      const pe = p.cadence === 'weekly' ? addDays(ps, 6) : monthEndOf(ps);
      if (pe >= todayStr()) break; // 当前周期进行中，留给用户玩
      if (ps >= p.createdAt) {
        const full = rng() < (p.mandatory ? 0.8 : 0.65);
        const k = full ? target : Math.floor(rng() * target);
        const days: string[] = [];
        for (let ds = ps; ds <= pe; ds = addDays(ds, 1)) if (!restSet.has(ds)) days.push(ds);
        for (let i = 0; i < k && days.length > 0; i++) {
          const j = i + Math.floor(rng() * (days.length - i));
          [days[i], days[j]] = [days[j], days[i]];
          const ds = days[i];
          checkins[recKey(p.id, ds)] = {
            score: seededInt(rng, p.posMin, p.posMax),
            status: 'done',
            via: 'user',
            ts: Date.parse(ds + 'T12:00:00'),
          };
        }
        if (p.mandatory && k < target) {
          let neg = 0;
          for (let i = 0; i < target - k; i++) neg += seededInt(rng, p.negMin ?? 0, p.negMax ?? 0);
          checkins[recKey(p.id, pe)] = {
            score: -neg,
            status: 'failed',
            via: 'auto',
            ts: Date.parse(pe + 'T12:00:00'),
          };
        }
      }
      ps = addDays(pe, 1);
    }
  }
  const td = todayStr();
  checkins[recKey(projects[1].id, td)] = { score: 87, status: 'done', via: 'user', ts: base };
  checkins[recKey(projects[2].id, td)] = { score: 45, status: 'done', via: 'user', ts: base };
  const price = restDayPrice(checkins, td);
  for (const i of REST_AT) {
    restDays.push({ ds: addDays(td, -i), cost: price, ts: base - i * 86400000 });
  }
  return { tags, projects, checkins, restDays };
}
