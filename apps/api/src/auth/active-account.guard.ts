import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { canAccessProtectedApi } from './account-access.js';
import type { AuthenticatedRequest } from './auth.types.js';

@Injectable()
export class ActiveAccountGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const principal = context.switchToHttp().getRequest<AuthenticatedRequest>().principal;
    if (!principal) throw new UnauthorizedException('Authentication required');
    if (!canAccessProtectedApi(principal.accountStatus))
      throw new ForbiddenException('Account access denied');
    return true;
  }
}
