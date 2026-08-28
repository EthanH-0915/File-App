import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { FilesService } from './files.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CreateUploadUrlDto } from './dto/create-upload-url.dto';

type AuthedRequest = Request & { user: { userId: string; email: string } };

// Looser than the app-wide default: a single upload costs two requests here
// (upload-url, then complete), so the 20/min default let a user manage only
// a handful of files a minute before tripping the limiter.
const FILES_THROTTLE = { default: { limit: 60, ttl: 60_000 } };

@Throttle(FILES_THROTTLE)
@UseGuards(JwtAuthGuard)
@Controller('files')
export class FilesController {
  constructor(private filesService: FilesService) {}

  @Post('upload-url')
  createUploadUrl(@Req() req: AuthedRequest, @Body() dto: CreateUploadUrlDto) {
    return this.filesService.createUploadUrl(req.user.userId, dto);
  }

  @Post(':id/complete')
  completeUpload(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.filesService.completeUpload(req.user.userId, id);
  }

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.filesService.listFiles(req.user.userId);
  }

  @Get(':id/download-url')
  getDownloadUrl(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.filesService.getDownloadUrl(req.user.userId, id);
  }

  @Delete(':id')
  remove(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.filesService.deleteFile(req.user.userId, id);
  }
}
