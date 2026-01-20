import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { RoomMember } from '../room/room-member.entity';

@Entity('user')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 64, unique: true, comment: '微信OpenID' })
  openid: string;

  @Column({ name: 'union_id', length: 64, nullable: true, comment: '微信UnionID' })
  unionId: string;

  @Column({ length: 64, nullable: true, comment: '用户昵称' })
  nickname: string;

  @Column({ name: 'avatar_url', length: 512, nullable: true, comment: '头像URL' })
  avatarUrl: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // 用户加入的房间成员记录
  @OneToMany(() => RoomMember, (member) => member.user)
  roomMembers: RoomMember[];
}
