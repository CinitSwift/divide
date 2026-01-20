import { updateProfile } from '../../services/auth';

const app = getApp<IAppOption>();

Page({
  data: {
    loading: false,
    avatarUrl: '',
    nickname: '',
    canSave: false,
  },

  onLoad() {
    // 加载已有的用户信息
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      this.setData({
        avatarUrl: userInfo.avatarUrl || '',
        nickname: userInfo.nickname || '',
      });
      this.checkCanSave();
    }
  },

  /**
   * 检查是否可以保存
   */
  checkCanSave() {
    const { avatarUrl, nickname } = this.data;
    this.setData({
      canSave: !!(avatarUrl && nickname.trim()),
    });
  },

  /**
   * 选择头像回调
   */
  onChooseAvatar(e: WechatMiniprogram.CustomEvent) {
    const { avatarUrl } = e.detail;
    this.setData({ avatarUrl });
    this.checkCanSave();
  },

  /**
   * 昵称输入
   */
  onNicknameInput(e: WechatMiniprogram.Input) {
    this.setData({ nickname: e.detail.value });
    this.checkCanSave();
  },

  /**
   * 保存资料
   */
  async handleSave() {
    if (this.data.loading || !this.data.canSave) return;

    const { nickname, avatarUrl } = this.data;

    this.setData({ loading: true });

    try {
      // 调用接口更新用户资料
      const updatedUser = await updateProfile({
        nickname: nickname.trim(),
        avatarUrl,
      });

      // 更新本地存储的用户信息
      const currentUserInfo = wx.getStorageSync('userInfo') || {};
      const newUserInfo = {
        ...currentUserInfo,
        nickname: updatedUser.nickname,
        avatarUrl: updatedUser.avatarUrl,
      };
      wx.setStorageSync('userInfo', newUserInfo);

      wx.showToast({
        title: '保存成功',
        icon: 'success',
      });

      // 跳转到首页
      setTimeout(() => {
        wx.redirectTo({ url: '/pages/index/index' });
      }, 500);
    } catch (error: any) {
      console.error('保存失败:', error);
      wx.showToast({
        title: error.message || '保存失败',
        icon: 'none',
      });
    } finally {
      this.setData({ loading: false });
    }
  },
});
