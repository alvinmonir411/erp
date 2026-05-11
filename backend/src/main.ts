import {
  ValidationPipe,
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import * as express from 'express';
import * as fs from 'fs';
import * as path from 'path';

// ── Global exception filter ────────────────────────────────────────────────────
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    if (status >= 500) {
      try {
        // Vercel has a read-only filesystem – wrap in try/catch so it never crashes
        const errStr =
          exception instanceof Error
            ? exception.stack || exception.message
            : String(exception);
        fs.appendFileSync(
          path.join(process.cwd(), 'error.log'),
          `[${new Date().toISOString()}] 500 ERROR at ${request.url}:\n${errStr}\n\n`,
        );
      } catch {
        // silently ignore on read-only environments (e.g. Vercel)
      }
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message:
        exception instanceof Error
          ? exception.message
          : 'Internal server error',
    });
  }
}

// ── Shared app initialisation ──────────────────────────────────────────────────
// We cache the initialised app so the serverless function reuses it across
// warm invocations (cold-start optimisation).
let cachedApp: express.Express | null = null;

async function createApp(): Promise<express.Express> {
  if (cachedApp) return cachedApp;

  const expressApp = express();

  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressApp),
    { logger: ['error', 'warn', 'log'] },
  );

  const configService = app.get(ConfigService);

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: configService.get<string>('app.corsOrigin') ?? true,
    credentials: true,
  });

  app.useGlobalFilters(new AllExceptionsFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.init();

  cachedApp = expressApp;
  return expressApp;
}

// ── Local development bootstrap ────────────────────────────────────────────────
// Only called when running with `nest start` / `ts-node` locally.
if (process.env['VERCEL'] !== '1') {
  void (async () => {
    const expressApp = await createApp();
    const port = Number(process.env['PORT']) || 3001;
    expressApp.listen(port, () => {
      console.log(`🚀 Server running on http://localhost:${port}/api`);
    });
  })();
}

// ── Vercel serverless default export ──────────────────────────────────────────
// Vercel invokes this function for every request. `createApp()` is idempotent
// and returns immediately on warm invocations due to the cache above.
export default async function handler(
  req: express.Request,
  res: express.Response,
) {
  const app = await createApp();
  app(req, res);
}
