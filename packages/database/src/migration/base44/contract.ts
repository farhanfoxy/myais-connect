// Source contract from the approved mapping; source-required actor fields remain
// required in legacy exports even where the canonical historical FK is nullable.
export interface FieldRule {
  type: string;
  required: boolean;
  format?: string;
  values?: readonly string[];
}
export const fields: Record<string, Record<string, FieldRule>> = {
  "User": {
    "role": {
      "type": "string",
      "required": false,
      "values": [
        "applicant",
        "ordinary_member",
        "lifetime_member",
        "associate_member",
        "honorary_member",
        "president",
        "deputy_president",
        "secretary",
        "assistant_secretary",
        "treasurer",
        "committee_member",
        "system_administrator"
      ]
    },
    "phoneNumber": {
      "type": "string",
      "required": false
    },
    "photoUrl": {
      "type": "string",
      "required": false
    },
    "accountStatus": {
      "type": "string",
      "required": false,
      "values": [
        "ACTIVE",
        "DISABLED",
        "SUSPENDED"
      ]
    },
    "lastLoginAt": {
      "type": "string",
      "required": false,
      "format": "date-time"
    }
  },
  "MemberProfile": {
    "userId": {
      "type": "string",
      "required": true
    },
    "fullName": {
      "type": "string",
      "required": false
    },
    "phoneNumber": {
      "type": "string",
      "required": false
    },
    "identificationType": {
      "type": "string",
      "required": false,
      "values": [
        "NRIC",
        "PASSPORT",
        "OTHER"
      ]
    },
    "identificationNumber": {
      "type": "string",
      "required": false
    },
    "nationality": {
      "type": "string",
      "required": false
    },
    "dateOfBirth": {
      "type": "string",
      "required": false,
      "format": "date"
    },
    "gender": {
      "type": "string",
      "required": false,
      "values": [
        "MALE",
        "FEMALE",
        "OTHER"
      ]
    },
    "addressLine1": {
      "type": "string",
      "required": false
    },
    "addressLine2": {
      "type": "string",
      "required": false
    },
    "city": {
      "type": "string",
      "required": false
    },
    "state": {
      "type": "string",
      "required": false
    },
    "postcode": {
      "type": "string",
      "required": false
    },
    "country": {
      "type": "string",
      "required": false
    },
    "institution": {
      "type": "string",
      "required": false
    },
    "occupation": {
      "type": "string",
      "required": false
    },
    "department": {
      "type": "string",
      "required": false
    },
    "areaOfExpertise": {
      "type": "string",
      "required": false
    },
    "aisMember": {
      "type": "boolean",
      "required": false
    },
    "aisMembershipNumber": {
      "type": "string",
      "required": false
    },
    "aisMembershipExpiry": {
      "type": "string",
      "required": false,
      "format": "date"
    },
    "profileCompletionPercentage": {
      "type": "number",
      "required": false
    }
  },
  "MembershipType": {
    "code": {
      "type": "string",
      "required": true,
      "values": [
        "ORDINARY",
        "LIFETIME",
        "ASSOCIATE",
        "HONORARY"
      ]
    },
    "name": {
      "type": "string",
      "required": true
    },
    "description": {
      "type": "string",
      "required": false
    },
    "entranceFee": {
      "type": "number",
      "required": false
    },
    "membershipFee": {
      "type": "number",
      "required": false
    },
    "validityMonths": {
      "type": "number",
      "required": false
    },
    "renewable": {
      "type": "boolean",
      "required": false
    },
    "votingRights": {
      "type": "boolean",
      "required": false
    },
    "applicantSelectable": {
      "type": "boolean",
      "required": false
    },
    "active": {
      "type": "boolean",
      "required": false
    }
  },
  "MembershipApplication": {
    "applicationNumber": {
      "type": "string",
      "required": false
    },
    "userId": {
      "type": "string",
      "required": true
    },
    "requestedMembershipTypeId": {
      "type": "string",
      "required": false
    },
    "recommendedMembershipTypeId": {
      "type": "string",
      "required": false
    },
    "approvedMembershipTypeId": {
      "type": "string",
      "required": false
    },
    "status": {
      "type": "string",
      "required": false,
      "values": [
        "DRAFT",
        "SUBMITTED",
        "UNDER_REVIEW",
        "ADDITIONAL_INFORMATION_REQUIRED",
        "ELIGIBLE",
        "RECOMMENDED_FOR_APPROVAL",
        "APPROVED_PENDING_PAYMENT",
        "PAYMENT_SUBMITTED",
        "PAYMENT_UNDER_VERIFICATION",
        "ACTIVE",
        "REJECTED",
        "EXPIRED",
        "SUSPENDED",
        "TERMINATED"
      ]
    },
    "currentStep": {
      "type": "number",
      "required": false
    },
    "eligibilityScore": {
      "type": "number",
      "required": false
    },
    "eligibilityExplanation": {
      "type": "string",
      "required": false
    },
    "submittedAt": {
      "type": "string",
      "required": false,
      "format": "date-time"
    },
    "reviewedAt": {
      "type": "string",
      "required": false,
      "format": "date-time"
    },
    "approvedAt": {
      "type": "string",
      "required": false,
      "format": "date-time"
    },
    "rejectedAt": {
      "type": "string",
      "required": false,
      "format": "date-time"
    },
    "rejectionReason": {
      "type": "string",
      "required": false
    },
    "latestReviewerRemarks": {
      "type": "string",
      "required": false
    },
    "reviewedByUserId": {
      "type": "string",
      "required": false
    },
    "approvedByUserId": {
      "type": "string",
      "required": false
    },
    "requestedMembershipTypeCode": {
      "type": "string",
      "required": false
    },
    "recommendedMembershipTypeCode": {
      "type": "string",
      "required": false
    },
    "approvedMembershipTypeCode": {
      "type": "string",
      "required": false
    }
  },
  "EligibilityQuestion": {
    "code": {
      "type": "string",
      "required": true
    },
    "question": {
      "type": "string",
      "required": true
    },
    "inputType": {
      "type": "string",
      "required": true,
      "values": [
        "BOOLEAN",
        "DATE",
        "TEXT",
        "SELECT"
      ]
    },
    "options": {
      "type": "string",
      "required": false
    },
    "displayOrder": {
      "type": "number",
      "required": false
    },
    "required": {
      "type": "boolean",
      "required": false
    },
    "active": {
      "type": "boolean",
      "required": false
    },
    "ordinaryRule": {
      "type": "string",
      "required": false
    },
    "lifetimeRule": {
      "type": "string",
      "required": false
    }
  },
  "EligibilityAnswer": {
    "applicationId": {
      "type": "string",
      "required": true
    },
    "questionId": {
      "type": "string",
      "required": true
    },
    "userId": {
      "type": "string",
      "required": true
    },
    "questionCode": {
      "type": "string",
      "required": false
    },
    "answerText": {
      "type": "string",
      "required": false
    },
    "answerBoolean": {
      "type": "boolean",
      "required": false
    },
    "answerOption": {
      "type": "string",
      "required": false
    }
  },
  "ApplicationDocument": {
    "applicationId": {
      "type": "string",
      "required": true
    },
    "userId": {
      "type": "string",
      "required": true
    },
    "documentType": {
      "type": "string",
      "required": true,
      "values": [
        "IDENTIFICATION",
        "AIS_MEMBERSHIP_PROOF",
        "PROFILE_PHOTO",
        "PAYMENT_RECEIPT",
        "ADDITIONAL_SUPPORTING_DOCUMENT",
        "REQUESTED_INFORMATION"
      ]
    },
    "fileUrl": {
      "type": "string",
      "required": false
    },
    "originalFileName": {
      "type": "string",
      "required": false
    },
    "mimeType": {
      "type": "string",
      "required": false
    },
    "fileSize": {
      "type": "number",
      "required": false
    },
    "verificationStatus": {
      "type": "string",
      "required": false,
      "values": [
        "PENDING",
        "VERIFIED",
        "INVALID",
        "RESUBMISSION_REQUIRED"
      ]
    },
    "reviewerRemarks": {
      "type": "string",
      "required": false
    },
    "verifiedByUserId": {
      "type": "string",
      "required": false
    },
    "verifiedAt": {
      "type": "string",
      "required": false,
      "format": "date-time"
    }
  },
  "ApplicationReview": {
    "applicationId": {
      "type": "string",
      "required": true
    },
    "reviewerUserId": {
      "type": "string",
      "required": true
    },
    "reviewerName": {
      "type": "string",
      "required": false
    },
    "decision": {
      "type": "string",
      "required": true,
      "values": [
        "START_REVIEW",
        "REQUEST_INFORMATION",
        "RECOMMEND_APPROVAL",
        "APPROVE",
        "REJECT",
        "RETURN_FOR_CORRECTION"
      ]
    },
    "remarks": {
      "type": "string",
      "required": false
    },
    "previousStatus": {
      "type": "string",
      "required": false
    },
    "newStatus": {
      "type": "string",
      "required": false
    }
  },
  "InformationRequest": {
    "applicationId": {
      "type": "string",
      "required": true
    },
    "requestedByUserId": {
      "type": "string",
      "required": true
    },
    "requestedByName": {
      "type": "string",
      "required": false
    },
    "message": {
      "type": "string",
      "required": true
    },
    "dueDate": {
      "type": "string",
      "required": false,
      "format": "date"
    },
    "status": {
      "type": "string",
      "required": false,
      "values": [
        "OPEN",
        "RESPONDED",
        "RESOLVED",
        "OVERDUE"
      ]
    },
    "applicantResponse": {
      "type": "string",
      "required": false
    },
    "responseAttachmentUrl": {
      "type": "string",
      "required": false
    },
    "respondedAt": {
      "type": "string",
      "required": false,
      "format": "date-time"
    }
  },
  "Membership": {
    "membershipNumber": {
      "type": "string",
      "required": false
    },
    "userId": {
      "type": "string",
      "required": true
    },
    "applicationId": {
      "type": "string",
      "required": false
    },
    "membershipTypeId": {
      "type": "string",
      "required": true
    },
    "membershipTypeCode": {
      "type": "string",
      "required": false
    },
    "membershipTypeName": {
      "type": "string",
      "required": false
    },
    "startDate": {
      "type": "string",
      "required": false,
      "format": "date"
    },
    "expiryDate": {
      "type": "string",
      "required": false,
      "format": "date"
    },
    "status": {
      "type": "string",
      "required": false,
      "values": [
        "PENDING",
        "ACTIVE",
        "EXPIRED",
        "SUSPENDED",
        "TERMINATED"
      ]
    },
    "votingEligible": {
      "type": "boolean",
      "required": false
    },
    "activatedAt": {
      "type": "string",
      "required": false,
      "format": "date-time"
    },
    "suspendedAt": {
      "type": "string",
      "required": false,
      "format": "date-time"
    },
    "terminatedAt": {
      "type": "string",
      "required": false,
      "format": "date-time"
    }
  },
  "Payment": {
    "paymentReference": {
      "type": "string",
      "required": false
    },
    "userId": {
      "type": "string",
      "required": true
    },
    "applicationId": {
      "type": "string",
      "required": false
    },
    "membershipId": {
      "type": "string",
      "required": false
    },
    "paymentType": {
      "type": "string",
      "required": true,
      "values": [
        "ENTRANCE_AND_ANNUAL",
        "ENTRANCE_AND_LIFETIME",
        "RENEWAL",
        "OTHER"
      ]
    },
    "entranceFee": {
      "type": "number",
      "required": false
    },
    "membershipFee": {
      "type": "number",
      "required": false
    },
    "totalAmount": {
      "type": "number",
      "required": true
    },
    "currency": {
      "type": "string",
      "required": false
    },
    "paymentMethod": {
      "type": "string",
      "required": false
    },
    "bankName": {
      "type": "string",
      "required": false
    },
    "transactionReference": {
      "type": "string",
      "required": false
    },
    "receiptUrl": {
      "type": "string",
      "required": false
    },
    "status": {
      "type": "string",
      "required": false,
      "values": [
        "NOT_SUBMITTED",
        "SUBMITTED",
        "UNDER_VERIFICATION",
        "VERIFIED",
        "REJECTED"
      ]
    },
    "paidAt": {
      "type": "string",
      "required": false,
      "format": "date-time"
    },
    "submittedAt": {
      "type": "string",
      "required": false,
      "format": "date-time"
    },
    "verifiedByUserId": {
      "type": "string",
      "required": false
    },
    "verifiedAt": {
      "type": "string",
      "required": false,
      "format": "date-time"
    },
    "rejectionReason": {
      "type": "string",
      "required": false
    },
    "treasurerRemarks": {
      "type": "string",
      "required": false
    }
  },
  "RenewalApplication": {
    "renewalNumber": {
      "type": "string",
      "required": false
    },
    "membershipId": {
      "type": "string",
      "required": true
    },
    "userId": {
      "type": "string",
      "required": true
    },
    "previousExpiryDate": {
      "type": "string",
      "required": false,
      "format": "date"
    },
    "newExpiryDate": {
      "type": "string",
      "required": false,
      "format": "date"
    },
    "fee": {
      "type": "number",
      "required": false
    },
    "status": {
      "type": "string",
      "required": false,
      "values": [
        "PENDING",
        "PAYMENT_SUBMITTED",
        "APPROVED",
        "REJECTED"
      ]
    },
    "submittedAt": {
      "type": "string",
      "required": false,
      "format": "date-time"
    },
    "paymentId": {
      "type": "string",
      "required": false
    },
    "approvedAt": {
      "type": "string",
      "required": false,
      "format": "date-time"
    }
  },
  "Event": {
    "eventNumber": {
      "type": "string",
      "required": false
    },
    "title": {
      "type": "string",
      "required": true
    },
    "slug": {
      "type": "string",
      "required": false
    },
    "category": {
      "type": "string",
      "required": true,
      "values": [
        "Seminars and Webinars",
        "Workshops",
        "Meetings",
        "MyDCIS",
        "Conferences",
        "Other"
      ]
    },
    "summary": {
      "type": "string",
      "required": false
    },
    "description": {
      "type": "string",
      "required": true
    },
    "coverImage": {
      "type": "string",
      "required": false
    },
    "speakerName": {
      "type": "string",
      "required": false
    },
    "speakerTitle": {
      "type": "string",
      "required": false
    },
    "eventType": {
      "type": "string",
      "required": false
    },
    "venueType": {
      "type": "string",
      "required": true,
      "values": [
        "PHYSICAL",
        "ONLINE",
        "HYBRID"
      ]
    },
    "venueName": {
      "type": "string",
      "required": false
    },
    "physicalAddress": {
      "type": "string",
      "required": false
    },
    "onlineMeetingUrl": {
      "type": "string",
      "required": false
    },
    "startDate": {
      "type": "string",
      "required": true,
      "format": "date"
    },
    "startTime": {
      "type": "string",
      "required": true
    },
    "endDate": {
      "type": "string",
      "required": false,
      "format": "date"
    },
    "endTime": {
      "type": "string",
      "required": false
    },
    "registrationStart": {
      "type": "string",
      "required": false,
      "format": "date"
    },
    "registrationDeadline": {
      "type": "string",
      "required": false,
      "format": "date"
    },
    "capacity": {
      "type": "number",
      "required": false
    },
    "limitedSeats": {
      "type": "boolean",
      "required": false
    },
    "memberFee": {
      "type": "number",
      "required": false
    },
    "nonMemberFee": {
      "type": "number",
      "required": false
    },
    "currency": {
      "type": "string",
      "required": false
    },
    "paymentInstructions": {
      "type": "string",
      "required": false
    },
    "registrationUrl": {
      "type": "string",
      "required": false
    },
    "status": {
      "type": "string",
      "required": false,
      "values": [
        "DRAFT",
        "PUBLISHED",
        "REGISTRATION_CLOSED",
        "CANCELLED",
        "COMPLETED",
        "ARCHIVED"
      ]
    },
    "targetAudience": {
      "type": "string",
      "required": false,
      "values": [
        "MEMBERS",
        "NON_MEMBERS",
        "MEMBERS_AND_NON_MEMBERS"
      ]
    },
    "createdBy": {
      "type": "string",
      "required": false
    },
    "createdAt": {
      "type": "string",
      "required": false,
      "format": "date-time"
    },
    "updatedAt": {
      "type": "string",
      "required": false,
      "format": "date-time"
    },
    "publishedAt": {
      "type": "string",
      "required": false,
      "format": "date-time"
    },
    "cancelledAt": {
      "type": "string",
      "required": false,
      "format": "date-time"
    },
    "cancellationReason": {
      "type": "string",
      "required": false
    },
    "placeholderImageNotice": {
      "type": "boolean",
      "required": false
    }
  },
  "EventRegistration": {
    "eventId": {
      "type": "string",
      "required": true
    },
    "userId": {
      "type": "string",
      "required": true
    },
    "attendeeName": {
      "type": "string",
      "required": false
    },
    "attendeeEmail": {
      "type": "string",
      "required": false
    },
    "status": {
      "type": "string",
      "required": false,
      "values": [
        "REGISTERED",
        "CANCELLED",
        "ATTENDED",
        "NO_SHOW"
      ]
    },
    "paymentStatus": {
      "type": "string",
      "required": false,
      "values": [
        "NOT_REQUIRED",
        "PENDING",
        "PAID",
        "FAILED"
      ]
    },
    "registeredAt": {
      "type": "string",
      "required": false,
      "format": "date-time"
    },
    "notes": {
      "type": "string",
      "required": false
    }
  },
  "Announcement": {
    "title": {
      "type": "string",
      "required": true
    },
    "category": {
      "type": "string",
      "required": false,
      "values": [
        "GENERAL",
        "EVENT",
        "MEMBERSHIP",
        "POLICY",
        "TRAINING"
      ]
    },
    "summary": {
      "type": "string",
      "required": false
    },
    "content": {
      "type": "string",
      "required": true
    },
    "coverImageUrl": {
      "type": "string",
      "required": false
    },
    "attachmentUrl": {
      "type": "string",
      "required": false
    },
    "targetAudience": {
      "type": "string",
      "required": false,
      "values": [
        "ALL",
        "MEMBERS",
        "APPLICANTS",
        "COMMITTEE"
      ]
    },
    "status": {
      "type": "string",
      "required": false,
      "values": [
        "DRAFT",
        "SCHEDULED",
        "PUBLISHED",
        "ARCHIVED"
      ]
    },
    "publishAt": {
      "type": "string",
      "required": false,
      "format": "date-time"
    },
    "expiryAt": {
      "type": "string",
      "required": false,
      "format": "date-time"
    },
    "createdByUserId": {
      "type": "string",
      "required": false
    },
    "createdByName": {
      "type": "string",
      "required": false
    }
  },
  "Notification": {
    "userId": {
      "type": "string",
      "required": true
    },
    "title": {
      "type": "string",
      "required": true
    },
    "message": {
      "type": "string",
      "required": true
    },
    "type": {
      "type": "string",
      "required": false,
      "values": [
        "APPLICATION",
        "PAYMENT",
        "MEMBERSHIP",
        "ANNOUNCEMENT",
        "SYSTEM"
      ]
    },
    "relatedEntityType": {
      "type": "string",
      "required": false
    },
    "relatedEntityId": {
      "type": "string",
      "required": false
    },
    "actionUrl": {
      "type": "string",
      "required": false
    },
    "isRead": {
      "type": "boolean",
      "required": false
    },
    "readAt": {
      "type": "string",
      "required": false,
      "format": "date-time"
    }
  },
  "AuditLog": {
    "actorUserId": {
      "type": "string",
      "required": true
    },
    "actorName": {
      "type": "string",
      "required": false
    },
    "action": {
      "type": "string",
      "required": true
    },
    "entityType": {
      "type": "string",
      "required": false
    },
    "entityId": {
      "type": "string",
      "required": false
    },
    "oldValues": {
      "type": "string",
      "required": false
    },
    "newValues": {
      "type": "string",
      "required": false
    },
    "description": {
      "type": "string",
      "required": true
    }
  },
  "SystemSetting": {
    "settingKey": {
      "type": "string",
      "required": true
    },
    "settingValue": {
      "type": "string",
      "required": true
    },
    "settingType": {
      "type": "string",
      "required": false,
      "values": [
        "STRING",
        "NUMBER",
        "BOOLEAN",
        "JSON"
      ]
    },
    "description": {
      "type": "string",
      "required": false
    },
    "updatedByUserId": {
      "type": "string",
      "required": false
    }
  }
};

export const references = [
  {
    "entity": "Announcement",
    "field": "createdByUserId",
    "target": "User"
  },
  {
    "entity": "ApplicationDocument",
    "field": "applicationId",
    "target": "MembershipApplication"
  },
  {
    "entity": "ApplicationDocument",
    "field": "userId",
    "target": "User"
  },
  {
    "entity": "ApplicationDocument",
    "field": "verifiedByUserId",
    "target": "User"
  },
  {
    "entity": "ApplicationReview",
    "field": "applicationId",
    "target": "MembershipApplication"
  },
  {
    "entity": "ApplicationReview",
    "field": "reviewerUserId",
    "target": "User"
  },
  {
    "entity": "AuditLog",
    "field": "actorUserId",
    "target": "User"
  },
  {
    "entity": "EligibilityAnswer",
    "field": "applicationId",
    "target": "MembershipApplication"
  },
  {
    "entity": "EligibilityAnswer",
    "field": "questionId",
    "target": "EligibilityQuestion"
  },
  {
    "entity": "EligibilityAnswer",
    "field": "userId",
    "target": "User"
  },
  {
    "entity": "Event",
    "field": "createdBy",
    "target": "User"
  },
  {
    "entity": "EventRegistration",
    "field": "eventId",
    "target": "Event"
  },
  {
    "entity": "EventRegistration",
    "field": "userId",
    "target": "User"
  },
  {
    "entity": "InformationRequest",
    "field": "applicationId",
    "target": "MembershipApplication"
  },
  {
    "entity": "InformationRequest",
    "field": "requestedByUserId",
    "target": "User"
  },
  {
    "entity": "MemberProfile",
    "field": "userId",
    "target": "User"
  },
  {
    "entity": "Membership",
    "field": "userId",
    "target": "User"
  },
  {
    "entity": "Membership",
    "field": "applicationId",
    "target": "MembershipApplication"
  },
  {
    "entity": "Membership",
    "field": "membershipTypeId",
    "target": "MembershipType"
  },
  {
    "entity": "MembershipApplication",
    "field": "userId",
    "target": "User"
  },
  {
    "entity": "MembershipApplication",
    "field": "requestedMembershipTypeId",
    "target": "MembershipType"
  },
  {
    "entity": "MembershipApplication",
    "field": "recommendedMembershipTypeId",
    "target": "MembershipType"
  },
  {
    "entity": "MembershipApplication",
    "field": "approvedMembershipTypeId",
    "target": "MembershipType"
  },
  {
    "entity": "MembershipApplication",
    "field": "reviewedByUserId",
    "target": "User"
  },
  {
    "entity": "MembershipApplication",
    "field": "approvedByUserId",
    "target": "User"
  },
  {
    "entity": "Notification",
    "field": "userId",
    "target": "User"
  },
  {
    "entity": "Payment",
    "field": "userId",
    "target": "User"
  },
  {
    "entity": "Payment",
    "field": "applicationId",
    "target": "MembershipApplication"
  },
  {
    "entity": "Payment",
    "field": "membershipId",
    "target": "Membership"
  },
  {
    "entity": "Payment",
    "field": "verifiedByUserId",
    "target": "User"
  },
  {
    "entity": "RenewalApplication",
    "field": "membershipId",
    "target": "Membership"
  },
  {
    "entity": "RenewalApplication",
    "field": "userId",
    "target": "User"
  },
  {
    "entity": "RenewalApplication",
    "field": "paymentId",
    "target": "Payment"
  },
  {
    "entity": "SystemSetting",
    "field": "updatedByUserId",
    "target": "User"
  }
];
export const uniqueKeys = ["User.email","MemberProfile.userId","MembershipType.code","EligibilityQuestion.code","SystemSetting.settingKey","MembershipApplication.applicationNumber","Membership.membershipNumber","Payment.paymentReference","Event.eventNumber","Membership.applicationId","Payment.applicationId"];
export const emptyEntities = new Set(["EligibilityAnswer", "EventRegistration", "InformationRequest", "RenewalApplication"]);
export const canonicalRoles = new Set(fields.User?.role?.values?.map(value => value.toUpperCase()) ?? []);
export const fileFor = (entity: string): string => entity === "User" ? "MyAIS_Connect-users.csv" : entity + "_export.csv";
