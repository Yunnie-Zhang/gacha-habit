/**
 * 临时诊断脚本：本地 preview 截图（手机视口），注入周/月任务 fixtures 验证新功能。
 * 运行：先 npm run build && npm run preview（后台），再 node scripts/shot-local.mjs
 */
import fs from 'node:fs';
import { chromium } from 'playwright-core';

const exe = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find((p) => fs.existsSync(p));
if (!exe) throw new Error('未找到 Edge/Chrome 可执行文件');

// ---- fixtures：今天 2026-09-21（周一，即本周周期起点）----
const TODAY = '2026-09-21';
const tagH = { id: 'tag-health', name: '健康', color: '#7e98b8' };
const tagL = { id: 'tag-learn', name: '学习', color: '#dd9d72' };
const projects = [
  { id: 'p-sleep', name: '早睡', icon: 'moon', tagIds: ['tag-health'], cadence: 'daily', posMin: 0, posMax: 200, mandatory: true, negMin: 50, negMax: 200, archived: false, createdAt: TODAY },
  { id: 'p-run', name: '晨跑', icon: 'run', tagIds: ['tag-health'], cadence: 'daily', posMin: 20, posMax: 150, mandatory: false, archived: false, createdAt: TODAY },
  { id: 'p-review', name: '每周复盘', icon: 'clock', tagIds: ['tag-learn'], cadence: 'weekly', target: 1, posMin: 20, posMax: 150, mandatory: true, negMin: 30, negMax: 120, archived: false, createdAt: TODAY },
  { id: 'p-sport3', name: '每周运动 3 次', icon: 'heart', tagIds: ['tag-health'], cadence: 'weekly', target: 3, posMin: 10, posMax: 100, mandatory: false, archived: false, createdAt: TODAY },
  { id: 'p-clean', name: '月度断舍离', icon: 'target', tagIds: ['tag-health'], cadence: 'monthly', target: 1, posMin: 30, posMax: 200, mandatory: false, archived: false, createdAt: TODAY },
];
const checkins = {
  'p-run|2026-09-21': { score: 60, status: 'done', via: 'user', ts: Date.now() },
  // 同日连打合并演示：count 2、分数合计
  'p-sport3|2026-09-21': { score: 77, status: 'done', via: 'user', count: 2, ts: Date.now() },
};
const state = { tags: [tagH, tagL], projects, checkins, restDays: [], soundOn: false };

fs.mkdirSync('shots', { recursive: true });
const browser = await chromium.launch({ executablePath: exe, headless: true });
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text());
});

await page.addInitScript((data) => {
  localStorage.setItem('gacha-habit-v1', JSON.stringify({ state: data, version: 4 }));
}, state);

await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
await page.waitForSelector('text=今日分数', { timeout: 20000 });
await page.waitForTimeout(600);
await page.screenshot({ path: 'shots/local-01-today.png' });

// 标签筛选：点「学习」
await page.click('.tag-filter button:has-text("学习")');
await page.waitForTimeout(400);
await page.screenshot({ path: 'shots/local-02-tag-learn.png' });

// 退回全部（标签行）
await page.click('.tag-filter button:has-text("全部")');
await page.waitForTimeout(400);

// 频率视图切换：点「每周」，应只剩周任务
await page.click('.cad-filter button:has-text("每周")');
await page.waitForTimeout(400);
await page.screenshot({ path: 'shots/local-02b-cad-weekly.png' });
await page.click('.cad-filter button:has-text("全部")');
await page.waitForTimeout(400);

// 打卡动画后的落位：点每周复盘的打卡，等动画走完（约 4.6s）
await page.click('.band:has-text("每周复盘") .btn-check');
await page.waitForTimeout(5200);
await page.screenshot({ path: 'shots/local-03-after-checkin.png' });

// 统计页（periodStats 周/月周期计数改动）
await page.click('.tabbar button:has-text("统计")');
await page.waitForTimeout(800);
await page.screenshot({ path: 'shots/local-04-stats.png' });

// 回今日页：同日连打合并验证——给每周运动 3 次（已 2/3）再打一次，应合并为 3/3 并移入已完成
await page.click('.tabbar .dock-ball');
await page.waitForTimeout(700);
await page.click('.band:has-text("每周运动 3 次") .btn-check');
await page.waitForTimeout(5200);
await page.screenshot({ path: 'shots/local-05-multi-merge.png' });

await browser.close();
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'NO CONSOLE ERRORS');
