import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Response } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { LogsWriter } from '../logs/logs.writer';
import { LoginDto } from './dto/login.dto';
import { SetupDto } from './dto/setup.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly logs: LogsWriter,
  ) {}

  async setup(dto: SetupDto, res: Response) {
    const existing = await this.prisma.user.count();
    if (existing > 0) throw new ForbiddenException('Setup already completed');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: { username: dto.username, passwordHash },
    });

    await this.prisma.systemSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton' },
      update: {},
    });

    this.setTokenCookie(res, user.id, user.username);
    this.logs.info(
      'auth',
      'AUTH_SETUP',
      `Admin account created: ${user.username}`,
    );
    return { id: user.id, username: user.username };
  }

  async login(dto: LoginDto, res: Response) {
    const user = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (!user) {
      this.logs.warn(
        'auth',
        'AUTH_LOGIN_FAILED',
        `Login failed — unknown user: ${dto.username}`,
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      this.logs.warn(
        'auth',
        'AUTH_LOGIN_FAILED',
        `Login failed — wrong password: ${dto.username}`,
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    this.setTokenCookie(res, user.id, user.username);
    this.logs.info('auth', 'AUTH_LOGIN', `Login: ${user.username}`);
    return { id: user.id, username: user.username };
  }

  logout(res: Response) {
    res.clearCookie('orbix_token', { path: '/' });
    this.logs.info('auth', 'AUTH_LOGOUT', 'User logged out');
  }

  async isSetupRequired(): Promise<boolean> {
    return (await this.prisma.user.count()) === 0;
  }

  private setTokenCookie(res: Response, sub: string, username: string) {
    const token = this.jwtService.sign({ sub, username });
    const secure = this.config.get('ORBIX_SECURE') === 'true';
    // lax en dev (cross-port localhost:3000→3001), strict en prod (HTTPS same-origin)
    const sameSite = secure ? ('strict' as const) : ('lax' as const);
    res.cookie('orbix_token', token, {
      httpOnly: true,
      secure,
      sameSite,
      maxAge: 24 * 60 * 60 * 1000,
      path: '/',
    });
  }
}
