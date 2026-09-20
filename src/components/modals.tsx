import type { ReactNode } from 'react';
import { useStore } from '../store';
import type { SettleItem } from '../store';
import { fmt, weekdayCN } from '../lib/date';
import { dayTotal, recKey } from '../lib/logic';
import { Icon } from './Icon';

/** 基础弹窗：点遮罩可选关闭 */
export function Modal({
  children,
  onClose,
  maxW,
  gacha,
}: {
  children: ReactNode;
  onClose?: () => void;
  maxW?: number;
  gacha?: boolean;
}) {
  return (
    <div
      className="overlay"
      onClick={
        onClose && !gacha
          ? (e) => {
              if (e.target === e.currentTarget) onClose();
            }
          : undefined
      }
    >
      <div className="modal" style={maxW ? { maxWidth: maxW } : undefined} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function ConfirmModal({
  text,
  onYes,
  onNo,
}: {
  text: string;
  onYes: () => void;
  onNo: () => void;
}) {
  return (
    <Modal maxW={340} onClose={onNo}>
      <p style={{ lineHeight: 1.7, fontSize: 14 }}>{text}</p>
      <div className="f-foot" style={{ marginTop: 18 }}>
        <button className="btn" onClick={onNo}>
          取消
        </button>
        <button className="btn primary" onClick={onYes}>
          确定
        </button>
      </div>
    </Modal>
  );
}

/** 单日明细（点击热力图色块打开）。归档项目的历史记录仍显示 */
export function DayDetailModal({ ds, onClose }: { ds: string; onClose: () => void }) {
  const projects = useStore((s) => s.projects);
  const checkins = useStore((s) => s.checkins);
  const rows = projects
    .filter((p) => p.createdAt <= ds)
    .map((p) => ({ p, r: checkins[recKey(p.id, ds)] }))
    .filter((x) => x.r !== undefined);

  return (
    <Modal maxW={380} onClose={onClose}>
      <h3>
        {ds.slice(5).replace('-', '/')} 星期{weekdayCN(ds)} · 总分 {fmt(dayTotal(checkins, ds))}
      </h3>
      {rows.length === 0 && <div className="zero-note">这一天没有记录</div>}
      {rows.map(({ p, r }) => {
        const stText = r!.status === 'done' ? '打卡' : r!.status === 'rest' ? '休息' : r!.via === 'auto' ? '日结' : '认输';
        return (
          <div className="day-item" key={p.id}>
            <span className="dico"><Icon name={p.icon} size={15} /></span>
            <span>{p.name}</span>
            <span className="st">{stText}</span>
            <span className={`score ${r!.score > 0 ? 'pos' : r!.score < 0 ? 'neg' : ''}`}>
              {r!.status === 'rest' ? '—' : fmt(r!.score)}
            </span>
          </div>
        );
      })}
      <div className="f-foot" style={{ marginTop: 16 }}>
        <button className="btn" style={{ flex: 1 }} onClick={onClose}>
          关闭
        </button>
      </div>
    </Modal>
  );
}

/** 日结结算单：静默扣分后的一次性告知（不打断、无动画） */
export function SettlementModal({ items, onClose }: { items: SettleItem[]; onClose: () => void }) {
  const sum = items.reduce((a, b) => a + b.score, 0);
  const dates = [...new Set(items.map((i) => i.date))].sort();
  return (
    <Modal maxW={380} onClose={onClose}>
      <h3>日结结算单</h3>
      <p style={{ fontSize: 12, color: 'var(--muted)', margin: '-8px 0 12px', lineHeight: 1.7 }}>
        {dates.length > 1
          ? `有 ${dates.length} 天未打开应用，以下强制项目按日静默扣分（追溯至对应日期）。`
          : `以下强制项目未完成，已静默扣分（追溯至对应日期）。`}
      </p>
      {items.map((it, i) => (
        <div className="day-item" key={i}>
          <span className="dico"><Icon name={it.project.icon} size={15} /></span>
          <span>
            {it.project.name}
            {dates.length > 1 && <span className="date-l"> · {it.date.slice(5).replace('-', '/')}</span>}
          </span>
          <span className="st">日结</span>
          <span className="score neg">{fmt(it.score)}</span>
        </div>
      ))}
      <div className="day-item">
        <span>Σ</span>
        <span>合计</span>
        <span className="score neg">{fmt(sum)}</span>
      </div>
      <div className="f-foot" style={{ marginTop: 16 }}>
        <button className="btn primary" style={{ flex: 1 }} onClick={onClose}>
          知道了
        </button>
      </div>
    </Modal>
  );
}
