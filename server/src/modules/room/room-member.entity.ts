import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Room } from './room.entity';
import { User } from '../user/user.entity';

export enum Team {
  NONE = 'none',       // 未分边
  TEAM_A = 'team_a',   // A队
  TEAM_B = 'team_b',   // B队
}

@Entity('room_member')
@Unique(['roomId', 'userId'])
export class RoomMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'room_id', comment: '房间ID' })
  roomId: string;

  @Column({ name: 'user_id', comment: '用户ID' })
  userId: string;

  @Column({
    type: 'enum',
    enum: Team,
    default: Team.NONE,
    comment: '分边结果',
  })
  team: Team;

  @CreateDateColumn({ name: 'joined_at' })
  joinedAt: Date;

  // 所属房间
  @ManyToOne(() => Room, (room) => room.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'room_id' })
  room: Room;

  // 用户
  @ManyToOne(() => User, (user) => user.roomMembers)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
