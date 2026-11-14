import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";

async function bootstrap() {
  process.env.QUOTE_WORKER_ENABLED = "true";
  const app = await NestFactory.createApplicationContext(AppModule);
  app.enableShutdownHooks();
}

void bootstrap().catch((error: unknown) => {
  const reason = error instanceof Error ? error.name : "UnknownError";
  process.stderr.write(`Quote worker failed to start: ${reason}\n`);
  process.exitCode = 1;
});
