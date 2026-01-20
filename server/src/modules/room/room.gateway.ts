import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { RoomService } from './room.service';

interface JoinRoomPayload {
  roomCode: string;
  userId: string;
  nickname: string;
  avatarUrl?: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/room',
})
export class RoomGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RoomGateway.name);

  // 用户 socket 映射: userId -> socketId
  private userSocketMap = new Map<string, string>();
  // socket 所在房间: socketId -> roomCode
  private socketRoomMap = new Map<string, string>();

  constructor(private readonly roomService: RoomService) {}

  /**
   * 客户端连接
   */
  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  /**
   * 客户端断开连接
   */
  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);

    // 清理映射关系
    const roomCode = this.socketRoomMap.get(client.id);
    if (roomCode) {
      this.socketRoomMap.delete(client.id);
    }

    // 移除用户映射
    for (const [userId, socketId] of this.userSocketMap.entries()) {
      if (socketId === client.id) {
        this.userSocketMap.delete(userId);
        break;
      }
    }
  }

  /**
   * 加入房间
   */
  @SubscribeMessage('room:join')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinRoomPayload,
  ) {
    const { roomCode, userId, nickname, avatarUrl } = payload;

    try {
      // 加入 Socket.IO 房间
      client.join(roomCode);
      this.userSocketMap.set(userId, client.id);
      this.socketRoomMap.set(client.id, roomCode);

      // 通知房间内其他人
      client.to(roomCode).emit('room:member_joined', {
        userId,
        nickname,
        avatarUrl,
      });

      this.logger.log(`User ${nickname} joined room ${roomCode}`);

      return { success: true };
    } catch (error) {
      this.logger.error(`Join room error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 离开房间
   */
  @SubscribeMessage('room:leave')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomCode: string; userId: string },
  ) {
    const { roomCode, userId } = payload;

    try {
      // 离开 Socket.IO 房间
      client.leave(roomCode);
      this.socketRoomMap.delete(client.id);
      this.userSocketMap.delete(userId);

      // 通知房间内其他人
      client.to(roomCode).emit('room:member_left', { userId });

      this.logger.log(`User ${userId} left room ${roomCode}`);

      return { success: true };
    } catch (error) {
      this.logger.error(`Leave room error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 广播分边结果
   */
  broadcastDivisionResult(
    roomCode: string,
    result: { teamA: any[]; teamB: any[] },
  ) {
    this.server.to(roomCode).emit('room:divided', result);
    this.logger.log(`Division result broadcast to room ${roomCode}`);
  }

  /**
   * 广播房间关闭
   */
  broadcastRoomClosed(roomCode: string) {
    this.server.to(roomCode).emit('room:closed', {});
    this.logger.log(`Room closed broadcast: ${roomCode}`);
  }

  /**
   * 向指定房间广播消息
   */
  broadcastToRoom(roomCode: string, event: string, data: any) {
    this.server.to(roomCode).emit(event, data);
  }
}
