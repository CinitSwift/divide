import { IsString, IsNotEmpty, MaxLength, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRoomDto {
  @ApiProperty({ description: '游戏名称', maxLength: 128 })
  @IsString()
  @IsNotEmpty({ message: '游戏名称不能为空' })
  @MaxLength(128, { message: '游戏名称最长128个字符' })
  gameName: string;

  @ApiPropertyOptional({ description: '最大人数', default: 10 })
  @IsNumber()
  @IsOptional()
  @Min(2, { message: '最少2人' })
  @Max(100, { message: '最多100人' })
  maxMembers?: number;
}

export class JoinRoomDto {
  @ApiProperty({ description: '房间号' })
  @IsString()
  @IsNotEmpty({ message: '房间号不能为空' })
  roomCode: string;
}
