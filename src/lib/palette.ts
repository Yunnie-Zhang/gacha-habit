/**
 * 图表与标签用色 —— 浅色主题（页面底 #ffffff 上验证通过）。
 * 标签分类色板为莫兰迪低饱和（与首页横条卡、皮粉主题同调）；
 * 全部 slot 对比度 <3:1（WARN），
 * 豁免条件：标签永远带文字、统计提供数据表视图。
 */
export const TAG_PALETTE = [
  '#7e98b8', '#dd9d72', '#85b3a0', '#d4b073',
  '#d9a1b4', '#93a983', '#a294bd', '#bd8080',
] as const;

/** 旧亮色标签色 → 莫兰迪色映射（persist v2→v3 迁移用） */
export const TAG_COLOR_MIGRATE: Record<string, string> = {
  '#2a78d6': '#7e98b8',
  '#eb6834': '#dd9d72',
  '#1baf7a': '#85b3a0',
  '#eda100': '#d4b073',
  '#e87ba4': '#d9a1b4',
  '#008300': '#93a983',
  '#4a3aa7': '#a294bd',
  '#e34948': '#bd8080',
};

export const TAG_COLOR_FALLBACK = '#8b93ad';

/** 热力图：正分皮粉臂 / 负分赭墨臂（越深越强；负臂整体更深以区分，与 index.css .heat-cell 同源） */
export const HEAT_POS = ['#f7d2c2', '#eba98f', '#d4795e'] as const;
export const HEAT_NEG = ['#a9746a', '#8a4f44', '#5f3029'] as const;

/** 趋势图柱色与热力臂同源 */
export const BAR_POS = '#d4795e';
export const BAR_NEG = '#8a4f44';

/** 扭蛋粒子色（多巴胺色板只在这里和开蛋瞬间出场） */
export const PARTICLE_POS = ['#ff8a3d', '#ffd166', '#4ecdc4', '#a78bfa', '#6fa8ff'];

/** 首页横条卡片色（莫兰迪），认输黑 / 休息灰 */
export const BAND_PALETTE = ['#b7a6c9', '#9db5b2', '#d9b98a', '#c99a9a', '#a3b5c4', '#b5c99a'] as const;
export const BAND_NEG = '#18100c';
export const BAND_REST = '#b3ab9e';
/** 卡片生长时终端迸出的星星色 */
export const SPARK_PALETTE = ['#ffcf5c', '#ffde9c', '#ff8a3d', '#ffffff'];
