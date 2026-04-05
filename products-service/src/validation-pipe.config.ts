import {
  BadRequestException,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';

function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): { field: string; messages: string[] }[] {
  const result: { field: string; messages: string[] }[] = [];
  for (const err of errors) {
    const path = parentPath ? `${parentPath}.${err.property}` : err.property;
    if (err.constraints) {
      result.push({ field: path, messages: Object.values(err.constraints) });
    }
    if (err.children?.length) {
      result.push(...flattenValidationErrors(err.children, path));
    }
  }
  return result;
}

export function createAppValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    exceptionFactory: (errors: ValidationError[]) => {
      const validationErrors = flattenValidationErrors(errors);
      return new BadRequestException({
        statusCode: 400,
        message: 'Erro de validação',
        errors: validationErrors,
      });
    },
  });
}
