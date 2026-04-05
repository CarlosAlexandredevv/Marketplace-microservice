import {
  IsEmail,
  IsEnum,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

enum Role {
  SELLER = 'seller',
  BUYER = 'buyer',
}

export class RegisterDto {
  @IsEmail()
  @ApiProperty({
    description: 'The email of the user',
    example: 'test@example.com',
  })
  email: string;

  @IsString()
  @MinLength(6)
  @MaxLength(32)
  @ApiProperty({
    description: 'The password of the user',
    example: 'password',
    minLength: 6,
    maxLength: 32,
  })
  password: string;

  @IsString()
  @MinLength(1)
  @MaxLength(32)
  @ApiProperty({
    description: 'The first name of the user',
    example: 'John',
  })
  firstName: string;

  @IsString()
  @MinLength(1)
  @MaxLength(32)
  @ApiProperty({
    description: 'The last name of the user',
    example: 'Doe',
  })
  lastName: string;

  @ApiProperty({
    description: 'The role of the user',
    example: Role.BUYER,
    enum: Role,
    required: false,
  })
  @IsOptional()
  @IsEnum(Role)
  role?: Role = Role.BUYER;
}
