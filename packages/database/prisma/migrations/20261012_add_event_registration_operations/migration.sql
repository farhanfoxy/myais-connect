ALTER TYPE "NotificationEventType" ADD VALUE 'EVENT_REGISTRATION_CONFIRMED';
ALTER TYPE "NotificationEventType" ADD VALUE 'EVENT_REGISTRATION_CANCELLED';
ALTER TYPE "NotificationEventType" ADD VALUE 'EVENT_CANCELLED';
ALTER TYPE "NotificationEventType" ADD VALUE 'EVENT_CHECKED_IN';

ALTER TABLE "EventRegistration"
ADD COLUMN "ticketCode" TEXT,
ADD COLUMN "checkedInAt" TIMESTAMPTZ(3),
ADD COLUMN "checkedInByUserId" UUID;

CREATE UNIQUE INDEX "EventRegistration_ticketCode_key" ON "EventRegistration"("ticketCode");
CREATE UNIQUE INDEX "EventRegistration_eventId_userId_key" ON "EventRegistration"("eventId", "userId");
CREATE INDEX "EventRegistration_eventId_status_idx" ON "EventRegistration"("eventId", "status");
CREATE INDEX "EventRegistration_checkedInByUserId_idx" ON "EventRegistration"("checkedInByUserId");

ALTER TABLE "EventRegistration"
ADD CONSTRAINT "EventRegistration_checkedInByUserId_fkey"
FOREIGN KEY ("checkedInByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
