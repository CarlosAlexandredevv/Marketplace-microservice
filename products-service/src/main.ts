import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createAppValidationPipe } from './validation-pipe.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(createAppValidationPipe());

  const port = process.env.PORT || 3001;
  await app.listen(port);
}
void bootstrap();
