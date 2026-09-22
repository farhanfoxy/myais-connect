import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@myais/database';
import { canAccessProtectedApi } from './account-access.js';
import type { AuthenticatedRequest } from './auth.types.js';
import { ROLES_KEY } from './roles.decorator.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const principal = context.switchToHttp().getRequest<AuthenticatedRequest>().principal;
    if (!principal) throw new UnauthorizedException('Authentication required');
    if (!canAccessProtectedApi(principal.accountStatus))
      throw new ForbiddenException('Account access denied');
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY,
      [context.getHandler(), context.getClass()]);
    if (!roles?.length) return true;
    if (!principal.role || !roles.includes(principal.role))
      throw new ForbiddenException('Insufficient role');
    return true;
  }
}
