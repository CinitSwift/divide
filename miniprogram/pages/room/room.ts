import {
  getRoomDetail,
  leaveRoom,
  closeRoom,
  divideTeams,
  redivideTeams,
  Room,
} from '../../services/room';
import { socketClient } from '../../utils/socket';

const app = getApp<IAppOption>();

Page({
  data: {
    room: {} as Room,
    isOwner: false,
    emptySlots: [] as number[],
    loading: false,
    refreshTimer: null as number | null,
  },

  /**
   * 页面加载
   */
  async onLoad(options) {
    const roomCode = options.roomCode;
    if (!roomCode) {
      wx.showToast({ title: '房间号无效', icon: 'none' });
      wx.navigateBack();
      return;
    }

    await this.loadRoomDetail(roomCode);
    this.connectWebSocket(roomCode);
  },

  /**
   * 页面卸载
   */
  onUnload() {
    socketClient.close();
    if (this.data.refreshTimer) {
      clearInterval(this.data.refreshTimer);
    }
  },

  /**
   * 加载房间详情
   */
  async loadRoomDetail(roomCode: string) {
    try {
      const room = await getRoomDetail(roomCode);
      const userInfo = wx.getStorageSync('userInfo');
      const isOwner = room.ownerId === userInfo?.id;

      // 计算空位
      const emptyCount = Math.min(room.maxMembers - room.memberCount, 8);
      const emptySlots = new Array(emptyCount).fill(0).map((_, i) => i);

      this.setData({ room, isOwner, emptySlots });

      // 如果已分边，跳转到结果页
      if (room.status === 'divided') {
        wx.navigateTo({
          url: `/pages/result/result?roomCode=${roomCode}`,
        });
      }
    } catch (error: any) {
      wx.showToast({ title: error.message || '加载失败', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1000);
    }
  },

  /**
   * 连接 WebSocket
   */
  connectWebSocket(roomCode: string) {
    const userInfo = wx.getStorageSync('userInfo');

    // 监听成员加入
    socketClient.on('room:member_joined', (data) => {
      console.log('新成员加入:', data);
      this.loadRoomDetail(roomCode);
    });

    // 监听成员离开
    socketClient.on('room:member_left', (data) => {
      console.log('成员离开:', data);
      this.loadRoomDetail(roomCode);
    });

    // 监听分边结果
    socketClient.on('room:divided', (data) => {
      console.log('分边完成:', data);
      wx.navigateTo({
        url: `/pages/result/result?roomCode=${roomCode}`,
      });
    });

    // 监听房间关闭
    socketClient.on('room:closed', () => {
      wx.showToast({ title: '房间已关闭', icon: 'none' });
      setTimeout(() => {
        wx.navigateBack();
      }, 1000);
    });

    // 连接并加入房间
    socketClient.connect(roomCode).then(() => {
      socketClient.send('room:join', {
        roomCode,
        userId: userInfo.id,
        nickname: userInfo.nickname,
        avatarUrl: userInfo.avatarUrl,
      });
    });

    // 备用：定时刷新（WebSocket 可能不稳定）
    const timer = setInterval(() => {
      this.loadRoomDetail(roomCode);
    }, 5000);
    this.setData({ refreshTimer: timer as unknown as number });
  },

  /**
   * 复制房间号
   */
  copyRoomCode() {
    wx.setClipboardData({
      data: this.data.room.roomCode,
      success: () => {
        wx.showToast({ title: '已复制房间号', icon: 'success' });
      },
    });
  },

  /**
   * 开始/重新分边
   */
  async handleDivide() {
    const { room, loading } = this.data;
    if (loading) return;

    if (room.memberCount < 2) {
      wx.showToast({ title: '至少需要2人', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '确认分边',
      content: `当前共 ${room.memberCount} 人，将随机分为两队，是否继续？`,
      confirmText: '开始分边',
      success: async (res) => {
        if (res.confirm) {
          this.setData({ loading: true });
          try {
            const isRedivide = room.status === 'divided';
            const result = isRedivide
              ? await redivideTeams(room.roomCode)
              : await divideTeams(room.roomCode);

            // 跳转到结果页
            wx.navigateTo({
              url: `/pages/result/result?roomCode=${room.roomCode}`,
            });
          } catch (error: any) {
            wx.showToast({
              title: error.message || '分边失败',
              icon: 'none',
            });
          } finally {
            this.setData({ loading: false });
          }
        }
      },
    });
  },

  /**
   * 离开房间
   */
  handleLeaveRoom() {
    wx.showModal({
      title: '确认离开',
      content: '确定要离开房间吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await leaveRoom(this.data.room.roomCode);
            socketClient.send('room:leave', {
              roomCode: this.data.room.roomCode,
              userId: wx.getStorageSync('userInfo').id,
            });
            wx.navigateBack();
          } catch (error: any) {
            wx.showToast({
              title: error.message || '操作失败',
              icon: 'none',
            });
          }
        }
      },
    });
  },

  /**
   * 关闭房间
   */
  handleCloseRoom() {
    wx.showModal({
      title: '确认关闭',
      content: '关闭房间后，所有成员将被移出，是否继续？',
      confirmColor: '#ff4d4f',
      success: async (res) => {
        if (res.confirm) {
          try {
            await closeRoom(this.data.room.roomCode);
            wx.showToast({ title: '房间已关闭', icon: 'success' });
            setTimeout(() => wx.navigateBack(), 500);
          } catch (error: any) {
            wx.showToast({
              title: error.message || '操作失败',
              icon: 'none',
            });
          }
        }
      },
    });
  },

  /**
   * 分享给好友
   */
  onShareAppMessage() {
    const { room } = this.data;
    return {
      title: `快来加入【${room.gameName}】的分队房间！`,
      path: `/pages/room/room?roomCode=${room.roomCode}`,
    };
  },

  /**
   * 下拉刷新
   */
  async onPullDownRefresh() {
    await this.loadRoomDetail(this.data.room.roomCode);
    wx.stopPullDownRefresh();
  },
});
