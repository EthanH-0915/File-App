import { IsEmail, IsNotEmpty } from 'class-validator';

export class CreateShareDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
