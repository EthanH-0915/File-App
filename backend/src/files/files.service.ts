import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { FileStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { S3Service } from './s3.service';
import { CreateUploadUrlDto } from './dto/create-upload-url.dto';
import {
  MAX_UPLOAD_SIZE_BYTES,
  PENDING_UPLOAD_TTL_MS,
  RECENT_FILES_LIMIT,
} from './constants';

// Fields safe to hand back to the client. s3Key and ownerId are internal
// storage details and deliberately excluded.
export const FILE_SELECT = {
  id: true,
  filename: true,
  mimeType: true,
  size: true,
  createdAt: true,
  isFavorite: true,
  deletedAt: true,
} as const;

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    private prisma: PrismaService,
    private s3: S3Service,
  ) {}

  async createUploadUrl(ownerId: string, dto: CreateUploadUrlDto) {
    await this.reapAbandonedUploads(ownerId);

    const s3Key = `files/${ownerId}/${randomUUID()}`;

    // Presign before writing the row: if this throws, we don't leave a
    // PENDING record behind for an upload that was never even offered.
    const { url, fields } = await this.s3.createPresignedPost(
      s3Key,
      dto.mimeType,
      MAX_UPLOAD_SIZE_BYTES,
    );

    const file = await this.prisma.file.create({
      data: {
        filename: dto.filename,
        mimeType: dto.mimeType,
        // Provisional. completeUpload replaces this with the real
        // ContentLength once the object is confirmed in S3.
        size: dto.size,
        s3Key,
        ownerId,
        status: FileStatus.PENDING,
      },
    });

    return { fileId: file.id, url, fields };
  }

  // Called by the client after it has POSTed the object to S3. Verifies the
  // object is really there and records its true size, which is the only
  // point at which a file becomes visible in listings.
  async completeUpload(ownerId: string, id: string) {
    const file = await this.findOwnedOrThrow(ownerId, id);

    if (file.status === FileStatus.READY) {
      return { id: file.id, size: file.size };
    }

    const size = await this.s3.getObjectSize(file.s3Key);
    if (size === null) {
      throw new BadRequestException('Upload was not completed');
    }

    // S3's content-length-range condition should already have rejected both
    // of these, so this is belt-and-braces against the policy and these
    // bounds drifting apart.
    if (size < 1 || size > MAX_UPLOAD_SIZE_BYTES) {
      await this.discard(file.id, file.s3Key);
      throw new BadRequestException('Uploaded file has an invalid size');
    }

    const updated = await this.prisma.file.update({
      where: { id: file.id },
      data: { size, status: FileStatus.READY },
      select: FILE_SELECT,
    });

    return updated;
  }

  async listFiles(ownerId: string) {
    return this.prisma.file.findMany({
      where: { ownerId, status: FileStatus.READY, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: FILE_SELECT,
    });
  }

  async getDownloadUrl(userId: string, id: string) {
    const file = await this.findAccessibleOrThrow(userId, id);
    if (file.status !== FileStatus.READY || file.deletedAt) {
      throw new NotFoundException('File not found');
    }

    const url = await this.s3.getPresignedDownloadUrl(
      file.s3Key,
      file.filename,
      file.mimeType,
    );
    await this.touchLastAccessed(file.id);
    return { url };
  }

  // Bumps "last used" so the file surfaces in Recent. Called for any real
  // download — the owner's own, a share grantee's, or a public link's.
  async touchLastAccessed(id: string) {
    await this.prisma.file.update({
      where: { id },
      data: { lastAccessedAt: new Date() },
    });
  }

  // Owner-only access, for SharingService's share-management operations
  // (create/list/revoke a share or link). Thin wrapper so callers outside
  // this service can reuse the same not-found/ownership semantics without
  // findOwnedOrThrow itself becoming public.
  async getOwnedFile(ownerId: string, id: string) {
    return this.findOwnedOrThrow(ownerId, id);
  }

  // The existing Delete button: moves a file to Trash rather than deleting
  // it for real. permanentlyDelete is what actually removes it.
  async moveToTrash(ownerId: string, id: string) {
    const file = await this.findOwnedOrThrow(ownerId, id);
    if (file.deletedAt) {
      throw new NotFoundException('File not found');
    }
    return this.prisma.file.update({
      where: { id: file.id },
      data: { deletedAt: new Date() },
      select: FILE_SELECT,
    });
  }

  async restoreFromTrash(ownerId: string, id: string) {
    const file = await this.findOwnedOrThrow(ownerId, id);
    if (!file.deletedAt) {
      throw new NotFoundException('File not found');
    }
    return this.prisma.file.update({
      where: { id: file.id },
      data: { deletedAt: null },
      select: FILE_SELECT,
    });
  }

  // The real, final delete — only reachable from Trash.
  async permanentlyDelete(ownerId: string, id: string) {
    const file = await this.findOwnedOrThrow(ownerId, id);
    if (!file.deletedAt) {
      throw new NotFoundException('File not found');
    }
    await this.discard(file.id, file.s3Key);
    return { success: true };
  }

  async listTrash(ownerId: string) {
    return this.prisma.file.findMany({
      where: { ownerId, deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
      select: FILE_SELECT,
    });
  }

  async favoriteFile(ownerId: string, id: string) {
    const file = await this.findOwnedOrThrow(ownerId, id);
    if (file.deletedAt) {
      throw new NotFoundException('File not found');
    }
    return this.prisma.file.update({
      where: { id: file.id },
      data: { isFavorite: true },
      select: FILE_SELECT,
    });
  }

  async unfavoriteFile(ownerId: string, id: string) {
    const file = await this.findOwnedOrThrow(ownerId, id);
    if (file.deletedAt) {
      throw new NotFoundException('File not found');
    }
    return this.prisma.file.update({
      where: { id: file.id },
      data: { isFavorite: false },
      select: FILE_SELECT,
    });
  }

  async listFavorites(ownerId: string) {
    return this.prisma.file.findMany({
      where: {
        ownerId,
        isFavorite: true,
        deletedAt: null,
        status: FileStatus.READY,
      },
      orderBy: { createdAt: 'desc' },
      select: FILE_SELECT,
    });
  }

  async listRecent(ownerId: string) {
    return this.prisma.file.findMany({
      where: {
        ownerId,
        deletedAt: null,
        status: FileStatus.READY,
        lastAccessedAt: { not: null },
      },
      orderBy: { lastAccessedAt: 'desc' },
      take: RECENT_FILES_LIMIT,
      select: FILE_SELECT,
    });
  }

  // Removes the S3 object before the row, so a failed delete leaves a row
  // that still names the key and can be retried, rather than an orphaned
  // object no record points at any more. Not private: TrashCleanupService's
  // cron reuses this exact same S3-then-DB logic for expired trash.
  async discard(id: string, s3Key: string) {
    await this.s3.deleteObject(s3Key);
    await this.prisma.file.delete({ where: { id } });
  }

  // Uploads the client never confirmed: either it never reached S3, or it
  // did and the completion call was lost. Both leave a PENDING row that
  // would otherwise sit in the database forever.
  private async reapAbandonedUploads(ownerId: string) {
    const cutoff = new Date(Date.now() - PENDING_UPLOAD_TTL_MS);
    const stale = await this.prisma.file.findMany({
      where: {
        ownerId,
        status: FileStatus.PENDING,
        createdAt: { lt: cutoff },
      },
      select: { id: true, s3Key: true },
    });

    for (const file of stale) {
      try {
        await this.discard(file.id, file.s3Key);
      } catch (err) {
        // Best effort: a failure here must not block the new upload. The
        // row stays PENDING and will be retried on the next request.
        this.logger.warn(
          `Failed to reap abandoned upload ${file.id} (${file.s3Key})`,
          err instanceof Error ? err.stack : undefined,
        );
      }
    }
  }

  private async findOwnedOrThrow(ownerId: string, id: string) {
    const file = await this.prisma.file.findUnique({ where: { id } });
    if (!file || file.ownerId !== ownerId) {
      throw new NotFoundException('File not found');
    }
    return file;
  }

  // Like findOwnedOrThrow, but also lets someone the file was shared with
  // through. Both the "doesn't exist" and "exists but not yours/not shared
  // with you" cases throw the identical exception, so a non-owner still
  // can't distinguish the two.
  private async findAccessibleOrThrow(userId: string, id: string) {
    const file = await this.prisma.file.findUnique({ where: { id } });
    if (!file) {
      throw new NotFoundException('File not found');
    }
    if (file.ownerId === userId) {
      return file;
    }

    const share = await this.prisma.fileShare.findUnique({
      where: { fileId_userId: { fileId: id, userId } },
    });
    if (!share) {
      throw new NotFoundException('File not found');
    }
    return file;
  }
}
