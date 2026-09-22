import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { CanonicalUserService } from './canonical-user.service.js';
import type { AuthenticatedRequest } from './auth.types.js';
import { SupabaseJwtVerifier } from './supabase-jwt.verifier.js';

@Injectable()
export class SupabaseJwtGuard implements CanActivate {
  constructor(
    @Inject(SupabaseJwtVerifier) private readonly verifier: SupabaseJwtVerifier,
    @Inject(CanonicalUserService) private readonly users: CanonicalUserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    if (typeof authorization !== 'string' || !/^Bearer [^\s]+$/i.test(authorization))
      throw new UnauthorizedException('Bearer access token required');
    const token = authorization.slice(7);
    let identity;
    try {
      identity = await this.verifier.verifyAccessToken(token);
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
    request.principal = await this.users.resolve(identity);
    return true;
  }
}
