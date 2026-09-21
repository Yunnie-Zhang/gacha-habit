/**
 * 临时诊断脚本：给线上站点截图（手机视口）。
 * 运行：node scripts/shot-live.mjs
 */
import fs from 'node:fs';
import { chromium } from 'playwright-core';

const exe = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find((p) => fs.existsSync(p));
if (!exe) throw new Error('未找到 Edge/Chrome 可执行文件');

fs.mkdirSync('shots', { recursive: true });
const browser = await chromium.launch({ executablePath: exe, headless: true });
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text());
});

await page.goto('https://yunnie-zhang.github.io/gacha-habit/', { waitUntil: 'networkidle' });
await page.waitForSelector('text=今日分数', { timeout: 20000 });
await page.waitForTimeout(600);
await page.screenshot({ path: 'shots/live-01-today.png' });

await page.click('.tabbar button:has-text("统计")');
await page.waitForTimeout(800);
await page.screenshot({ path: 'shots/live-02-stats.png' });

await browser.close();
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'NO CONSOLE ERRORS');
