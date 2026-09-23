import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@myais/database';
import { ActiveAccountGuard } from '../auth/active-account.guard.js';
import type { CanonicalPrincipal } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { SupabaseJwtGuard } from '../auth/supabase-jwt.guard.js';
import { ReviewerApplicationsService } from './reviewer-applications.service.js';

const reviewerRoles = [
  UserRole.PRESIDENT,
  UserRole.DEPUTY_PRESIDENT,
  UserRole.SECRETARY,
  UserRole.ASSISTANT_SECRETARY,
  UserRole.COMMITTEE_MEMBER,
  UserRole.SYSTEM_ADMINISTRATOR,
];

@Controller('reviewer/applications')
@UseGuards(SupabaseJwtGuard, ActiveAccountGuard, RolesGuard)
@Roles(...reviewerRoles)
export class ReviewerApplicationsController {
  constructor(private readonly applications: ReviewerApplicationsService) {}

  @Get()
  list(@Query() query: unknown) {
    return this.applications.list(query);
  }

  @Get(':applicationId/documents/:documentId/download')
  downloadDocument(@Param('applicationId') applicationId: string, @Param('documentId') documentId: string) {
    return this.applications.downloadDocument(applicationId, documentId);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.applications.detail(id);
  }

  @Post(':id/start-review')
  startReview(@CurrentUser() reviewer: CanonicalPrincipal, @Param('id') id: string, @Body() input: unknown) {
    return this.applications.startReview(reviewer, id, input);
  }

  @Post(':id/request-information')
  requestInformation(@CurrentUser() reviewer: CanonicalPrincipal, @Param('id') id: string,
    @Body() input: unknown) {
    return this.applications.requestInformation(reviewer, id, input);
  }

  @Post(':id/recommend-approval')
  recommendApproval(@CurrentUser() reviewer: CanonicalPrincipal, @Param('id') id: string,
    @Body() input: unknown) {
    return this.applications.recommendApproval(reviewer, id, input);
  }

  @Post(':id/reject')
  reject(@CurrentUser() reviewer: CanonicalPrincipal, @Param('id') id: string, @Body() input: unknown) {
    return this.applications.reject(reviewer, id, input);
  }
}
