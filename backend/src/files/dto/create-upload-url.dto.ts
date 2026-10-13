import {
  IsString,
  IsNotEmpty,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { MAX_UPLOAD_SIZE_BYTES } from '../constants';

export class CreateUploadUrlDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255) // matches common filesystem filename limits (e.g. ext4, NTFS)
  filename: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255) // real MIME types are short; this just bounds an unbounded string
  mimeType: string;

  @IsInt()
  @Min(1)
  @Max(MAX_UPLOAD_SIZE_BYTES)
  size: number;
}
