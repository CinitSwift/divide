import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { Request, Response } from 'express';
import { AppModule } from '../server/src/app.module';

const server = express();

let app: any;

async function bootstrap() {
  if (!app) {
    const nestApp = await NestFactory.create(
      AppModule,
      new ExpressAdapter(server),
    );

    // 全局验证管道
    nestApp.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    // 全局前缀
    nestApp.setGlobalPrefix('api');

    // CORS 配置
    nestApp.enableCors({
      origin: true,
      credentials: true,
    });

    await nestApp.init();
    app = nestApp;
  }
  return app;
}

export default async function handler(req: Request, res: Response) {
  await bootstrap();
  server(req, res);
}
