import { useRef, useState, type ReactNode } from 'react';
import { useStore } from '../store';
import type { SettleItem } from '../store';
import { useAuth, useCurrentAccount } from '../lib/auth';
import { resizeAvatar } from '../lib/avatar';
import { fmt, todayStr, weekdayCN } from '../lib/date';
import { AvatarFace } from './Avatar';
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

/** 账号与设置（点头像打开）：改名、改密码、退出登录 */
export function AccountModal({
  onClose,
  onLogout,
  onEditAvatar,
  toast,
}: {
  onClose: () => void;
  onLogout: () => void;
  onEditAvatar: () => void;
  toast: (m: string) => void;
}) {
  const account = useCurrentAccount();
  const [editing, setEditing] = useState<'name' | 'pass' | null>(null);
  const [nameVal, setNameVal] = useState('');
  const [curPass, setCurPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  if (!account) return null;
  const startEdit = (what: 'name' | 'pass') => {
    setEditing(what);
    setErr('');
    if (what === 'name') setNameVal(account.name);
    else {
      setCurPass('');
      setNewPass('');
    }
  };

  const saveName = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await useAuth.getState().rename(nameVal);
      toast(`已改名为「${nameVal.trim()}」`);
      setEditing(null);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : '出错了，请重试');
    }
    setBusy(false);
  };

  const savePass = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await useAuth.getState().changePassword(curPass, newPass);
      toast('密码已更新');
      setEditing(null);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : '出错了，请重试');
    }
    setBusy(false);
  };

  return (
    <Modal maxW={340} onClose={onClose}>
      <h3>账号与设置</h3>
      <div className="acct-row">
        <div
          className="t-avatar acct-avatar av-click"
          onClick={onEditAvatar}
          title="点开大图 / 修改头像"
          role="button"
        >
          <AvatarFace account={account} />
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{account.name}</div>
          <div style={{ fontSize: 12, color: 'var(--sub)', marginTop: 3 }}>注册于 {account.createdAt}</div>
        </div>
      </div>

      {editing === 'name' ? (
        <div className="acct-edit">
          <input
            className="login-input"
            value={nameVal}
            maxLength={12}
            autoFocus
            placeholder="新用户名（2~12 个字符）"
            onChange={(e) => setNameVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                saveName();
              }
            }}
          />
          {err && <p className="login-err">{err}</p>}
          <div className="f-foot">
            <button className="btn" onClick={() => setEditing(null)}>
              取消
            </button>
            <button className="btn primary" disabled={busy || !nameVal.trim()} onClick={saveName}>
              保存
            </button>
          </div>
        </div>
      ) : (
        <div className="acct-item">
          <span className="acct-k">用户名</span>
          <span className="acct-v">{account.name}</span>
          <button className="linkop" onClick={() => startEdit('name')}>
            修改
          </button>
        </div>
      )}

      {editing === 'pass' ? (
        <div className="acct-edit">
          <input
            className="login-input"
            type="password"
            value={curPass}
            autoFocus
            placeholder="当前密码"
            autoComplete="current-password"
            onChange={(e) => setCurPass(e.target.value)}
          />
          <input
            className="login-input"
            type="password"
            value={newPass}
            placeholder="新密码（至少 4 位）"
            autoComplete="new-password"
            onChange={(e) => setNewPass(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                savePass();
              }
            }}
          />
          {err && <p className="login-err">{err}</p>}
          <div className="f-foot">
            <button className="btn" onClick={() => setEditing(null)}>
              取消
            </button>
            <button className="btn primary" disabled={busy || !curPass || !newPass} onClick={savePass}>
              保存
            </button>
          </div>
        </div>
      ) : (
        <div className="acct-item">
          <span className="acct-k">密码</span>
          <span className="acct-v">••••</span>
          <button className="linkop" onClick={() => startEdit('pass')}>
            修改
          </button>
        </div>
      )}

      <div className="f-foot" style={{ marginTop: 16 }}>
        <button className="btn" onClick={onClose}>
          关闭
        </button>
        <button className="btn danger" onClick={onLogout}>
          退出登录
        </button>
      </div>
    </Modal>
  );
}

/** 头像大图查看与修改：上传新图先预览，点「确认应用」才生效；取消/关闭不应用 */
export function AvatarEditorModal({ onClose, toast }: { onClose: () => void; toast: (m: string) => void }) {
  const account = useCurrentAccount();
  const [draft, setDraft] = useState<string | null>(null); // 新头像预览（未应用）
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!account) return null;

  const pick = (file: File) => {
    resizeAvatar(file)
      .then((dataUrl) => setDraft(dataUrl))
      .catch(() => toast('图片读取失败，换一张试试'));
  };

  const apply = async () => {
    if (!draft || busy) return;
    setBusy(true);
    try {
      await useAuth.getState().setAvatar(draft);
      toast('头像已更新');
      onClose();
    } catch (ex) {
      toast(ex instanceof Error ? ex.message : '出错了，请重试');
    }
    setBusy(false);
  };

  return (
    <Modal maxW={360} onClose={onClose}>
      <h3>{draft ? '预览新头像' : '头像'}</h3>
      <div className="av-editor">
        <div className="t-avatar av-big">
          {draft ? <img className="avatar-img" src={draft} alt="" /> : <AvatarFace account={account} />}
        </div>
      </div>
      <p className="av-editor-note">
        {draft ? '满意就点「确认应用」；取消或关闭则保留当前头像。' : '支持 JPG/PNG，会自动裁圆并压缩。'}
      </p>
      <div className="f-foot">
        <button className="btn" onClick={onClose}>
          取消
        </button>
        <button className="btn" onClick={() => fileRef.current?.click()}>
          {draft ? '重新上传' : '修改头像'}
        </button>
        <button className="btn primary" disabled={!draft || busy} onClick={apply}>
          确认应用
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) pick(f);
          e.target.value = '';
        }}
      />
    </Modal>
  );
}
