import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

interface ErrorBody {
  code: string;
  message: string;
  details?: unknown[];
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      let error: ErrorBody;

      if (typeof body === 'object' && body !== null && 'error' in body) {
        error = (body as { error: ErrorBody }).error;
      } else if (
        typeof body === 'object' &&
        body !== null &&
        'message' in body
      ) {
        const msg = body as { message: string | string[] };
        error = {
          code: this.statusToCode(status),
          message: Array.isArray(msg.message) ? msg.message[0] : msg.message,
          details: Array.isArray(msg.message) ? msg.message : undefined,
        };
      } else {
        error = {
          code: this.statusToCode(status),
          message: typeof body === 'string' ? body : 'An error occurred',
        };
      }

      response.status(status).json({ error });
    } else {
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: { code: 'UNHANDLED', message: 'An unexpected error occurred' },
      });
    }
  }

  private statusToCode(status: number): string {
    const map: Record<number, string> = {
      400: 'INVALID_INPUT',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'INVALID_INPUT',
      500: 'UNHANDLED',
      502: 'SMTP_ERROR',
    };
    return map[status] ?? 'UNHANDLED';
  }
}
