/** 密码学安全的 [a, b] 整数均匀分布（用于真实摇分） */
export function randInt(a: number, b: number): number {
  if (a === b) return a;
  const x = new Uint32Array(1);
  crypto.getRandomValues(x);
  return a + (x[0] % (b - a + 1));
}

/** 可复现伪随机（仅用于生成演示数据） */
export function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededInt(rng: () => number, a: number, b: number): number {
  return a + Math.floor(rng() * (b - a + 1));
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
