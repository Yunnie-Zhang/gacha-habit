/**
 * 临时诊断脚本：假登录 + 用户管理 + 迎宾飞行 + 头像上传全流程验证（本地 preview，手机视口）。
 * 流程：注入旧数据 → 注册 Yunnie（迎宾飞行 + 迁移）→ 新用户气泡改头像（上传/确认应用）→
 *       账号弹窗头像大图 → 改名/改密码 → 旧密码拒/新密码过 → Demo 空数据 + 不再提示持久化 →
 *       登回云宝 → 刷新保持 → 存储盘点。
 * 运行：先 npm run build && npm run preview（后台），再 node scripts/shot-auth.mjs
 */
import fs from 'node:fs';
import { chromium } from 'playwright-core';

const exe = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find((p) => fs.existsSync(p));
if (!exe) throw new Error('未找到 Edge/Chrome 可执行文件');

/** 现场生成 8×8 BMP 测试图（免外部依赖） */
function makeBmp() {
  const w = 8;
  const h = 8;
  const rowSize = Math.ceil((w * 3) / 4) * 4;
  const dataSize = rowSize * h;
  const buf = Buffer.alloc(54 + dataSize);
  buf.write('BM', 0);
  buf.writeUInt32LE(54 + dataSize, 2);
  buf.writeUInt32LE(54, 10);
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(w, 18);
  buf.writeInt32LE(h, 22);
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(24, 28);
  buf.writeUInt32LE(dataSize, 34);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = 54 + y * rowSize + x * 3;
      buf[o] = 90;
      buf[o + 1] = 120;
      buf[o + 2] = 220;
    }
  }
  return buf;
}

// ---- 旧版全局数据 fixture（模拟分仓前的存量用户）----
const TODAY = '2026-09-21';
const tagH = { id: 'tag-health', name: '健康', color: '#7e98b8' };
const projects = [
  { id: 'p-run', name: '晨跑', icon: 'run', tagIds: ['tag-health'], cadence: 'daily', posMin: 20, posMax: 150, mandatory: false, archived: false, createdAt: TODAY },
  { id: 'p-review', name: '每周复盘', icon: 'clock', tagIds: ['tag-health'], cadence: 'weekly', target: 1, posMin: 20, posMax: 150, mandatory: true, negMin: 30, negMax: 120, archived: false, createdAt: TODAY },
];
const legacyState = {
  tags: [tagH],
  projects,
  checkins: { 'p-run|2026-09-21': { score: 60, status: 'done', via: 'user', ts: Date.now() } },
  restDays: [],
  soundOn: false,
};

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
}, legacyState);

await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });

// 1. 未登录首屏：登录页（头像为帽子 fallback）
await page.waitForSelector('.login-card', { timeout: 20000 });
await page.screenshot({ path: 'shots/auth-01-login.png' });

// 2. 注册 Yunnie：输入用户名后头像应实时预览「Y」
await page.click('.login-tabs button:has-text("注册")');
await page.fill('input[placeholder="用户名"]', 'Yunnie');
await page.fill('input[placeholder="密码（至少 4 位）"]', 'demo1234');
await page.waitForTimeout(200);
await page.screenshot({ path: 'shots/auth-02-avatar-preview.png' });

// 3. 提交注册：迎宾流程——幕布盖屏 → 头像放大到中央 → 问候语停留 1s → 缩小归位
await page.click('.login-btn');
await page.waitForSelector('.avatar-fly', { timeout: 5000 });
await page.waitForSelector('.fly-hello', { timeout: 5000 });
await page.waitForTimeout(600); // 落在 1s 停留窗口内
const helloText = await page.textContent('.fly-hello');
const avHidden = await page.evaluate(() => getComputedStyle(document.querySelector('.t-avatar')).visibility);
await page.screenshot({ path: 'shots/auth-03-center-hold.png' });
console.log(`[迎宾·中央] 问候语=${helloText?.trim()} 页头头像已隐藏=${avHidden === 'hidden'}`);
await page.waitForSelector('.avatar-fly', { state: 'detached', timeout: 10000 });
await page.waitForTimeout(200);
const avVisible = await page.evaluate(() => getComputedStyle(document.querySelector('.t-avatar')).visibility);
await page.waitForSelector('text=今日分数', { timeout: 20000 });
await page.waitForTimeout(400);
const headerName = await page.textContent('.t-hd .hi em');
const mainText = await page.textContent('.today-layer');
console.log(`[迎宾·归位] 页头头像显示=${avVisible === 'visible'}`);
console.log(`[注册 Yunnie] 页头昵称=${headerName?.trim()} 含晨跑=${mainText?.includes('晨跑')}`);
await page.screenshot({ path: 'shots/auth-04-main-yunnie.png' });

// 3b. 新用户气泡：修改头像 → 上传 → 预览 → 确认应用
await page.waitForSelector('.av-tip', { timeout: 5000 });
await page.waitForTimeout(1100); // 等气泡浮现动画结束
await page.screenshot({ path: 'shots/auth-05-avatar-tip.png' });
await page.click('.av-tip-go');
await page.waitForSelector('.av-big', { timeout: 5000 });
await page.setInputFiles('.modal input[type="file"]', { name: 'avatar.bmp', mimeType: 'image/bmp', buffer: makeBmp() });
await page.waitForSelector('.av-big .avatar-img', { timeout: 5000 });
await page.waitForTimeout(300);
await page.screenshot({ path: 'shots/auth-06-avatar-draft.png' });
await page.click('.modal button:has-text("确认应用")');
await page.waitForTimeout(700);
const hasAvatarImg = (await page.$('.t-avatar .avatar-img')) !== null;
const tipGone = (await page.$('.av-tip')) === null;
console.log(`[改头像] 页头已是图片=${hasAvatarImg} 气泡消失=${tipGone}`);
await page.screenshot({ path: 'shots/auth-07-avatar-applied.png' });

// 4. 头像 → 账号与设置弹窗（头像应为已上传图片）
await page.click('.t-avatar');
await page.waitForSelector('.modal', { timeout: 5000 });
const modalAvatarImg = (await page.$('.acct-avatar .avatar-img')) !== null;
console.log(`[账号弹窗] 头像为图片=${modalAvatarImg}`);
await page.screenshot({ path: 'shots/auth-08-account.png' });

// 4b. 弹窗里再点头像 → 大图查看/修改，取消不应用
await page.click('.acct-avatar');
await page.waitForSelector('.av-big', { timeout: 5000 });
await page.screenshot({ path: 'shots/auth-09-avatar-viewer.png' });
await page.click('.modal button:has-text("取消")');
await page.waitForTimeout(300);

// 5. 改用户名：云宝
await page.click('.t-avatar');
await page.waitForSelector('.modal', { timeout: 5000 });
await page.click('.acct-item:has-text("用户名") .linkop');
await page.fill('input[placeholder="新用户名（2~12 个字符）"]', '云宝');
await page.click('.acct-edit button:has-text("保存")');
await page.waitForTimeout(700);
const renamedHeader = await page.textContent('.t-hd .hi em');
console.log(`[改名] 页头昵称=${renamedHeader?.trim()}（应为：云宝）`);
await page.screenshot({ path: 'shots/auth-10-renamed.png' });

// 6. 改密码：先走错误路径（当前密码不对），再正确修改
await page.click('.acct-item:has-text("密码") .linkop');
await page.fill('input[placeholder="当前密码"]', 'wrong0');
await page.fill('input[placeholder="新密码（至少 4 位）"]', 'newpass5678');
await page.click('.acct-edit button:has-text("保存")');
await page.waitForSelector('.acct-edit .login-err', { timeout: 5000 });
const passErr = await page.textContent('.acct-edit .login-err');
console.log(`[改密码·错误路径] 提示=${passErr?.trim()}`);
await page.fill('input[placeholder="当前密码"]', 'demo1234');
await page.click('.acct-edit button:has-text("保存")');
await page.waitForTimeout(700);
const passToast = await page.textContent('#toast');
console.log(`[改密码] toast=${passToast?.trim()}（应为：密码已更新）`);

// 7. 退出登录
await page.click('.modal button:has-text("关闭")');
await page.click('.t-avatar');
await page.click('.modal button:has-text("退出登录")');
await page.click('.modal button:has-text("确定")');
await page.waitForSelector('.login-card', { timeout: 5000 });

// 8. 旧密码登录应失败，新密码应成功（改名后登录用户名为「云宝」）
await page.fill('input[placeholder="用户名"]', '云宝');
await page.fill('input[placeholder="密码（至少 4 位）"]', 'demo1234');
await page.click('.login-btn');
await page.waitForSelector('.login-err', { timeout: 5000 });
const oldPwErr = await page.textContent('.login-err');
console.log(`[旧密码登录] 提示=${oldPwErr?.trim()}`);
await page.fill('input[placeholder="密码（至少 4 位）"]', 'newpass5678');
await page.click('.login-btn');
await page.waitForSelector('text=今日分数', { timeout: 20000 });
await page.waitForTimeout(500);
const reHeader = await page.textContent('.t-hd .hi em');
console.log(`[新密码登录] 页头昵称=${reHeader?.trim()}（应为：云宝）`);

// 9. 退出 → 注册 Demo → 空数据隔离态 + 不再提示
await page.click('.t-avatar');
await page.click('.modal button:has-text("退出登录")');
await page.click('.modal button:has-text("确定")');
await page.waitForSelector('.login-card', { timeout: 5000 });
await page.click('.login-tabs button:has-text("注册")');
await page.fill('input[placeholder="用户名"]', 'Demo');
await page.fill('input[placeholder="密码（至少 4 位）"]', 'demo5678');
await page.click('.login-btn');
await page.waitForSelector('text=今日分数', { timeout: 20000 });
await page.waitForSelector('text=还没有项目', { timeout: 5000 });
console.log('[注册 Demo] 空数据隔离态 ✓');
await page.waitForSelector('.av-tip', { timeout: 5000 });
await page.click('.av-tip-x'); // 不再提示
await page.waitForTimeout(300);
const demoTipGone = (await page.$('.av-tip')) === null;
console.log(`[Demo 不再提示] 气泡已关=${demoTipGone}`);
await page.screenshot({ path: 'shots/auth-11-demo-tip-dismissed.png' });

// 9b. Demo 重登：不再提示应持久化
await page.click('.t-avatar');
await page.click('.modal button:has-text("退出登录")');
await page.click('.modal button:has-text("确定")');
await page.waitForSelector('.login-card', { timeout: 5000 });
await page.fill('input[placeholder="用户名"]', 'Demo');
await page.fill('input[placeholder="密码（至少 4 位）"]', 'demo5678');
await page.click('.login-btn');
await page.waitForSelector('text=今日分数', { timeout: 20000 });
await page.waitForTimeout(1200);
const demoTipStillGone = (await page.$('.av-tip')) === null;
console.log(`[Demo 重登] 气泡仍关闭=${demoTipStillGone}`);

// 10. 退出 → 登回云宝（迎宾幽灵应为上传的图片头像）→ 数据还原 → 刷新保持
await page.click('.t-avatar');
await page.click('.modal button:has-text("退出登录")');
await page.click('.modal button:has-text("确定")');
await page.waitForSelector('.login-card', { timeout: 5000 });
await page.fill('input[placeholder="用户名"]', '云宝');
await page.fill('input[placeholder="密码（至少 4 位）"]', 'newpass5678');
await page.click('.login-btn');
await page.waitForSelector('.fly-hello', { timeout: 5000 });
await page.waitForTimeout(700);
await page.screenshot({ path: 'shots/auth-12-welcome-avatar.png' });
await page.waitForSelector('text=今日分数', { timeout: 20000 });
await page.waitForTimeout(500);
const backText = await page.textContent('.today-layer');
console.log(`[登回云宝] 含晨跑=${backText?.includes('晨跑')} 含每周复盘=${backText?.includes('每周复盘')}`);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('text=今日分数', { timeout: 20000 });
const stillLoggedIn = (await page.$('.login-card')) === null;
const avatarAfterReload = (await page.$('.t-avatar .avatar-img')) !== null;
console.log(`[刷新] 仍在主界面=${stillLoggedIn} 头像保持=${avatarAfterReload}`);
await page.screenshot({ path: 'shots/auth-13-reload.png' });

// 11. 存储盘点：旧 key 保留 + 两个账号 vault
const storage = await page.evaluate(() => {
  const keys = Object.keys(localStorage);
  const vaults = keys.filter((k) => k.startsWith('gacha-habit-vault-'));
  const authRaw = localStorage.getItem('gacha-auth-v1') ?? '';
  return {
    keys,
    legacyKept: keys.includes('gacha-habit-v1'),
    vaultCount: vaults.length,
    avatarStored: authRaw.includes('data:image/jpeg'),
  };
});
console.log(`[存储] vault 数=${storage.vaultCount} 旧key保留=${storage.legacyKept} 头像已入库=${storage.avatarStored}`);
console.log(`[存储] keys=${storage.keys.join(', ')}`);

await browser.close();
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'NO CONSOLE ERRORS');
