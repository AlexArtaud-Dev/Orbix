import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());
  app.use(helmet());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const reflector = app.get(Reflector);
  const jwtService = app.get(JwtService);
  app.useGlobalGuards(new JwtAuthGuard(jwtService, reflector));

  if (process.env.NODE_ENV !== 'production') {
    app.enableCors({
      origin: 'http://localhost:3000',
      credentials: true,
    });
  }

  const port = parseInt(process.env.PORT ?? '3001', 10);
  await app.listen(port);
  console.log(`Orbix backend running on port ${port}`);
}

void bootstrap();
