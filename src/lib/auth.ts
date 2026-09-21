/**
 * 本地假账号体系（演示用）：注册 / 登录 / 退出全流程，接口签名与真实后端一致。
 * 之后接入腾讯云 CloudBase 时只需替换本文件实现——登录改云端鉴权、vaultKey()
 * 改云端数据定位——UI 与数据层（store.ts）无需改动。
 *
 * ⚠️ 密码仅做 base64 混淆存于本机 localStorage（明文级安全）——仅演示用，
 *    真实后端由服务端加盐哈希，前端永不落明文。
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid } from './rng';
import { todayStr } from './date';

export interface AuthAccount {
  id: string;
  name: string;
  /** base64 混淆（演示用，非加密） */
  pass: string;
  /** 注册日期 YYYY-MM-DD */
  createdAt: string;
  /** 自定义头像（256×256 JPEG data URL），缺省为首字渐变头像 */
  avatar?: string;
  /** 已点「不再提示」，不再弹改头像气泡 */
  avatarTipDismissed?: boolean;
}

interface AuthState {
  accounts: AuthAccount[];
  currentId: string | null;
}

interface AuthActions {
  /** 校验失败/重名抛 Error（中文文案直接给 UI 展示）；migrated=接管了旧版全局数据 */
  register: (name: string, pass: string) => Promise<{ migrated: boolean }>;
  login: (name: string, pass: string) => Promise<AuthAccount>;
  logout: () => void;
  /** 改当前账号用户名（2~12 字符、不得与他人重名）；失败抛 Error */
  rename: (name: string) => Promise<void>;
  /** 改当前账号密码（需先验证当前密码）；失败抛 Error */
  changePassword: (currentPass: string, newPass: string) => Promise<void>;
  /** 应用新头像（调用方已压缩成 data URL）；失败抛 Error */
  setAvatar: (dataUrl: string) => Promise<void>;
  /** 不再弹出「修改头像」气泡 */
  dismissAvatarTip: () => void;
}

/** 旧版全局数据 key（分仓前的存量，首个注册的账号自动接管） */
export const LEGACY_DATA_KEY = 'gacha-habit-v1';

const VAULT_PREFIX = 'gacha-habit-vault-';

/** 当前账号的数据仓 key（store 按账号分仓用）；未登录返回 null */
export function vaultKey(): string | null {
  const id = useAuth.getState().currentId;
  return id ? VAULT_PREFIX + id : null;
}

export function useCurrentAccount(): AuthAccount | null {
  return useAuth((s) => s.accounts.find((a) => a.id === s.currentId) ?? null);
}

/** 模拟网络延迟，让假登录的体感与真后端一致 */
const fakeNet = () => new Promise<void>((r) => setTimeout(r, 320));

/** base64 混淆（演示用，非加密） */
const mask = (pass: string) => btoa(String.fromCharCode(...new TextEncoder().encode(pass)));

function validateName(name: string): void {
  if (name.length < 2 || name.length > 12) throw new Error('用户名需要 2~12 个字符');
}

function validatePass(pass: string): void {
  if (pass.length < 4) throw new Error('密码至少 4 位');
}

/** 首个注册账号接管旧版全局数据：原样搬进该账号的仓（保留旧 key 兜底） */
function adoptLegacyData(accountId: string): boolean {
  try {
    const raw = localStorage.getItem(LEGACY_DATA_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { state?: unknown };
    if (typeof parsed !== 'object' || parsed === null || typeof parsed.state !== 'object') return false;
    localStorage.setItem(VAULT_PREFIX + accountId, raw);
    return true;
  } catch {
    return false;
  }
}

export const useAuth = create<AuthState & AuthActions>()(
  persist(
    (set, get) => ({
      accounts: [],
      currentId: null,

      register: async (name, pass) => {
        await fakeNet();
        const trimmed = name.trim();
        validateName(trimmed);
        validatePass(pass);
        if (get().accounts.some((a) => a.name === trimmed)) throw new Error('用户名已存在，换一个试试');
        const isFirst = get().accounts.length === 0;
        const account: AuthAccount = { id: uid(), name: trimmed, pass: mask(pass), createdAt: todayStr() };
        set((s) => ({ accounts: [...s.accounts, account] }));
        // 仓 key 依赖账号 id，先落账号再迁移，最后置会话
        const migrated = isFirst ? adoptLegacyData(account.id) : false;
        set({ currentId: account.id });
        return { migrated };
      },

      login: async (name, pass) => {
        await fakeNet();
        const account = get().accounts.find((a) => a.name === name.trim());
        if (!account) throw new Error('用户名不存在，先注册一个吧');
        if (account.pass !== mask(pass)) throw new Error('密码不对，再想想');
        set({ currentId: account.id });
        return account;
      },

      logout: () => set({ currentId: null }),

      rename: async (name) => {
        await fakeNet();
        const trimmed = name.trim();
        validateName(trimmed);
        const me = get().accounts.find((a) => a.id === get().currentId);
        if (!me) throw new Error('登录状态异常，请重新登录');
        if (get().accounts.some((a) => a.id !== me.id && a.name === trimmed)) throw new Error('用户名已存在，换一个试试');
        set((s) => ({ accounts: s.accounts.map((a) => (a.id === me.id ? { ...a, name: trimmed } : a)) }));
      },

      changePassword: async (currentPass, newPass) => {
        await fakeNet();
        const me = get().accounts.find((a) => a.id === get().currentId);
        if (!me) throw new Error('登录状态异常，请重新登录');
        if (me.pass !== mask(currentPass)) throw new Error('当前密码不对');
        validatePass(newPass);
        if (me.pass === mask(newPass)) throw new Error('新密码不能和当前密码一样');
        set((s) => ({ accounts: s.accounts.map((a) => (a.id === me.id ? { ...a, pass: mask(newPass) } : a)) }));
      },

      setAvatar: async (dataUrl) => {
        await fakeNet();
        if (!dataUrl.startsWith('data:image/') || dataUrl.length > 200_000) {
          throw new Error('这张图片不适合做头像，换一张试试');
        }
        const me = get().accounts.find((a) => a.id === get().currentId);
        if (!me) throw new Error('登录状态异常，请重新登录');
        set((s) => ({ accounts: s.accounts.map((a) => (a.id === me.id ? { ...a, avatar: dataUrl } : a)) }));
      },

      dismissAvatarTip: () => {
        set((s) => ({
          accounts: s.accounts.map((a) => (a.id === s.currentId ? { ...a, avatarTipDismissed: true } : a)),
        }));
      },
    }),
    { name: 'gacha-auth-v1' },
  ),
);
