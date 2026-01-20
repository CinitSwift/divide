import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WxLoginDto {
  @ApiProperty({ description: '微信登录code' })
  @IsString()
  @IsNotEmpty({ message: 'code不能为空' })
  code: string;

  @ApiPropertyOptional({ description: '用户昵称' })
  @IsString()
  @IsOptional()
  nickname?: string;

  @ApiPropertyOptional({ description: '用户头像URL' })
  @IsString()
  @IsOptional()
  avatarUrl?: string;
}
