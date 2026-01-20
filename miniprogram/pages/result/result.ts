import {
  getRoomDetail,
  getDivisionResult,
  redivideTeams,
  Room,
} from '../../services/room';

interface TeamMember {
  id: string;
  nickname: string;
  avatarUrl: string;
}

Page({
  data: {
    room: {} as Room,
    teamA: [] as TeamMember[],
    teamB: [] as TeamMember[],
    isOwner: false,
    loading: false,
    roomCode: '',
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

    this.setData({ roomCode });
    await this.loadData(roomCode);
  },

  /**
   * 加载数据
   */
  async loadData(roomCode: string) {
    try {
      // 并行加载房间信息和分边结果
      const [room, result] = await Promise.all([
        getRoomDetail(roomCode),
        getDivisionResult(roomCode),
      ]);

      const userInfo = wx.getStorageSync('userInfo');
      const isOwner = room.ownerId === userInfo?.id;

      this.setData({
        room,
        teamA: result.teamA,
        teamB: result.teamB,
        isOwner,
      });
    } catch (error: any) {
      wx.showToast({ title: error.message || '加载失败', icon: 'none' });
    }
  },

  /**
   * 重新分边
   */
  async handleRedivide() {
    const { roomCode, loading } = this.data;
    if (loading) return;

    wx.showModal({
      title: '确认重新分边',
      content: '将重新随机分配所有成员到两队，是否继续？',
      confirmText: '重新分边',
      success: async (res) => {
        if (res.confirm) {
          this.setData({ loading: true });
          try {
            const result = await redivideTeams(roomCode);
            this.setData({
              teamA: result.teamA,
              teamB: result.teamB,
            });

            wx.showToast({
              title: '分边完成',
              icon: 'success',
            });
          } catch (error: any) {
            wx.showToast({
              title: error.message || '操作失败',
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
   * 返回房间
   */
  goBack() {
    wx.navigateBack();
  },

  /**
   * 分享结果
   */
  onShareAppMessage() {
    const { room, teamA, teamB } = this.data;
    const teamANames = teamA.map((m) => m.nickname).join('、');
    const teamBNames = teamB.map((m) => m.nickname).join('、');

    return {
      title: `【${room.gameName}】分边结果出炉！`,
      path: `/pages/result/result?roomCode=${room.roomCode}`,
    };
  },

  /**
   * 下拉刷新
   */
  async onPullDownRefresh() {
    await this.loadData(this.data.roomCode);
    wx.stopPullDownRefresh();
  },
});
