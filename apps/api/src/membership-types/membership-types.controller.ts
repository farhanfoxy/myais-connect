import { Controller, Get, UseGuards } from '@nestjs/common';
import { ActiveAccountGuard } from '../auth/active-account.guard.js';
import { SupabaseJwtGuard } from '../auth/supabase-jwt.guard.js';
import { MembershipTypesService } from './membership-types.service.js';

@Controller('registration/membership-types')
@UseGuards(SupabaseJwtGuard, ActiveAccountGuard)
export class MembershipTypesController {
  constructor(private readonly membershipTypes: MembershipTypesService) {}

  @Get()
  list() {
    return this.membershipTypes.listApplicantTypes();
  }
}
