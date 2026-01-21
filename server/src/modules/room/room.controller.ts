import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RoomService } from './room.service';
import { CreateRoomDto } from './dto';

@ApiTags('房间')
@Controller('room')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @Post('create')
  @ApiOperation({ summary: '创建房间' })
  async createRoom(@Request() req, @Body() dto: CreateRoomDto) {
    const room = await this.roomService.createRoom(req.user.userId, dto);
    return this.formatRoomResponse(room);
  }

  @Get('my-room')
  @ApiOperation({ summary: '获取我创建的房间' })
  async getMyRoom(@Request() req) {
    const room = await this.roomService.getMyRoom(req.user.userId);
    return room ? this.formatRoomResponse(room) : null;
  }

  @Get('my-joined-room')
  @ApiOperation({ summary: '获取我加入的房间（非自己创建）' })
  async getMyJoinedRoom(@Request() req) {
    const room = await this.roomService.getMyJoinedRoom(req.user.userId);
    return room ? this.formatRoomResponse(room) : null;
  }

  @Get(':roomCode')
  @ApiOperation({ summary: '获取房间详情' })
  async getRoomDetail(@Param('roomCode') roomCode: string) {
    const room = await this.roomService.getRoomByCode(roomCode);
    return this.formatRoomResponse(room);
  }

  @Post(':roomCode/join')
  @ApiOperation({ summary: '加入房间' })
  async joinRoom(@Request() req, @Param('roomCode') roomCode: string) {
    const room = await this.roomService.joinRoom(req.user.userId, roomCode);
    return this.formatRoomResponse(room);
  }

  @Post(':roomCode/leave')
  @ApiOperation({ summary: '离开房间' })
  async leaveRoom(@Request() req, @Param('roomCode') roomCode: string) {
    await this.roomService.leaveRoom(req.user.userId, roomCode);
    return { success: true };
  }

  @Post(':roomCode/remove/:memberId')
  @ApiOperation({ summary: '房主移除成员' })
  async removeMember(
    @Request() req,
    @Param('roomCode') roomCode: string,
    @Param('memberId') memberId: string,
  ) {
    await this.roomService.removeMember(req.user.userId, roomCode, memberId);
    return { success: true };
  }

  @Delete(':roomCode')
  @ApiOperation({ summary: '关闭房间' })
  async closeRoom(@Request() req, @Param('roomCode') roomCode: string) {
    await this.roomService.closeRoom(req.user.userId, roomCode);
    return { success: true };
  }

  @Post(':roomCode/divide')
  @ApiOperation({ summary: '开始分边' })
  async divideTeams(@Request() req, @Param('roomCode') roomCode: string) {
    return this.roomService.divideTeams(req.user.userId, roomCode);
  }

  @Post(':roomCode/redivide')
  @ApiOperation({ summary: '重新分边' })
  async redivideTeams(@Request() req, @Param('roomCode') roomCode: string) {
    return this.roomService.redivideTeams(req.user.userId, roomCode);
  }

  @Get(':roomCode/result')
  @ApiOperation({ summary: '获取分边结果' })
  async getDivisionResult(@Param('roomCode') roomCode: string) {
    return this.roomService.getDivisionResult(roomCode);
  }

  /**
   * 格式化房间响应数据
   */
  private formatRoomResponse(room: any) {
    return {
      id: room.id,
      roomCode: room.roomCode,
      gameName: room.gameName,
      status: room.status,
      maxMembers: room.maxMembers,
      ownerId: room.ownerId,
      owner: room.owner
        ? {
            id: room.owner.id,
            nickname: room.owner.nickname,
            avatarUrl: room.owner.avatarUrl,
          }
        : null,
      members: room.members?.map((m: any) => ({
        id: m.user?.id,
        nickname: m.user?.nickname,
        avatarUrl: m.user?.avatarUrl,
        team: m.team,
        joinedAt: m.joinedAt,
      })) || [],
      memberCount: room.members?.length || 0,
      createdAt: room.createdAt,
    };
  }
}
