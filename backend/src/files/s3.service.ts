import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Strips characters that would break or inject into the
// Content-Disposition header, and encodes the filename per RFC 5987 so
// non-ASCII names survive too.
function sanitizeForContentDisposition(filename: string): string {
  const cleaned = filename.replace(/["\r\n]/g, '');
  const asciiFallback = cleaned.replace(/[^\x20-\x7E]/g, '_');
  const encoded = encodeURIComponent(cleaned);
  return `filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

@Injectable()
export class S3Service {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    const region = config.get<string>('AWS_REGION');
    const bucket = config.get<string>('AWS_S3_BUCKET');
    const accessKeyId = config.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = config.get<string>('AWS_SECRET_ACCESS_KEY');

    if (!region || !bucket || !accessKeyId || !secretAccessKey) {
      throw new Error(
        'Missing required AWS S3 environment variable(s): AWS_REGION, AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY',
      );
    }

    this.bucket = bucket;
    this.client = new S3Client({
      region,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  async createPresignedPost(key: string, mimeType: string, maxBytes: number) {
    return createPresignedPost(this.client, {
      Bucket: this.bucket,
      Key: key,
      Conditions: [
        ['content-length-range', 0, maxBytes],
        ['eq', '$Content-Type', mimeType],
      ],
      Fields: {
        'Content-Type': mimeType,
      },
      Expires: 60,
    });
  }

  async getPresignedDownloadUrl(
    key: string,
    downloadFilename: string,
    mimeType: string,
  ) {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentDisposition: `attachment; ${sanitizeForContentDisposition(downloadFilename)}`,
      ResponseContentType: mimeType,
    });
    return getSignedUrl(this.client, command, { expiresIn: 300 });
  }

  async deleteObject(key: string) {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
