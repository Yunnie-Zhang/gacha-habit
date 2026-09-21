export function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function dstr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayStr(): string {
  return dstr(new Date());
}

export function addDays(s: string, n: number): string {
  const d = new Date(s + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return dstr(d);
}

export function weekdayCN(s: string): string {
  return '日一二三四五六'[new Date(s + 'T12:00:00').getDay()];
}

/** 带符号格式化：正数加 +，负数自带 - */
export function fmt(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

export function dsOf(y: number, m: number, d: number): string {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(y, m + 1, 0).getDate();
}

/** 月份键：'YYYY-MM' */
export function monthKeyOf(ds: string): string {
  return ds.slice(0, 7);
}

/** 周起点（周一）：与统计页 periodRange 的周定义一致 */
export function weekStartOf(ds: string): string {
  const t = new Date(ds + 'T12:00:00');
  return addDays(ds, -((t.getDay() + 6) % 7));
}

/** 周终点（周日） */
export function weekEndOf(ds: string): string {
  return addDays(weekStartOf(ds), 6);
}

/** 月起点（1 号） */
export function monthStartOf(ds: string): string {
  return ds.slice(0, 8) + '01';
}

/** 月终点（月末最后一天） */
export function monthEndOf(ds: string): string {
  const [y, m] = ds.split('-').map(Number);
  return dstr(new Date(y, m, 0));
}
