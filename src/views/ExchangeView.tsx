import { useState } from 'react';
import { useStore } from '../store';
import { RestDayModal } from '../components/modals';
import { Icon } from '../components/Icon';
import {
  REST_MONTHLY_LIMIT,
  restBalance,
  restDaysUsedInMonth,
  restPurchaseState,
} from '../lib/logic';
import { todayStr, weekdayCN } from '../lib/date';
import { playPop } from '../lib/sound';

/** 兑换页（小卖部）：放假一日是第一个商品，后续货架待补 */
export function ExchangeView({ toast }: { toast: (m: string) => void }) {
  const projects = useStore((s) => s.projects);
  const checkins = useStore((s) => s.checkins);
  const restDays = useStore((s) => s.restDays);
  const [open, setOpen] = useState(false);

  const today = todayStr();
  const st = restPurchaseState(projects, checkins, restDays, today);
  const isRestDay = restDays.some((r) => r.ds === today);
  const balance = restBalance(checkins, restDays);
  const avg = st.price !== null ? Math.round(st.price / 4) : null;

  return (
    <section className="view">
      <div className="row-between">
        <h2>兑换</h2>
      </div>

      {/* 商品：放假一日 */}
      <div className="panel ex-card">
        <div className="ex-head">
          <span className="ex-ico">
            <Icon name="ticket" size={20} />
          </span>
          <div className="ex-info">
            <div className="ex-name">放假一日</div>
            <div className="ex-sub">强制免扣分 · 不断签 · 当天封盘</div>
          </div>
          <div className="ex-price">{st.price === null ? '未解锁' : `${st.price} 分`}</div>
        </div>
        <div className="ex-rows">
          <div>
            定价 <b>{avg ?? '—'}</b> × 4 = 近 30 天日均活动量的 4 倍
          </div>
          <div>
            可用余额 <b>{balance}</b> 分 · 本月已放假 {restDaysUsedInMonth(restDays, today)}/{REST_MONTHLY_LIMIT} 天
          </div>
        </div>
        <button
          className="btn primary ex-cta"
          disabled={!st.canBuy || isRestDay}
          onClick={() => setOpen(true)}
        >
          {isRestDay ? '今天已在放假 🏖' : st.canBuy ? '兑换今天放假' : st.reason}
        </button>
      </div>

      {/* 兑换记录 */}
      <div className="panel">
        <h3>兑换记录</h3>
        {[...restDays]
          .sort((a, b) => b.ds.localeCompare(a.ds))
          .map((r) => (
            <div className="day-item" key={`${r.ds}-${r.ts}`}>
              <span className="dico">
                <Icon name="ticket" size={15} />
              </span>
              <span>
                放假一日
                <span className="date-l">
                  {' '}
                  · {r.ds.slice(5).replace('-', '/')} 周{weekdayCN(r.ds)}
                </span>
              </span>
              <span className="st">账本</span>
              <span className="score neg">−{r.cost}</span>
            </div>
          ))}
        {restDays.length === 0 && <div className="zero-note">还没有兑换记录</div>}
      </div>

      {/* 待补货货架 */}
      <div className="panel">
        <h3>更多兑换</h3>
        <div className="zero-note">小卖部补货中，敬请期待 🧰</div>
      </div>

      {open && (
        <RestDayModal
          onClose={() => {
            setOpen(false);
          }}
          onBought={() => {
            playPop();
            toast('兑换成功，今天放假 🏖');
          }}
        />
      )}
    </section>
  );
}

/** 成就页：占位，具体设计待讨论 */
export function AchievementsView() {
  return (
    <section className="view">
      <div className="row-between">
        <h2>成就</h2>
      </div>
      <div className="panel achv-empty">
        <div className="achv-emoji">🏅</div>
        <div className="achv-name">成就墙装修中</div>
        <div className="achv-sub">连续打卡、攒分、坚持都会变成勋章 · 敬请期待</div>
      </div>
    </section>
  );
}
