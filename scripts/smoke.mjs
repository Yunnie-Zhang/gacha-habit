/**
 * 冒烟测试：驱动无头 Edge 走一遍核心用户路径并截图。
 * 前置：`npm run preview -- --port 4173 --strictPort` 已在后台运行。
 * 运行：node scripts/smoke.mjs
 */
import fs from 'node:fs';
import { chromium } from 'playwright-core';

const exe = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find((p) => fs.existsSync(p));
if (!exe) throw new Error('未找到 Edge/Chrome 可执行文件');

fs.mkdirSync('shots', { recursive: true });
const errors = [];
const browser = await chromium.launch({ executablePath: exe, headless: true });

// ---- 手机视口：完整用户路径 ----
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push('pageerror: ' + e));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text());
});

await page.goto('http://localhost:4173');
await page.waitForSelector('text=今日分数', { timeout: 15000 });
await page.screenshot({ path: 'shots/01-today-empty.png' });

// 载入演示数据
await page.click('.tabbar button:has-text("管理")');
await page.waitForTimeout(300);
await page.click('button:has-text("载入演示数据")');
await page.click('.overlay button:has-text("确定")');
await page.waitForSelector('text=已载入演示数据');
await page.click('.tabbar button:has-text("今日")');
await page.waitForSelector('text=今日分数');
await page.waitForTimeout(300);
await page.screenshot({ path: 'shots/02-today-demo.png', fullPage: true });

// 打卡：卡片消失 → 从左长出（终端迸星）→ 分数揭晓原地停留 → 逐行下放
await page.locator('.stack .btn-check').first().click();
await page.waitForSelector('.band.is-anim', { timeout: 5000 });
await page.waitForTimeout(1300);
await page.screenshot({ path: 'shots/03-band-growing.png' });
await page.waitForSelector('.stack .band:has-text("早睡") .b-score', { timeout: 15000 });
await page.waitForTimeout(600);
await page.screenshot({ path: 'shots/04-band-hold.png', fullPage: true });
await page.waitForTimeout(3400);
await page.screenshot({ path: 'shots/05-band-landed.png', fullPage: true });

// 认输（强制项目：黑色横条从右长出 + 负分）
const giveup = page.locator('.b-link:has-text("认输")');
if (await giveup.count()) {
  await giveup.first().click();
  await page.click('.overlay button:has-text("确定")');
  await page.waitForTimeout(6200);
  await page.screenshot({ path: 'shots/06-giveup.png', fullPage: true });
}

// 统计页
await page.click('.tabbar button:has-text("统计")');
await page.waitForSelector('text=打卡热力图');
await page.waitForTimeout(500);
await page.screenshot({ path: 'shots/07-stats-mobile.png', fullPage: true });

// M2：周期报表（本年）+ 年视图热力图
await page.click('button:has-text("本年")');
await page.waitForSelector('text=项目得分排行');
await page.waitForTimeout(400);
await page.screenshot({ path: 'shots/09-stats-year.png', fullPage: true });
await page.click('.seg button:has-text("年")');
await page.waitForSelector('.heat-months');
await page.waitForTimeout(400);
await page.screenshot({ path: 'shots/10-heat-year.png' });
await ctx.close();

// ---- 桌面视口：统计页布局 ----
const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 850 } });
const page2 = await ctx2.newPage();
page2.on('pageerror', (e) => errors.push('desktop pageerror: ' + e));
await page2.goto('http://localhost:4173');
await page2.waitForSelector('text=今日分数', { timeout: 15000 });
await page2.click('.tabbar button:has-text("统计")');
await page2.waitForSelector('text=打卡热力图');
await page2.waitForTimeout(500);
await page2.screenshot({ path: 'shots/08-stats-desktop.png' });
await ctx2.close();

await browser.close();
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'NO CONSOLE ERRORS');
