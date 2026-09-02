import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { FilesService } from './files.service';
import { TRASH_RETENTION_MS } from './constants';

// Runs unattended on its own timer, with no request context and no
// per-owner scoping — a different lifecycle from FilesService's
// request-scoped, ownership-checked methods, so it lives separately.
@Injectable()
export class TrashCleanupService {
  private readonly logger = new Logger(TrashCleanupService.name);

  constructor(
    private prisma: PrismaService,
    private filesService: FilesService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async purgeExpiredTrash() {
    const cutoff = new Date(Date.now() - TRASH_RETENTION_MS);
    const expired = await this.prisma.file.findMany({
      where: { deletedAt: { lt: cutoff } },
      select: { id: true, s3Key: true },
    });

    for (const file of expired) {
      try {
        await this.filesService.discard(file.id, file.s3Key);
      } catch (err) {
        // Best effort, same as reapAbandonedUploads: a failure here must not
        // stop the rest of the sweep. The row stays in Trash and is retried
        // on the next run.
        this.logger.warn(
          `Failed to purge trashed file ${file.id} (${file.s3Key})`,
          err instanceof Error ? err.stack : undefined,
        );
      }
    }
  }
}
