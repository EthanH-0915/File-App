import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { S3Service } from './s3.service';
import { CreateUploadUrlDto } from './dto/create-upload-url.dto';
import { MAX_UPLOAD_SIZE_BYTES } from './constants';

@Injectable()
export class FilesService {
  constructor(
    private prisma: PrismaService,
    private s3: S3Service,
  ) {}

  async createUploadUrl(ownerId: string, dto: CreateUploadUrlDto) {
    const s3Key = `files/${ownerId}/${randomUUID()}`;

    const file = await this.prisma.file.create({
      data: {
        filename: dto.filename,
        mimeType: dto.mimeType,
        size: dto.size,
        s3Key,
        ownerId,
      },
    });

    const { url, fields } = await this.s3.createPresignedPost(
      s3Key,
      dto.mimeType,
      MAX_UPLOAD_SIZE_BYTES,
    );

    return { fileId: file.id, url, fields };
  }

  async listFiles(ownerId: string) {
    return this.prisma.file.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDownloadUrl(ownerId: string, id: string) {
    const file = await this.findOwnedOrThrow(ownerId, id);
    const url = await this.s3.getPresignedDownloadUrl(
      file.s3Key,
      file.filename,
      file.mimeType,
    );
    return { url };
  }

  async deleteFile(ownerId: string, id: string) {
    const file = await this.findOwnedOrThrow(ownerId, id);

    await this.prisma.file.delete({ where: { id: file.id } });

    try {
      await this.s3.deleteObject(file.s3Key);
    } catch (err) {
      console.error(`Failed to delete S3 object ${file.s3Key}:`, err);
    }

    return { success: true };
  }

  private async findOwnedOrThrow(ownerId: string, id: string) {
    const file = await this.prisma.file.findUnique({ where: { id } });
    if (!file || file.ownerId !== ownerId) {
      throw new NotFoundException('File not found');
    }
    return file;
  }
}
