/// <reference path="./types/index.d.ts" />

interface IAppOption {
  globalData: {
    userInfo: WechatMiniprogram.UserInfo | null;
    token: string | null;
  };
  getToken(): string | null;
  setLoginInfo(token: string, userInfo: any): void;
  clearLoginInfo(): void;
}
