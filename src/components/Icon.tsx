import type { CSSProperties } from 'react';
import { ICONS } from '../lib/icons';

/** 线性图标（24×24 currentColor 描边） */
export function Icon({
  name,
  size = 20,
  strokeWidth = 1.7,
  className,
  style,
}: {
  name: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const d = ICONS[name] ?? ICONS.target;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: d }}
    />
  );
}
