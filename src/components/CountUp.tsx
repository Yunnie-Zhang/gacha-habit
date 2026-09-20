import { useEffect, useRef, useState } from 'react';
import { fmt } from '../lib/date';

/** 数值变化时从旧值滚动到新值（easeOutCubic） */
export function CountUp({ value, duration = 700 }: { value: number; duration?: number }) {
  const [disp, setDisp] = useState(value);
  const prevRef = useRef(value);
  const rafRef = useRef(0);

  useEffect(() => {
    const from = prevRef.current;
    prevRef.current = value;
    if (from === value) {
      setDisp(value);
      return;
    }
    const t0 = performance.now();
    const fr = (t: number) => {
      const k = Math.min(1, (t - t0) / duration);
      const e = 1 - Math.pow(1 - k, 3);
      setDisp(Math.round(from + (value - from) * e));
      if (k < 1) rafRef.current = requestAnimationFrame(fr);
    };
    rafRef.current = requestAnimationFrame(fr);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  return <>{fmt(disp)}</>;
}
