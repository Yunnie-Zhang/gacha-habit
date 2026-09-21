import { useRef, useState, type FormEvent } from 'react';
import { useAuth } from '../lib/auth';
import { Icon } from '../components/Icon';

type Mode = 'login' | 'register';

/** 登录头像迎宾飞行参数：起飞圆心/直径 + 中央展示的问候语 */
interface FlySpec {
  cx: number;
  cy: number;
  size: number;
  hello: string;
}

/**
 * 全屏登录页：本地演示账号体系，接口对齐未来 CloudBase（注册成功即登录）。
 * 头像预览随用户名输入实时变化；登录成功时把头像交给 App 飞向页头头像位。
 */
export function LoginView({
  toast,
  onAvatarFly,
}: {
  toast: (m: string) => void;
  onAvatarFly?: (spec: FlySpec) => void;
}) {
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);

  const switchMode = (m: Mode) => {
    setMode(m);
    setErr('');
  };

  /** 起飞点在提交时采集：await 之后本组件可能已被换仓卸载，ref 会失效 */
  const captureAvatar = () => {
    const r = avatarRef.current?.getBoundingClientRect();
    return r && r.width > 0 ? { cx: r.left + r.width / 2, cy: r.top + r.height / 2, size: r.width } : null;
  };

  /** 上报起飞坐标与问候语给 App 编排迎宾飞行；偏好减弱动效时直接省略 */
  const flyHome = (rect: { cx: number; cy: number; size: number } | null, hello: string, migrated: boolean) => {
    if (migrated) toast('已带入本机原有数据');
    if (!rect || !onAvatarFly || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    onAvatarFly({ ...rect, hello });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setErr('');
    setBusy(true);
    const rect = captureAvatar();
    try {
      if (mode === 'register') {
        const { migrated } = await useAuth.getState().register(name, pass);
        flyHome(rect, `欢迎，${name.trim()}`, migrated);
      } else {
        const account = await useAuth.getState().login(name, pass);
        flyHome(rect, `${account.name}，欢迎回来`, false);
      }
      // 成功后不恢复 busy：currentId 变化会让本组件卸载
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : '出错了，改个姿势重试');
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-avatar" ref={avatarRef}>
            {name.trim().slice(0, 1) || <Icon name="cap" size={26} />}
          </div>
        </div>

        <div className="login-tabs" role="tablist">
          <button type="button" className={mode === 'login' ? 'sel' : ''} onClick={() => switchMode('login')}>
            登录
          </button>
          <button type="button" className={mode === 'register' ? 'sel' : ''} onClick={() => switchMode('register')}>
            注册
          </button>
        </div>

        <form onSubmit={submit}>
          <input
            className="login-input"
            placeholder="用户名"
            value={name}
            maxLength={12}
            autoFocus
            autoComplete="username"
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="login-input"
            type="password"
            placeholder="密码（至少 4 位）"
            value={pass}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            onChange={(e) => setPass(e.target.value)}
          />
          {err && <p className="login-err">{err}</p>}
          <button className="btn primary login-btn" disabled={busy || !name.trim() || !pass}>
            {busy ? '请稍候…' : mode === 'login' ? '登录' : '注册并进入'}
          </button>
        </form>
      </div>
    </div>
  );
}
