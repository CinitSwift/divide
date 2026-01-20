/**
 * 认证服务
 */
import { post, get } from '../utils/request';

interface LoginResult {
  token: string;
  user: {
    id: string;
    nickname: string;
    avatarUrl: string;
  };
}

interface UserProfile {
  id: string;
  nickname: string;
  avatarUrl: string;
}

/**
 * 微信登录
 */
export async function wxLogin(nickname?: string, avatarUrl?: string): Promise<LoginResult> {
  // 获取微信 code
  const loginResult = await new Promise<WechatMiniprogram.LoginSuccessCallbackResult>(
    (resolve, reject) => {
      wx.login({
        success: resolve,
        fail: reject,
      });
    }
  );

  // 调用后端登录接口
  return post<LoginResult>('/auth/login', {
    code: loginResult.code,
    nickname,
    avatarUrl,
  });
}

/**
 * 获取用户信息
 */
export async function getProfile(): Promise<UserProfile> {
  return get<UserProfile>('/auth/profile');
}

/**
 * 检查登录状态
 */
export function checkLogin(): boolean {
  const token = wx.getStorageSync('token');
  return !!token;
}

/**
 * 登出
 */
export function logout(): void {
  wx.removeStorageSync('token');
  wx.removeStorageSync('userInfo');
  wx.redirectTo({ url: '/pages/login/login' });
}
