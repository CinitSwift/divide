/**
 * 类型定义
 */

// 用户信息
interface UserInfo {
  id: string;
  nickname: string;
  avatarUrl: string;
}

// 房间信息
interface RoomInfo {
  id: string;
  roomCode: string;
  gameName: string;
  status: 'waiting' | 'divided' | 'closed';
  maxMembers: number;
  ownerId: string;
  owner: UserInfo;
  members: RoomMember[];
  memberCount: number;
  createdAt: string;
}

// 房间成员
interface RoomMember {
  id: string;
  nickname: string;
  avatarUrl: string;
  team: 'none' | 'team_a' | 'team_b';
  joinedAt: string;
}

// 分边结果
interface DivisionResult {
  teamA: UserInfo[];
  teamB: UserInfo[];
}

// API 响应
interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}
