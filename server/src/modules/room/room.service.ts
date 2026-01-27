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
import { Room, RoomStatus, LabelRule, LabelRulesConfig, DivisionResult } from './room.entity';
import { RoomMember, Team, MemberLabel } from './room-member.entity';
import { CreateRoomDto } from './dto';
import { UserService } from '../user/user.service';
import { PusherService } from '../pusher/pusher.service';

// === Division Algorithm Types (Internal Use Only) ===
interface DivisionLog {
  step: number;
  action: 'init' | 'constraint' | 'assign' | 'swap' | 'final';
  description: string;
  teamA: string[];  // 成员昵称列表
  teamB: string[];
  score?: number;
}

interface DivisionOptions {
  debug?: boolean;
}

interface DivisionResultInternal {
  teamA: RoomMember[];
  teamB: RoomMember[];
  logs?: DivisionLog[];
}

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

    // 如果是房主离开，自动关闭房间并删除记录
    if (room.ownerId === userId) {
      await this.closeAndDeleteRoom(room);
      return;
    }

    await this.memberRepository.delete({ roomId: room.id, userId });

    // 获取更新后的房间信息并推送 Pusher 事件
    const updatedRoom = await this.getRoomByCode(roomCode);
    await this.pusherService.memberLeft(roomCode, this.formatRoomData(updatedRoom));
  }

  /**
   * 房主移除成员
   */
  async removeMember(ownerId: string, roomCode: string, memberId: string): Promise<void> {
    const room = await this.getRoomByCode(roomCode);

    // 验证是否为房主
    if (room.ownerId !== ownerId) {
      throw new ForbiddenException('只有房主才能移除成员');
    }

    // 不能移除自己
    if (memberId === ownerId) {
      throw new BadRequestException('不能移除房主自己');
    }

    // 检查成员是否在房间中
    const member = room.members.find((m) => m.userId === memberId);
    if (!member) {
      throw new BadRequestException('该成员不在房间中');
    }

    await this.memberRepository.delete({ roomId: room.id, userId: memberId });

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

    await this.closeAndDeleteRoom(room);
  }

  /**
   * 关闭房间并删除所有相关记录（私有方法）
   */
  private async closeAndDeleteRoom(room: Room): Promise<void> {
    const roomCode = room.roomCode;

    // 推送房间关闭事件
    await this.pusherService.roomClosed(roomCode);

    // 删除所有成员
    await this.memberRepository.delete({ roomId: room.id });

    // 删除房间记录
    await this.roomRepository.delete({ id: room.id });
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
   * 开始分边 - 支持标签规则的分边算法
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

    // 获取标签规则
    const labelRules = room.labelRules || {};

    // 使用带规则的分边算法
    const { teamA, teamB } = this.divideWithRules(members, labelRules);

    // 更新成员队伍信息
    for (const member of teamA) {
      await this.memberRepository.update(member.id, { team: Team.TEAM_A });
    }
    for (const member of teamB) {
      await this.memberRepository.update(member.id, { team: Team.TEAM_B });
    }

    // 更新房间状态和分边结果
    const result: DivisionResult = {
      teamA: teamA.map((m) => ({
        id: m.user.id,
        nickname: m.user.nickname,
        avatarUrl: m.user.avatarUrl,
        labels: m.labels || [],
      })),
      teamB: teamB.map((m) => ({
        id: m.user.id,
        nickname: m.user.nickname,
        avatarUrl: m.user.avatarUrl,
        labels: m.labels || [],
      })),
    };

    room.status = RoomStatus.DIVIDED;
    room.divisionResult = result;
    await this.roomRepository.save(room);

    // 推送分边完成事件
    const updatedRoom = await this.getRoomByCode(roomCode);
    await this.pusherService.teamsDivided(roomCode, this.formatRoomData(updatedRoom), result);

    return result;
  }

  /**
   * 带规则的分边算法（优化版：处理多标签成员）
   */
  private divideWithRules(
    members: RoomMember[],
    labelRules: LabelRulesConfig,
  ): { teamA: RoomMember[]; teamB: RoomMember[] } {
    const teamA: RoomMember[] = [];
    const teamB: RoomMember[] = [];
    const unassigned: RoomMember[] = [];

    // 隐藏规则（最高优先级）：葳蕤和兔子 90% 概率在同一边
    const weiRuiMember = members.find((m) => m.user?.nickname === '葳蕤');
    const tuZiMember = members.find((m) => m.user?.nickname === '兔子');
    const hasSpecialPair = weiRuiMember && tuZiMember;
    const specialPairSameTeam = hasSpecialPair && Math.random() < 0.9;

    if (hasSpecialPair && specialPairSameTeam) {
      // 90% 概率：两人在同一边
      const goToTeamA = Math.random() < 0.5;
      if (goToTeamA) {
        teamA.push(weiRuiMember, tuZiMember);
      } else {
        teamB.push(weiRuiMember, tuZiMember);
      }
      // 其他成员待分配
      for (const member of members) {
        if (member !== weiRuiMember && member !== tuZiMember) {
          unassigned.push(member);
        }
      }
    } else {
      // 10% 概率或不存在特殊配对：正常流程
      unassigned.push(...members);
    }

    // 第一步：处理 "全部在一边" 规则
    const sameTeamLabel = Object.entries(labelRules)
      .find(([_, rule]) => String(rule) === 'same_team')?.[0];

    // 从 unassigned 中处理
    const remainingAfterSameTeam: RoomMember[] = [];

    if (sameTeamLabel) {
      const sameTeamMembers: RoomMember[] = [];

      for (const member of unassigned) {
        const memberLabels = member.labels || [];
        if (memberLabels.includes(sameTeamLabel)) {
          sameTeamMembers.push(member);
        } else {
          remainingAfterSameTeam.push(member);
        }
      }

      // 随机决定这些人去 A 队还是 B 队
      if (sameTeamMembers.length > 0) {
        const goToTeamA = Math.random() < 0.5;
        if (goToTeamA) {
          teamA.push(...sameTeamMembers);
        } else {
          teamB.push(...sameTeamMembers);
        }
      }
    } else {
      remainingAfterSameTeam.push(...unassigned);
    }

    // 第二步：处理 "平均分到每一队" 规则（优化版：全局平衡）
    const evenLabels = Object.entries(labelRules)
      .filter(([_, rule]) => String(rule) === 'even')
      .map(([label]) => label);

    // 为每个成员统计其拥有的需要平均分配的标签
    interface MemberWithLabels {
      member: RoomMember;
      evenLabels: string[]; // 该成员拥有的需要平均分配的标签
    }

    const membersWithLabels: MemberWithLabels[] = remainingAfterSameTeam.map((member) => ({
      member,
      evenLabels: (member.labels || []).filter((label) => evenLabels.includes(label)),
    }));

    // 按拥有的平均分配标签数量降序排序（多标签成员优先处理）
    membersWithLabels.sort((a, b) => b.evenLabels.length - a.evenLabels.length);

    // 记录每个标签在各队的数量
    const labelCountA: Map<string, number> = new Map();
    const labelCountB: Map<string, number> = new Map();

    // 初始化已分配成员的标签计数（处理隐藏规则和 same_team 规则分配的成员）
    for (const member of teamA) {
      for (const label of member.labels || []) {
        if (evenLabels.includes(label)) {
          labelCountA.set(label, (labelCountA.get(label) || 0) + 1);
        }
      }
    }
    for (const member of teamB) {
      for (const label of member.labels || []) {
        if (evenLabels.includes(label)) {
          labelCountB.set(label, (labelCountB.get(label) || 0) + 1);
        }
      }
    }

    // 分配成员，考虑所有标签的平衡
    for (const { member, evenLabels: memberEvenLabels } of membersWithLabels) {
      if (memberEvenLabels.length === 0) {
        // 无特殊标签，稍后处理
        continue;
      }

      // 计算分配到 A 队和 B 队的"不平衡分数"
      // 分数越高表示分配后越不平衡，选择分数低的队伍
      let scoreA = 0;
      let scoreB = 0;

      for (const label of memberEvenLabels) {
        const countA = labelCountA.get(label) || 0;
        const countB = labelCountB.get(label) || 0;

        // 如果分到 A 队，A 队该标签数量会 +1
        // 不平衡程度 = |新A数量 - B数量|
        scoreA += Math.abs((countA + 1) - countB);
        // 如果分到 B 队，B 队该标签数量会 +1
        scoreB += Math.abs(countA - (countB + 1));
      }

      // 同时考虑队伍人数平衡
      const teamSizePenalty = 2; // 人数差异的权重
      scoreA += Math.abs((teamA.length + 1) - teamB.length) * teamSizePenalty;
      scoreB += Math.abs(teamA.length - (teamB.length + 1)) * teamSizePenalty;

      // 选择分数较低的队伍（更平衡）
      if (scoreA <= scoreB) {
        teamA.push(member);
        for (const label of memberEvenLabels) {
          labelCountA.set(label, (labelCountA.get(label) || 0) + 1);
        }
      } else {
        teamB.push(member);
        for (const label of memberEvenLabels) {
          labelCountB.set(label, (labelCountB.get(label) || 0) + 1);
        }
      }
    }

    // 第三步：处理无特殊规则的成员
    const noLabelMembers = membersWithLabels
      .filter(({ evenLabels }) => evenLabels.length === 0)
      .map(({ member }) => member);

    this.shuffle(noLabelMembers);

    // 尽量保持两队人数平衡
    for (const member of noLabelMembers) {
      if (teamA.length <= teamB.length) {
        teamA.push(member);
      } else {
        teamB.push(member);
      }
    }

    return { teamA, teamB };
  }

  /**
   * 计算分队方案的不平衡分数（越低越好）
   * @param teamA A队成员列表
   * @param teamB B队成员列表
   * @param evenLabels 需要平均分配的标签列表
   * @returns 不平衡分数
   */
  private calculateScore(
    teamA: RoomMember[],
    teamB: RoomMember[],
    evenLabels: string[],
  ): number {
    let score = 0;

    // 1. 标签不平衡惩罚 (权重 5)
    for (const label of evenLabels) {
      const countA = teamA.filter(m => m.labels?.includes(label)).length;
      const countB = teamB.filter(m => m.labels?.includes(label)).length;
      score += Math.abs(countA - countB) * 5;
    }

    // 2. 人数不平衡惩罚 (权重 3)
    score += Math.abs(teamA.length - teamB.length) * 3;

    return score;
  }

  /**
   * CSP 精确求解：枚举所有 2^n 种分配，找到最优解
   * @param members 待分配的成员列表（已排除受保护成员）
   * @param evenLabels 需要平均分配的标签
   * @param sameTeamLabel 需要在同一队的标签（可为 null）
   * @param protectedAssignment 已预分配的成员
   * @param debug 是否记录调试日志
   */
  private solveWithCSP(
    members: RoomMember[],
    evenLabels: string[],
    sameTeamLabel: string | null,
    protectedAssignment: { teamA: RoomMember[]; teamB: RoomMember[] } | null,
    debug: boolean = false,
  ): DivisionResultInternal {
    const logs: DivisionLog[] = [];
    const n = members.length;

    // 边界：如果没有剩余成员需要分配
    if (n === 0 && protectedAssignment) {
      return {
        teamA: [...protectedAssignment.teamA],
        teamB: [...protectedAssignment.teamB],
        logs: debug ? logs : undefined,
      };
    }

    let bestResult: { teamA: RoomMember[]; teamB: RoomMember[] } | null = null;
    let bestScore = Infinity;

    // 枚举所有 2^n 种分配
    const totalCombinations = 1 << n;

    for (let mask = 0; mask < totalCombinations; mask++) {
      // 初始化时包含受保护的成员
      const teamA: RoomMember[] = protectedAssignment
        ? [...protectedAssignment.teamA]
        : [];
      const teamB: RoomMember[] = protectedAssignment
        ? [...protectedAssignment.teamB]
        : [];

      // 根据 mask 分配剩余成员
      for (let i = 0; i < n; i++) {
        if ((mask >> i) & 1) {
          teamA.push(members[i]);
        } else {
          teamB.push(members[i]);
        }
      }

      // 检查 SAME_TEAM 硬性约束
      if (sameTeamLabel) {
        const inA = teamA.some((m) => m.labels?.includes(sameTeamLabel));
        const inB = teamB.some((m) => m.labels?.includes(sameTeamLabel));
        if (inA && inB) continue; // 违反约束，跳过
      }

      const score = this.calculateScore(teamA, teamB, evenLabels);

      if (score < bestScore) {
        bestScore = score;
        bestResult = { teamA: [...teamA], teamB: [...teamB] };
      }
    }

    if (debug && bestResult) {
      logs.push({
        step: 1,
        action: 'final',
        description: `CSP found optimal solution with score ${bestScore} (checked ${totalCombinations} combinations)`,
        teamA: bestResult.teamA.map((m) => m.user?.nickname || m.userId),
        teamB: bestResult.teamB.map((m) => m.user?.nickname || m.userId),
        score: bestScore,
      });
    }

    return bestResult
      ? { ...bestResult, logs: debug ? logs : undefined }
      : { teamA: [], teamB: [], logs: debug ? logs : undefined };
  }

  /**
   * 贪心 + 2-opt 局部优化算法
   * 用于成员数 > 12 时的回退方案
   */
  private greedyWithTwoOpt(
    members: RoomMember[],
    evenLabels: string[],
    sameTeamLabel: string | null,
    protectedAssignment: { teamA: RoomMember[]; teamB: RoomMember[] } | null,
    debug: boolean = false,
    maxIterations: number = 100,
  ): DivisionResultInternal {
    const logs: DivisionLog[] = [];

    // Step 1: 初始化队伍
    const teamA: RoomMember[] = protectedAssignment
      ? [...protectedAssignment.teamA]
      : [];
    const teamB: RoomMember[] = protectedAssignment
      ? [...protectedAssignment.teamB]
      : [];
    const protectedIds = new Set([...teamA, ...teamB].map((m) => m.id));

    // 处理 SAME_TEAM 成员
    const remaining: RoomMember[] = [];
    let sameTeamTarget: 'A' | 'B' | null = null;

    if (sameTeamLabel) {
      const inA = teamA.some((m) => m.labels?.includes(sameTeamLabel));
      const inB = teamB.some((m) => m.labels?.includes(sameTeamLabel));
      if (inA) sameTeamTarget = 'A';
      else if (inB) sameTeamTarget = 'B';
      else sameTeamTarget = Math.random() < 0.5 ? 'A' : 'B';
    }

    for (const member of members) {
      if (protectedIds.has(member.id)) continue;

      if (sameTeamLabel && member.labels?.includes(sameTeamLabel)) {
        if (sameTeamTarget === 'A') {
          teamA.push(member);
        } else {
          teamB.push(member);
        }
        protectedIds.add(member.id); // SAME_TEAM 成员也受保护
      } else {
        remaining.push(member);
      }
    }

    // 按 evenLabels 数量排序（多标签优先）
    remaining.sort((a, b) => {
      const aCount = (a.labels || []).filter((l) => evenLabels.includes(l)).length;
      const bCount = (b.labels || []).filter((l) => evenLabels.includes(l)).length;
      return bCount - aCount;
    });

    // Step 2: 贪心分配
    for (const member of remaining) {
      const scoreIfA = this.calculateScore([...teamA, member], teamB, evenLabels);
      const scoreIfB = this.calculateScore(teamA, [...teamB, member], evenLabels);

      if (scoreIfA <= scoreIfB) {
        teamA.push(member);
      } else {
        teamB.push(member);
      }
    }

    if (debug) {
      logs.push({
        step: 1,
        action: 'init',
        description: 'Greedy assignment complete',
        teamA: teamA.map((m) => m.user?.nickname || m.userId),
        teamB: teamB.map((m) => m.user?.nickname || m.userId),
        score: this.calculateScore(teamA, teamB, evenLabels),
      });
    }

    // Step 3: 2-opt 优化
    let improved = true;
    let iterations = 0;

    while (improved && iterations < maxIterations) {
      improved = false;
      iterations++;
      const currentScore = this.calculateScore(teamA, teamB, evenLabels);

      outerLoop: for (let i = 0; i < teamA.length; i++) {
        if (protectedIds.has(teamA[i].id)) continue;

        for (let j = 0; j < teamB.length; j++) {
          if (protectedIds.has(teamB[j].id)) continue;

          // 尝试交换
          [teamA[i], teamB[j]] = [teamB[j], teamA[i]];

          // 检查 SAME_TEAM 约束
          if (sameTeamLabel) {
            const inA = teamA.some((m) => m.labels?.includes(sameTeamLabel));
            const inB = teamB.some((m) => m.labels?.includes(sameTeamLabel));
            if (inA && inB) {
              [teamA[i], teamB[j]] = [teamB[j], teamA[i]]; // 撤销
              continue;
            }
          }

          const newScore = this.calculateScore(teamA, teamB, evenLabels);

          if (newScore < currentScore) {
            improved = true;
            if (debug) {
              logs.push({
                step: logs.length + 1,
                action: 'swap',
                description: `Swapped ${teamA[i].user?.nickname || teamA[i].userId} <-> ${teamB[j].user?.nickname || teamB[j].userId}`,
                teamA: teamA.map((m) => m.user?.nickname || m.userId),
                teamB: teamB.map((m) => m.user?.nickname || m.userId),
                score: newScore,
              });
            }
            break outerLoop;
          } else {
            [teamA[i], teamB[j]] = [teamB[j], teamA[i]]; // 撤销
          }
        }
      }
    }

    if (debug) {
      logs.push({
        step: logs.length + 1,
        action: 'final',
        description: `2-opt completed after ${iterations} iterations`,
        teamA: teamA.map((m) => m.user?.nickname || m.userId),
        teamB: teamB.map((m) => m.user?.nickname || m.userId),
        score: this.calculateScore(teamA, teamB, evenLabels),
      });
    }

    return { teamA, teamB, logs: debug ? logs : undefined };
  }

  /**
   * Fisher-Yates 洗牌算法
   */
  private shuffle<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
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
  async getDivisionResult(roomCode: string): Promise<DivisionResult> {
    const room = await this.getRoomByCode(roomCode);

    // 优先从 divisionResult 字段获取
    if (room.divisionResult) {
      return room.divisionResult;
    }

    // 兼容旧数据：从成员的 team 字段获取
    const teamA = room.members
      .filter((m) => String(m.team) === 'team_a')
      .map((m) => ({
        id: m.user.id,
        nickname: m.user.nickname,
        avatarUrl: m.user.avatarUrl,
        labels: m.labels || [],
      }));

    const teamB = room.members
      .filter((m) => String(m.team) === 'team_b')
      .map((m) => ({
        id: m.user.id,
        nickname: m.user.nickname,
        avatarUrl: m.user.avatarUrl,
        labels: m.labels || [],
      }));

    return { teamA, teamB };
  }

  /**
   * 设置成员标签
   */
  async setMemberLabels(
    userId: string,
    roomCode: string,
    memberId: string,
    labels: string[],
  ): Promise<void> {
    const room = await this.getRoomByCode(roomCode);

    // 验证是否为房主
    if (room.ownerId !== userId) {
      throw new ForbiddenException('只有房主才能设置成员标签');
    }

    // 验证标签是否有效
    const validLabels = Object.values(MemberLabel);
    for (const label of labels) {
      if (!validLabels.includes(label as MemberLabel)) {
        throw new BadRequestException(`无效的标签: ${label}`);
      }
    }

    // 查找成员
    const member = room.members.find((m) => m.userId === memberId);
    if (!member) {
      throw new BadRequestException('该成员不在房间中');
    }

    // 更新标签
    await this.memberRepository.update(member.id, { labels });

    // 推送更新事件
    const updatedRoom = await this.getRoomByCode(roomCode);
    await this.pusherService.memberJoined(roomCode, this.formatRoomData(updatedRoom));
  }

  /**
   * 设置标签规则
   */
  async setLabelRules(
    userId: string,
    roomCode: string,
    labelRules: LabelRulesConfig,
  ): Promise<void> {
    const room = await this.getRoomByCode(roomCode);

    // 验证是否为房主
    if (room.ownerId !== userId) {
      throw new ForbiddenException('只有房主才能设置标签规则');
    }

    // 验证规则是否有效
    const validRules = Object.values(LabelRule);
    for (const [label, rule] of Object.entries(labelRules)) {
      if (rule && !validRules.includes(rule as LabelRule)) {
        throw new BadRequestException(`无效的规则: ${rule}`);
      }
    }

    // 检查互斥逻辑：不能有多个标签同时设置为 "全部在一边"
    const sameTeamLabels = Object.entries(labelRules)
      .filter(([_, rule]) => rule === LabelRule.SAME_TEAM)
      .map(([label]) => label);

    if (sameTeamLabels.length > 1) {
      throw new BadRequestException(
        `以下标签不能同时设置为"全部在一边"：${sameTeamLabels.join('、')}，这可能导致分边冲突`,
      );
    }

    // 更新规则
    room.labelRules = labelRules;
    await this.roomRepository.save(room);

    // 推送更新事件
    const updatedRoom = await this.getRoomByCode(roomCode);
    await this.pusherService.memberJoined(roomCode, this.formatRoomData(updatedRoom));
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
      labelRules: room.labelRules || {},
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
        labels: m.labels || [],
        joinedAt: m.joinedAt,
      })),
      memberCount: room.members.length,
      divisionResult: room.divisionResult || null,
      createdAt: room.createdAt,
    };
  }
}
