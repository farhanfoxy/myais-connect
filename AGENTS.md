# AGENTS.md — MyAIS Connect

## Mission
Rebuild the approved MyAIS Connect Base44 prototype as a maintainable, scalable TypeScript system while preserving current behavior and data semantics before adding improvements.

## Target stack
- Monorepo: pnpm workspaces + Turborepo
- Web/admin: Next.js + TypeScript + Tailwind CSS + shadcn/ui
- Mobile/member app: Expo React Native + TypeScript + NativeWind
- API: NestJS + TypeScript
- Database: PostgreSQL + Prisma
- Shared validation/types: Zod + TypeScript
- Tests: Vitest/Jest where appropriate + API integration tests + Playwright for web E2E
- Storage: S3-compatible abstraction; provider selected later
- Payments: provider adapter; Malaysian DuitNow/online-banking provider selected in payment phase

## Source-of-truth order
When sources conflict, use this priority:
1. Actual Base44 source/archive and entity JSONC schemas
2. Actual exported Base44 data/CSV structure
3. Base44 migration technical export
4. Project migration docs
5. Assumptions only when explicitly approved

Never silently invent, rename, remove, or change an existing business rule.

## Development rules
- Feature parity first; improvements second.
- Strict TypeScript. Avoid `any` unless justified.
- API/backend is the authority for permissions, state changes, membership activation, and payment verification.
- Never trust client-provided user IDs, roles, prices, payment status, or membership status.
- All privileged actions require server-side authorization.
- Use DB transactions for multi-entity state changes.
- Preserve legacy Base44 IDs in a dedicated `legacyBase44Id` field during migration.
- Do not reuse Base44 IDs as primary keys in the new system.
- Do not commit CSV exports, personal data, uploaded documents, secrets, API keys, or payment credentials.
- Do not modify the legacy Base44 archive unless explicitly requested.
- Do not add a Base44 runtime dependency to the new application.

## Token / work efficiency
- Read only files relevant to the current task.
- Do not restate the project plan on every turn.
- Batch cohesive edits.
- Avoid long explanatory comments in code.
- Prefer shared types/validation over duplicated definitions.
- Do not generate placeholder features that are not requested.
- Do not refactor unrelated code.
- After a task: run the smallest relevant lint/typecheck/test set and report only changed files, tests, and blockers.
- If a requirement is ambiguous and could alter schema/business behavior, stop and ask rather than guess.

## Existing roles to preserve
Member-side:
- APPLICANT
- ORDINARY_MEMBER
- LIFETIME_MEMBER
- ASSOCIATE_MEMBER
- HONORARY_MEMBER

Admin/committee:
- PRESIDENT
- DEPUTY_PRESIDENT
- SECRETARY
- ASSISTANT_SECRETARY
- TREASURER
- COMMITTEE_MEMBER
- SYSTEM_ADMINISTRATOR
- ADMIN (legacy compatibility/migration only unless retained deliberately)

Normalize role casing in the new system; migration code must map legacy lowercase/uppercase variants.

## Application state machine to preserve
DRAFT -> SUBMITTED
SUBMITTED -> UNDER_REVIEW
UNDER_REVIEW -> ADDITIONAL_INFORMATION_REQUIRED | RECOMMENDED_FOR_APPROVAL | REJECTED
ADDITIONAL_INFORMATION_REQUIRED -> UNDER_REVIEW
RECOMMENDED_FOR_APPROVAL -> APPROVED_PENDING_PAYMENT | REJECTED
APPROVED_PENDING_PAYMENT -> PAYMENT_SUBMITTED
PAYMENT_SUBMITTED -> PAYMENT_UNDER_VERIFICATION
PAYMENT_UNDER_VERIFICATION -> ACTIVE | APPROVED_PENDING_PAYMENT
ACTIVE -> EXPIRED | SUSPENDED | TERMINATED

Do not allow arbitrary state updates.

## Payment safety
Current Base44 prototype uses manual proof/verification. Future system will add DuitNow/online banking.
- Frontend must never mark payment VERIFIED.
- Frontend must never activate membership.
- Payment provider callbacks/webhooks must be verified server-side.
- Payment and membership activation must be idempotent.
- Keep an immutable/auditable payment event trail.

## Data migration
Two deleted Base44 users are referenced by historical records. Preserve these as disabled, non-login legacy identities so FK history remains intact.
Empty legacy entities still require schema support if they are part of the approved system.
