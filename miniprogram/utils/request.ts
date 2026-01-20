/**
 * API 基础配置
 */

// 根据环境切换 API 地址
const isDev = true; // 开发环境

export const BASE_URL = isDev
  ? 'http://localhost:3000/api'  // 开发环境
  : 'https://your-domain.com/api'; // 生产环境

export const WS_URL = isDev
  ? 'ws://localhost:3000/room'
  : 'wss://your-domain.com/room';

/**
 * 封装请求方法
 */
interface RequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: any;
  header?: Record<string, string>;
  showLoading?: boolean;
  showError?: boolean;
}

interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

export async function request<T = any>(options: RequestOptions): Promise<T> {
  const {
    url,
    method = 'GET',
    data,
    header = {},
    showLoading = true,
    showError = true,
  } = options;

  // 获取 token
  const token = wx.getStorageSync('token');
  if (token) {
    header['Authorization'] = `Bearer ${token}`;
  }

  if (showLoading) {
    wx.showLoading({ title: '加载中...', mask: true });
  }

  try {
    const res = await new Promise<WechatMiniprogram.RequestSuccessCallbackResult>(
      (resolve, reject) => {
        wx.request({
          url: `${BASE_URL}${url}`,
          method,
          data,
          header: {
            'Content-Type': 'application/json',
            ...header,
          },
          success: resolve,
          fail: reject,
        });
      }
    );

    if (showLoading) {
      wx.hideLoading();
    }

    const result = res.data as ApiResponse<T>;

    // 成功响应
    if (result.code === 0) {
      return result.data;
    }

    // Token 过期
    if (res.statusCode === 401) {
      wx.removeStorageSync('token');
      wx.removeStorageSync('userInfo');
      wx.redirectTo({ url: '/pages/login/login' });
      throw new Error('登录已过期，请重新登录');
    }

    // 业务错误
    if (showError) {
      wx.showToast({
        title: result.message || '请求失败',
        icon: 'none',
      });
    }
    throw new Error(result.message || '请求失败');
  } catch (error: any) {
    if (showLoading) {
      wx.hideLoading();
    }

    if (showError && error.message) {
      wx.showToast({
        title: error.message || '网络错误',
        icon: 'none',
      });
    }
    throw error;
  }
}

// 便捷方法
export const get = <T = any>(url: string, data?: any) =>
  request<T>({ url, method: 'GET', data });

export const post = <T = any>(url: string, data?: any) =>
  request<T>({ url, method: 'POST', data });

export const put = <T = any>(url: string, data?: any) =>
  request<T>({ url, method: 'PUT', data });

export const del = <T = any>(url: string, data?: any) =>
  request<T>({ url, method: 'DELETE', data });
