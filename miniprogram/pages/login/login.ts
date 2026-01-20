import { wxLogin } from '../../services/auth';

const app = getApp<IAppOption>();

Page({
  data: {
    loading: false,
  },

  onLoad() {
    // 检查是否已登录
    const token = wx.getStorageSync('token');
    if (token) {
      this.navigateAfterLogin();
    }
  },

  /**
   * 登录后导航逻辑
   */
  navigateAfterLogin() {
    const userInfo = wx.getStorageSync('userInfo');
    // 如果没有昵称，跳转到资料设置页
    if (!userInfo?.nickname) {
      wx.redirectTo({ url: '/pages/profile-setup/profile-setup' });
    } else {
      wx.redirectTo({ url: '/pages/index/index' });
    }
  },

  /**
   * 处理登录
   */
  async handleLogin() {
    if (this.data.loading) return;

    this.setData({ loading: true });

    try {
      // 执行微信登录
      const result = await wxLogin();

      // 保存登录信息
      app.setLoginInfo(result.token, result.user);

      wx.showToast({
        title: '登录成功',
        icon: 'success',
      });

      // 根据用户资料完整性跳转
      setTimeout(() => {
        this.navigateAfterLogin();
      }, 500);
    } catch (error: any) {
      console.error('登录失败:', error);
      wx.showToast({
        title: error.message || '登录失败',
        icon: 'none',
      });
    } finally {
      this.setData({ loading: false });
    }
  },
});
