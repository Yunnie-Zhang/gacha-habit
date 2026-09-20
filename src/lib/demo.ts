import type { CheckinMap, Project, Tag } from '../types';
import { todayStr, addDays } from './date';
import { mulberry32, seededInt, uid } from './rng';
import { TAG_PALETTE } from './palette';
import { recKey } from './logic';

/** 生成 70 天可复现的演示数据（今日预置 2 条打卡，其余留白可玩） */
export function generateDemoData(): { tags: Tag[]; projects: Project[]; checkins: CheckinMap } {
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
  ): Project => ({
    id: uid() + Math.floor(rng() * 1e6).toString(36),
    name,
    icon: ic,
    tagIds: ids,
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
  ];
  const checkins: CheckinMap = {};
  const base = Date.now();
  for (let i = 70; i >= 1; i--) {
    const ds = addDays(todayStr(), -i);
    for (const p of projects) {
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
  const td = todayStr();
  checkins[recKey(projects[1].id, td)] = { score: 87, status: 'done', via: 'user', ts: base };
  checkins[recKey(projects[2].id, td)] = { score: 45, status: 'done', via: 'user', ts: base };
  return { tags, projects, checkins };
}
