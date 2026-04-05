import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false },
    { message: 'price deve ser um número com no máximo 2 casas decimais' },
  )
  @Min(0.01, { message: 'price deve ser no mínimo 0,01' })
  price: number;

  @Type(() => Number)
  @IsInt({ message: 'stock deve ser um número inteiro' })
  @Min(0, { message: 'stock deve ser no mínimo 0' })
  stock: number;
}
