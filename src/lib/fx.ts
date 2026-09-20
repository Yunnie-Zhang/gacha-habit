import { PARTICLE_POS, SPARK_PALETTE } from './palette';

/** DOM 粒子迸发（大奖彩带 / 今日总分庆祝） */
export function burst(x: number, y: number, n: number): void {
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i');
    p.className = 'pt';
    const a = Math.random() * Math.PI * 2;
    const v = 60 + Math.random() * 150;
    const dx = Math.cos(a) * v;
    const dy = Math.sin(a) * v - 50;
    const size = 5 + Math.random() * 6;
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.width = `${size}px`;
    p.style.height = `${size}px`;
    p.style.background = PARTICLE_POS[i % PARTICLE_POS.length];
    p.style.setProperty('--d', `${0.7 + Math.random() * 0.6}s`);
    document.body.appendChild(p);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        p.style.transform = `translate(${dx}px,${dy}px) rotate(${360 + Math.random() * 360}deg)`;
        p.style.opacity = '0';
      }),
    );
    window.setTimeout(() => p.remove(), 1500);
  }
}

/** 负分屏幕短促震动 */
export function quake(): void {
  document.body.classList.add('quake');
  window.setTimeout(() => document.body.classList.remove('quake'), 500);
}

/** 单颗星星：从 (x, y) 向卡片前进方向 (dir 1=右 / -1=左) 迸出并旋转淡出 */
export function sparkAt(x: number, y: number, dir: 1 | -1): void {
  const s = document.createElement('span');
  s.className = 'spark';
  s.textContent = Math.random() < 0.72 ? '✦' : '✧';
  s.style.left = `${x.toFixed(1)}px`;
  s.style.top = `${y.toFixed(1)}px`;
  s.style.fontSize = `${(7 + Math.random() * 9).toFixed(0)}px`;
  s.style.color = SPARK_PALETTE[Math.floor(Math.random() * SPARK_PALETTE.length)];
  document.body.appendChild(s);
  const a = (Math.random() - 0.5) * 1.7;
  const v = 36 + Math.random() * 84;
  const dx = Math.cos(a) * v * dir;
  const dy = Math.sin(a) * v - 10;
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      s.style.transform = `translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px) rotate(${(
        Math.random() * 140 - 70
      ).toFixed(0)}deg) scale(.35)`;
      s.style.opacity = '0';
    }),
  );
  window.setTimeout(() => s.remove(), 680);
}

/** 卡片生长全程：终端整条端边持续迸星（dir 1=向右长 / -1=向左长） */
export function sparkTrail(el: HTMLElement, dir: 1 | -1, durMs: number): void {
  const end = performance.now() + durMs;
  let last = 0;
  const tickFn = () => {
    const now = performance.now();
    if (now >= end) return;
    if (now - last > 65) {
      last = now;
      const r = el.getBoundingClientRect();
      if (r.width > 2) {
        const x = dir > 0 ? r.right : r.left;
        const n = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < n; i++) sparkAt(x, r.top + 6 + Math.random() * (r.height - 12), dir);
      }
    }
    requestAnimationFrame(tickFn);
  };
  requestAnimationFrame(tickFn);
}

/** 揭晓瞬间：整个终端迸一捧星星 */
export function tipPop(el: HTMLElement, dir: 1 | -1): void {
  const r = el.getBoundingClientRect();
  for (let i = 0; i < 14; i++) {
    window.setTimeout(() => {
      sparkAt(
        dir > 0 ? r.right - 4 - Math.random() * 12 : r.left + 4 + Math.random() * 12,
        r.top + 4 + Math.random() * (r.height - 8),
        dir,
      );
    }, i * 26);
  }
}
