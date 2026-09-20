# 扭蛋打卡 GachaHabit 🎁

随机积分 × 扭蛋抽奖的自我管理打卡应用：给习惯定价，让坚持上瘾。

- 每个项目的分数区间由你自己制定，打卡成功 → 彩色横条卡片**从左侧慢慢生长**出来，长度即分数，终端迸发星星
- 强制项目未完成 → 日结时系统**静默扣分**（结算单告知）；也可主动「认输」（黑色横条从右长出）或设「休息日」
- 打卡全流程**分级音效**（Web Audio 合成），大奖有专属琶音，顶栏可一键静音
- 打卡后当天锁定，不可重摇——分数的含金量靠不可逆保证
- GitHub 风格热力图（红亏绿赚，**月/年双视图**）+ **周/月/年报表**（KPI、趋势、标签分布、项目排行，可翻期回看）
- 数据存浏览器 localStorage，支持 JSON 导出 / 导入备份
- 纯前端 + 纯静态，免费托管 GitHub Pages

需求与设计文档见 [docs/DESIGN.md](docs/DESIGN.md)，早期交互原型见 [prototype/index.html](prototype/index.html)（可直接双击打开）。

## 本地开发

```bash
npm install
npm run dev      # 开发服务器
npm run build    # 类型检查 + 产物构建（dist/）
npm run preview  # 预览构建产物
```

## 部署到 GitHub Pages

1. 在 GitHub 新建仓库，推送本仓库（`main` 分支）
2. 仓库 Settings → Pages → Source 选择 **GitHub Actions**
3. 之后每次 push 到 `main`，`.github/workflows/deploy.yml` 会自动构建并发布

```bash
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main
```

## 安装到手机（PWA）

- **Android**：Chrome 打开线上地址 → 地址栏「安装」/ 菜单 →「添加到主屏幕」
- **iOS**：Safari 打开线上地址 → 分享 →「添加到主屏幕」

安装后从主屏幕图标进入即为全屏独立窗口（无浏览器地址栏），离线也能打开查看。

## 数据与隐私

- 所有数据只存在你自己的浏览器 localStorage 中，不上传任何服务器
- 换设备 / 清浏览器缓存前，先在「项目」页导出 JSON 备份
- 数据结构预留了后端账号同步字段，未来可扩展

## 路线图

| 阶段 | 内容 | 状态 |
|---|---|---|
| M0 | 设计文档 + HTML 原型 | ✅ |
| M1 | React 正式版 MVP | ✅ |
| M2 | 周月年报表 + 年视图热力图 + 标签管理 | ✅ v0.3 |
| M2.5 | 首页横条卡片改版：消失-生长动画 + 星星迸发 + 完成卡按分排序（替换扭蛋弹窗） | ✅ v1.0.1 |
| M3 | 成就系统（构想：积分兑换重摇，每日上限 5 次） | 1.0 后讨论 |
| M4 | 可选：后端账号同步 / PWA | 待定 |
