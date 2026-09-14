# Security Requirements

## Authorization
Server-side enforcement is mandatory. Frontend visibility is UX only.

### Ownership
A normal user may access only their own:
- profile
- membership applications
- application documents
- eligibility answers
- information requests/responses
- membership
- payment records intended for them
- notifications
- event registrations

### Admin capabilities
Preserve the Base44 permission intent:
- Application review: President, Deputy President, Secretary, Assistant Secretary, Committee Member, System Administrator, legacy Admin
- Final approval: President, System Administrator, legacy Admin
- Payment verification: Treasurer, System Administrator, legacy Admin
- Member directory: President, Deputy President, Secretary, Assistant Secretary, System Administrator, legacy Admin
- Events: President, Deputy President, Secretary, Assistant Secretary, Committee Member, System Administrator, legacy Admin
- Announcements: President, Secretary, System Administrator, legacy Admin
- Reports: President, Deputy President, Treasurer, System Administrator, legacy Admin
- Audit logs: President, System Administrator, legacy Admin
- Settings: System Administrator, legacy Admin

## Sensitive data
Identification documents, payment receipts, profile data and private attachments must not be public URLs by default. Use private storage and signed/authorized retrieval.

## API baseline
- DTO/schema validation
- rate limiting where appropriate
- secure headers
- strict CORS
- authentication/session protection
- no secrets in clients
- structured audit logging for privileged actions
- safe error responses
- idempotent payment callbacks
- webhook signature verification when payment provider is introduced

## Migration data
CSV exports and real member data stay outside public Git repositories.
