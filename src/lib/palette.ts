/**
 * 图表与标签用色 —— 全部经过 dataviz 色板验证器校验
 * （分类色板：深色模式、卡片底色 #161c33 上全项 PASS；
 *   热力图双色臂：单调亮度 + 暗端对比度 >= 2:1 PASS）
 */

/** 标签分类色，固定顺序分配给标签，永不错开复用；超出 8 个用中性灰 */
export const TAG_PALETTE = [
  '#3987e5', '#d95926', '#199e70', '#c98500',
  '#d55181', '#008300', '#9085e9', '#e66767',
] as const;

export const TAG_COLOR_FALLBACK = '#8b93ad';

/** 热力图：正分绿色臂 / 负分红色臂 / 无记录中性色（分裂色阶，中点=中性灰蓝） */
export const HEAT_POS = ['#166534', '#22c55e', '#86efac'] as const;
export const HEAT_NEG = ['#9f1239', '#e11d48', '#fb7185'] as const;

/** 趋势图柱色与热力臂保持同源 */
export const BAR_POS = '#22c55e';
export const BAR_NEG = '#e11d48';

/** 扭蛋粒子色 */
export const PARTICLE_POS = ['#fbbf24', '#f59e0b', '#fde68a', '#4ade80', '#fff7ed'];

export const EMOJIS = [
  '🌙', '🏃', '📖', '💪', '🧘', '💧', '📝', '🚫',
  '🍎', '😴', '🎯', '🎸', '💻', '🧹', '💰', '🦷',
  '🥗', '🚭', '⏰', '📚', '✍️', '🎨', '🧠', '❤️',
];
