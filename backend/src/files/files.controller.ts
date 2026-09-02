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
import { SharingService } from './sharing.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CreateUploadUrlDto } from './dto/create-upload-url.dto';
import { CreateShareDto } from './dto/create-share.dto';

type AuthedRequest = Request & { user: { userId: string; email: string } };

// Looser than the app-wide default: a single upload costs two requests here
// (upload-url, then complete), so the 20/min default let a user manage only
// a handful of files a minute before tripping the limiter.
const FILES_THROTTLE = { default: { limit: 60, ttl: 60_000 } };

@Throttle(FILES_THROTTLE)
@UseGuards(JwtAuthGuard)
@Controller('files')
export class FilesController {
  constructor(
    private filesService: FilesService,
    private sharingService: SharingService,
  ) {}

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

  @Get('recent')
  listRecent(@Req() req: AuthedRequest) {
    return this.filesService.listRecent(req.user.userId);
  }

  @Get('favorites')
  listFavorites(@Req() req: AuthedRequest) {
    return this.filesService.listFavorites(req.user.userId);
  }

  @Get('trash')
  listTrash(@Req() req: AuthedRequest) {
    return this.filesService.listTrash(req.user.userId);
  }

  @Get(':id/download-url')
  getDownloadUrl(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.filesService.getDownloadUrl(req.user.userId, id);
  }

  // Moves the file to Trash. Delete Forever (below) is the real, final delete.
  @Delete(':id')
  remove(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.filesService.moveToTrash(req.user.userId, id);
  }

  @Post(':id/restore')
  restore(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.filesService.restoreFromTrash(req.user.userId, id);
  }

  @Delete(':id/permanent')
  permanentlyDelete(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.filesService.permanentlyDelete(req.user.userId, id);
  }

  @Post(':id/favorite')
  favorite(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.filesService.favoriteFile(req.user.userId, id);
  }

  @Delete(':id/favorite')
  unfavorite(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.filesService.unfavoriteFile(req.user.userId, id);
  }

  @Get('shared-with-me')
  listSharedWithMe(@Req() req: AuthedRequest) {
    return this.sharingService.listSharedWithMe(req.user.userId);
  }

  @Post(':id/shares')
  shareWithUser(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateShareDto,
  ) {
    return this.sharingService.shareWithUser(req.user.userId, id, dto.email);
  }

  @Get(':id/shares')
  listShares(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.sharingService.listShares(req.user.userId, id);
  }

  @Delete(':id/shares/:shareId')
  revokeShare(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('shareId', ParseUUIDPipe) shareId: string,
  ) {
    return this.sharingService.revokeShare(req.user.userId, id, shareId);
  }

  @Post(':id/share-link')
  createShareLink(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.sharingService.getOrCreateShareLink(req.user.userId, id);
  }

  @Get(':id/share-link')
  getShareLinkStatus(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.sharingService.getShareLinkStatus(req.user.userId, id);
  }

  @Delete(':id/share-link')
  revokeShareLink(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.sharingService.revokeShareLink(req.user.userId, id);
  }
}
