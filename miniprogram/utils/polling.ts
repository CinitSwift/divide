/**
 * 轮询服务
 * 替代 WebSocket 实现房间状态同步
 */

type PollingCallback = (data: any) => void;

interface PollingTask {
  timer: number;
  callback: PollingCallback;
  interval: number;
  fetchFn: () => Promise<any>;
}

class PollingService {
  private tasks: Map<string, PollingTask> = new Map();

  /**
   * 开始轮询
   * @param key 唯一标识
   * @param fetchFn 获取数据的函数
   * @param callback 数据回调
   * @param interval 轮询间隔（毫秒），默认 3000ms
   */
  start(
    key: string,
    fetchFn: () => Promise<any>,
    callback: PollingCallback,
    interval: number = 3000
  ): void {
    // 如果已存在，先停止
    this.stop(key);

    // 立即执行一次
    this.execute(fetchFn, callback);

    // 设置定时器
    const timer = setInterval(() => {
      this.execute(fetchFn, callback);
    }, interval);

    this.tasks.set(key, {
      timer,
      callback,
      interval,
      fetchFn,
    });

    console.log(`[Polling] Started: ${key}, interval: ${interval}ms`);
  }

  /**
   * 停止轮询
   */
  stop(key: string): void {
    const task = this.tasks.get(key);
    if (task) {
      clearInterval(task.timer);
      this.tasks.delete(key);
      console.log(`[Polling] Stopped: ${key}`);
    }
  }

  /**
   * 停止所有轮询
   */
  stopAll(): void {
    this.tasks.forEach((_, key) => this.stop(key));
  }

  /**
   * 执行一次轮询
   */
  private async execute(fetchFn: () => Promise<any>, callback: PollingCallback): Promise<void> {
    try {
      const data = await fetchFn();
      callback(data);
    } catch (error) {
      console.error('[Polling] Error:', error);
    }
  }

  /**
   * 手动触发一次轮询
   */
  async trigger(key: string): Promise<void> {
    const task = this.tasks.get(key);
    if (task) {
      await this.execute(task.fetchFn, task.callback);
    }
  }
}

export const pollingService = new PollingService();
export default pollingService;
