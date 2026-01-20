/**
 * 游戏分队平台 - 小程序入口
 */
import { checkLogin } from './services/auth';

App<IAppOption>({
  globalData: {
    userInfo: null,
    token: null,
  },

  onLaunch() {
    // 检查登录状态
    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');

    if (token && userInfo) {
      this.globalData.token = token;
      this.globalData.userInfo = userInfo;
    }
  },

  /**
   * 获取 token
   */
  getToken(): string | null {
    return this.globalData.token || wx.getStorageSync('token');
  },

  /**
   * 设置登录信息
   */
  setLoginInfo(token: string, userInfo: any) {
    this.globalData.token = token;
    this.globalData.userInfo = userInfo;
    wx.setStorageSync('token', token);
    wx.setStorageSync('userInfo', userInfo);
  },

  /**
   * 清除登录信息
   */
  clearLoginInfo() {
    this.globalData.token = null;
    this.globalData.userInfo = null;
    wx.removeStorageSync('token');
    wx.removeStorageSync('userInfo');
  },
});
