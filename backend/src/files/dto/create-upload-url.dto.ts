import { IsString, IsNotEmpty, IsInt, Min, Max } from 'class-validator';
import { MAX_UPLOAD_SIZE_BYTES } from '../constants';

export class CreateUploadUrlDto {
  @IsString()
  @IsNotEmpty()
  filename: string;

  @IsString()
  @IsNotEmpty()
  mimeType: string;

  @IsInt()
  @Min(1)
  @Max(MAX_UPLOAD_SIZE_BYTES)
  size: number;
}
