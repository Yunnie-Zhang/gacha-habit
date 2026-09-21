import type { AuthAccount } from '../lib/auth';

/**
 * 头像内容：已上传头像显示图片，否则显示昵称首字
 * （渐变底、描边等外壳样式由外层 .t-avatar / .login-avatar 容器提供）。
 */
export function AvatarFace({ account }: { account: AuthAccount | null }) {
  if (account?.avatar) return <img className="avatar-img" src={account.avatar} alt="" />;
  return <>{account?.name.slice(0, 1) ?? '?'}</>;
}
