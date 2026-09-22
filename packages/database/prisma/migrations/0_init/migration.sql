-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AnnouncementCategory" AS ENUM ('GENERAL', 'EVENT', 'MEMBERSHIP', 'POLICY', 'TRAINING');

-- CreateEnum
CREATE TYPE "AnnouncementTargetAudience" AS ENUM ('ALL', 'MEMBERS', 'APPLICANTS', 'COMMITTEE');

-- CreateEnum
CREATE TYPE "AnnouncementStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ApplicationDocumentDocumentType" AS ENUM ('IDENTIFICATION', 'AIS_MEMBERSHIP_PROOF', 'PROFILE_PHOTO', 'PAYMENT_RECEIPT', 'ADDITIONAL_SUPPORTING_DOCUMENT', 'REQUESTED_INFORMATION');

-- CreateEnum
CREATE TYPE "ApplicationDocumentVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'INVALID', 'RESUBMISSION_REQUIRED');

-- CreateEnum
CREATE TYPE "ApplicationReviewDecision" AS ENUM ('START_REVIEW', 'REQUEST_INFORMATION', 'RECOMMEND_APPROVAL', 'APPROVE', 'REJECT', 'RETURN_FOR_CORRECTION');

-- CreateEnum
CREATE TYPE "EligibilityQuestionInputType" AS ENUM ('BOOLEAN', 'DATE', 'TEXT', 'SELECT');

-- CreateEnum
CREATE TYPE "EventCategory" AS ENUM ('Seminars and Webinars', 'Workshops', 'Meetings', 'MyDCIS', 'Conferences', 'Other');

-- CreateEnum
CREATE TYPE "EventVenueType" AS ENUM ('PHYSICAL', 'ONLINE', 'HYBRID');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'REGISTRATION_CLOSED', 'CANCELLED', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EventTargetAudience" AS ENUM ('MEMBERS', 'NON_MEMBERS', 'MEMBERS_AND_NON_MEMBERS');

-- CreateEnum
CREATE TYPE "EventRegistrationStatus" AS ENUM ('REGISTERED', 'CANCELLED', 'ATTENDED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "EventRegistrationPaymentStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "InformationRequestStatus" AS ENUM ('OPEN', 'RESPONDED', 'RESOLVED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "MemberProfileIdentificationType" AS ENUM ('NRIC', 'PASSPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "MemberProfileGender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('PENDING', 'ACTIVE', 'EXPIRED', 'SUSPENDED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "MembershipApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'ADDITIONAL_INFORMATION_REQUIRED', 'ELIGIBLE', 'RECOMMENDED_FOR_APPROVAL', 'APPROVED_PENDING_PAYMENT', 'PAYMENT_SUBMITTED', 'PAYMENT_UNDER_VERIFICATION', 'ACTIVE', 'REJECTED', 'EXPIRED', 'SUSPENDED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "MembershipTypeCode" AS ENUM ('ORDINARY', 'LIFETIME', 'ASSOCIATE', 'HONORARY');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('APPLICATION', 'PAYMENT', 'MEMBERSHIP', 'ANNOUNCEMENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "PaymentPaymentType" AS ENUM ('ENTRANCE_AND_ANNUAL', 'ENTRANCE_AND_LIFETIME', 'RENEWAL', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('NOT_SUBMITTED', 'SUBMITTED', 'UNDER_VERIFICATION', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RenewalApplicationStatus" AS ENUM ('PENDING', 'PAYMENT_SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SystemSettingSettingType" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'JSON');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('APPLICANT', 'ORDINARY_MEMBER', 'LIFETIME_MEMBER', 'ASSOCIATE_MEMBER', 'HONORARY_MEMBER', 'PRESIDENT', 'DEPUTY_PRESIDENT', 'SECRETARY', 'ASSISTANT_SECRETARY', 'TREASURER', 'COMMITTEE_MEMBER', 'SYSTEM_ADMINISTRATOR');

-- CreateEnum
CREATE TYPE "UserAccountStatus" AS ENUM ('ACTIVE', 'DISABLED', 'SUSPENDED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "legacyBase44Id" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "legacyCreatedAt" TIMESTAMPTZ(3),
    "legacyUpdatedAt" TIMESTAMPTZ(3),
    "role" "UserRole" DEFAULT 'APPLICANT',
    "phoneNumber" TEXT,
    "photoUrl" TEXT,
    "accountStatus" "UserAccountStatus" DEFAULT 'ACTIVE',
    "lastLoginAt" TIMESTAMPTZ(3),
    "email" TEXT,
    "legacyFullName" TEXT,
    "fullName" TEXT,
    "legacyRole" TEXT,
    "legacyPlatformStatus" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberProfile" (
    "id" UUID NOT NULL,
    "legacyBase44Id" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "legacyCreatedAt" TIMESTAMPTZ(3),
    "legacyUpdatedAt" TIMESTAMPTZ(3),
    "userId" UUID NOT NULL,
    "fullName" TEXT,
    "phoneNumber" TEXT,
    "identificationType" "MemberProfileIdentificationType",
    "identificationNumber" TEXT,
    "nationality" TEXT,
    "dateOfBirth" DATE,
    "gender" "MemberProfileGender",
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postcode" TEXT,
    "country" TEXT,
    "institution" TEXT,
    "occupation" TEXT,
    "department" TEXT,
    "areaOfExpertise" TEXT,
    "aisMember" BOOLEAN DEFAULT false,
    "aisMembershipNumber" TEXT,
    "aisMembershipExpiry" DATE,
    "profileCompletionPercentage" DOUBLE PRECISION DEFAULT 0,
    "legacyCreatedById" TEXT,
    "legacyCreatedBy" TEXT,
    "legacyIsSample" BOOLEAN,

    CONSTRAINT "MemberProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipType" (
    "id" UUID NOT NULL,
    "legacyBase44Id" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "legacyCreatedAt" TIMESTAMPTZ(3),
    "legacyUpdatedAt" TIMESTAMPTZ(3),
    "code" "MembershipTypeCode" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "entranceFee" DECIMAL(12,2) DEFAULT 0,
    "membershipFee" DECIMAL(12,2) DEFAULT 0,
    "validityMonths" DOUBLE PRECISION DEFAULT 12,
    "renewable" BOOLEAN DEFAULT true,
    "votingRights" BOOLEAN DEFAULT false,
    "applicantSelectable" BOOLEAN DEFAULT true,
    "active" BOOLEAN DEFAULT true,
    "legacyCreatedById" TEXT,
    "legacyCreatedBy" TEXT,
    "legacyIsSample" BOOLEAN,

    CONSTRAINT "MembershipType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipApplication" (
    "id" UUID NOT NULL,
    "legacyBase44Id" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "legacyCreatedAt" TIMESTAMPTZ(3),
    "legacyUpdatedAt" TIMESTAMPTZ(3),
    "applicationNumber" TEXT,
    "userId" UUID NOT NULL,
    "requestedMembershipTypeId" UUID,
    "recommendedMembershipTypeId" UUID,
    "approvedMembershipTypeId" UUID,
    "status" "MembershipApplicationStatus" DEFAULT 'DRAFT',
    "currentStep" DOUBLE PRECISION DEFAULT 1,
    "eligibilityScore" DOUBLE PRECISION,
    "eligibilityExplanation" TEXT,
    "submittedAt" TIMESTAMPTZ(3),
    "reviewedAt" TIMESTAMPTZ(3),
    "approvedAt" TIMESTAMPTZ(3),
    "rejectedAt" TIMESTAMPTZ(3),
    "rejectionReason" TEXT,
    "latestReviewerRemarks" TEXT,
    "reviewedByUserId" UUID,
    "approvedByUserId" UUID,
    "requestedMembershipTypeCode" TEXT,
    "recommendedMembershipTypeCode" TEXT,
    "approvedMembershipTypeCode" TEXT,
    "legacyCreatedById" TEXT,
    "legacyCreatedBy" TEXT,
    "legacyIsSample" BOOLEAN,

    CONSTRAINT "MembershipApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EligibilityQuestion" (
    "id" UUID NOT NULL,
    "legacyBase44Id" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "legacyCreatedAt" TIMESTAMPTZ(3),
    "legacyUpdatedAt" TIMESTAMPTZ(3),
    "code" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "inputType" "EligibilityQuestionInputType" NOT NULL,
    "options" TEXT,
    "displayOrder" DOUBLE PRECISION,
    "required" BOOLEAN DEFAULT true,
    "active" BOOLEAN DEFAULT true,
    "ordinaryRule" TEXT,
    "lifetimeRule" TEXT,
    "legacyCreatedById" TEXT,
    "legacyCreatedBy" TEXT,
    "legacyIsSample" BOOLEAN,

    CONSTRAINT "EligibilityQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EligibilityAnswer" (
    "id" UUID NOT NULL,
    "legacyBase44Id" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "legacyCreatedAt" TIMESTAMPTZ(3),
    "legacyUpdatedAt" TIMESTAMPTZ(3),
    "applicationId" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "questionCode" TEXT,
    "answerText" TEXT,
    "answerBoolean" BOOLEAN,
    "answerOption" TEXT,

    CONSTRAINT "EligibilityAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationDocument" (
    "id" UUID NOT NULL,
    "legacyBase44Id" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "legacyCreatedAt" TIMESTAMPTZ(3),
    "legacyUpdatedAt" TIMESTAMPTZ(3),
    "applicationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "documentType" "ApplicationDocumentDocumentType" NOT NULL,
    "fileUrl" TEXT,
    "originalFileName" TEXT,
    "mimeType" TEXT,
    "fileSize" DOUBLE PRECISION,
    "verificationStatus" "ApplicationDocumentVerificationStatus" DEFAULT 'PENDING',
    "reviewerRemarks" TEXT,
    "verifiedByUserId" UUID,
    "verifiedAt" TIMESTAMPTZ(3),
    "legacyCreatedById" TEXT,
    "legacyCreatedBy" TEXT,
    "legacyIsSample" BOOLEAN,

    CONSTRAINT "ApplicationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationReview" (
    "id" UUID NOT NULL,
    "legacyBase44Id" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "legacyCreatedAt" TIMESTAMPTZ(3),
    "legacyUpdatedAt" TIMESTAMPTZ(3),
    "applicationId" UUID NOT NULL,
    "reviewerUserId" UUID,
    "reviewerName" TEXT,
    "decision" "ApplicationReviewDecision" NOT NULL,
    "remarks" TEXT,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "legacyCreatedById" TEXT,
    "legacyCreatedBy" TEXT,
    "legacyIsSample" BOOLEAN,

    CONSTRAINT "ApplicationReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InformationRequest" (
    "id" UUID NOT NULL,
    "legacyBase44Id" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "legacyCreatedAt" TIMESTAMPTZ(3),
    "legacyUpdatedAt" TIMESTAMPTZ(3),
    "applicationId" UUID NOT NULL,
    "requestedByUserId" UUID,
    "requestedByName" TEXT,
    "message" TEXT NOT NULL,
    "dueDate" DATE,
    "status" "InformationRequestStatus" DEFAULT 'OPEN',
    "applicantResponse" TEXT,
    "responseAttachmentUrl" TEXT,
    "respondedAt" TIMESTAMPTZ(3),

    CONSTRAINT "InformationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" UUID NOT NULL,
    "legacyBase44Id" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "legacyCreatedAt" TIMESTAMPTZ(3),
    "legacyUpdatedAt" TIMESTAMPTZ(3),
    "membershipNumber" TEXT,
    "userId" UUID NOT NULL,
    "applicationId" UUID,
    "membershipTypeId" UUID NOT NULL,
    "membershipTypeCode" TEXT,
    "membershipTypeName" TEXT,
    "startDate" DATE,
    "expiryDate" DATE,
    "status" "MembershipStatus" DEFAULT 'PENDING',
    "votingEligible" BOOLEAN DEFAULT false,
    "activatedAt" TIMESTAMPTZ(3),
    "suspendedAt" TIMESTAMPTZ(3),
    "terminatedAt" TIMESTAMPTZ(3),
    "legacyCreatedById" TEXT,
    "legacyCreatedBy" TEXT,
    "legacyIsSample" BOOLEAN,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "legacyBase44Id" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "legacyCreatedAt" TIMESTAMPTZ(3),
    "legacyUpdatedAt" TIMESTAMPTZ(3),
    "paymentReference" TEXT,
    "userId" UUID NOT NULL,
    "applicationId" UUID,
    "membershipId" UUID,
    "paymentType" "PaymentPaymentType" NOT NULL,
    "entranceFee" DECIMAL(12,2) DEFAULT 0,
    "membershipFee" DECIMAL(12,2) DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT DEFAULT 'MYR',
    "paymentMethod" TEXT,
    "bankName" TEXT,
    "transactionReference" TEXT,
    "receiptUrl" TEXT,
    "status" "PaymentStatus" DEFAULT 'NOT_SUBMITTED',
    "paidAt" TIMESTAMPTZ(3),
    "submittedAt" TIMESTAMPTZ(3),
    "verifiedByUserId" UUID,
    "verifiedAt" TIMESTAMPTZ(3),
    "rejectionReason" TEXT,
    "treasurerRemarks" TEXT,
    "legacyCreatedById" TEXT,
    "legacyCreatedBy" TEXT,
    "legacyIsSample" BOOLEAN,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RenewalApplication" (
    "id" UUID NOT NULL,
    "legacyBase44Id" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "legacyCreatedAt" TIMESTAMPTZ(3),
    "legacyUpdatedAt" TIMESTAMPTZ(3),
    "renewalNumber" TEXT,
    "membershipId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "previousExpiryDate" DATE,
    "newExpiryDate" DATE,
    "fee" DECIMAL(12,2),
    "status" "RenewalApplicationStatus" DEFAULT 'PENDING',
    "submittedAt" TIMESTAMPTZ(3),
    "paymentId" UUID,
    "approvedAt" TIMESTAMPTZ(3),

    CONSTRAINT "RenewalApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" UUID NOT NULL,
    "legacyBase44Id" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "legacyCreatedAt" TIMESTAMPTZ(3),
    "legacyUpdatedAt" TIMESTAMPTZ(3),
    "eventNumber" TEXT,
    "title" TEXT NOT NULL,
    "slug" TEXT,
    "category" "EventCategory" NOT NULL,
    "summary" TEXT,
    "description" TEXT NOT NULL,
    "coverImage" TEXT,
    "speakerName" TEXT,
    "speakerTitle" TEXT,
    "eventType" TEXT,
    "venueType" "EventVenueType" NOT NULL,
    "venueName" TEXT,
    "physicalAddress" TEXT,
    "onlineMeetingUrl" TEXT,
    "startDate" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "endDate" DATE,
    "endTime" TEXT,
    "registrationStart" DATE,
    "registrationDeadline" DATE,
    "capacity" DOUBLE PRECISION,
    "limitedSeats" BOOLEAN DEFAULT false,
    "memberFee" DECIMAL(12,2) DEFAULT 0,
    "nonMemberFee" DECIMAL(12,2) DEFAULT 0,
    "currency" TEXT DEFAULT 'MYR',
    "paymentInstructions" TEXT,
    "registrationUrl" TEXT,
    "status" "EventStatus" DEFAULT 'DRAFT',
    "targetAudience" "EventTargetAudience" DEFAULT 'MEMBERS_AND_NON_MEMBERS',
    "createdByUserId" UUID,
    "legacyCreatedBy" TEXT,
    "publishedAt" TIMESTAMPTZ(3),
    "cancelledAt" TIMESTAMPTZ(3),
    "cancellationReason" TEXT,
    "placeholderImageNotice" BOOLEAN DEFAULT false,
    "legacyCreatedById" TEXT,
    "legacyPlatformCreatedBy" TEXT,
    "legacyIsSample" BOOLEAN,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kuala_Lumpur',

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventRegistration" (
    "id" UUID NOT NULL,
    "legacyBase44Id" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "legacyCreatedAt" TIMESTAMPTZ(3),
    "legacyUpdatedAt" TIMESTAMPTZ(3),
    "eventId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "attendeeName" TEXT,
    "attendeeEmail" TEXT,
    "status" "EventRegistrationStatus" DEFAULT 'REGISTERED',
    "paymentStatus" "EventRegistrationPaymentStatus" DEFAULT 'PENDING',
    "registeredAt" TIMESTAMPTZ(3),
    "notes" TEXT,

    CONSTRAINT "EventRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" UUID NOT NULL,
    "legacyBase44Id" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "legacyCreatedAt" TIMESTAMPTZ(3),
    "legacyUpdatedAt" TIMESTAMPTZ(3),
    "title" TEXT NOT NULL,
    "category" "AnnouncementCategory",
    "summary" TEXT,
    "content" TEXT NOT NULL,
    "coverImageUrl" TEXT,
    "attachmentUrl" TEXT,
    "targetAudience" "AnnouncementTargetAudience" DEFAULT 'ALL',
    "status" "AnnouncementStatus" DEFAULT 'DRAFT',
    "publishAt" TIMESTAMPTZ(3),
    "expiryAt" TIMESTAMPTZ(3),
    "createdByUserId" UUID,
    "createdByName" TEXT,
    "legacyCreatedById" TEXT,
    "legacyCreatedBy" TEXT,
    "legacyIsSample" BOOLEAN,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "legacyBase44Id" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "legacyCreatedAt" TIMESTAMPTZ(3),
    "legacyUpdatedAt" TIMESTAMPTZ(3),
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "NotificationType",
    "relatedEntityType" TEXT,
    "legacyRelatedEntityId" TEXT,
    "actionUrl" TEXT,
    "isRead" BOOLEAN DEFAULT false,
    "readAt" TIMESTAMPTZ(3),
    "legacyCreatedById" TEXT,
    "legacyCreatedBy" TEXT,
    "legacyIsSample" BOOLEAN,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "legacyBase44Id" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "legacyCreatedAt" TIMESTAMPTZ(3),
    "legacyUpdatedAt" TIMESTAMPTZ(3),
    "actorUserId" UUID,
    "actorName" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "legacyEntityId" TEXT,
    "oldValues" TEXT,
    "newValues" TEXT,
    "description" TEXT NOT NULL,
    "legacyCreatedById" TEXT,
    "legacyCreatedBy" TEXT,
    "legacyIsSample" BOOLEAN,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" UUID NOT NULL,
    "legacyBase44Id" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "legacyCreatedAt" TIMESTAMPTZ(3),
    "legacyUpdatedAt" TIMESTAMPTZ(3),
    "settingKey" TEXT NOT NULL,
    "settingValue" TEXT NOT NULL,
    "settingType" "SystemSettingSettingType",
    "description" TEXT,
    "updatedByUserId" UUID,
    "legacyCreatedById" TEXT,
    "legacyCreatedBy" TEXT,
    "legacyIsSample" BOOLEAN,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_legacyBase44Id_key" ON "User"("legacyBase44Id");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "MemberProfile_legacyBase44Id_key" ON "MemberProfile"("legacyBase44Id");

-- CreateIndex
CREATE UNIQUE INDEX "MemberProfile_userId_key" ON "MemberProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipType_legacyBase44Id_key" ON "MembershipType"("legacyBase44Id");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipType_code_key" ON "MembershipType"("code");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipApplication_legacyBase44Id_key" ON "MembershipApplication"("legacyBase44Id");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipApplication_applicationNumber_key" ON "MembershipApplication"("applicationNumber");

-- CreateIndex
CREATE INDEX "MembershipApplication_userId_idx" ON "MembershipApplication"("userId");

-- CreateIndex
CREATE INDEX "MembershipApplication_requestedMembershipTypeId_idx" ON "MembershipApplication"("requestedMembershipTypeId");

-- CreateIndex
CREATE INDEX "MembershipApplication_recommendedMembershipTypeId_idx" ON "MembershipApplication"("recommendedMembershipTypeId");

-- CreateIndex
CREATE INDEX "MembershipApplication_approvedMembershipTypeId_idx" ON "MembershipApplication"("approvedMembershipTypeId");

-- CreateIndex
CREATE INDEX "MembershipApplication_reviewedByUserId_idx" ON "MembershipApplication"("reviewedByUserId");

-- CreateIndex
CREATE INDEX "MembershipApplication_approvedByUserId_idx" ON "MembershipApplication"("approvedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "EligibilityQuestion_legacyBase44Id_key" ON "EligibilityQuestion"("legacyBase44Id");

-- CreateIndex
CREATE UNIQUE INDEX "EligibilityQuestion_code_key" ON "EligibilityQuestion"("code");

-- CreateIndex
CREATE UNIQUE INDEX "EligibilityAnswer_legacyBase44Id_key" ON "EligibilityAnswer"("legacyBase44Id");

-- CreateIndex
CREATE INDEX "EligibilityAnswer_applicationId_idx" ON "EligibilityAnswer"("applicationId");

-- CreateIndex
CREATE INDEX "EligibilityAnswer_questionId_idx" ON "EligibilityAnswer"("questionId");

-- CreateIndex
CREATE INDEX "EligibilityAnswer_userId_idx" ON "EligibilityAnswer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationDocument_legacyBase44Id_key" ON "ApplicationDocument"("legacyBase44Id");

-- CreateIndex
CREATE INDEX "ApplicationDocument_applicationId_idx" ON "ApplicationDocument"("applicationId");

-- CreateIndex
CREATE INDEX "ApplicationDocument_userId_idx" ON "ApplicationDocument"("userId");

-- CreateIndex
CREATE INDEX "ApplicationDocument_verifiedByUserId_idx" ON "ApplicationDocument"("verifiedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationReview_legacyBase44Id_key" ON "ApplicationReview"("legacyBase44Id");

-- CreateIndex
CREATE INDEX "ApplicationReview_applicationId_idx" ON "ApplicationReview"("applicationId");

-- CreateIndex
CREATE INDEX "ApplicationReview_reviewerUserId_idx" ON "ApplicationReview"("reviewerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "InformationRequest_legacyBase44Id_key" ON "InformationRequest"("legacyBase44Id");

-- CreateIndex
CREATE INDEX "InformationRequest_applicationId_idx" ON "InformationRequest"("applicationId");

-- CreateIndex
CREATE INDEX "InformationRequest_requestedByUserId_idx" ON "InformationRequest"("requestedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_legacyBase44Id_key" ON "Membership"("legacyBase44Id");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_membershipNumber_key" ON "Membership"("membershipNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_applicationId_key" ON "Membership"("applicationId");

-- CreateIndex
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");

-- CreateIndex
CREATE INDEX "Membership_membershipTypeId_idx" ON "Membership"("membershipTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_legacyBase44Id_key" ON "Payment"("legacyBase44Id");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_paymentReference_key" ON "Payment"("paymentReference");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_applicationId_key" ON "Payment"("applicationId");

-- CreateIndex
CREATE INDEX "Payment_userId_idx" ON "Payment"("userId");

-- CreateIndex
CREATE INDEX "Payment_membershipId_idx" ON "Payment"("membershipId");

-- CreateIndex
CREATE INDEX "Payment_verifiedByUserId_idx" ON "Payment"("verifiedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "RenewalApplication_legacyBase44Id_key" ON "RenewalApplication"("legacyBase44Id");

-- CreateIndex
CREATE INDEX "RenewalApplication_membershipId_idx" ON "RenewalApplication"("membershipId");

-- CreateIndex
CREATE INDEX "RenewalApplication_userId_idx" ON "RenewalApplication"("userId");

-- CreateIndex
CREATE INDEX "RenewalApplication_paymentId_idx" ON "RenewalApplication"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "Event_legacyBase44Id_key" ON "Event"("legacyBase44Id");

-- CreateIndex
CREATE UNIQUE INDEX "Event_eventNumber_key" ON "Event"("eventNumber");

-- CreateIndex
CREATE INDEX "Event_createdByUserId_idx" ON "Event"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "EventRegistration_legacyBase44Id_key" ON "EventRegistration"("legacyBase44Id");

-- CreateIndex
CREATE INDEX "EventRegistration_eventId_idx" ON "EventRegistration"("eventId");

-- CreateIndex
CREATE INDEX "EventRegistration_userId_idx" ON "EventRegistration"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Announcement_legacyBase44Id_key" ON "Announcement"("legacyBase44Id");

-- CreateIndex
CREATE INDEX "Announcement_createdByUserId_idx" ON "Announcement"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_legacyBase44Id_key" ON "Notification"("legacyBase44Id");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditLog_legacyBase44Id_key" ON "AuditLog"("legacyBase44Id");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSetting_legacyBase44Id_key" ON "SystemSetting"("legacyBase44Id");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSetting_settingKey_key" ON "SystemSetting"("settingKey");

-- CreateIndex
CREATE INDEX "SystemSetting_updatedByUserId_idx" ON "SystemSetting"("updatedByUserId");

-- AddForeignKey
ALTER TABLE "MemberProfile" ADD CONSTRAINT "MemberProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipApplication" ADD CONSTRAINT "MembershipApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipApplication" ADD CONSTRAINT "MembershipApplication_requestedMembershipTypeId_fkey" FOREIGN KEY ("requestedMembershipTypeId") REFERENCES "MembershipType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipApplication" ADD CONSTRAINT "MembershipApplication_recommendedMembershipTypeId_fkey" FOREIGN KEY ("recommendedMembershipTypeId") REFERENCES "MembershipType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipApplication" ADD CONSTRAINT "MembershipApplication_approvedMembershipTypeId_fkey" FOREIGN KEY ("approvedMembershipTypeId") REFERENCES "MembershipType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipApplication" ADD CONSTRAINT "MembershipApplication_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipApplication" ADD CONSTRAINT "MembershipApplication_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EligibilityAnswer" ADD CONSTRAINT "EligibilityAnswer_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "MembershipApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EligibilityAnswer" ADD CONSTRAINT "EligibilityAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "EligibilityQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EligibilityAnswer" ADD CONSTRAINT "EligibilityAnswer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationDocument" ADD CONSTRAINT "ApplicationDocument_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "MembershipApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationDocument" ADD CONSTRAINT "ApplicationDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationDocument" ADD CONSTRAINT "ApplicationDocument_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationReview" ADD CONSTRAINT "ApplicationReview_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "MembershipApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationReview" ADD CONSTRAINT "ApplicationReview_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InformationRequest" ADD CONSTRAINT "InformationRequest_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "MembershipApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InformationRequest" ADD CONSTRAINT "InformationRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "MembershipApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_membershipTypeId_fkey" FOREIGN KEY ("membershipTypeId") REFERENCES "MembershipType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "MembershipApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenewalApplication" ADD CONSTRAINT "RenewalApplication_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenewalApplication" ADD CONSTRAINT "RenewalApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenewalApplication" ADD CONSTRAINT "RenewalApplication_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemSetting" ADD CONSTRAINT "SystemSetting_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
