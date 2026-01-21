/**
 * 房间服务
 */
import { get, post, del, request } from '../utils/request';

// 标签规则类型
export type LabelRule = 'none' | 'even' | 'same_team';

// 标签规则配置
export interface LabelRulesConfig {
  god?: LabelRule;
  sister?: LabelRule;
  male?: LabelRule;
  boss?: LabelRule;
}

// 成员标签类型
export const MemberLabels = {
  god: '幻神',
  sister: '妹妹',
  male: '男生',
  boss: '老板',
} as const;

// 标签规则选项
export const LabelRuleOptions = {
  none: '无规则',
  even: '平均分到每一队',
  same_team: '全部在一边',
} as const;

// 房间成员
export interface RoomMember {
  id: string;
  nickname: string;
  avatarUrl: string;
  team: 'none' | 'team_a' | 'team_b';
  labels: string[];
  joinedAt: string;
}

// 房间信息
export interface Room {
  id: string;
  roomCode: string;
  gameName: string;
  status: 'waiting' | 'divided' | 'closed';
  maxMembers: number;
  ownerId: string;
  labelRules: LabelRulesConfig;
  owner: {
    id: string;
    nickname: string;
    avatarUrl: string;
  };
  members: RoomMember[];
  memberCount: number;
  createdAt: string;
}

// 分边结果
export interface DivisionResult {
  teamA: {
    id: string;
    nickname: string;
    avatarUrl: string;
  }[];
  teamB: {
    id: string;
    nickname: string;
    avatarUrl: string;
  }[];
}

/**
 * 创建房间
 */
export async function createRoom(gameName: string, maxMembers = 10): Promise<Room> {
  return post<Room>('/room/create', { gameName, maxMembers });
}

/**
 * 获取房间详情
 */
export async function getRoomDetail(roomCode: string): Promise<Room> {
  return get<Room>(`/room/${roomCode}`);
}

/**
 * 获取房间详情（静默模式，用于轮询，不显示 loading）
 */
export async function getRoomDetailSilent(roomCode: string): Promise<Room> {
  return request<Room>({
    url: `/room/${roomCode}`,
    method: 'GET',
    showLoading: false,
    showError: false,
  });
}

/**
 * 加入房间
 */
export async function joinRoom(roomCode: string): Promise<Room> {
  return post<Room>(`/room/${roomCode}/join`);
}

/**
 * 离开房间
 */
export async function leaveRoom(roomCode: string): Promise<void> {
  return post(`/room/${roomCode}/leave`);
}

/**
 * 房主移除成员
 */
export async function removeMember(roomCode: string, memberId: string): Promise<void> {
  return post(`/room/${roomCode}/remove/${memberId}`);
}

/**
 * 关闭房间
 */
export async function closeRoom(roomCode: string): Promise<void> {
  return del(`/room/${roomCode}`);
}

/**
 * 获取我创建的房间
 */
export async function getMyRoom(): Promise<Room | null> {
  return get<Room | null>('/room/my-room');
}

/**
 * 获取我加入的房间（非自己创建）
 */
export async function getMyJoinedRoom(): Promise<Room | null> {
  return get<Room | null>('/room/my-joined-room');
}

/**
 * 开始分边
 */
export async function divideTeams(roomCode: string): Promise<DivisionResult> {
  return post<DivisionResult>(`/room/${roomCode}/divide`);
}

/**
 * 重新分边
 */
export async function redivideTeams(roomCode: string): Promise<DivisionResult> {
  return post<DivisionResult>(`/room/${roomCode}/redivide`);
}

/**
 * 获取分边结果
 */
export async function getDivisionResult(roomCode: string): Promise<DivisionResult> {
  return get<DivisionResult>(`/room/${roomCode}/result`);
}

/**
 * 设置成员标签
 */
export async function setMemberLabels(
  roomCode: string,
  memberId: string,
  labels: string[],
): Promise<void> {
  return post(`/room/${roomCode}/member/${memberId}/labels`, { labels });
}

/**
 * 设置标签规则
 */
export async function setLabelRules(
  roomCode: string,
  labelRules: LabelRulesConfig,
): Promise<void> {
  return post(`/room/${roomCode}/label-rules`, { labelRules });
}
