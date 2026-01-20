/**
 * 房间服务
 */
import { get, post, del } from '../utils/request';

// 房间信息
export interface Room {
  id: string;
  roomCode: string;
  gameName: string;
  status: 'waiting' | 'divided' | 'closed';
  maxMembers: number;
  ownerId: string;
  owner: {
    id: string;
    nickname: string;
    avatarUrl: string;
  };
  members: RoomMember[];
  memberCount: number;
  createdAt: string;
}

// 房间成员
export interface RoomMember {
  id: string;
  nickname: string;
  avatarUrl: string;
  team: 'none' | 'team_a' | 'team_b';
  joinedAt: string;
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
