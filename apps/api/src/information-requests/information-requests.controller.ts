import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ActiveAccountGuard } from '../auth/active-account.guard.js';
import type { CanonicalPrincipal } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { SupabaseJwtGuard } from '../auth/supabase-jwt.guard.js';
import { InformationRequestsService } from './information-requests.service.js';

@Controller('applications/:applicationId/information-requests')
@UseGuards(SupabaseJwtGuard, ActiveAccountGuard)
export class InformationRequestsController {
  constructor(private readonly requests: InformationRequestsService) {}

  @Post(':requestId/attachment-upload')
  initiateAttachmentUpload(
    @CurrentUser() user: CanonicalPrincipal,
    @Param('applicationId') applicationId: string,
    @Param('requestId') requestId: string,
    @Body() input: unknown,
  ) {
    return this.requests.initiateAttachmentUpload(user.id, applicationId, requestId, input);
  }

  @Post(':requestId/respond')
  respond(
    @CurrentUser() user: CanonicalPrincipal,
    @Param('applicationId') applicationId: string,
    @Param('requestId') requestId: string,
    @Body() input: unknown,
  ) {
    return this.requests.respond(user.id, applicationId, requestId, input);
  }
}
