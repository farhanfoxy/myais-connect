import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { EnvironmentError, loadEnvironment } from './config/environment.js';

async function bootstrap(): Promise<void> {
  const environment = loadEnvironment();
  const app = await NestFactory.create(AppModule, { abortOnError: false, logger: false });
  app.enableShutdownHooks();
  try {
  await app.listen(environment.port, environment.host);
} catch (error) {
  await app.close();
  throw error;
}
}

void bootstrap().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(`${error.name}: ${error.message}`);
  } else {
    console.error('API startup failed');
  }

  process.exitCode = 1;
});
