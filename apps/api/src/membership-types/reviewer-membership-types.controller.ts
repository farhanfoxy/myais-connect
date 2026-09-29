import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRole } from '@myais/database';
import { ActiveAccountGuard } from '../auth/active-account.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { SupabaseJwtGuard } from '../auth/supabase-jwt.guard.js';
import { MembershipTypesService } from './membership-types.service.js';

const membershipTypeApproverRoles = [UserRole.PRESIDENT, UserRole.SYSTEM_ADMINISTRATOR];

@Controller('reviewer/membership-types')
@UseGuards(SupabaseJwtGuard, ActiveAccountGuard, RolesGuard)
@Roles(...membershipTypeApproverRoles)
export class ReviewerMembershipTypesController {
  constructor(private readonly membershipTypes: MembershipTypesService) {}

  @Get()
  list() {
    return this.membershipTypes.listApproverTypes();
  }
}
