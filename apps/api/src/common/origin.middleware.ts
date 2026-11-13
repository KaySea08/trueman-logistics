import { ForbiddenException, Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
@Injectable()
export class OriginMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      const origin = req.headers.origin;
      const allowed = (process.env.WEB_ORIGIN ?? 'http://localhost:5173').split(',').map((x) => x.trim());
      const hasSessionCookie = Boolean(req.headers.cookie?.includes('trueman_session='));
      if ((origin && !allowed.includes(origin)) || (hasSessionCookie && !origin)) throw new ForbiddenException('Untrusted request origin.');
    }
    next();
  }
}
