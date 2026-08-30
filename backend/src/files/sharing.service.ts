import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { FileStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FilesService, FILE_SELECT } from './files.service';
import { UsersService } from '../users/users.service';
import { S3Service } from './s3.service';

function generateToken(): string {
  return randomBytes(24).toString('base64url');
}

@Injectable()
export class SharingService {
  constructor(
    private prisma: PrismaService,
    private filesService: FilesService,
    private usersService: UsersService,
    private s3: S3Service,
  ) {}

  async shareWithUser(ownerId: string, fileId: string, email: string) {
    const file = await this.filesService.getOwnedFile(ownerId, fileId);
    if (file.status !== FileStatus.READY) {
      throw new BadRequestException('File is not ready to share');
    }

    const target = await this.usersService.findByEmail(email);
    if (!target) {
      throw new NotFoundException('No user with that email');
    }
    if (target.id === ownerId) {
      throw new BadRequestException('You already own this file');
    }

    const share = await this.prisma.fileShare.upsert({
      where: { fileId_userId: { fileId, userId: target.id } },
      create: { fileId, userId: target.id },
      update: {},
    });

    return { id: share.id, email: target.email, createdAt: share.createdAt };
  }

  async listShares(ownerId: string, fileId: string) {
    await this.filesService.getOwnedFile(ownerId, fileId);

    const shares = await this.prisma.fileShare.findMany({
      where: { fileId },
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return shares.map((share) => ({
      id: share.id,
      email: share.user.email,
      createdAt: share.createdAt,
    }));
  }

  async revokeShare(ownerId: string, fileId: string, shareId: string) {
    await this.filesService.getOwnedFile(ownerId, fileId);

    const { count } = await this.prisma.fileShare.deleteMany({
      where: { id: shareId, fileId },
    });
    if (count === 0) {
      throw new NotFoundException('Share not found');
    }

    return { success: true };
  }

  async listSharedWithMe(userId: string) {
    const shares = await this.prisma.fileShare.findMany({
      where: { userId, file: { status: FileStatus.READY } },
      include: { file: { select: FILE_SELECT } },
      orderBy: { createdAt: 'desc' },
    });

    return shares.map((share) => share.file);
  }

  async getOrCreateShareLink(ownerId: string, fileId: string) {
    const file = await this.filesService.getOwnedFile(ownerId, fileId);
    if (file.status !== FileStatus.READY) {
      throw new BadRequestException('File is not ready to share');
    }

    const existing = await this.prisma.shareLink.findUnique({
      where: { fileId },
    });
    if (existing) {
      return { token: existing.token };
    }

    // Collision on a 192-bit random token is astronomically unlikely; the
    // retry is belt-and-braces, not a real expectation.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const link = await this.prisma.shareLink.create({
          data: { fileId, token: generateToken() },
        });
        return { token: link.token };
      } catch (err) {
        if (attempt === 1) throw err;
      }
    }
    throw new Error('Could not create share link');
  }

  async getShareLinkStatus(ownerId: string, fileId: string) {
    await this.filesService.getOwnedFile(ownerId, fileId);

    const link = await this.prisma.shareLink.findUnique({ where: { fileId } });
    return { active: !!link, token: link?.token ?? null };
  }

  async revokeShareLink(ownerId: string, fileId: string) {
    await this.filesService.getOwnedFile(ownerId, fileId);

    await this.prisma.shareLink.deleteMany({ where: { fileId } });
    return { success: true };
  }

  async resolvePublicToken(token: string) {
    const link = await this.prisma.shareLink.findUnique({
      where: { token },
      include: { file: true },
    });

    if (!link || link.file.status !== FileStatus.READY) {
      throw new NotFoundException('Link not found or has been revoked');
    }

    // Explicit pick, not the full row: s3Key/ownerId must never reach an
    // unauthenticated caller.
    const { id, filename, mimeType, size, createdAt } = link.file;
    return { id, filename, mimeType, size, createdAt };
  }

  async getPublicDownloadUrl(token: string) {
    const link = await this.prisma.shareLink.findUnique({
      where: { token },
      include: { file: true },
    });

    if (!link || link.file.status !== FileStatus.READY) {
      throw new NotFoundException('Link not found or has been revoked');
    }

    const url = await this.s3.getPresignedDownloadUrl(
      link.file.s3Key,
      link.file.filename,
      link.file.mimeType,
    );
    return { url };
  }
}
