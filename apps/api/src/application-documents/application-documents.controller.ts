import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ActiveAccountGuard } from '../auth/active-account.guard.js';
import type { CanonicalPrincipal } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { SupabaseJwtGuard } from '../auth/supabase-jwt.guard.js';
import { ApplicationDocumentsService } from './application-documents.service.js';

@Controller('applications/:applicationId/documents')
@UseGuards(SupabaseJwtGuard, ActiveAccountGuard)
export class ApplicationDocumentsController {
  constructor(private readonly documents: ApplicationDocumentsService) {}

  @Post('uploads')
  initiateUpload(@CurrentUser() user: CanonicalPrincipal, @Param('applicationId') applicationId: string,
    @Body() input: unknown) {
    return this.documents.initiateUpload(user.id, applicationId, input);
  }

  @Post('uploads/finalize')
  finalizeUpload(@CurrentUser() user: CanonicalPrincipal, @Param('applicationId') applicationId: string,
    @Body() input: unknown) {
    return this.documents.finalizeUpload(user.id, applicationId, input);
  }

  @Get()
  listOwn(@CurrentUser() user: CanonicalPrincipal, @Param('applicationId') applicationId: string) {
    return this.documents.listOwn(user.id, applicationId);
  }

  @Get(':documentId/download')
  downloadOwn(@CurrentUser() user: CanonicalPrincipal, @Param('applicationId') applicationId: string,
    @Param('documentId') documentId: string) {
    return this.documents.downloadOwn(user.id, applicationId, documentId);
  }

  @Delete(':documentId')
  deleteOwn(@CurrentUser() user: CanonicalPrincipal, @Param('applicationId') applicationId: string,
    @Param('documentId') documentId: string) {
    return this.documents.deleteOwn(user.id, applicationId, documentId);
  }
}
