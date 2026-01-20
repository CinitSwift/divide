import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../user/user.entity';
import { RoomMember } from './room-member.entity';

export enum RoomStatus {
  WAITING = 'waiting',   // 等待中
  DIVIDED = 'divided',   // 已分边
  CLOSED = 'closed',     // 已关闭
}

@Entity('room')
export class Room {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'room_code', length: 8, unique: true, comment: '房间号' })
  roomCode: string;

  @Column({ name: 'game_name', length: 128, comment: '游戏名称' })
  gameName: string;

  @Column({ name: 'owner_id', comment: '房主用户ID' })
  ownerId: string;

  @Column({
    type: 'enum',
    enum: RoomStatus,
    default: RoomStatus.WAITING,
    comment: '房间状态',
  })
  status: RoomStatus;

  @Column({ name: 'max_members', default: 10, comment: '最大人数' })
  maxMembers: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // 房主
  @ManyToOne(() => User)
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  // 房间成员
  @OneToMany(() => RoomMember, (member) => member.room, { cascade: true })
  members: RoomMember[];
}
