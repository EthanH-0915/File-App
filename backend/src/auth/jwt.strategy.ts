import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import type { JwtPayload } from './jwt-payload';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    const secret = config.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is not set');
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // read from cookie. cookie-parser types `cookies` as
        // Record<string, any>, so narrow it rather than leak an `any`.
        (req: Request): string | null => {
          const cookies = req.cookies as
            | Record<string, string | undefined>
            | undefined;
          return cookies?.token ?? null;
        },
      ]),
      secretOrKey: secret,
    });
  }

  validate(payload: JwtPayload) {
    return { userId: payload.sub, email: payload.email };
  }
}
