import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // 全局前缀
  app.setGlobalPrefix('api');

  // CORS 配置
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Swagger 文档配置 (仅开发环境)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('游戏分队平台 API')
      .setDescription('游戏分队平台后端 API 文档')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 服务已启动: http://localhost:${port}`);
}

// 本地开发时启动服务器
bootstrap();

// 导出 app 用于 Vercel Serverless
export default bootstrap;
