import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { FilesController } from './files.controller';
import { PublicSharesController } from './public-shares.controller';
import { FilesService } from './files.service';
import { SharingService } from './sharing.service';
import { TrashCleanupService } from './trash-cleanup.service';
import { S3Service } from './s3.service';

@Module({
  imports: [UsersModule],
  controllers: [FilesController, PublicSharesController],
  providers: [FilesService, SharingService, TrashCleanupService, S3Service],
})
export class FilesModule {}
