import type { ReactNode } from 'react';
import { useStore } from '../store';
import type { SettleItem } from '../store';
import { fmt, todayStr, weekdayCN } from '../lib/date';
import {
  REST_MONTHLY_LIMIT,
  REST_MULT,
  SETTLE_CN,
  dayTotal,
  recKey,
  restBalance,
  restDaysUsedInMonth,
  restPurchaseState,
} from '../lib/logic';
import { Icon } from './Icon';

/** 基础弹窗：点遮罩可选关闭 */
export function Modal({
  children,
  onClose,
  maxW,
}: {
  children: ReactNode;
  onClose?: () => void;
  maxW?: number;
}) {
  return (
    <div
      className="overlay"
      onClick={
        onClose
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
  const restDays = useStore((s) => s.restDays);
  const rest = restDays.find((r) => r.ds === ds);
  const rows = projects
    .filter((p) => p.createdAt <= ds)
    .map((p) => ({ p, r: checkins[recKey(p.id, ds)] }))
    .filter((x) => x.r !== undefined);

  return (
    <Modal maxW={380} onClose={onClose}>
      <h3>
        {ds.slice(5).replace('-', '/')} 星期{weekdayCN(ds)} ·{' '}
        {rest ? '放假日 🏖' : `总分 ${fmt(dayTotal(checkins, ds))}`}
      </h3>
      {rows.length === 0 && <div className="zero-note">这一天没有记录</div>}
      {rows.map(({ p, r }) => {
        const stText =
          r!.status === 'done'
            ? '打卡'
            : r!.status === 'rest'
              ? '休息'
              : r!.via === 'auto'
                ? `${SETTLE_CN[p.cadence] ?? '日结'}`
                : '认输';
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
      {rest && (
        <div className="day-item">
          <span className="dico"><Icon name="ticket" size={15} /></span>
          <span>放假兑换</span>
          <span className="st">账本</span>
          <span className="score neg">−{rest.cost}</span>
        </div>
      )}
      <div className="f-foot" style={{ marginTop: 16 }}>
        <button className="btn" style={{ flex: 1 }} onClick={onClose}>
          关闭
        </button>
      </div>
    </Modal>
  );
}

/** 结算单：静默扣分后的一次性告知（不打断、无动画） */
export function SettlementModal({ items, onClose }: { items: SettleItem[]; onClose: () => void }) {
  const sum = items.reduce((a, b) => a + b.score, 0);
  const dates = [...new Set(items.map((i) => i.date))].sort();
  return (
    <Modal maxW={380} onClose={onClose}>
      <h3>结算单</h3>
      <p style={{ fontSize: 12, color: 'var(--muted)', margin: '-8px 0 12px', lineHeight: 1.7 }}>
        {dates.length > 1
          ? `有 ${dates.length} 天未打开应用，以下强制项目未完成，已静默扣分（追溯至对应日期）。`
          : `以下强制项目未完成，已静默扣分（追溯至对应日期）。`}
      </p>
      {items.map((it, i) => (
        <div className="day-item" key={i}>
          <span className="dico"><Icon name={it.project.icon} size={15} /></span>
          <span>
            {it.project.name}
            {dates.length > 1 && <span className="date-l"> · {it.date.slice(5).replace('-', '/')}</span>}
          </span>
          <span className="st">{SETTLE_CN[it.project.cadence] ?? '日结'}</span>
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

/** 兑换放假确认单：摆出定价算式、余额与额度；资格校验在 store.buyRestDay 里兜底 */
export function RestDayModal({
  onClose,
  onBought,
}: {
  onClose: () => void;
  /** 兑换成功后的回调（音效 / toast） */
  onBought?: () => void;
}) {
  const projects = useStore((s) => s.projects);
  const checkins = useStore((s) => s.checkins);
  const restDays = useStore((s) => s.restDays);
  const buyRestDay = useStore((s) => s.buyRestDay);
  const today = todayStr();
  const st = restPurchaseState(projects, checkins, restDays, today);
  const price = st.price ?? 0;

  return (
    <Modal maxW={360} onClose={onClose}>
      <h3>兑换放假 🎫</h3>
      <div className="rest-quote">
        近 30 天日均活动量 <b>{Math.round(price / REST_MULT)}</b> 分
        <br />× {REST_MULT} 倍 = 消耗 <b className="neg">−{price}</b> 分
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--sub)', lineHeight: 1.8, margin: '0 0 12px' }}>
        今天所有强制任务免扣分，连续天数不断签。当天封盘：不可打卡、不可认输，兑换后积分不退。
      </p>
      <div className="rest-meta">
        <span>
          可用余额 <b className="rest-meta-b">{restBalance(checkins, restDays)}</b> 分
        </span>
        <span>
          本月已放假 {restDaysUsedInMonth(restDays, today)}/{REST_MONTHLY_LIMIT} 天
        </span>
      </div>
      <div className="f-foot">
        <button className="btn" onClick={onClose}>
          再想想
        </button>
        <button
          className="btn primary"
          disabled={!st.canBuy}
          onClick={() => {
            if (buyRestDay()) {
              onBought?.();
              onClose();
            }
          }}
        >
          {st.canBuy ? '兑换放假' : st.reason}
        </button>
      </div>
    </Modal>
  );
}
