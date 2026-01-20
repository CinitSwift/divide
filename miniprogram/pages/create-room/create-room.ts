import { createRoom } from '../../services/room';

Page({
  data: {
    gameName: '',
    maxMembers: 10,
    loading: false,
  },

  /**
   * 输入游戏名称
   */
  onGameNameInput(e: any) {
    this.setData({ gameName: e.detail.value });
  },

  /**
   * 减少最大人数
   */
  decreaseMax() {
    const { maxMembers } = this.data;
    if (maxMembers > 2) {
      this.setData({ maxMembers: maxMembers - 1 });
    }
  },

  /**
   * 增加最大人数
   */
  increaseMax() {
    const { maxMembers } = this.data;
    if (maxMembers < 100) {
      this.setData({ maxMembers: maxMembers + 1 });
    }
  },

  /**
   * 创建房间
   */
  async handleCreate() {
    const { gameName, maxMembers, loading } = this.data;

    if (loading) return;

    if (!gameName.trim()) {
      wx.showToast({
        title: '请输入游戏名称',
        icon: 'none',
      });
      return;
    }

    this.setData({ loading: true });

    try {
      const room = await createRoom(gameName.trim(), maxMembers);

      wx.showToast({
        title: '创建成功',
        icon: 'success',
      });

      // 跳转到房间页面
      setTimeout(() => {
        wx.redirectTo({
          url: `/pages/room/room?roomCode=${room.roomCode}`,
        });
      }, 500);
    } catch (error: any) {
      wx.showToast({
        title: error.message || '创建失败',
        icon: 'none',
      });
    } finally {
      this.setData({ loading: false });
    }
  },
});
