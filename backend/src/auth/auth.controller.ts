import { Controller, Post, Get, Res, Req, Body, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt.guard';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

// Tighter than the app-wide default: these are the endpoints brute-forcing
// or credential-stuffing would actually target.
const AUTH_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Throttle(AUTH_THROTTLE)
  @Post()
  async createUser(@Body() dto: RegisterDto) {
    return this.authService.registerUser(dto.email, dto.password);
  }

  @Throttle(AUTH_THROTTLE)
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { token } = await this.authService.validateUser(dto.email, dto.password);

    // Set JWT as cookie
    res.cookie('token', token, {
      httpOnly: true, // not accessible via JS
      secure: process.env.NODE_ENV === 'production', // only HTTPS in prod
      sameSite: 'strict',
      path: '/',
      maxAge: 1000 * 60 * 60, // 1 hour
    });

    return { message: 'Login successful' };
  }

  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('token');
    return { message: 'Logged out' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: Request & { user: { userId: string; email: string } }) {
    return req.user;
  }
}