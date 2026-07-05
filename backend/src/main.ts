process.env.TZ = 'Asia/Dhaka';

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
import { AppModule } from './app.module';
// Use default import so express() is callable on both ESM and CJS runtimes.
// 'import * as express' produces a namespace object, NOT the function itself.
import express, { Express, Request, Response } from 'express';
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
        // Vercel has a read-only filesystem – wrapped in try/catch so it never crashes
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
// Cached so the serverless function reuses the warm NestJS instance across
// invocations (avoids full cold-start on every request).
let cachedApp: Express | null = null;

async function createApp(): Promise<Express> {
  if (cachedApp) return cachedApp;

  // express() is callable only when using the default import, not namespace import
  const expressInstance: Express = express();

  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressInstance),
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

  cachedApp = expressInstance;
  return expressInstance;
}

// ── Local development bootstrap ────────────────────────────────────────────────
// Only called locally (nest start / ts-node). Skipped entirely on Vercel.
if (process.env['VERCEL'] !== '1') {
  void (async () => {
    const expressInstance = await createApp();
    const port = Number(process.env['PORT']) || 3001;
    expressInstance.listen(port, () => {
      console.log(`🚀 Server running on http://localhost:${port}/api`);
    });
  })();
}

// ── Vercel serverless default export ──────────────────────────────────────────
// Vercel calls this for every incoming request.
export default async function handler(req: Request, res: Response) {
  const app = await createApp();
  app(req, res);
}
