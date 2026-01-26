import { updateProfile } from '../../services/auth';
import { compressAndConvertToBase64 } from '../../utils/image';

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
  async onChooseAvatar(e: WechatMiniprogram.CustomEvent) {
    const { avatarUrl } = e.detail;

    // 显示加载提示
    wx.showLoading({ title: '处理中...' });

    try {
      // 压缩图片并转为 base64
      const base64Avatar = await compressAndConvertToBase64(avatarUrl, 60);
      this.setData({ avatarUrl: base64Avatar });
      this.checkCanSave();
    } catch (error) {
      console.error('头像处理失败:', error);
      // 处理失败时使用原图
      this.setData({ avatarUrl });
      this.checkCanSave();
      wx.showToast({ title: '头像处理失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
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

      // 返回上一页（如果有上一页），否则跳转到首页
      setTimeout(() => {
        const pages = getCurrentPages();
        if (pages.length > 1) {
          wx.navigateBack();
        } else {
          wx.redirectTo({ url: '/pages/index/index' });
        }
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
