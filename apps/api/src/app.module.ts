import { Module } from '@nestjs/common';
import { PrismaModule } from './database/prisma.module.js';
import { HealthController } from './health/health.controller.js';
import { AuthModule } from './auth/auth.module.js';
import { MembershipTypesModule } from './membership-types/membership-types.module.js';
import { ProfileModule } from './profile/profile.module.js';
import { EligibilityModule } from './eligibility/eligibility.module.js';
import { MembershipApplicationsModule } from './membership-applications/membership-applications.module.js';
import { ApplicationDocumentsModule } from './application-documents/application-documents.module.js';
import { InformationRequestsModule } from './information-requests/information-requests.module.js';
import { ReviewerApplicationsModule } from './reviewer-applications/reviewer-applications.module.js';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    MembershipTypesModule,
    ProfileModule,
    EligibilityModule,
    MembershipApplicationsModule,
    ApplicationDocumentsModule,
    InformationRequestsModule,
    ReviewerApplicationsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
