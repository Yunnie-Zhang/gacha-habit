export interface Tag {
  id: string;
  name: string;
  color: string;
}

/** 打卡频率：每日 / 每周 / 每月 */
export type Cadence = 'daily' | 'weekly' | 'monthly';

export interface Project {
  id: string;
  name: string;
  /** 线性图标 key（见 lib/icons.ts ICONS） */
  icon: string;
  tagIds: string[];
  /** 打卡频率（旧数据迁移默认 daily） */
  cadence: Cadence;
  /** 每周期需打卡次数（仅 weekly/monthly，缺省 1） */
  target?: number;
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
  /** user=打卡/认输，auto=日结/周结/月结 */
  via: 'user' | 'auto';
  /** 同日多次打卡合并的次数（周/月任务连打），缺省 1 */
  count?: number;
  ts: number;
}

/** 打卡记录键：`${projectId}|${date}` */
export type CheckinMap = Record<string, Checkin>;

/** 兑换的放假日（独立账本：扣分不进每日积分流水，图表保持纯行为记录） */
export interface RestDay {
  /** 放假日期 YYYY-MM-DD */
  ds: string;
  /** 兑换消耗的积分 */
  cost: number;
  ts: number;
}
