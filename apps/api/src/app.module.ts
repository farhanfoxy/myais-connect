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
import { PaymentsModule } from './payments/payments.module.js';
import { ReviewerPaymentsModule } from './reviewer-payments/reviewer-payments.module.js';
import { MembershipsModule } from './memberships/memberships.module.js';
import { EventsModule } from './events/events.module.js';
import { AdminDashboardModule } from './admin-dashboard/admin-dashboard.module.js';
import { AnnouncementsModule } from './announcements/announcements.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { AdminMembersModule } from './admin-members/admin-members.module.js';
import { AuditLogsModule } from './audit-logs/audit-logs.module.js';

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
    PaymentsModule,
    ReviewerPaymentsModule,
    MembershipsModule,
    EventsModule,
    AdminDashboardModule,
    AnnouncementsModule,
    NotificationsModule,
    ReportsModule,
    AdminMembersModule,
    AuditLogsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
