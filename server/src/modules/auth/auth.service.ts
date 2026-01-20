import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { WechatService } from '../wechat/wechat.service';
import { WxLoginDto } from './dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly wechatService: WechatService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * 微信登录
   */
  async wxLogin(dto: WxLoginDto) {
    // 1. 通过 code 换取 openid
    const session = await this.wechatService.code2Session(dto.code);

    // 2. 查找或创建用户
    const user = await this.userService.findOrCreate(session.openid, {
      unionId: session.unionid,
      nickname: dto.nickname,
      avatarUrl: dto.avatarUrl,
    });

    // 3. 如果传入了用户信息，更新用户信息
    if (dto.nickname || dto.avatarUrl) {
      await this.userService.update(user.id, {
        nickname: dto.nickname || user.nickname,
        avatarUrl: dto.avatarUrl || user.avatarUrl,
      });
    }

    // 4. 生成 JWT Token
    const payload = { sub: user.id, openid: user.openid };
    const token = this.jwtService.sign(payload);

    return {
      token,
      user: {
        id: user.id,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  /**
   * 获取用户信息
   */
  async getProfile(userId: string) {
    const user = await this.userService.findById(userId);
    if (!user) {
      return null;
    }
    return {
      id: user.id,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
    };
  }
}
