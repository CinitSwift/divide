import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * 根据 OpenID 查找用户
   */
  async findByOpenid(openid: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { openid } });
  }

  /**
   * 根据 ID 查找用户
   */
  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  /**
   * 创建新用户
   */
  async create(data: Partial<User>): Promise<User> {
    const user = this.userRepository.create(data);
    return this.userRepository.save(user);
  }

  /**
   * 更新用户信息
   */
  async update(id: string, data: Partial<User>): Promise<User> {
    await this.userRepository.update(id, data);
    return this.findById(id);
  }

  /**
   * 根据 OpenID 查找或创建用户
   */
  async findOrCreate(openid: string, data?: Partial<User>): Promise<User> {
    let user = await this.findByOpenid(openid);
    if (!user) {
      user = await this.create({ openid, ...data });
    }
    return user;
  }
}
