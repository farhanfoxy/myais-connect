# Base44 Migration Contract

## Legacy entities
Preserve the concepts and data of:
User
MemberProfile
MembershipType
MembershipApplication
EligibilityQuestion
EligibilityAnswer
ApplicationDocument
ApplicationReview
InformationRequest
Membership
Payment
RenewalApplication
Event
EventRegistration
Announcement
Notification
AuditLog
SystemSetting

## Existing member features
- Email/password registration
- Email OTP verification
- Google sign-in
- Login/logout
- Password reset
- Profile management + profile photo
- Profile completion tracking
- 4-step membership application:
  1. eligibility
  2. membership type
  3. documents
  4. review/submit
- Application reference generation
- Application tracker
- Information-request response
- Manual payment proof submission
- Payment status tracking
- Digital membership card
- Notifications
- Announcements
- Public event browsing/detail

## Existing admin features
- Dashboard/statistics
- Application list/search/filter
- Start review
- Request information
- Recommend approval
- Final approve/reject with role gates
- Payment verify/reject
- Membership activation on payment verification
- Member directory + CSV export
- Event create/edit/publish/cancel/archive/duplicate/delete-draft
- Event registration viewer
- Announcement management
- Reports/charts + CSV
- Audit log viewer
- Membership type settings
- Permission-filtered admin navigation

## Important legacy behavior
- Honorary membership can activate without paid membership workflow.
- Other approved membership types create/require payment before activation.
- Payment verification creates ACTIVE Membership and updates user member role.
- Document types include identification, AIS proof, profile photo, payment receipt, additional support, requested information.
- Existing uploads accept PDF/JPG/PNG; application document UI uses 5 MB max.
- Public event registration creation was not yet implemented even though EventRegistration schema exists.
- Renewal page/workflow was not fully implemented even though RenewalApplication schema exists.

## Legacy IDs
Every migrated legacy record gets `legacyBase44Id` where a Base44 record ID exists. Use new UUID/UUIDv7/CUID2 primary keys consistently in the new database.

## Historical/orphan users
Preserve orphan references with disabled legacy identity records. They must not be able to authenticate.

## Migration completeness rule
For every legacy field, record a decision:
- MIGRATE
- TRANSFORM
- RENAME
- LEGACY_ONLY
- DROP_WITH_REASON

No field is silently discarded.
