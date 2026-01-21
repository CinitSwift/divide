import {
  Injectable,
  HttpException,
  HttpStatus,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room, RoomStatus } from './room.entity';
import { RoomMember, Team } from './room-member.entity';
import { CreateRoomDto } from './dto';
import { UserService } from '../user/user.service';
import { PusherService } from '../pusher/pusher.service';

@Injectable()
export class RoomService {
  constructor(
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    @InjectRepository(RoomMember)
    private readonly memberRepository: Repository<RoomMember>,
    private readonly userService: UserService,
    private readonly pusherService: PusherService,
  ) {}

  /**
   * 生成唯一房间号 (6位数字)
   */
  private async generateRoomCode(): Promise<string> {
    const maxAttempts = 10;
    for (let i = 0; i < maxAttempts; i++) {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const exists = await this.roomRepository.findOne({
        where: { roomCode: code },
      });
      if (!exists) {
        return code;
      }
    }
    throw new HttpException('无法生成房间号，请稍后重试', HttpStatus.INTERNAL_SERVER_ERROR);
  }

  /**
   * 创建房间
   */
  async createRoom(userId: string, dto: CreateRoomDto): Promise<Room> {
    // 检查用户是否已有房间
    const existingRoom = await this.roomRepository.findOne({
      where: { ownerId: userId, status: RoomStatus.WAITING },
    });
    if (existingRoom) {
      throw new BadRequestException('您已创建了一个房间，请先关闭后再创建新房间');
    }

    // 生成房间号
    const roomCode = await this.generateRoomCode();

    // 创建房间
    const room = this.roomRepository.create({
      roomCode,
      gameName: dto.gameName,
      ownerId: userId,
      maxMembers: dto.maxMembers || 10,
      status: RoomStatus.WAITING,
    });
    await this.roomRepository.save(room);

    // 房主自动加入房间
    await this.addMember(room.id, userId);

    return this.getRoomByCode(roomCode);
  }

  /**
   * 根据房间号获取房间
   */
  async getRoomByCode(roomCode: string): Promise<Room> {
    const room = await this.roomRepository.findOne({
      where: { roomCode },
      relations: ['owner', 'members', 'members.user'],
    });
    if (!room) {
      throw new NotFoundException('房间不存在');
    }
    return room;
  }

  /**
   * 根据房间ID获取房间
   */
  async getRoomById(roomId: string): Promise<Room> {
    const room = await this.roomRepository.findOne({
      where: { id: roomId },
      relations: ['owner', 'members', 'members.user'],
    });
    if (!room) {
      throw new NotFoundException('房间不存在');
    }
    return room;
  }

  /**
   * 加入房间
   */
  async joinRoom(userId: string, roomCode: string): Promise<Room> {
    const room = await this.getRoomByCode(roomCode);

    if (room.status !== RoomStatus.WAITING) {
      throw new BadRequestException('房间已关闭或已开始游戏');
    }

    // 检查是否已在房间中
    const existingMember = room.members.find((m) => m.userId === userId);
    if (existingMember) {
      return room; // 已在房间中，直接返回
    }

    // 检查房间人数
    if (room.members.length >= room.maxMembers) {
      throw new BadRequestException('房间已满');
    }

    // 加入房间
    await this.addMember(room.id, userId);

    // 获取更新后的房间信息并推送 Pusher 事件
    const updatedRoom = await this.getRoomByCode(roomCode);
    await this.pusherService.memberJoined(roomCode, this.formatRoomData(updatedRoom));

    return updatedRoom;
  }

  /**
   * 添加成员到房间
   */
  private async addMember(roomId: string, userId: string): Promise<RoomMember> {
    const member = this.memberRepository.create({
      roomId,
      userId,
      team: Team.NONE,
    });
    return this.memberRepository.save(member);
  }

  /**
   * 离开房间
   */
  async leaveRoom(userId: string, roomCode: string): Promise<void> {
    const room = await this.getRoomByCode(roomCode);

    // 房主不能离开，只能关闭房间
    if (room.ownerId === userId) {
      throw new BadRequestException('房主不能离开房间，请使用关闭房间功能');
    }

    await this.memberRepository.delete({ roomId: room.id, userId });

    // 获取更新后的房间信息并推送 Pusher 事件
    const updatedRoom = await this.getRoomByCode(roomCode);
    await this.pusherService.memberLeft(roomCode, this.formatRoomData(updatedRoom));
  }

  /**
   * 关闭房间
   */
  async closeRoom(userId: string, roomCode: string): Promise<void> {
    const room = await this.getRoomByCode(roomCode);

    if (room.ownerId !== userId) {
      throw new ForbiddenException('只有房主才能关闭房间');
    }

    room.status = RoomStatus.CLOSED;
    await this.roomRepository.save(room);

    // 推送房间关闭事件
    await this.pusherService.roomClosed(roomCode);

    // 删除所有成员
    await this.memberRepository.delete({ roomId: room.id });
  }

  /**
   * 获取用户创建的房间
   */
  async getMyRoom(userId: string): Promise<Room | null> {
    return this.roomRepository.findOne({
      where: { ownerId: userId, status: RoomStatus.WAITING },
      relations: ['members', 'members.user'],
    });
  }

  /**
   * 获取用户加入的房间（非自己创建的）
   */
  async getMyJoinedRoom(userId: string): Promise<Room | null> {
    // 查找用户作为成员加入的房间（排除自己创建的）
    const member = await this.memberRepository.findOne({
      where: { userId },
      relations: ['room', 'room.owner', 'room.members', 'room.members.user'],
    });

    if (!member || !member.room) {
      return null;
    }

    // 排除已关闭的房间和自己创建的房间
    if (member.room.status === RoomStatus.CLOSED || member.room.ownerId === userId) {
      return null;
    }

    return member.room;
  }

  /**
   * 开始分边 - Fisher-Yates 洗牌算法
   */
  async divideTeams(userId: string, roomCode: string): Promise<{ teamA: any[]; teamB: any[] }> {
    const room = await this.getRoomByCode(roomCode);

    // 验证房主权限
    if (room.ownerId !== userId) {
      throw new ForbiddenException('只有房主才能开始分边');
    }

    if (room.status !== RoomStatus.WAITING) {
      throw new BadRequestException('房间状态不允许分边');
    }

    const members = room.members;
    if (members.length < 2) {
      throw new BadRequestException('至少需要2人才能分边');
    }

    // Fisher-Yates 洗牌算法
    const shuffled = [...members];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // 分配队伍
    const mid = Math.floor(shuffled.length / 2);
    const teamA = shuffled.slice(0, mid);
    const teamB = shuffled.slice(mid);

    // 更新成员队伍信息
    for (const member of teamA) {
      await this.memberRepository.update(member.id, { team: Team.TEAM_A });
    }
    for (const member of teamB) {
      await this.memberRepository.update(member.id, { team: Team.TEAM_B });
    }

    // 更新房间状态
    room.status = RoomStatus.DIVIDED;
    await this.roomRepository.save(room);

    // 返回分边结果
    const result = {
      teamA: teamA.map((m) => ({
        id: m.user.id,
        nickname: m.user.nickname,
        avatarUrl: m.user.avatarUrl,
      })),
      teamB: teamB.map((m) => ({
        id: m.user.id,
        nickname: m.user.nickname,
        avatarUrl: m.user.avatarUrl,
      })),
    };

    // 推送分边完成事件
    const updatedRoom = await this.getRoomByCode(roomCode);
    await this.pusherService.teamsDivided(roomCode, this.formatRoomData(updatedRoom), result);

    return result;
  }

  /**
   * 重新分边
   */
  async redivideTeams(userId: string, roomCode: string): Promise<{ teamA: any[]; teamB: any[] }> {
    const room = await this.getRoomByCode(roomCode);

    // 验证房主权限
    if (room.ownerId !== userId) {
      throw new ForbiddenException('只有房主才能重新分边');
    }

    // 重置所有成员队伍
    await this.memberRepository.update({ roomId: room.id }, { team: Team.NONE });

    // 更新房间状态
    room.status = RoomStatus.WAITING;
    await this.roomRepository.save(room);

    // 重新分边
    return this.divideTeams(userId, roomCode);
  }

  /**
   * 获取分边结果
   */
  async getDivisionResult(roomCode: string): Promise<{ teamA: any[]; teamB: any[] }> {
    const room = await this.getRoomByCode(roomCode);

    const teamA = room.members
      .filter((m) => m.team === Team.TEAM_A)
      .map((m) => ({
        id: m.user.id,
        nickname: m.user.nickname,
        avatarUrl: m.user.avatarUrl,
      }));

    const teamB = room.members
      .filter((m) => m.team === Team.TEAM_B)
      .map((m) => ({
        id: m.user.id,
        nickname: m.user.nickname,
        avatarUrl: m.user.avatarUrl,
      }));

    return { teamA, teamB };
  }

  /**
   * 格式化房间数据用于 Pusher 推送
   */
  private formatRoomData(room: Room) {
    return {
      id: room.id,
      roomCode: room.roomCode,
      gameName: room.gameName,
      status: room.status,
      maxMembers: room.maxMembers,
      ownerId: room.ownerId,
      owner: room.owner ? {
        id: room.owner.id,
        nickname: room.owner.nickname,
        avatarUrl: room.owner.avatarUrl,
      } : null,
      members: room.members.map((m) => ({
        id: m.user.id,
        nickname: m.user.nickname,
        avatarUrl: m.user.avatarUrl,
        team: m.team,
        joinedAt: m.joinedAt,
      })),
      memberCount: room.members.length,
      createdAt: room.createdAt,
    };
  }
}
