import { Body, Controller, Get, HttpCode, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SetupDto } from './dto/setup.dto';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('setup')
  async setup(
    @Body() dto: SetupDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.setup(dto, res);
    return { data: user };
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.login(dto, res);
    return { data: user };
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    this.authService.logout(res);
    return { data: null };
  }

  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return { data: { id: user.sub, username: user.username } };
  }

  @Public()
  @Get('setup-required')
  async setupRequired() {
    const required = await this.authService.isSetupRequired();
    return { data: { required } };
  }
}
