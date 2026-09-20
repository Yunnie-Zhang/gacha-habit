/**
 * 图表与标签用色 —— 浅色主题（页面底 #ffffff 上验证通过）。
 * 标签分类色板有 3 个浅色 slot 对比度 <3:1（WARN），
 * 豁免条件：标签永远带文字、统计提供数据表视图。
 */
export const TAG_PALETTE = [
  '#2a78d6', '#eb6834', '#1baf7a', '#eda100',
  '#e87ba4', '#008300', '#4a3aa7', '#e34948',
] as const;

export const TAG_COLOR_FALLBACK = '#8b93ad';

/** 热力图：正分绿臂 / 负分红臂（浅色：越多越深） */
export const HEAT_POS = ['#74bd89', '#2f9e60', '#136b3e'] as const;
export const HEAT_NEG = ['#eb8f95', '#d64c5a', '#8f1f30'] as const;

/** 趋势图柱色与热力臂同源 */
export const BAR_POS = '#2f9e60';
export const BAR_NEG = '#d64c5a';

/** 扭蛋粒子色（多巴胺色板只在这里和开蛋瞬间出场） */
export const PARTICLE_POS = ['#ff8a3d', '#ffd166', '#4ecdc4', '#a78bfa', '#6fa8ff'];
