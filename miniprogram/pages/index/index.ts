import { checkLogin } from '../../services/auth';
import { getMyRoom, getMyJoinedRoom, joinRoom, Room } from '../../services/room';

const app = getApp<IAppOption>();

Page({
  data: {
    userInfo: null as any,
    myRoom: null as Room | null,
    joinedRoom: null as Room | null,
    showJoinModal: false,
    roomCode: '',
  },

  onLoad() {
    // 检查登录状态
    if (!checkLogin()) {
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }

    // 获取用户信息
    const userInfo = wx.getStorageSync('userInfo');
    this.setData({ userInfo });
  },

  onShow() {
    // 每次显示页面时刷新用户信息和房间信息
    const userInfo = wx.getStorageSync('userInfo');
    this.setData({ userInfo });
    this.loadMyRoom();
    this.loadJoinedRoom();
  },

  /**
   * 跳转到修改资料页
   */
  goEditProfile() {
    wx.navigateTo({ url: '/pages/profile-setup/profile-setup' });
  },

  /**
   * 加载我创建的房间
   */
  async loadMyRoom() {
    try {
      const myRoom = await getMyRoom();
      this.setData({ myRoom });
    } catch (error) {
      console.error('加载创建的房间失败:', error);
    }
  },

  /**
   * 加载我加入的房间
   */
  async loadJoinedRoom() {
    try {
      const joinedRoom = await getMyJoinedRoom();
      this.setData({ joinedRoom });
    } catch (error) {
      console.error('加载加入的房间失败:', error);
    }
  },

  /**
   * 跳转到创建房间页
   */
  goCreateRoom() {
    if (this.data.myRoom) {
      wx.showModal({
        title: '提示',
        content: '您已有一个房间，是否先进入该房间？',
        confirmText: '进入房间',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            this.goMyRoom();
          }
        },
      });
      return;
    }
    wx.navigateTo({ url: '/pages/create-room/create-room' });
  },

  /**
   * 进入我的房间
   */
  goMyRoom() {
    if (this.data.myRoom) {
      wx.navigateTo({
        url: `/pages/room/room?roomCode=${this.data.myRoom.roomCode}`,
      });
    }
  },

  /**
   * 进入加入的房间
   */
  goJoinedRoom() {
    if (this.data.joinedRoom) {
      wx.navigateTo({
        url: `/pages/room/room?roomCode=${this.data.joinedRoom.roomCode}`,
      });
    }
  },

  /**
   * 显示加入房间弹窗
   */
  showJoinDialog() {
    this.setData({ showJoinModal: true, roomCode: '' });
  },

  /**
   * 隐藏加入房间弹窗
   */
  hideJoinDialog() {
    this.setData({ showJoinModal: false });
  },

  /**
   * 阻止冒泡关闭弹窗
   */
  preventClose() {},

  /**
   * 输入房间号
   */
  onRoomCodeInput(e: any) {
    this.setData({ roomCode: e.detail.value });
  },

  /**
   * 加入房间
   */
  async handleJoinRoom() {
    const { roomCode } = this.data;

    if (!roomCode || roomCode.length !== 6) {
      wx.showToast({
        title: '请输入6位房间号',
        icon: 'none',
      });
      return;
    }

    try {
      await joinRoom(roomCode);
      this.hideJoinDialog();
      wx.navigateTo({
        url: `/pages/room/room?roomCode=${roomCode}`,
      });
    } catch (error: any) {
      wx.showToast({
        title: error.message || '加入失败',
        icon: 'none',
      });
    }
  },

  /**
   * 下拉刷新
   */
  async onPullDownRefresh() {
    await Promise.all([this.loadMyRoom(), this.loadJoinedRoom()]);
    wx.stopPullDownRefresh();
  },
});
