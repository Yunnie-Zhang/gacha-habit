export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface Project {
  id: string;
  name: string;
  emoji: string;
  tagIds: string[];
  /** 打卡成功 · 正分区间（整数，min<=max，可相等=固定分） */
  posMin: number;
  posMax: number;
  /** 强制打卡：未完成将扣分 */
  mandatory: boolean;
  /** 未完成 · 负分区间（仅强制项目，0 起含免罚概率） */
  negMin?: number;
  negMax?: number;
  archived: boolean;
  /** 归档日期（YYYY-MM-DD），结算义务截止到此日期 */
  archivedAt?: string;
  createdAt: string;
}

export type CheckinStatus = 'done' | 'failed' | 'rest';

export interface Checkin {
  score: number;
  status: CheckinStatus;
  /** user=打卡/认输，auto=日结 */
  via: 'user' | 'auto';
  ts: number;
}

/** 打卡记录键：`${projectId}|${date}` */
export type CheckinMap = Record<string, Checkin>;
