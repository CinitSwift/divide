import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Pusher from 'pusher';

@Injectable()
export class PusherService {
  private pusher: Pusher;

  constructor(private configService: ConfigService) {
    this.pusher = new Pusher({
      appId: this.configService.get<string>('PUSHER_APP_ID'),
      key: this.configService.get<string>('PUSHER_KEY'),
      secret: this.configService.get<string>('PUSHER_SECRET'),
      cluster: this.configService.get<string>('PUSHER_CLUSTER'),
      useTLS: true,
    });
  }

  /**
   * 触发房间事件
   * @param roomCode 房间号
   * @param event 事件名称
   * @param data 事件数据
   */
  async triggerRoomEvent(roomCode: string, event: string, data: any): Promise<void> {
    const channel = `room-${roomCode}`;
    try {
      await this.pusher.trigger(channel, event, data);
    } catch (error) {
      console.error('Pusher trigger error:', error);
    }
  }

  /**
   * 成员加入房间事件
   */
  async memberJoined(roomCode: string, roomData: any): Promise<void> {
    await this.triggerRoomEvent(roomCode, 'member-joined', { room: roomData });
  }

  /**
   * 成员离开房间事件
   */
  async memberLeft(roomCode: string, roomData: any): Promise<void> {
    await this.triggerRoomEvent(roomCode, 'member-left', { room: roomData });
  }

  /**
   * 房间关闭事件
   */
  async roomClosed(roomCode: string): Promise<void> {
    await this.triggerRoomEvent(roomCode, 'room-closed', {});
  }

  /**
   * 分边完成事件
   */
  async teamsDivided(roomCode: string, roomData: any, result: any): Promise<void> {
    await this.triggerRoomEvent(roomCode, 'teams-divided', { room: roomData, result });
  }
}
