import { PARTICLE_POS } from './palette';

/** DOM 粒子迸发（扭蛋爆开 / 大奖彩带） */
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
