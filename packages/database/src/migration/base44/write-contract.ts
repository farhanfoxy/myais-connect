// Scalar whitelist captured from the approved canonical schema. Used for
// explicit INSERT columns and full conflict comparison, never schema generation.
export interface Column { type: string; nullable: boolean; dateOnly?: boolean; unique?: boolean }
export const columns: Record<string, Record<string, Column>> = {
  "User": {
    "id": {
      "type": "String",
      "nullable": false
    },
    "legacyBase44Id": {
      "type": "String",
      "nullable": true,
      "unique": true
    },
    "createdAt": {
      "type": "DateTime",
      "nullable": false
    },
    "updatedAt": {
      "type": "DateTime",
      "nullable": false
    },
    "legacyCreatedAt": {
      "type": "DateTime",
      "nullable": true
    },
    "legacyUpdatedAt": {
      "type": "DateTime",
      "nullable": true
    },
    "role": {
      "type": "UserRole",
      "nullable": true
    },
    "phoneNumber": {
      "type": "String",
      "nullable": true
    },
    "photoUrl": {
      "type": "String",
      "nullable": true
    },
    "accountStatus": {
      "type": "UserAccountStatus",
      "nullable": true
    },
    "lastLoginAt": {
      "type": "DateTime",
      "nullable": true
    },
    "email": {
      "type": "String",
      "nullable": true,
      "unique": true
    },
    "legacyFullName": {
      "type": "String",
      "nullable": true
    },
    "fullName": {
      "type": "String",
      "nullable": true
    },
    "legacyRole": {
      "type": "String",
      "nullable": true
    },
    "legacyPlatformStatus": {
      "type": "String",
      "nullable": true
    }
  },
  "MemberProfile": {
    "id": {
      "type": "String",
      "nullable": false
    },
    "legacyBase44Id": {
      "type": "String",
      "nullable": true,
      "unique": true
    },
    "createdAt": {
      "type": "DateTime",
      "nullable": false
    },
    "updatedAt": {
      "type": "DateTime",
      "nullable": false
    },
    "legacyCreatedAt": {
      "type": "DateTime",
      "nullable": true
    },
    "legacyUpdatedAt": {
      "type": "DateTime",
      "nullable": true
    },
    "userId": {
      "type": "String",
      "nullable": false,
      "unique": true
    },
    "fullName": {
      "type": "String",
      "nullable": true
    },
    "phoneNumber": {
      "type": "String",
      "nullable": true
    },
    "identificationType": {
      "type": "MemberProfileIdentificationType",
      "nullable": true
    },
    "identificationNumber": {
      "type": "String",
      "nullable": true
    },
    "nationality": {
      "type": "String",
      "nullable": true
    },
    "dateOfBirth": {
      "type": "DateTime",
      "nullable": true,
      "dateOnly": true
    },
    "gender": {
      "type": "MemberProfileGender",
      "nullable": true
    },
    "addressLine1": {
      "type": "String",
      "nullable": true
    },
    "addressLine2": {
      "type": "String",
      "nullable": true
    },
    "city": {
      "type": "String",
      "nullable": true
    },
    "state": {
      "type": "String",
      "nullable": true
    },
    "postcode": {
      "type": "String",
      "nullable": true
    },
    "country": {
      "type": "String",
      "nullable": true
    },
    "institution": {
      "type": "String",
      "nullable": true
    },
    "occupation": {
      "type": "String",
      "nullable": true
    },
    "department": {
      "type": "String",
      "nullable": true
    },
    "areaOfExpertise": {
      "type": "String",
      "nullable": true
    },
    "aisMember": {
      "type": "Boolean",
      "nullable": true
    },
    "aisMembershipNumber": {
      "type": "String",
      "nullable": true
    },
    "aisMembershipExpiry": {
      "type": "DateTime",
      "nullable": true,
      "dateOnly": true
    },
    "profileCompletionPercentage": {
      "type": "Float",
      "nullable": true
    },
    "legacyCreatedById": {
      "type": "String",
      "nullable": true
    },
    "legacyCreatedBy": {
      "type": "String",
      "nullable": true
    },
    "legacyIsSample": {
      "type": "Boolean",
      "nullable": true
    }
  },
  "MembershipType": {
    "id": {
      "type": "String",
      "nullable": false
    },
    "legacyBase44Id": {
      "type": "String",
      "nullable": true,
      "unique": true
    },
    "createdAt": {
      "type": "DateTime",
      "nullable": false
    },
    "updatedAt": {
      "type": "DateTime",
      "nullable": false
    },
    "legacyCreatedAt": {
      "type": "DateTime",
      "nullable": true
    },
    "legacyUpdatedAt": {
      "type": "DateTime",
      "nullable": true
    },
    "code": {
      "type": "MembershipTypeCode",
      "nullable": false,
      "unique": true
    },
    "name": {
      "type": "String",
      "nullable": false
    },
    "description": {
      "type": "String",
      "nullable": true
    },
    "entranceFee": {
      "type": "Decimal",
      "nullable": true
    },
    "membershipFee": {
      "type": "Decimal",
      "nullable": true
    },
    "validityMonths": {
      "type": "Float",
      "nullable": true
    },
    "renewable": {
      "type": "Boolean",
      "nullable": true
    },
    "votingRights": {
      "type": "Boolean",
      "nullable": true
    },
    "applicantSelectable": {
      "type": "Boolean",
      "nullable": true
    },
    "active": {
      "type": "Boolean",
      "nullable": true
    },
    "legacyCreatedById": {
      "type": "String",
      "nullable": true
    },
    "legacyCreatedBy": {
      "type": "String",
      "nullable": true
    },
    "legacyIsSample": {
      "type": "Boolean",
      "nullable": true
    }
  },
  "MembershipApplication": {
    "id": {
      "type": "String",
      "nullable": false
    },
    "legacyBase44Id": {
      "type": "String",
      "nullable": true,
      "unique": true
    },
    "createdAt": {
      "type": "DateTime",
      "nullable": false
    },
    "updatedAt": {
      "type": "DateTime",
      "nullable": false
    },
    "legacyCreatedAt": {
      "type": "DateTime",
      "nullable": true
    },
    "legacyUpdatedAt": {
      "type": "DateTime",
      "nullable": true
    },
    "applicationNumber": {
      "type": "String",
      "nullable": true,
      "unique": true
    },
    "userId": {
      "type": "String",
      "nullable": false
    },
    "requestedMembershipTypeId": {
      "type": "String",
      "nullable": true
    },
    "recommendedMembershipTypeId": {
      "type": "String",
      "nullable": true
    },
    "approvedMembershipTypeId": {
      "type": "String",
      "nullable": true
    },
    "status": {
      "type": "MembershipApplicationStatus",
      "nullable": true
    },
    "currentStep": {
      "type": "Float",
      "nullable": true
    },
    "eligibilityScore": {
      "type": "Float",
      "nullable": true
    },
    "eligibilityExplanation": {
      "type": "String",
      "nullable": true
    },
    "submittedAt": {
      "type": "DateTime",
      "nullable": true
    },
    "reviewedAt": {
      "type": "DateTime",
      "nullable": true
    },
    "approvedAt": {
      "type": "DateTime",
      "nullable": true
    },
    "rejectedAt": {
      "type": "DateTime",
      "nullable": true
    },
    "rejectionReason": {
      "type": "String",
      "nullable": true
    },
    "latestReviewerRemarks": {
      "type": "String",
      "nullable": true
    },
    "reviewedByUserId": {
      "type": "String",
      "nullable": true
    },
    "approvedByUserId": {
      "type": "String",
      "nullable": true
    },
    "requestedMembershipTypeCode": {
      "type": "String",
      "nullable": true
    },
    "recommendedMembershipTypeCode": {
      "type": "String",
      "nullable": true
    },
    "approvedMembershipTypeCode": {
      "type": "String",
      "nullable": true
    },
    "legacyCreatedById": {
      "type": "String",
      "nullable": true
    },
    "legacyCreatedBy": {
      "type": "String",
      "nullable": true
    },
    "legacyIsSample": {
      "type": "Boolean",
      "nullable": true
    }
  },
  "EligibilityQuestion": {
    "id": {
      "type": "String",
      "nullable": false
    },
    "legacyBase44Id": {
      "type": "String",
      "nullable": true,
      "unique": true
    },
    "createdAt": {
      "type": "DateTime",
      "nullable": false
    },
    "updatedAt": {
      "type": "DateTime",
      "nullable": false
    },
    "legacyCreatedAt": {
      "type": "DateTime",
      "nullable": true
    },
    "legacyUpdatedAt": {
      "type": "DateTime",
      "nullable": true
    },
    "code": {
      "type": "String",
      "nullable": false,
      "unique": true
    },
    "question": {
      "type": "String",
      "nullable": false
    },
    "inputType": {
      "type": "EligibilityQuestionInputType",
      "nullable": false
    },
    "options": {
      "type": "String",
      "nullable": true
    },
    "displayOrder": {
      "type": "Float",
      "nullable": true
    },
    "required": {
      "type": "Boolean",
      "nullable": true
    },
    "active": {
      "type": "Boolean",
      "nullable": true
    },
    "ordinaryRule": {
      "type": "String",
      "nullable": true
    },
    "lifetimeRule": {
      "type": "String",
      "nullable": true
    },
    "legacyCreatedById": {
      "type": "String",
      "nullable": true
    },
    "legacyCreatedBy": {
      "type": "String",
      "nullable": true
    },
    "legacyIsSample": {
      "type": "Boolean",
      "nullable": true
    }
  },
  "EligibilityAnswer": {
    "id": {
      "type": "String",
      "nullable": false
    },
    "legacyBase44Id": {
      "type": "String",
      "nullable": true,
      "unique": true
    },
    "createdAt": {
      "type": "DateTime",
      "nullable": false
    },
    "updatedAt": {
      "type": "DateTime",
      "nullable": false
    },
    "legacyCreatedAt": {
      "type": "DateTime",
      "nullable": true
    },
    "legacyUpdatedAt": {
      "type": "DateTime",
      "nullable": true
    },
    "applicationId": {
      "type": "String",
      "nullable": false
    },
    "questionId": {
      "type": "String",
      "nullable": false
    },
    "userId": {
      "type": "String",
      "nullable": false
    },
    "questionCode": {
      "type": "String",
      "nullable": true
    },
    "answerText": {
      "type": "String",
      "nullable": true
    },
    "answerBoolean": {
      "type": "Boolean",
      "nullable": true
    },
    "answerOption": {
      "type": "String",
      "nullable": true
    }
  },
  "ApplicationDocument": {
    "id": {
      "type": "String",
      "nullable": false
    },
    "legacyBase44Id": {
      "type": "String",
      "nullable": true,
      "unique": true
    },
    "createdAt": {
      "type": "DateTime",
      "nullable": false
    },
    "updatedAt": {
      "type": "DateTime",
      "nullable": false
    },
    "legacyCreatedAt": {
      "type": "DateTime",
      "nullable": true
    },
    "legacyUpdatedAt": {
      "type": "DateTime",
      "nullable": true
    },
    "applicationId": {
      "type": "String",
      "nullable": false
    },
    "userId": {
      "type": "String",
      "nullable": false
    },
    "documentType": {
      "type": "ApplicationDocumentDocumentType",
      "nullable": false
    },
    "fileUrl": {
      "type": "String",
      "nullable": true
    },
    "originalFileName": {
      "type": "String",
      "nullable": true
    },
    "mimeType": {
      "type": "String",
      "nullable": true
    },
    "fileSize": {
      "type": "Float",
      "nullable": true
    },
    "verificationStatus": {
      "type": "ApplicationDocumentVerificationStatus",
      "nullable": true
    },
    "reviewerRemarks": {
      "type": "String",
      "nullable": true
    },
    "verifiedByUserId": {
      "type": "String",
      "nullable": true
    },
    "verifiedAt": {
      "type": "DateTime",
      "nullable": true
    },
    "legacyCreatedById": {
      "type": "String",
      "nullable": true
    },
    "legacyCreatedBy": {
      "type": "String",
      "nullable": true
    },
    "legacyIsSample": {
      "type": "Boolean",
      "nullable": true
    }
  },
  "ApplicationReview": {
    "id": {
      "type": "String",
      "nullable": false
    },
    "legacyBase44Id": {
      "type": "String",
      "nullable": true,
      "unique": true
    },
    "createdAt": {
      "type": "DateTime",
      "nullable": false
    },
    "updatedAt": {
      "type": "DateTime",
      "nullable": false
    },
    "legacyCreatedAt": {
      "type": "DateTime",
      "nullable": true
    },
    "legacyUpdatedAt": {
      "type": "DateTime",
      "nullable": true
    },
    "applicationId": {
      "type": "String",
      "nullable": false
    },
    "reviewerUserId": {
      "type": "String",
      "nullable": true
    },
    "reviewerName": {
      "type": "String",
      "nullable": true
    },
    "decision": {
      "type": "ApplicationReviewDecision",
      "nullable": false
    },
    "remarks": {
      "type": "String",
      "nullable": true
    },
    "previousStatus": {
      "type": "String",
      "nullable": true
    },
    "newStatus": {
      "type": "String",
      "nullable": true
    },
    "legacyCreatedById": {
      "type": "String",
      "nullable": true
    },
    "legacyCreatedBy": {
      "type": "String",
      "nullable": true
    },
    "legacyIsSample": {
      "type": "Boolean",
      "nullable": true
    }
  },
  "InformationRequest": {
    "id": {
      "type": "String",
      "nullable": false
    },
    "legacyBase44Id": {
      "type": "String",
      "nullable": true,
      "unique": true
    },
    "createdAt": {
      "type": "DateTime",
      "nullable": false
    },
    "updatedAt": {
      "type": "DateTime",
      "nullable": false
    },
    "legacyCreatedAt": {
      "type": "DateTime",
      "nullable": true
    },
    "legacyUpdatedAt": {
      "type": "DateTime",
      "nullable": true
    },
    "applicationId": {
      "type": "String",
      "nullable": false
    },
    "requestedByUserId": {
      "type": "String",
      "nullable": true
    },
    "requestedByName": {
      "type": "String",
      "nullable": true
    },
    "message": {
      "type": "String",
      "nullable": false
    },
    "dueDate": {
      "type": "DateTime",
      "nullable": true,
      "dateOnly": true
    },
    "status": {
      "type": "InformationRequestStatus",
      "nullable": true
    },
    "applicantResponse": {
      "type": "String",
      "nullable": true
    },
    "responseAttachmentUrl": {
      "type": "String",
      "nullable": true
    },
    "respondedAt": {
      "type": "DateTime",
      "nullable": true
    }
  },
  "Membership": {
    "id": {
      "type": "String",
      "nullable": false
    },
    "legacyBase44Id": {
      "type": "String",
      "nullable": true,
      "unique": true
    },
    "createdAt": {
      "type": "DateTime",
      "nullable": false
    },
    "updatedAt": {
      "type": "DateTime",
      "nullable": false
    },
    "legacyCreatedAt": {
      "type": "DateTime",
      "nullable": true
    },
    "legacyUpdatedAt": {
      "type": "DateTime",
      "nullable": true
    },
    "membershipNumber": {
      "type": "String",
      "nullable": true,
      "unique": true
    },
    "userId": {
      "type": "String",
      "nullable": false
    },
    "applicationId": {
      "type": "String",
      "nullable": true,
      "unique": true
    },
    "membershipTypeId": {
      "type": "String",
      "nullable": false
    },
    "membershipTypeCode": {
      "type": "String",
      "nullable": true
    },
    "membershipTypeName": {
      "type": "String",
      "nullable": true
    },
    "startDate": {
      "type": "DateTime",
      "nullable": true,
      "dateOnly": true
    },
    "expiryDate": {
      "type": "DateTime",
      "nullable": true,
      "dateOnly": true
    },
    "status": {
      "type": "MembershipStatus",
      "nullable": true
    },
    "votingEligible": {
      "type": "Boolean",
      "nullable": true
    },
    "activatedAt": {
      "type": "DateTime",
      "nullable": true
    },
    "suspendedAt": {
      "type": "DateTime",
      "nullable": true
    },
    "terminatedAt": {
      "type": "DateTime",
      "nullable": true
    },
    "legacyCreatedById": {
      "type": "String",
      "nullable": true
    },
    "legacyCreatedBy": {
      "type": "String",
      "nullable": true
    },
    "legacyIsSample": {
      "type": "Boolean",
      "nullable": true
    }
  },
  "Payment": {
    "id": {
      "type": "String",
      "nullable": false
    },
    "legacyBase44Id": {
      "type": "String",
      "nullable": true,
      "unique": true
    },
    "createdAt": {
      "type": "DateTime",
      "nullable": false
    },
    "updatedAt": {
      "type": "DateTime",
      "nullable": false
    },
    "legacyCreatedAt": {
      "type": "DateTime",
      "nullable": true
    },
    "legacyUpdatedAt": {
      "type": "DateTime",
      "nullable": true
    },
    "paymentReference": {
      "type": "String",
      "nullable": true,
      "unique": true
    },
    "userId": {
      "type": "String",
      "nullable": false
    },
    "applicationId": {
      "type": "String",
      "nullable": true,
      "unique": true
    },
    "membershipId": {
      "type": "String",
      "nullable": true
    },
    "paymentType": {
      "type": "PaymentPaymentType",
      "nullable": false
    },
    "entranceFee": {
      "type": "Decimal",
      "nullable": true
    },
    "membershipFee": {
      "type": "Decimal",
      "nullable": true
    },
    "totalAmount": {
      "type": "Decimal",
      "nullable": false
    },
    "currency": {
      "type": "String",
      "nullable": true
    },
    "paymentMethod": {
      "type": "String",
      "nullable": true
    },
    "bankName": {
      "type": "String",
      "nullable": true
    },
    "transactionReference": {
      "type": "String",
      "nullable": true
    },
    "receiptUrl": {
      "type": "String",
      "nullable": true
    },
    "status": {
      "type": "PaymentStatus",
      "nullable": true
    },
    "paidAt": {
      "type": "DateTime",
      "nullable": true
    },
    "submittedAt": {
      "type": "DateTime",
      "nullable": true
    },
    "verifiedByUserId": {
      "type": "String",
      "nullable": true
    },
    "verifiedAt": {
      "type": "DateTime",
      "nullable": true
    },
    "rejectionReason": {
      "type": "String",
      "nullable": true
    },
    "treasurerRemarks": {
      "type": "String",
      "nullable": true
    },
    "legacyCreatedById": {
      "type": "String",
      "nullable": true
    },
    "legacyCreatedBy": {
      "type": "String",
      "nullable": true
    },
    "legacyIsSample": {
      "type": "Boolean",
      "nullable": true
    }
  },
  "RenewalApplication": {
    "id": {
      "type": "String",
      "nullable": false
    },
    "legacyBase44Id": {
      "type": "String",
      "nullable": true,
      "unique": true
    },
    "createdAt": {
      "type": "DateTime",
      "nullable": false
    },
    "updatedAt": {
      "type": "DateTime",
      "nullable": false
    },
    "legacyCreatedAt": {
      "type": "DateTime",
      "nullable": true
    },
    "legacyUpdatedAt": {
      "type": "DateTime",
      "nullable": true
    },
    "renewalNumber": {
      "type": "String",
      "nullable": true
    },
    "membershipId": {
      "type": "String",
      "nullable": false
    },
    "userId": {
      "type": "String",
      "nullable": false
    },
    "previousExpiryDate": {
      "type": "DateTime",
      "nullable": true,
      "dateOnly": true
    },
    "newExpiryDate": {
      "type": "DateTime",
      "nullable": true,
      "dateOnly": true
    },
    "fee": {
      "type": "Decimal",
      "nullable": true
    },
    "status": {
      "type": "RenewalApplicationStatus",
      "nullable": true
    },
    "submittedAt": {
      "type": "DateTime",
      "nullable": true
    },
    "paymentId": {
      "type": "String",
      "nullable": true
    },
    "approvedAt": {
      "type": "DateTime",
      "nullable": true
    }
  },
  "Event": {
    "id": {
      "type": "String",
      "nullable": false
    },
    "legacyBase44Id": {
      "type": "String",
      "nullable": true,
      "unique": true
    },
    "createdAt": {
      "type": "DateTime",
      "nullable": false
    },
    "updatedAt": {
      "type": "DateTime",
      "nullable": false
    },
    "legacyCreatedAt": {
      "type": "DateTime",
      "nullable": true
    },
    "legacyUpdatedAt": {
      "type": "DateTime",
      "nullable": true
    },
    "eventNumber": {
      "type": "String",
      "nullable": true,
      "unique": true
    },
    "title": {
      "type": "String",
      "nullable": false
    },
    "slug": {
      "type": "String",
      "nullable": true
    },
    "category": {
      "type": "EventCategory",
      "nullable": false
    },
    "summary": {
      "type": "String",
      "nullable": true
    },
    "description": {
      "type": "String",
      "nullable": false
    },
    "coverImage": {
      "type": "String",
      "nullable": true
    },
    "speakerName": {
      "type": "String",
      "nullable": true
    },
    "speakerTitle": {
      "type": "String",
      "nullable": true
    },
    "eventType": {
      "type": "String",
      "nullable": true
    },
    "venueType": {
      "type": "EventVenueType",
      "nullable": false
    },
    "venueName": {
      "type": "String",
      "nullable": true
    },
    "physicalAddress": {
      "type": "String",
      "nullable": true
    },
    "onlineMeetingUrl": {
      "type": "String",
      "nullable": true
    },
    "startDate": {
      "type": "DateTime",
      "nullable": false,
      "dateOnly": true
    },
    "startTime": {
      "type": "String",
      "nullable": false
    },
    "endDate": {
      "type": "DateTime",
      "nullable": true,
      "dateOnly": true
    },
    "endTime": {
      "type": "String",
      "nullable": true
    },
    "registrationStart": {
      "type": "DateTime",
      "nullable": true,
      "dateOnly": true
    },
    "registrationDeadline": {
      "type": "DateTime",
      "nullable": true,
      "dateOnly": true
    },
    "capacity": {
      "type": "Float",
      "nullable": true
    },
    "limitedSeats": {
      "type": "Boolean",
      "nullable": true
    },
    "memberFee": {
      "type": "Decimal",
      "nullable": true
    },
    "nonMemberFee": {
      "type": "Decimal",
      "nullable": true
    },
    "currency": {
      "type": "String",
      "nullable": true
    },
    "paymentInstructions": {
      "type": "String",
      "nullable": true
    },
    "registrationUrl": {
      "type": "String",
      "nullable": true
    },
    "status": {
      "type": "EventStatus",
      "nullable": true
    },
    "targetAudience": {
      "type": "EventTargetAudience",
      "nullable": true
    },
    "createdByUserId": {
      "type": "String",
      "nullable": true
    },
    "legacyCreatedBy": {
      "type": "String",
      "nullable": true
    },
    "publishedAt": {
      "type": "DateTime",
      "nullable": true
    },
    "cancelledAt": {
      "type": "DateTime",
      "nullable": true
    },
    "cancellationReason": {
      "type": "String",
      "nullable": true
    },
    "placeholderImageNotice": {
      "type": "Boolean",
      "nullable": true
    },
    "legacyCreatedById": {
      "type": "String",
      "nullable": true
    },
    "legacyPlatformCreatedBy": {
      "type": "String",
      "nullable": true
    },
    "legacyIsSample": {
      "type": "Boolean",
      "nullable": true
    },
    "timezone": {
      "type": "String",
      "nullable": false
    }
  },
  "EventRegistration": {
    "id": {
      "type": "String",
      "nullable": false
    },
    "legacyBase44Id": {
      "type": "String",
      "nullable": true,
      "unique": true
    },
    "createdAt": {
      "type": "DateTime",
      "nullable": false
    },
    "updatedAt": {
      "type": "DateTime",
      "nullable": false
    },
    "legacyCreatedAt": {
      "type": "DateTime",
      "nullable": true
    },
    "legacyUpdatedAt": {
      "type": "DateTime",
      "nullable": true
    },
    "eventId": {
      "type": "String",
      "nullable": false
    },
    "userId": {
      "type": "String",
      "nullable": false
    },
    "attendeeName": {
      "type": "String",
      "nullable": true
    },
    "attendeeEmail": {
      "type": "String",
      "nullable": true
    },
    "status": {
      "type": "EventRegistrationStatus",
      "nullable": true
    },
    "paymentStatus": {
      "type": "EventRegistrationPaymentStatus",
      "nullable": true
    },
    "registeredAt": {
      "type": "DateTime",
      "nullable": true
    },
    "notes": {
      "type": "String",
      "nullable": true
    }
  },
  "Announcement": {
    "id": {
      "type": "String",
      "nullable": false
    },
    "legacyBase44Id": {
      "type": "String",
      "nullable": true,
      "unique": true
    },
    "createdAt": {
      "type": "DateTime",
      "nullable": false
    },
    "updatedAt": {
      "type": "DateTime",
      "nullable": false
    },
    "legacyCreatedAt": {
      "type": "DateTime",
      "nullable": true
    },
    "legacyUpdatedAt": {
      "type": "DateTime",
      "nullable": true
    },
    "title": {
      "type": "String",
      "nullable": false
    },
    "category": {
      "type": "AnnouncementCategory",
      "nullable": true
    },
    "summary": {
      "type": "String",
      "nullable": true
    },
    "content": {
      "type": "String",
      "nullable": false
    },
    "coverImageUrl": {
      "type": "String",
      "nullable": true
    },
    "attachmentUrl": {
      "type": "String",
      "nullable": true
    },
    "targetAudience": {
      "type": "AnnouncementTargetAudience",
      "nullable": true
    },
    "status": {
      "type": "AnnouncementStatus",
      "nullable": true
    },
    "publishAt": {
      "type": "DateTime",
      "nullable": true
    },
    "expiryAt": {
      "type": "DateTime",
      "nullable": true
    },
    "createdByUserId": {
      "type": "String",
      "nullable": true
    },
    "createdByName": {
      "type": "String",
      "nullable": true
    },
    "legacyCreatedById": {
      "type": "String",
      "nullable": true
    },
    "legacyCreatedBy": {
      "type": "String",
      "nullable": true
    },
    "legacyIsSample": {
      "type": "Boolean",
      "nullable": true
    }
  },
  "Notification": {
    "id": {
      "type": "String",
      "nullable": false
    },
    "legacyBase44Id": {
      "type": "String",
      "nullable": true,
      "unique": true
    },
    "createdAt": {
      "type": "DateTime",
      "nullable": false
    },
    "updatedAt": {
      "type": "DateTime",
      "nullable": false
    },
    "legacyCreatedAt": {
      "type": "DateTime",
      "nullable": true
    },
    "legacyUpdatedAt": {
      "type": "DateTime",
      "nullable": true
    },
    "userId": {
      "type": "String",
      "nullable": false
    },
    "title": {
      "type": "String",
      "nullable": false
    },
    "message": {
      "type": "String",
      "nullable": false
    },
    "type": {
      "type": "NotificationType",
      "nullable": true
    },
    "relatedEntityType": {
      "type": "String",
      "nullable": true
    },
    "legacyRelatedEntityId": {
      "type": "String",
      "nullable": true
    },
    "actionUrl": {
      "type": "String",
      "nullable": true
    },
    "isRead": {
      "type": "Boolean",
      "nullable": true
    },
    "readAt": {
      "type": "DateTime",
      "nullable": true
    },
    "legacyCreatedById": {
      "type": "String",
      "nullable": true
    },
    "legacyCreatedBy": {
      "type": "String",
      "nullable": true
    },
    "legacyIsSample": {
      "type": "Boolean",
      "nullable": true
    }
  },
  "AuditLog": {
    "id": {
      "type": "String",
      "nullable": false
    },
    "legacyBase44Id": {
      "type": "String",
      "nullable": true,
      "unique": true
    },
    "createdAt": {
      "type": "DateTime",
      "nullable": false
    },
    "updatedAt": {
      "type": "DateTime",
      "nullable": false
    },
    "legacyCreatedAt": {
      "type": "DateTime",
      "nullable": true
    },
    "legacyUpdatedAt": {
      "type": "DateTime",
      "nullable": true
    },
    "actorUserId": {
      "type": "String",
      "nullable": true
    },
    "actorName": {
      "type": "String",
      "nullable": true
    },
    "action": {
      "type": "String",
      "nullable": false
    },
    "entityType": {
      "type": "String",
      "nullable": true
    },
    "legacyEntityId": {
      "type": "String",
      "nullable": true
    },
    "oldValues": {
      "type": "String",
      "nullable": true
    },
    "newValues": {
      "type": "String",
      "nullable": true
    },
    "description": {
      "type": "String",
      "nullable": false
    },
    "legacyCreatedById": {
      "type": "String",
      "nullable": true
    },
    "legacyCreatedBy": {
      "type": "String",
      "nullable": true
    },
    "legacyIsSample": {
      "type": "Boolean",
      "nullable": true
    }
  },
  "SystemSetting": {
    "id": {
      "type": "String",
      "nullable": false
    },
    "legacyBase44Id": {
      "type": "String",
      "nullable": true,
      "unique": true
    },
    "createdAt": {
      "type": "DateTime",
      "nullable": false
    },
    "updatedAt": {
      "type": "DateTime",
      "nullable": false
    },
    "legacyCreatedAt": {
      "type": "DateTime",
      "nullable": true
    },
    "legacyUpdatedAt": {
      "type": "DateTime",
      "nullable": true
    },
    "settingKey": {
      "type": "String",
      "nullable": false,
      "unique": true
    },
    "settingValue": {
      "type": "String",
      "nullable": false
    },
    "settingType": {
      "type": "SystemSettingSettingType",
      "nullable": true
    },
    "description": {
      "type": "String",
      "nullable": true
    },
    "updatedByUserId": {
      "type": "String",
      "nullable": true
    },
    "legacyCreatedById": {
      "type": "String",
      "nullable": true
    },
    "legacyCreatedBy": {
      "type": "String",
      "nullable": true
    },
    "legacyIsSample": {
      "type": "Boolean",
      "nullable": true
    }
  }
};
