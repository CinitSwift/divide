import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { RoomModule } from './modules/room/room.module';
import { WechatModule } from './modules/wechat/wechat.module';
import { PusherModule } from './modules/pusher';
import configuration from './config/configuration';

@Module({
  imports: [
    // 配置模块
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    // PostgreSQL 数据库连接 (Vercel Postgres)
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const dbUrl = configService.get('database.url');
        
        // 如果有 DATABASE_URL，直接使用
        if (dbUrl) {
          return {
            type: 'postgres',
            url: dbUrl,
            entities: [__dirname + '/**/*.entity{.ts,.js}'],
            synchronize: configService.get('nodeEnv') !== 'production',
            ssl: configService.get('database.ssl'),
          };
        }

        // 否则使用分散的配置
        return {
          type: 'postgres',
          host: configService.get('database.host'),
          port: configService.get('database.port'),
          username: configService.get('database.username'),
          password: configService.get('database.password'),
          database: configService.get('database.database'),
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: configService.get('nodeEnv') !== 'production',
          ssl: configService.get('database.ssl'),
        };
      },
      inject: [ConfigService],
    }),

    // 业务模块
    PusherModule,
    AuthModule,
    UserModule,
    RoomModule,
    WechatModule,
  ],
})
export class AppModule {}
