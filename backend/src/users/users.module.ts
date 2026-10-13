import { Module } from '@nestjs/common';
import { UsersService } from './users.service';

@Module({
  providers: [UsersService],
  exports: [UsersService], // allows AuthModule to use it
})
export class UsersModule {}
