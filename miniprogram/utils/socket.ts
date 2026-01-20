/**
 * WebSocket 封装
 */
import { WS_URL } from './request';

type EventCallback = (data: any) => void;

class SocketClient {
  private socket: WechatMiniprogram.SocketTask | null = null;
  private isConnected = false;
  private reconnectTimer: number | null = null;
  private eventListeners: Map<string, EventCallback[]> = new Map();
  private messageQueue: any[] = [];

  /**
   * 连接 WebSocket
   */
  connect(roomCode: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnected) {
        resolve();
        return;
      }

      const token = wx.getStorageSync('token');
      const url = `${WS_URL}?roomCode=${roomCode}&token=${token}`;

      this.socket = wx.connectSocket({
        url,
        success: () => {
          console.log('WebSocket connecting...');
        },
        fail: (err) => {
          console.error('WebSocket connect failed:', err);
          reject(err);
        },
      });

      this.socket.onOpen(() => {
        console.log('WebSocket connected');
        this.isConnected = true;
        // 发送队列中的消息
        this.flushMessageQueue();
        resolve();
      });

      this.socket.onMessage((res) => {
        try {
          const message = JSON.parse(res.data as string);
          const { event, data } = message;
          this.emit(event, data);
        } catch (e) {
          console.error('Parse message error:', e);
        }
      });

      this.socket.onClose(() => {
        console.log('WebSocket closed');
        this.isConnected = false;
        this.socket = null;
      });

      this.socket.onError((err) => {
        console.error('WebSocket error:', err);
        this.isConnected = false;
      });
    });
  }

  /**
   * 发送消息
   */
  send(event: string, data: any): void {
    const message = JSON.stringify({ event, data });

    if (this.isConnected && this.socket) {
      this.socket.send({ data: message });
    } else {
      // 未连接时加入队列
      this.messageQueue.push(message);
    }
  }

  /**
   * 发送队列中的消息
   */
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.isConnected) {
      const message = this.messageQueue.shift();
      this.socket?.send({ data: message });
    }
  }

  /**
   * 监听事件
   */
  on(event: string, callback: EventCallback): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * 移除事件监听
   */
  off(event: string, callback?: EventCallback): void {
    if (!callback) {
      this.eventListeners.delete(event);
    } else {
      const callbacks = this.eventListeners.get(event);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index !== -1) {
          callbacks.splice(index, 1);
        }
      }
    }
  }

  /**
   * 触发事件
   */
  private emit(event: string, data: any): void {
    const callbacks = this.eventListeners.get(event);
    if (callbacks) {
      callbacks.forEach((callback) => callback(data));
    }
  }

  /**
   * 关闭连接
   */
  close(): void {
    if (this.socket) {
      this.socket.close({});
      this.socket = null;
    }
    this.isConnected = false;
    this.eventListeners.clear();
    this.messageQueue = [];

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * 是否已连接
   */
  get connected(): boolean {
    return this.isConnected;
  }
}

export const socketClient = new SocketClient();
