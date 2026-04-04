import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserRole } from '../../users/entities/user.entity';

export class RegisterDto {
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @IsNotEmpty({ message: 'O e-mail é obrigatório.' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'A senha deve ter no mínimo 6 caracteres.' })
  @IsNotEmpty({ message: 'A senha é obrigatória.' })
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'O primeiro nome é obrigatório.' })
  @MaxLength(100, {
    message: 'O primeiro nome pode ter no máximo 100 caracteres.',
  })
  firstName: string;

  @IsString()
  @IsNotEmpty({ message: 'O sobrenome é obrigatório.' })
  @MaxLength(100, { message: 'O sobrenome pode ter no máximo 100 caracteres.' })
  lastName: string;

  @IsEnum(UserRole, {
    message: 'O papel deve ser seller ou buyer.',
  })
  @IsNotEmpty({ message: 'O papel é obrigatório.' })
  role: UserRole;
}
