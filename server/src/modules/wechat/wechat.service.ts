import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface WechatSession {
  openid: string;
  session_key: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

@Injectable()
export class WechatService {
  private readonly appId: string;
  private readonly appSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.appId = this.configService.get('wechat.appId');
    this.appSecret = this.configService.get('wechat.appSecret');
  }

  /**
   * 通过 code 换取微信 session
   * @param code 小程序 wx.login() 返回的 code
   */
  async code2Session(code: string): Promise<WechatSession> {
    const url = 'https://api.weixin.qq.com/sns/jscode2session';
    const params = {
      appid: this.appId,
      secret: this.appSecret,
      js_code: code,
      grant_type: 'authorization_code',
    };

    try {
      const response = await axios.get<WechatSession>(url, { params });
      const data = response.data;

      if (data.errcode) {
        throw new HttpException(
          `微信登录失败: ${data.errmsg}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      return data;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        '微信服务器请求失败',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
