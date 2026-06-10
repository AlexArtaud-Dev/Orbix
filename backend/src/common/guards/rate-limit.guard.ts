import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;

const store = new Map<string, number[]>();

@Injectable()
export class RateLimitGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<{ ip?: string; ips?: string[] }>();
    const ip = (req.ips?.length ? req.ips[0] : req.ip) ?? 'unknown';
    const now = Date.now();
    const hits = (store.get(ip) ?? []).filter((ts) => now - ts < WINDOW_MS);
    hits.push(now);
    store.set(ip, hits);
    if (hits.length > MAX_REQUESTS) {
      throw new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }
}
