import {
  getRoomDetail,
  joinRoom,
  leaveRoom,
  closeRoom,
  divideTeams,
  redivideTeams,
  removeMember,
  setMemberLabels,
  setLabelRules,
  Room,
  MemberLabels,
  LabelRuleOptions,
  LabelRulesConfig,
} from '../../services/room';
import { pusherClient } from '../../utils/pusher';

const app = getApp<IAppOption>();

// 标签键列表
const labelKeys = Object.keys(MemberLabels) as (keyof typeof MemberLabels)[];

Page({
  data: {
    room: {} as Room,
    roomCode: '',
    isOwner: false,
    isMember: false,
    emptySlots: [] as number[],
    loading: false,
    // 标签相关
    showLabelModal: false,
    showRuleModal: false,
    currentEditMember: null as any,
    memberLabels: [] as string[],
    labelOptions: Object.entries(MemberLabels).map(([key, value]) => ({
      key,
      name: value,
      checked: false,
    })),
    ruleOptions: Object.entries(LabelRuleOptions).map(([key, value]) => ({
      key,
      name: value,
    })),
    labelRules: {} as LabelRulesConfig,
    // 查看所有标签弹窗
    showAllLabelsModal: false,
    viewLabelsMember: null as any,
  },

  // Pusher 频道引用
  _pusherChannel: null as any,

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
    await this.loadRoomDetail(roomCode);
    this.subscribePusher(roomCode);
  },

  /**
   * 页面卸载
   */
  onUnload() {
    this.unsubscribePusher();
  },

  /**
   * 页面隐藏
   */
  onHide() {
    // 页面隐藏时不断开连接，保持实时更新
  },

  /**
   * 页面显示
   */
  onShow() {
    const { roomCode } = this.data;
    if (roomCode && !this._pusherChannel) {
      this.subscribePusher(roomCode);
    }
  },

  /**
   * 加载房间详情
   */
  async loadRoomDetail(roomCode: string) {
    try {
      const room = await getRoomDetail(roomCode);
      this.updateRoomData(room);

      // 如果已分边，跳转到结果页
      if (room.status === 'divided') {
        this.unsubscribePusher();
        wx.navigateTo({
          url: `/pages/result/result?roomCode=${roomCode}`,
        });
      }

      // 如果房间已关闭，返回首页
      if (room.status === 'closed') {
        this.unsubscribePusher();
        wx.showToast({ title: '房间已关闭', icon: 'none' });
        setTimeout(() => {
          wx.reLaunch({ url: '/pages/index/index' });
        }, 1000);
      }
    } catch (error: any) {
      wx.showToast({ title: error.message || '加载失败', icon: 'none' });
      setTimeout(() => {
        wx.reLaunch({ url: '/pages/index/index' });
      }, 1000);
    }
  },

  /**
   * 更新房间数据
   */
  updateRoomData(room: Room) {
    const userInfo = wx.getStorageSync('userInfo');
    const isOwner = room.ownerId === userInfo?.id;

    // 检查当前用户是否是房间成员
    const isMember = room.members?.some((m) => m.id === userInfo?.id) || false;

    // 计算空位
    const emptyCount = Math.min(room.maxMembers - room.memberCount, 8);
    const emptySlots = new Array(emptyCount).fill(0).map((_, i) => i);

    this.setData({ room, isOwner, isMember, emptySlots });
  },

  /**
   * 订阅 Pusher 频道
   */
  subscribePusher(roomCode: string) {
    // 连接 Pusher
    pusherClient.connect();

    // 订阅房间频道
    const channelName = `room-${roomCode}`;
    this._pusherChannel = pusherClient.subscribe(channelName);

    // 监听成员加入事件
    this._pusherChannel.bind('member-joined', (data: { room: Room }) => {
      console.log('[Pusher] Member joined:', data);
      this.updateRoomData(data.room);
    });

    // 监听成员离开事件
    this._pusherChannel.bind('member-left', (data: { room: Room }) => {
      console.log('[Pusher] Member left:', data);
      this.updateRoomData(data.room);
    });

    // 监听房间关闭事件
    this._pusherChannel.bind('room-closed', () => {
      console.log('[Pusher] Room closed');
      this.unsubscribePusher();
      wx.showToast({ title: '房间已关闭', icon: 'none' });
      setTimeout(() => {
        wx.reLaunch({ url: '/pages/index/index' });
      }, 1000);
    });

    // 监听分边完成事件
    this._pusherChannel.bind('teams-divided', (data: { room: Room; result: any }) => {
      console.log('[Pusher] Teams divided:', data);
      this.unsubscribePusher();
      wx.navigateTo({
        url: `/pages/result/result?roomCode=${roomCode}`,
      });
    });
  },

  /**
   * 取消订阅 Pusher 频道
   */
  unsubscribePusher() {
    const { roomCode } = this.data;
    if (roomCode) {
      pusherClient.unsubscribe(`room-${roomCode}`);
    }
    this._pusherChannel = null;
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
   * 加入房间
   */
  async handleJoinRoom() {
    const { roomCode, loading } = this.data;
    if (loading) return;

    this.setData({ loading: true });
    try {
      const room = await joinRoom(roomCode);
      this.updateRoomData(room);
      wx.showToast({ title: '加入成功', icon: 'success' });
    } catch (error: any) {
      wx.showToast({
        title: error.message || '加入失败',
        icon: 'none',
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 点击成员头像打开标签设置（仅房主）
   */
  onMemberTap(e: any) {
    const { isOwner, room } = this.data;
    if (!isOwner) return;

    const memberId = e.currentTarget.dataset.id;
    const member = room.members.find((m) => m.id === memberId);
    if (!member) return;

    // 获取成员当前标签
    const currentLabels = member.labels || [];

    // 更新标签选项的选中状态
    const labelOptions = this.data.labelOptions.map((opt) => ({
      ...opt,
      checked: currentLabels.includes(opt.key),
    }));

    this.setData({
      showLabelModal: true,
      currentEditMember: member,
      memberLabels: [...currentLabels],
      labelOptions,
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

            // 取消订阅
            this.unsubscribePusher();

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
            this.unsubscribePusher();
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
            this.unsubscribePusher();
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
   * 长按成员头像弹出删除确认（仅房主）
   */
  onMemberLongPress(e: any) {
    const { isOwner, room, loading } = this.data;
    if (!isOwner) return;

    const memberId = e.currentTarget.dataset.id;
    // 不能删除自己（房主）
    if (memberId === room.ownerId) return;

    const member = room.members.find((m) => m.id === memberId);
    if (!member) return;

    const memberName = member.nickname || '该成员';

    wx.showModal({
      title: '确认移除',
      content: `确定要将 ${memberName} 移出房间吗？`,
      confirmColor: '#ff4d4f',
      success: async (res) => {
        if (res.confirm) {
          this.setData({ loading: true });
          try {
            await removeMember(room.roomCode, memberId);
            wx.showToast({ title: '已移除', icon: 'success' });
          } catch (error: any) {
            wx.showToast({
              title: error.message || '移除失败',
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
   * 标签选中状态变化
   */
  onLabelChange(e: any) {
    const key = e.currentTarget.dataset.key;
    const { labelOptions, memberLabels } = this.data;

    const newLabels = [...memberLabels];
    const index = newLabels.indexOf(key);
    if (index > -1) {
      newLabels.splice(index, 1);
    } else {
      newLabels.push(key);
    }

    const newOptions = labelOptions.map((opt) => ({
      ...opt,
      checked: newLabels.includes(opt.key),
    }));

    this.setData({
      memberLabels: newLabels,
      labelOptions: newOptions,
    });
  },

  /**
   * 关闭标签设置弹窗
   */
  closeLabelModal() {
    this.setData({
      showLabelModal: false,
      currentEditMember: null,
      memberLabels: [],
    });
  },

  /**
   * 保存成员标签
   */
  async saveMemberLabels() {
    const { room, currentEditMember, memberLabels, loading } = this.data;
    if (loading || !currentEditMember) return;

    this.setData({ loading: true });
    try {
      await setMemberLabels(room.roomCode, currentEditMember.id, memberLabels);
      wx.showToast({ title: '标签已保存', icon: 'success' });
      this.closeLabelModal();
    } catch (error: any) {
      wx.showToast({
        title: error.message || '保存失败',
        icon: 'none',
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 打开标签规则设置弹窗
   */
  openRuleModal() {
    const { room } = this.data;
    this.setData({
      showRuleModal: true,
      labelRules: { ...room.labelRules } || {},
    });
  },

  /**
   * 关闭标签规则设置弹窗
   */
  closeRuleModal() {
    this.setData({
      showRuleModal: false,
    });
  },

  /**
   * 规则选择变化
   */
  onRuleChange(e: any) {
    const labelKey = e.currentTarget.dataset.label;
    const ruleIndex = parseInt(e.detail.value);
    const { ruleOptions, labelRules } = this.data;

    // 获取对应的规则 key
    const ruleKey = ruleOptions[ruleIndex]?.key || 'none';

    this.setData({
      labelRules: {
        ...labelRules,
        [labelKey]: ruleKey,
      },
    });
  },

  /**
   * 保存标签规则
   */
  async saveLabelRules() {
    const { room, labelRules, loading } = this.data;
    if (loading) return;

    this.setData({ loading: true });
    try {
      await setLabelRules(room.roomCode, labelRules);
      wx.showToast({ title: '规则已保存', icon: 'success' });
      this.closeRuleModal();
    } catch (error: any) {
      wx.showToast({
        title: error.message || '保存失败',
        icon: 'none',
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 点击标签查看成员所有标签
   */
  onLabelsTap(e: any) {
    // 阻止事件冒泡到父元素的 onMemberTap
    const member = e.currentTarget.dataset.member;
    if (!member || !member.labels || member.labels.length === 0) return;

    this.setData({
      showAllLabelsModal: true,
      viewLabelsMember: member,
    });
  },

  /**
   * 关闭查看所有标签弹窗
   */
  closeAllLabelsModal() {
    this.setData({
      showAllLabelsModal: false,
      viewLabelsMember: null,
    });
  },

  /**
   * 阻止事件冒泡（空方法）
   */
  preventBubble() {
    // 空方法，仅用于阻止事件冒泡
  },

  /**
   * 下拉刷新
   */
  async onPullDownRefresh() {
    await this.loadRoomDetail(this.data.room.roomCode);
    wx.stopPullDownRefresh();
  },
});
