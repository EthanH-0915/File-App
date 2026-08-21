import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';

// Hash of a fixed, unused password. Compared against when no user/passwordHash
// exists, so a login attempt for a nonexistent email takes the same time as one
// for a real email with a wrong password — otherwise the fast "no compare" path
// for missing users lets an attacker enumerate registered emails by timing.
const DUMMY_PASSWORD_HASH =
  '$2b$10$xxEO9BH8UenI3JdUTq6uE.tC09YF0B7l7laHX4XKpes8JTdssdOTW';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);

    const passwordValid = await bcrypt.compare(
      password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );

    if (!user || !user.passwordHash || !passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = this.jwtService.sign({ sub: user.id, email: user.email });
    return { token };
  }

  async registerUser(email: string, password: string) {
    if (await this.usersService.findByEmail(email)) {
      throw new ConflictException('User already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await this.usersService.createUser(email, hashedPassword);
   
    return newUser;
  }

  async verifyToken(token: string) {
    try {
      return this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
