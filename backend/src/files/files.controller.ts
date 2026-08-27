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
import type { Request } from 'express';
import { FilesService } from './files.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CreateUploadUrlDto } from './dto/create-upload-url.dto';

type AuthedRequest = Request & { user: { userId: string; email: string } };

@UseGuards(JwtAuthGuard)
@Controller('files')
export class FilesController {
  constructor(private filesService: FilesService) {}

  @Post('upload-url')
  createUploadUrl(@Req() req: AuthedRequest, @Body() dto: CreateUploadUrlDto) {
    return this.filesService.createUploadUrl(req.user.userId, dto);
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
