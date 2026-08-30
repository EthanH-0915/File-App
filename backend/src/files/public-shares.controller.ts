import { Controller, Get, Param } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SharingService } from './sharing.service';

// Deliberately no @UseGuards(JwtAuthGuard) here, and a separate controller
// from FilesController — anyone with a link needs access with no account
// and no cookie at all.
@Throttle({ default: { limit: 20, ttl: 60_000 } })
@Controller('public/shares')
export class PublicSharesController {
  constructor(private sharingService: SharingService) {}

  @Get(':token')
  getSharedFile(@Param('token') token: string) {
    return this.sharingService.resolvePublicToken(token);
  }

  @Get(':token/download-url')
  getSharedDownloadUrl(@Param('token') token: string) {
    return this.sharingService.getPublicDownloadUrl(token);
  }
}
