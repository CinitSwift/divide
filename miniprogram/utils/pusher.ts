/**
 * Pusher 小程序适配器
 * 使用 wx.connectSocket 替代浏览器的 WebSocket
 */

// Pusher 配置 - 请替换为你的 Pusher 凭证
const PUSHER_KEY = 'd9763216be289d046477'; // TODO: 替换为实际的 Pusher Key
const PUSHER_CLUSTER = 'ap1'; // TODO: 替换为实际的 Cluster

interface PusherEventCallback {
  (data: any): void;
}

interface PusherChannel {
  channelName: string;
  callbacks: Map<string, PusherEventCallback[]>;
}

/**
 * 小程序 Pusher 客户端
 */
class MiniProgramPusher {
  private socketTask: WechatMiniprogram.SocketTask | null = null;
  private channels: Map<string, PusherChannel> = new Map();
  private isConnected: boolean = false;
  private reconnectTimer: number | null = null;
  private socketId: string = '';

  constructor(
    private key: string,
    private cluster: string,
  ) {}

  /**
   * 连接到 Pusher
   */
  connect(): void {
    if (this.socketTask) {
      return;
    }

    const url = `wss://ws-${this.cluster}.pusher.com/app/${this.key}?protocol=7&client=js&version=8.0.0&flash=false`;

    this.socketTask = wx.connectSocket({
      url,
      complete: () => {},
    });

    this.socketTask.onOpen(() => {
      console.log('[Pusher] WebSocket connected');
    });

    this.socketTask.onMessage((res) => {
      this.handleMessage(res.data as string);
    });

    this.socketTask.onError((err) => {
      console.error('[Pusher] WebSocket error:', err);
    });

    this.socketTask.onClose(() => {
      console.log('[Pusher] WebSocket closed');
      this.isConnected = false;
      this.socketTask = null;
      // 尝试重连
      this.scheduleReconnect();
    });
  }

  /**
   * 处理收到的消息
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);
      const event = message.event;
      const channelName = message.channel;

      // 连接成功事件
      if (event === 'pusher:connection_established') {
        const eventData = JSON.parse(message.data);
        this.socketId = eventData.socket_id;
        this.isConnected = true;
        console.log('[Pusher] Connection established, socket_id:', this.socketId);

        // 重新订阅所有频道
        this.channels.forEach((_, name) => {
          this.sendSubscribe(name);
        });
        return;
      }

      // 订阅成功事件
      if (event === 'pusher_internal:subscription_succeeded') {
        console.log('[Pusher] Subscribed to channel:', channelName);
        return;
      }

      // 频道事件
      if (channelName && this.channels.has(channelName)) {
        const channel = this.channels.get(channelName)!;
        const callbacks = channel.callbacks.get(event);
        if (callbacks) {
          const eventData = message.data ? JSON.parse(message.data) : {};
          callbacks.forEach((cb) => cb(eventData));
        }
      }
    } catch (error) {
      console.error('[Pusher] Failed to parse message:', error);
    }
  }

  /**
   * 发送订阅请求
   */
  private sendSubscribe(channelName: string): void {
    if (!this.socketTask || !this.isConnected) {
      return;
    }

    const message = JSON.stringify({
      event: 'pusher:subscribe',
      data: { channel: channelName },
    });

    this.socketTask.send({ data: message });
  }

  /**
   * 订阅频道
   */
  subscribe(channelName: string): {
    bind: (event: string, callback: PusherEventCallback) => void;
    unbind: (event: string, callback?: PusherEventCallback) => void;
  } {
    if (!this.channels.has(channelName)) {
      this.channels.set(channelName, {
        channelName,
        callbacks: new Map(),
      });

      // 如果已连接，立即订阅
      if (this.isConnected) {
        this.sendSubscribe(channelName);
      }
    }

    const channel = this.channels.get(channelName)!;

    return {
      bind: (event: string, callback: PusherEventCallback) => {
        if (!channel.callbacks.has(event)) {
          channel.callbacks.set(event, []);
        }
        channel.callbacks.get(event)!.push(callback);
      },
      unbind: (event: string, callback?: PusherEventCallback) => {
        if (!callback) {
          channel.callbacks.delete(event);
        } else {
          const callbacks = channel.callbacks.get(event);
          if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index !== -1) {
              callbacks.splice(index, 1);
            }
          }
        }
      },
    };
  }

  /**
   * 取消订阅频道
   */
  unsubscribe(channelName: string): void {
    if (!this.channels.has(channelName)) {
      return;
    }

    this.channels.delete(channelName);

    if (this.socketTask && this.isConnected) {
      const message = JSON.stringify({
        event: 'pusher:unsubscribe',
        data: { channel: channelName },
      });
      this.socketTask.send({ data: message });
    }
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socketTask) {
      this.socketTask.close({});
      this.socketTask = null;
    }

    this.isConnected = false;
    this.channels.clear();
  }

  /**
   * 安排重连
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      console.log('[Pusher] Attempting to reconnect...');
      this.connect();
    }, 3000) as unknown as number;
  }
}

// 导出单例
export const pusherClient = new MiniProgramPusher(PUSHER_KEY, PUSHER_CLUSTER);

// 导出配置更新方法（用于动态设置 key）
export function initPusher(key: string, cluster: string): MiniProgramPusher {
  return new MiniProgramPusher(key, cluster);
}
