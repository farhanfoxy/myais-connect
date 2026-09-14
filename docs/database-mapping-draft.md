# Database mapping draft — Base44 source and export analysis

Status: **analysis only; not an approved canonical schema**. No Prisma models, migrations, application changes, data imports, or archive edits were made.

## Source and scope

- Current source location: `../myais-connect-base44-archive` (sibling repository). The initial source-only analysis used the same archive while it was nested; this export audit rechecked the sibling at the unchanged commit below.
- Archive HEAD: `087cc14fa0034107972006c413ba8992eac9caac`. Its working tree was clean when inspected.
- Read `AGENTS.md` and every existing file in `docs/` first. Source evidence takes precedence over those documents for this analysis; conflicts are recorded rather than resolved by changing behavior.
- Inspected all **18** files in [base44/entities](../../myais-connect-base44-archive/base44/entities): **221 explicitly declared properties**, **26 field-level enums**. Also inspected entity readers/writers, validation, role helpers, reference generators, and the sole archived backend function, [manageEvent](../../myais-connect-base44-archive/base44/functions/manageEvent/entry.ts).
- All schema files parsed as plain JSON despite their `.jsonc` extension. Their property definitions use only `type`, `enum`, `default`, `format`, and `description`; their `required` arrays and `rls` objects are documented separately below.
- The initial source-only analysis is supplemented by the **Export Data Audit** below: all 18 CSVs in `../migration-private` and `Base44_User_ID_Mapping.txt` were inspected. This establishes the supplied export contents, not completeness of the deployed platform/auth contract. No live Base44 calls, downloads, dependency installation, or archive execution occurred.
- The two deleted identities and all nine domain-reference records listed in the private mapping are verified against the exports. Preserve them as disabled, non-login legacy identities under AGENTS.md; actual IDs and personal data stay outside this document.

## Approved canonical mapping decisions

The user approved the following decisions after the export audit. They supersede earlier provisional target mappings, while Base44 schema definitions and exported observations below remain historical evidence. **R01, R12 and R18 are resolved for canonical design.** This is documentation approval only; no Prisma models, migrations or application code are created.

### R01 — Legacy role mapping: RESOLVED

- Base44 `user` maps to `APPLICANT`; Base44 `admin` maps to `SYSTEM_ADMINISTRATOR`. Known casing variants follow the same mapping.
- All other declared Base44 roles map to their equivalent normalized uppercase canonical roles. The canonical UserRole enum contains exactly: `APPLICANT`, `ORDINARY_MEMBER`, `LIFETIME_MEMBER`, `ASSOCIATE_MEMBER`, `HONORARY_MEMBER`, `PRESIDENT`, `DEPUTY_PRESIDENT`, `SECRETARY`, `ASSISTANT_SECRETARY`, `TREASURER`, `COMMITTEE_MEMBER`, `SYSTEM_ADMINISTRATOR`.
- Neither `user` nor `admin` (including uppercase USER/ADMIN) is a canonical enum member. ADMIN references in source evidence describe legacy behavior, not a target role.
- Preserve the exact original imported role, before normalization, in nullable `User.legacyRole` (`String?`). Blank optional roles become NULL; they are not defaulted to APPLICANT. Do not fabricate roles for disabled historical identities.
- The route-only `SYSTEM_ADMIN` alias is not a declared/exported role and receives no invented mapping; its code/permission cleanup remains R02 MEDIUM. Legacy permission enforcement questions remain R03/R05/R25.

### R12 — Event creator: RESOLVED

- Canonical `Event.createdByUserId` is a nullable User foreign key (`String? @db.Uuid` with the draft new-ID strategy). Populate it only when Base44 `createdBy` resolves to a real User through the legacy-ID lookup.
- For a system/service/platform principal, set `createdByUserId = NULL` and preserve the exact original identifier/value in nullable `Event.legacyCreatedBy` (`String?`). The exported `system` sentinel therefore becomes NULL FK plus `legacyCreatedBy = "system"`.
- Do not substitute platform `created_by_id` for the business creator. Preserve platform creator metadata separately. Do not create authenticatable fake users for service/platform principals.
- The two confirmed deleted human identities still require disabled, non-login legacy identities under AGENTS.md. They are distinct from platform principals. Unknown purported human references still require investigation; they are not automatically classified as services.
- Keep Event business timestamps separate from imported system timestamps. Duplicate/cancellation workflow behavior remains R21 MEDIUM; principal platform details remain R25 HIGH.

### R18 — Date, time and NULL handling: RESOLVED FOR CANONICAL DESIGN

- System timestamps and event/action timestamps use PostgreSQL `timestamptz` (`DateTime @db.Timestamptz(3)` for the observed millisecond precision), normalized to UTC. Use UTC database/session rendering; do not use timezone-less timestamp columns for canonical instants.
- Date-only business fields use PostgreSQL `date` (`DateTime @db.Date`), without shifting the calendar date through timezone conversion.
- `Event.startTime` and `Event.endTime` preserve local clock-time semantics, independently of their date fields. Retain the draft String clock-time representation; do not convert these standalone clocks to UTC instants.
- Add canonical `Event.timezone` as an IANA timezone string, default `Asia/Kuala_Lumpur`, unless explicitly migrated otherwise. This default applies to Event local scheduling.
- Blank optional Base44 values migrate to SQL NULL, not empty strings. Explicit null/omitted optional values also remain NULL. Do not turn valid false or zero into NULL, trim nonblank values silently, or backfill User.accountStatus with ACTIVE. Source raw provenance can retain original representation privately.
- Canonical imported system timestamps use `legacyCreatedAt` / `legacyUpdatedAt`, separate from Event `createdAt` / `updatedAt`; retain exact raw source strings in restricted provenance. Do not attach `@updatedAt` to imported legacy timestamps.
- **Migration execution follow-up (R25 HIGH):** UTC target storage does not prove the original timezone of the 156 offset-less system timestamp cells. Before importing them, document the source-zone interpretation from evidence or an explicit migration decision, then normalize to UTC. Do not silently append Z or apply Event.timezone to unrelated platform timestamps. This does not block choosing timestamptz or beginning canonical design.

## Reading the field tables

Each entity has a table containing every declared field plus explicitly marked implicit/system or code-only fields. Source types, required flags, defaults, and enum values come directly from its JSONC. A default does **not** make an optional property required. `—` means no declaration, not an empty string, zero, or a runtime default.

The PostgreSQL/Prisma columns remain proposals except for the explicitly approved decisions above:

- Existing camelCase names stay unchanged unless a row says otherwise. No destructive drop is proposed. Schema-only or currently unused fields remain `MIGRATE`, not discarded.
- `MIGRATE`: retain the field's value/meaning. `TRANSFORM`: explicit representation conversion or legacy-ID lookup. `RENAME`: retain content under a clearer target name. `LEGACY_ONLY`: retain source metadata for provenance without treating it as an operational relationship. `DROP_WITH_REASON`: available action, **used for no fields**.
- Each imported entity needs a **new** primary key `id`; `String @db.Uuid` is the draft choice, with the UUID generation/version decision deferred. Original `id` is copied exactly into `legacyBase44Id` and is never reused as the new primary key. A per-entity unique legacy-ID lookup is proposed for import identity; 78 exported entity IDs and three mapped User IDs are nonempty and globally distinct in this supplied dataset; this does not establish uniqueness rules for other fields. New native records need not have a legacy ID.
- Direct reference fields propose `String @db.Uuid` holding the referenced new ID, obtained by lookup of its entity's `legacyBase44Id`. The schemas declare plain strings, **not foreign keys**. No cascade deletes or uniqueness constraints are inferred. Unresolved required references block that record's import; do not drop the record or silently make the field optional.
- The “Nullable?” column applies to the target import representation. Required schema fields propose “No”; optional schema fields propose “Yes”. Neither omission nor a default proves that explicit JSON null is accepted by Base44. Existing code does send null for some optional fields. Use the per-column export profile below before final NOT NULL/default decisions; blank optional values become NULL under the approved rule; original representations may remain in restricted provenance.
- `String` maps to PostgreSQL text; no source length limit is invented. Enum type names below are proposed. Source enum values remain recorded exactly; canonical roles follow the approved role mapping above. Non-enum strings such as membership type snapshots, payment methods, and review status snapshots are **not** silently tightened into enums.
- Schema `number` maps provisionally to `Float` (PostgreSQL double precision), preserving the source's unconstrained numeric semantics. Fields that look integral are not declared integer. Narrowing to Int/BigInt requires value/range profiling. Monetary fields propose `Decimal` (PostgreSQL numeric); precision and scale are **unresolved**. Do not silently round to two decimal places or rely on Prisma's implicit decimal precision.
- Approved date-only mapping is `DateTime @db.Date`; system/event/action instants use `DateTime @db.Timestamptz(3)` normalized to UTC. Millisecond precision covers all observed values. Optional blanks become NULL; invalid nonblank dates must be reported, never replaced with “now”. Source-zone interpretation for offset-less imports is tracked under R25 HIGH.
- **Export qualification:** User system timestamps have explicit Z; non-User system timestamps have no offset. Canonical UTC timestamptz is approved; raw input remains restricted provenance and source-zone interpretation is an import follow-up (R25 HIGH). Six-digit fractional syntax is observed, but every supplied timestamp is millisecond-aligned. Optional fields on the four empty entities remain unprofiled.
- System timestamps use `legacyCreatedAt` / `legacyUpdatedAt` as UTC timestamptz; exact raw input remains restricted provenance on every entity to preserve source provenance without colliding with Event's explicit `createdAt` / `updatedAt`. Do not attach `@updatedAt` to imported legacy timestamps or synthesize missing source timestamps.
- File URLs remain preserved strings in restricted data. This does not authorize public retrieval or automatic network downloads. Converting them to private storage objects is a later, separately specified task.
- Every `source-only` enum/constraint/reference ambiguity is listed below; blocked choices must be resolved before implementing the canonical schema.

## Base44 system and undeclared User fields

The archive does not contain the platform's complete base-entity schema. The following distinction is essential:

| Field | Evidence in this archive | What is / is not established |
| --- | --- | --- |
| `id` | Entity filter/update/delete calls throughout; `manageEvent/entry.ts:135` removes it from duplicates. | Returned legacy identity, consumed as a string. Exact platform generation algorithm/format is absent. |
| `created_date` | Sorting throughout; review/notification/announcement displays; `manageEvent/entry.ts:136`. | Implicit creation metadata consumed as a date string. Required/default contract and presence on every entity are not declared here. |
| `updated_date` | MemberProfile list sorting; `Profile.jsx:79`; `manageEvent/entry.ts:137`. | Implicit update metadata consumed as a date string. Required/default contract and presence on every entity are not declared here. |
| `created_by_id` | Destructured out of editable MemberProfile payload in `Profile.jsx:79`. | Name implies creator ID, but exact platform type, referent, nullability, and presence on other entities are not established. Preserve raw if exported. |
| User.`email` | `Register.jsx:37`, user/profile joins and admin displays. | Auth identifier and observed User property; omitted from custom User.jsonc. Uniqueness, case semantics and provider contract require user export/platform evidence. |
| User.`full_name` | Event audit writes, information response audit, announcement author snapshots, profile fallback. | Undeclared returned name property. Do not merge with fullName without reconciliation. |
| User.`fullName` | `Register.jsx:54`, `Profile.jsx:100`, `nameUtils.js:22`. | Undeclared property explicitly written by application code; not proven to be a platform alias of full_name. |

The three common identity/timestamp rows are repeated under each entity as an **implicit metadata checklist**, not evidence that every record has all three. Only MemberProfile has direct source evidence for `created_by_id`; the audit now confirms its exported presence on every populated non-User entity and adds common metadata mapping rows below. Fields such as `created_by`, `is_sample`, email-verification flags, provider IDs, password hashes, deletion flags, or other platform metadata are **not defined or referenced as entity properties in the inspected source**. The Export Data Audit confirms created_by_id, created_by and is_sample on all 13 populated non-User entities, plus User.status. The platform contract beyond those headers remains unknown. Auth passwords, OTPs, access tokens and reset tokens occur as transient SDK inputs/results; do not invent database columns or import credentials from those UI variables.

## Entity mappings
### User

Schema: [User.jsonc](../../myais-connect-base44-archive/base44/entities/User.jsonc). Declared fields: **5**.

Code evidence (archive-relative): `src/pages/Register.jsx:23-55`; `src/pages/member/Profile.jsx:58-105`; `src/lib/nameUtils.js:1-26`; `src/lib/constants.js:1-78`; `src/pages/admin/PaymentManagement.jsx:110-113`.

The custom schema contains five properties and no RLS block. Its required array is empty. Do not infer the platform auth schema from this extension. Existing role strings must be retained in restricted migration provenance before normalization; disabled legacy identities must never be given login credentials.

| Base44 field | Base44 type | Required/optional | Default | Enum values | Relationship/reference | Proposed PostgreSQL/Prisma field | Proposed Prisma type | Nullable? | Migration action | Notes / validation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `role` | string | Optional | `"applicant"` | `applicant`, `ordinary_member`, `lifetime_member`, `associate_member`, `honorary_member`, `president`, `deputy_president`, `secretary`, `assistant_secretary`, `treasurer`, `committee_member`, `system_administrator` | — | `role` | UserRole | Yes | TRANSFORM | Approved: user -> APPLICANT; admin -> SYSTEM_ADMINISTRATOR; other declared roles -> equivalent uppercase. Preserve original in nullable legacyRole; no USER/ADMIN canonical members. |
| `role` (original import copy) | Source string | Optional | — | Raw value, not a canonical enum | None | `legacyRole` | String | Yes | LEGACY_ONLY | Preserve exact imported role before normalization; blank optional value becomes NULL. Target provenance addition, not a new Base44 field. |
| `phoneNumber` | string | Optional | — | — | — | `phoneNumber` | String | Yes | MIGRATE | Phone number |
| `photoUrl` | string | Optional | — | — | — | `photoUrl` | String | Yes | MIGRATE | Profile photo lives on User, not MemberProfile; separate from application PROFILE_PHOTO uploads. |
| `accountStatus` | string | Optional | `"ACTIVE"` | `ACTIVE`, `DISABLED`, `SUSPENDED` | — | `accountStatus` | UserAccountStatus | Yes | MIGRATE | No custom runtime enforcement or writer found; platform auth behavior unknown. |
| `lastLoginAt` | string (date-time) | Optional | — | — | — | `lastLoginAt` | DateTime @db.Timestamptz(3) | Yes | TRANSFORM | No custom writer found; do not infer last login from created_date/updated_date. |
| `id` | Implicit string; no declaration | System; contract absent | Platform-generated; algorithm unknown | — | This entity's legacy identity | `legacyBase44Id` | String | No for imported records; native rows may be null | RENAME | New id generated independently. Copy original ID exactly. |
| `created_date` | Implicit date string; no declaration | Unknown; system metadata | Platform-managed; exact contract unknown | — | — | `legacyCreatedAt` | DateTime @db.Timestamptz(3) | Yes; export presence profiled below | TRANSFORM | Canonical UTC instant; retain raw input privately. Source-zone interpretation precedes offset-less import (R25 HIGH); R18 schema decision resolved. |
| `updated_date` | Implicit date string; no declaration | Unknown; system metadata | Platform-managed; exact contract unknown | — | — | `legacyUpdatedAt` | DateTime @db.Timestamptz(3) | Yes; export presence profiled below | TRANSFORM | Canonical UTC instant; retain raw input privately. Source-zone interpretation precedes offset-less import (R25 HIGH); R18 schema decision resolved. |
| `email` | Undeclared; string used by auth/UI | Unknown at entity level; registration UI requires it | Unknown | — | Auth identifier; not a FK | `email` | String | Yes, provisional for incomplete/disabled identities | MIGRATE | Verify platform required/unique/case semantics and duplicate addresses before constraining. |
| `full_name` | Undeclared; string consumed by UI | Unknown | Unknown | — | Competing name source with fullName and MemberProfile.fullName | `legacyFullName` | String | Yes, provisional | RENAME | Retain separately; exact alias/synchronization semantics unknown. |
| `fullName` | Undeclared; string written by code | Unknown at entity level; registration/profile UI requires name | Unknown | — | Duplicated from MemberProfile.fullName on save | `fullName` | String | Yes, provisional | MIGRATE | Keep both name spellings; do not automatically overwrite a populated source with another. |

### MemberProfile

Schema: [MemberProfile.jsonc](../../myais-connect-base44-archive/base44/entities/MemberProfile.jsonc). Declared fields: **22**.

Code evidence (archive-relative): `src/pages/member/Profile.jsx:20-150`; `src/lib/nameUtils.js:1-26`; `src/pages/member/MyApplication.jsx:70-94`.

The source reads the first matching profile per user or builds a map keyed by userId. This suggests intended single-profile behavior but does not establish a unique constraint. Profile completion uses UI rules, not schema required flags.

| Base44 field | Base44 type | Required/optional | Default | Enum values | Relationship/reference | Proposed PostgreSQL/Prisma field | Proposed Prisma type | Nullable? | Migration action | Notes / validation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `userId` | string | Required | — | — | User.id via legacyBase44Id; logical reference, not declared FK | `userId` | String @db.Uuid | No | TRANSFORM | User ID reference |
| `fullName` | string | Optional | — | — | — | `fullName` | String | Yes | MIGRATE | UI requires trimmed length >=2; normalized whitespace; duplicated into undeclared User.fullName. |
| `phoneNumber` | string | Optional | — | — | — | `phoneNumber` | String | Yes | MIGRATE | Duplicates User.phoneNumber conceptually; no synchronization found. |
| `identificationType` | string | Optional | — | `NRIC`, `PASSPORT`, `OTHER` | — | `identificationType` | MemberProfileIdentificationType | Yes | MIGRATE | No field-specific constraint beyond declared type. |
| `identificationNumber` | string | Optional | — | — | — | `identificationNumber` | String | Yes | MIGRATE | No field-specific constraint beyond declared type. |
| `nationality` | string | Optional | — | — | — | `nationality` | String | Yes | MIGRATE | Free text; eligibility uses lowercase substring malaysia. |
| `dateOfBirth` | string (date) | Optional | — | — | — | `dateOfBirth` | DateTime @db.Date | Yes | TRANSFORM | No field-specific constraint beyond declared type. |
| `gender` | string | Optional | — | `MALE`, `FEMALE`, `OTHER` | — | `gender` | MemberProfileGender | Yes | MIGRATE | No field-specific constraint beyond declared type. |
| `addressLine1` | string | Optional | — | — | — | `addressLine1` | String | Yes | MIGRATE | No field-specific constraint beyond declared type. |
| `addressLine2` | string | Optional | — | — | — | `addressLine2` | String | Yes | MIGRATE | No field-specific constraint beyond declared type. |
| `city` | string | Optional | — | — | — | `city` | String | Yes | MIGRATE | No field-specific constraint beyond declared type. |
| `state` | string | Optional | — | — | — | `state` | String | Yes | MIGRATE | UI select has Malaysian-state choices, but schema is free string. |
| `postcode` | string | Optional | — | — | — | `postcode` | String | Yes | MIGRATE | No field-specific constraint beyond declared type. |
| `country` | string | Optional | — | — | — | `country` | String | Yes | MIGRATE | Free text; eligibility uses lowercase substring malaysia. |
| `institution` | string | Optional | — | — | — | `institution` | String | Yes | MIGRATE | No field-specific constraint beyond declared type. |
| `occupation` | string | Optional | — | — | — | `occupation` | String | Yes | MIGRATE | No field-specific constraint beyond declared type. |
| `department` | string | Optional | — | — | — | `department` | String | Yes | MIGRATE | No field-specific constraint beyond declared type. |
| `areaOfExpertise` | string | Optional | — | — | — | `areaOfExpertise` | String | Yes | MIGRATE | No field-specific constraint beyond declared type. |
| `aisMember` | boolean | Optional | `false` | — | — | `aisMember` | Boolean | Yes | MIGRATE | Profile save conditionally requires number and expiry when true; eligibility allows local-answer fallback. |
| `aisMembershipNumber` | string | Optional | — | — | — | `aisMembershipNumber` | String | Yes | MIGRATE | External AIS identifier, no FK/uniqueness contract; required by UI only when aisMember. |
| `aisMembershipExpiry` | string (date) | Optional | — | — | — | `aisMembershipExpiry` | DateTime @db.Date | Yes | TRANSFORM | Required by profile UI when aisMember; eligibility compares parsed date strictly greater than now. |
| `profileCompletionPercentage` | number | Optional | `0` | — | — | `profileCompletionPercentage` | Float | Yes | MIGRATE | Rounded percentage over 15 fields, excluding fullName and AIS fields; persisted derived value. |
| `id` | Implicit string; no declaration | System; contract absent | Platform-generated; algorithm unknown | — | This entity's legacy identity | `legacyBase44Id` | String | No for imported records; native rows may be null | RENAME | New id generated independently. Copy original ID exactly. |
| `created_date` | Implicit date string; no declaration | Unknown; system metadata | Platform-managed; exact contract unknown | — | — | `legacyCreatedAt` | DateTime @db.Timestamptz(3) | Yes; export presence profiled below | TRANSFORM | Canonical UTC instant; retain raw input privately. Source-zone interpretation precedes offset-less import (R25 HIGH); R18 schema decision resolved. |
| `updated_date` | Implicit date string; no declaration | Unknown; system metadata | Platform-managed; exact contract unknown | — | — | `legacyUpdatedAt` | DateTime @db.Timestamptz(3) | Yes; export presence profiled below | TRANSFORM | Canonical UTC instant; retain raw input privately. Source-zone interpretation precedes offset-less import (R25 HIGH); R18 schema decision resolved. |
| `created_by_id` | Undeclared; exported string | Unknown; system metadata | Unknown | — | Platform creator; User or non-user principal | `legacyCreatedById` | String | Yes, provisional | LEGACY_ONLY | Export presence confirmed; preserve raw. No universal User FK: service-marked creator also occurs. |

### MembershipType

Schema: [MembershipType.jsonc](../../myais-connect-base44-archive/base44/entities/MembershipType.jsonc). Declared fields: **10**.

Code evidence (archive-relative): `src/pages/admin/AdminSettings.jsx:18-31`; `src/pages/admin/AdminSettings.jsx:64-94`; `src/pages/member/MyApplication.jsx:47-118`; `src/pages/admin/PaymentManagement.jsx:82-113`.

No creation/seed routine is archived. Settings only updates existing types. Code/name pairs and fees can change, so type references and historical snapshots are both needed.

| Base44 field | Base44 type | Required/optional | Default | Enum values | Relationship/reference | Proposed PostgreSQL/Prisma field | Proposed Prisma type | Nullable? | Migration action | Notes / validation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `code` | string | Required | — | `ORDINARY`, `LIFETIME`, `ASSOCIATE`, `HONORARY` | — | `code` | MembershipTypeCode | No | MIGRATE | No unique constraint declared; application UI looks up by code. |
| `name` | string | Required | — | — | — | `name` | String | No | MIGRATE | No field-specific constraint beyond declared type. |
| `description` | string | Optional | — | — | — | `description` | String | Yes | MIGRATE | No field-specific constraint beyond declared type. |
| `entranceFee` | number | Optional | `0` | — | — | `entranceFee` | Decimal (precision/scale TBD) | Yes | TRANSFORM | Settings uses Number(input), no negative-value guard; preserve historical values. |
| `membershipFee` | number | Optional | `0` | — | — | `membershipFee` | Decimal (precision/scale TBD) | Yes | TRANSFORM | Settings uses Number(input), no negative-value guard; preserve historical values. |
| `validityMonths` | number | Optional | `12` | — | — | `validityMonths` | Float | Yes | MIGRATE | Schema default 12; settings labels 0 as lifetime; fractional/negative values not schema-restricted. |
| `renewable` | boolean | Optional | `true` | — | — | `renewable` | Boolean | Yes | MIGRATE | Declared and editable; no renewal workflow found. |
| `votingRights` | boolean | Optional | `false` | — | — | `votingRights` | Boolean | Yes | MIGRATE | No field-specific constraint beyond declared type. |
| `applicantSelectable` | boolean | Optional | `true` | — | — | `applicantSelectable` | Boolean | Yes | MIGRATE | UI combines this flag with active and eligibility result. |
| `active` | boolean | Optional | `true` | — | — | `active` | Boolean | Yes | MIGRATE | No field-specific constraint beyond declared type. |
| `id` | Implicit string; no declaration | System; contract absent | Platform-generated; algorithm unknown | — | This entity's legacy identity | `legacyBase44Id` | String | No for imported records; native rows may be null | RENAME | New id generated independently. Copy original ID exactly. |
| `created_date` | Implicit date string; no declaration | Unknown; system metadata | Platform-managed; exact contract unknown | — | — | `legacyCreatedAt` | DateTime @db.Timestamptz(3) | Yes; export presence profiled below | TRANSFORM | Canonical UTC instant; retain raw input privately. Source-zone interpretation precedes offset-less import (R25 HIGH); R18 schema decision resolved. |
| `updated_date` | Implicit date string; no declaration | Unknown; system metadata | Platform-managed; exact contract unknown | — | — | `legacyUpdatedAt` | DateTime @db.Timestamptz(3) | Yes; export presence profiled below | TRANSFORM | Canonical UTC instant; retain raw input privately. Source-zone interpretation precedes offset-less import (R25 HIGH); R18 schema decision resolved. |

### MembershipApplication

Schema: [MembershipApplication.jsonc](../../myais-connect-base44-archive/base44/entities/MembershipApplication.jsonc). Declared fields: **20**.

Code evidence (archive-relative): `src/pages/member/MyApplication.jsx:36-195`; `src/pages/admin/ApplicationReviewPage.jsx:77-200`; `src/pages/member/InformationResponse.jsx:21-56`; `src/lib/constants.js:81-126`.

This is distinct from Membership; do not collapse their statuses. The UI reads the newest application rather than proving one application per user. Drafts have no required reference number or type relationship.

| Base44 field | Base44 type | Required/optional | Default | Enum values | Relationship/reference | Proposed PostgreSQL/Prisma field | Proposed Prisma type | Nullable? | Migration action | Notes / validation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `applicationNumber` | string | Optional | — | — | — | `applicationNumber` | String | Yes | MIGRATE | Assigned on submit using current list length, including already-created draft. |
| `userId` | string | Required | — | — | User.id via legacyBase44Id; logical reference, not declared FK | `userId` | String @db.Uuid | No | TRANSFORM | No field-specific constraint beyond declared type. |
| `requestedMembershipTypeId` | string | Optional | — | — | MembershipType.id via legacyBase44Id; logical reference, not declared FK | `requestedMembershipTypeId` | String @db.Uuid | Yes | TRANSFORM | No field-specific constraint beyond declared type. |
| `recommendedMembershipTypeId` | string | Optional | — | — | MembershipType.id via legacyBase44Id; logical reference, not declared FK | `recommendedMembershipTypeId` | String @db.Uuid | Yes | TRANSFORM | No field-specific constraint beyond declared type. |
| `approvedMembershipTypeId` | string | Optional | — | — | MembershipType.id via legacyBase44Id; logical reference, not declared FK | `approvedMembershipTypeId` | String @db.Uuid | Yes | TRANSFORM | No field-specific constraint beyond declared type. |
| `status` | string | Optional | `"DRAFT"` | `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `ADDITIONAL_INFORMATION_REQUIRED`, `ELIGIBLE`, `RECOMMENDED_FOR_APPROVAL`, `APPROVED_PENDING_PAYMENT`, `PAYMENT_SUBMITTED`, `PAYMENT_UNDER_VERIFICATION`, `ACTIVE`, `REJECTED`, `EXPIRED`, `SUSPENDED`, `TERMINATED` | — | `status` | MembershipApplicationStatus | Yes | MIGRATE | ELIGIBLE declared but no transition in VALID_TRANSITIONS or status writer found. |
| `currentStep` | number | Optional | `1` | — | — | `currentStep` | Float | Yes | MIGRATE | Schema default 1; creation writes 2; submission writes 4. UI step is separate zero-based state. |
| `eligibilityScore` | number | Optional | — | — | — | `eligibilityScore` | Float | Yes | MIGRATE | Snapshot from hardcoded five-condition evaluation; schema number has no range. |
| `eligibilityExplanation` | string | Optional | — | — | — | `eligibilityExplanation` | String | Yes | MIGRATE | Snapshot of evaluation text; local answers are not persisted as EligibilityAnswer rows. |
| `submittedAt` | string (date-time) | Optional | — | — | — | `submittedAt` | DateTime @db.Timestamptz(3) | Yes | TRANSFORM | No field-specific constraint beyond declared type. |
| `reviewedAt` | string (date-time) | Optional | — | — | — | `reviewedAt` | DateTime @db.Timestamptz(3) | Yes | TRANSFORM | Updated for every review action, not only first review. |
| `approvedAt` | string (date-time) | Optional | — | — | — | `approvedAt` | DateTime @db.Timestamptz(3) | Yes | TRANSFORM | No field-specific constraint beyond declared type. |
| `rejectedAt` | string (date-time) | Optional | — | — | — | `rejectedAt` | DateTime @db.Timestamptz(3) | Yes | TRANSFORM | No field-specific constraint beyond declared type. |
| `rejectionReason` | string | Optional | — | — | — | `rejectionReason` | String | Yes | MIGRATE | No field-specific constraint beyond declared type. |
| `latestReviewerRemarks` | string | Optional | — | — | — | `latestReviewerRemarks` | String | Yes | MIGRATE | Latest truthy remarks snapshot; blank new remarks retain previous value. |
| `reviewedByUserId` | string | Optional | — | — | User.id via legacyBase44Id; logical reference, not declared FK | `reviewedByUserId` | String @db.Uuid | Yes | TRANSFORM | Latest reviewing actor, distinct from full ApplicationReview history. |
| `approvedByUserId` | string | Optional | — | — | User.id via legacyBase44Id; logical reference, not declared FK | `approvedByUserId` | String @db.Uuid | Yes | TRANSFORM | No field-specific constraint beyond declared type. |
| `requestedMembershipTypeCode` | string | Optional | — | — | MembershipType.code snapshot; no FK/enum constraint | `requestedMembershipTypeCode` | String | Yes | MIGRATE | Denormalized code; schema permits any string, not MembershipTypeCode enum. |
| `recommendedMembershipTypeCode` | string | Optional | — | — | MembershipType.code snapshot; no FK/enum constraint | `recommendedMembershipTypeCode` | String | Yes | MIGRATE | Denormalized eligibility result; no later recommendation recalculation found. |
| `approvedMembershipTypeCode` | string | Optional | — | — | MembershipType.code snapshot; no FK/enum constraint | `approvedMembershipTypeCode` | String | Yes | MIGRATE | Denormalized approved code; kept independently from requested/recommended choices. |
| `id` | Implicit string; no declaration | System; contract absent | Platform-generated; algorithm unknown | — | This entity's legacy identity | `legacyBase44Id` | String | No for imported records; native rows may be null | RENAME | New id generated independently. Copy original ID exactly. |
| `created_date` | Implicit date string; no declaration | Unknown; system metadata | Platform-managed; exact contract unknown | — | — | `legacyCreatedAt` | DateTime @db.Timestamptz(3) | Yes; export presence profiled below | TRANSFORM | Canonical UTC instant; retain raw input privately. Source-zone interpretation precedes offset-less import (R25 HIGH); R18 schema decision resolved. |
| `updated_date` | Implicit date string; no declaration | Unknown; system metadata | Platform-managed; exact contract unknown | — | — | `legacyUpdatedAt` | DateTime @db.Timestamptz(3) | Yes; export presence profiled below | TRANSFORM | Canonical UTC instant; retain raw input privately. Source-zone interpretation precedes offset-less import (R25 HIGH); R18 schema decision resolved. |

### EligibilityQuestion

Schema: [EligibilityQuestion.jsonc](../../myais-connect-base44-archive/base44/entities/EligibilityQuestion.jsonc). Declared fields: **9**.

Code evidence (archive-relative): `src/pages/member/MyApplication.jsx:70-118`.

Schema-only entity: no SDK reads or writes found. The live UI's eligibility calculation does not consume these question records. Preserve all fields; do not reverse-engineer question rows from the hardcoded UI.

| Base44 field | Base44 type | Required/optional | Default | Enum values | Relationship/reference | Proposed PostgreSQL/Prisma field | Proposed Prisma type | Nullable? | Migration action | Notes / validation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `code` | string | Required | — | — | — | `code` | String | No | MIGRATE | No uniqueness or seed values declared. |
| `question` | string | Required | — | — | — | `question` | String | No | MIGRATE | No field-specific constraint beyond declared type. |
| `inputType` | string | Required | — | `BOOLEAN`, `DATE`, `TEXT`, `SELECT` | — | `inputType` | EligibilityQuestionInputType | No | MIGRATE | No field-specific constraint beyond declared type. |
| `options` | string | Optional | — | — | — | `options` | String | Yes | MIGRATE | JSON array encoded as string by description only; no parsing or option shape contract found. |
| `displayOrder` | number | Optional | — | — | — | `displayOrder` | Float | Yes | MIGRATE | number, not integer; no default or range. |
| `required` | boolean | Optional | `true` | — | — | `required` | Boolean | Yes | MIGRATE | Question-level flag; distinct from the entity required-property list. |
| `active` | boolean | Optional | `true` | — | — | `active` | Boolean | Yes | MIGRATE | No field-specific constraint beyond declared type. |
| `ordinaryRule` | string | Optional | — | — | — | `ordinaryRule` | String | Yes | MIGRATE | Expected value per description; no evaluator or grammar for this field found. |
| `lifetimeRule` | string | Optional | — | — | — | `lifetimeRule` | String | Yes | MIGRATE | Expected value per description; runtime eligibility uses hardcoded logic instead. |
| `id` | Implicit string; no declaration | System; contract absent | Platform-generated; algorithm unknown | — | This entity's legacy identity | `legacyBase44Id` | String | No for imported records; native rows may be null | RENAME | New id generated independently. Copy original ID exactly. |
| `created_date` | Implicit date string; no declaration | Unknown; system metadata | Platform-managed; exact contract unknown | — | — | `legacyCreatedAt` | DateTime @db.Timestamptz(3) | Yes; export presence profiled below | TRANSFORM | Canonical UTC instant; retain raw input privately. Source-zone interpretation precedes offset-less import (R25 HIGH); R18 schema decision resolved. |
| `updated_date` | Implicit date string; no declaration | Unknown; system metadata | Platform-managed; exact contract unknown | — | — | `legacyUpdatedAt` | DateTime @db.Timestamptz(3) | Yes; export presence profiled below | TRANSFORM | Canonical UTC instant; retain raw input privately. Source-zone interpretation precedes offset-less import (R25 HIGH); R18 schema decision resolved. |

### EligibilityAnswer

Schema: [EligibilityAnswer.jsonc](../../myais-connect-base44-archive/base44/entities/EligibilityAnswer.jsonc). Declared fields: **7**.

Code evidence (archive-relative): `src/pages/member/MyApplication.jsx:70-118`.

Schema-only entity: no SDK reads or writes found. Local answers/declaration in MyApplication are not written here. Do not fabricate missing historical answers.

| Base44 field | Base44 type | Required/optional | Default | Enum values | Relationship/reference | Proposed PostgreSQL/Prisma field | Proposed Prisma type | Nullable? | Migration action | Notes / validation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `applicationId` | string | Required | — | — | MembershipApplication.id via legacyBase44Id; logical reference, not declared FK | `applicationId` | String @db.Uuid | No | TRANSFORM | No field-specific constraint beyond declared type. |
| `questionId` | string | Required | — | — | EligibilityQuestion.id via legacyBase44Id; logical reference, not declared FK | `questionId` | String @db.Uuid | No | TRANSFORM | No field-specific constraint beyond declared type. |
| `userId` | string | Required | — | — | User.id via legacyBase44Id; logical reference, not declared FK | `userId` | String @db.Uuid | No | TRANSFORM | No field-specific constraint beyond declared type. |
| `questionCode` | string | Optional | — | — | EligibilityQuestion.code snapshot | `questionCode` | String | Yes | MIGRATE | Duplicates EligibilityQuestion.code; no population/synchronization code found. |
| `answerText` | string | Optional | — | — | — | `answerText` | String | Yes | MIGRATE | No XOR constraint with answerBoolean/answerOption. DATE representation unspecified. |
| `answerBoolean` | boolean | Optional | — | — | — | `answerBoolean` | Boolean | Yes | MIGRATE | No required answer or exactly-one-answer rule in schema. |
| `answerOption` | string | Optional | — | — | — | `answerOption` | String | Yes | MIGRATE | No relation to options enforced and no answer writer found. |
| `id` | Implicit string; no declaration | System; contract absent | Platform-generated; algorithm unknown | — | This entity's legacy identity | `legacyBase44Id` | String | No for imported records; native rows may be null | RENAME | New id generated independently. Copy original ID exactly. |
| `created_date` | Implicit date string; no declaration | Unknown; system metadata | Platform-managed; exact contract unknown | — | — | `legacyCreatedAt` | DateTime @db.Timestamptz(3) | Yes; export presence profiled below | TRANSFORM | Canonical UTC instant; retain raw input privately. Source-zone interpretation precedes offset-less import (R25 HIGH); R18 schema decision resolved. |
| `updated_date` | Implicit date string; no declaration | Unknown; system metadata | Platform-managed; exact contract unknown | — | — | `legacyUpdatedAt` | DateTime @db.Timestamptz(3) | Yes; export presence profiled below | TRANSFORM | Canonical UTC instant; retain raw input privately. Source-zone interpretation precedes offset-less import (R25 HIGH); R18 schema decision resolved. |

### ApplicationDocument

Schema: [ApplicationDocument.jsonc](../../myais-connect-base44-archive/base44/entities/ApplicationDocument.jsonc). Declared fields: **11**.

Code evidence (archive-relative): `src/pages/member/MyApplication.jsx:128-200`; `src/pages/member/MyApplication.jsx:236-237`; `src/pages/admin/ApplicationReviewPage.jsx:259-283`.

Each upload creates a new row, even when the UI says “Replace”; no unique(applicationId, documentType) constraint is justified. The UI requires three document types regardless of requested membership type; a row's existence suffices, without checking its fileUrl or verificationStatus.

| Base44 field | Base44 type | Required/optional | Default | Enum values | Relationship/reference | Proposed PostgreSQL/Prisma field | Proposed Prisma type | Nullable? | Migration action | Notes / validation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `applicationId` | string | Required | — | — | MembershipApplication.id via legacyBase44Id; logical reference, not declared FK | `applicationId` | String @db.Uuid | No | TRANSFORM | No field-specific constraint beyond declared type. |
| `userId` | string | Required | — | — | User.id via legacyBase44Id; logical reference, not declared FK | `userId` | String @db.Uuid | No | TRANSFORM | No field-specific constraint beyond declared type. |
| `documentType` | string | Required | — | `IDENTIFICATION`, `AIS_MEMBERSHIP_PROOF`, `PROFILE_PHOTO`, `PAYMENT_RECEIPT`, `ADDITIONAL_SUPPORTING_DOCUMENT`, `REQUESTED_INFORMATION` | — | `documentType` | ApplicationDocumentDocumentType | No | MIGRATE | No field-specific constraint beyond declared type. |
| `fileUrl` | string | Optional | — | — | — | `fileUrl` | String | Yes | MIGRATE | Optional in schema despite document-upload purpose; file receipt returned by UploadFile. |
| `originalFileName` | string | Optional | — | — | — | `originalFileName` | String | Yes | MIGRATE | No field-specific constraint beyond declared type. |
| `mimeType` | string | Optional | — | — | — | `mimeType` | String | Yes | MIGRATE | No field-specific constraint beyond declared type. |
| `fileSize` | number | Optional | — | — | — | `fileSize` | Float | Yes | MIGRATE | Browser File.size is bytes. Schema permits any number; do not impose integer/range without profiling. |
| `verificationStatus` | string | Optional | `"PENDING"` | `PENDING`, `VERIFIED`, `INVALID`, `RESUBMISSION_REQUIRED` | — | `verificationStatus` | ApplicationDocumentVerificationStatus | Yes | MIGRATE | Uploader writes PENDING. No verification mutation found. |
| `reviewerRemarks` | string | Optional | — | — | — | `reviewerRemarks` | String | Yes | MIGRATE | No field-specific constraint beyond declared type. |
| `verifiedByUserId` | string | Optional | — | — | User.id via legacyBase44Id; logical reference, not declared FK | `verifiedByUserId` | String @db.Uuid | Yes | TRANSFORM | No field-specific constraint beyond declared type. |
| `verifiedAt` | string (date-time) | Optional | — | — | — | `verifiedAt` | DateTime @db.Timestamptz(3) | Yes | TRANSFORM | No field-specific constraint beyond declared type. |
| `id` | Implicit string; no declaration | System; contract absent | Platform-generated; algorithm unknown | — | This entity's legacy identity | `legacyBase44Id` | String | No for imported records; native rows may be null | RENAME | New id generated independently. Copy original ID exactly. |
| `created_date` | Implicit date string; no declaration | Unknown; system metadata | Platform-managed; exact contract unknown | — | — | `legacyCreatedAt` | DateTime @db.Timestamptz(3) | Yes; export presence profiled below | TRANSFORM | Canonical UTC instant; retain raw input privately. Source-zone interpretation precedes offset-less import (R25 HIGH); R18 schema decision resolved. |
| `updated_date` | Implicit date string; no declaration | Unknown; system metadata | Platform-managed; exact contract unknown | — | — | `legacyUpdatedAt` | DateTime @db.Timestamptz(3) | Yes; export presence profiled below | TRANSFORM | Canonical UTC instant; retain raw input privately. Source-zone interpretation precedes offset-less import (R25 HIGH); R18 schema decision resolved. |

### ApplicationReview

Schema: [ApplicationReview.jsonc](../../myais-connect-base44-archive/base44/entities/ApplicationReview.jsonc). Declared fields: **7**.

Code evidence (archive-relative): `src/pages/admin/ApplicationReviewPage.jsx:77-200`; `src/pages/member/ApplicationTracker.jsx:44-47`.

Append-style records are created by the UI, but JSONC permits admin update/delete. previousStatus/newStatus are free strings, intentionally retained separately from the application status enum.

| Base44 field | Base44 type | Required/optional | Default | Enum values | Relationship/reference | Proposed PostgreSQL/Prisma field | Proposed Prisma type | Nullable? | Migration action | Notes / validation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `applicationId` | string | Required | — | — | MembershipApplication.id via legacyBase44Id; logical reference, not declared FK | `applicationId` | String @db.Uuid | No | TRANSFORM | No field-specific constraint beyond declared type. |
| `reviewerUserId` | string | Required | — | — | User.id via legacyBase44Id; logical reference, not declared FK | `reviewerUserId` | String @db.Uuid | No | TRANSFORM | No field-specific constraint beyond declared type. |
| `reviewerName` | string | Optional | — | — | — | `reviewerName` | String | Yes | MIGRATE | Historical name snapshot from getCurrentFullName(null, user). |
| `decision` | string | Required | — | `START_REVIEW`, `REQUEST_INFORMATION`, `RECOMMEND_APPROVAL`, `APPROVE`, `REJECT`, `RETURN_FOR_CORRECTION` | — | `decision` | ApplicationReviewDecision | No | MIGRATE | RETURN_FOR_CORRECTION declared but no handler found. |
| `remarks` | string | Optional | — | — | — | `remarks` | String | Yes | MIGRATE | No field-specific constraint beyond declared type. |
| `previousStatus` | string | Optional | — | — | — | `previousStatus` | String | Yes | MIGRATE | Free string, not a declared application enum. Preserve original. |
| `newStatus` | string | Optional | — | — | — | `newStatus` | String | Yes | MIGRATE | Free string; honorary approval records ACTIVE directly. |
| `id` | Implicit string; no declaration | System; contract absent | Platform-generated; algorithm unknown | — | This entity's legacy identity | `legacyBase44Id` | String | No for imported records; native rows may be null | RENAME | New id generated independently. Copy original ID exactly. |
| `created_date` | Implicit date string; no declaration | Unknown; system metadata | Platform-managed; exact contract unknown | — | — | `legacyCreatedAt` | DateTime @db.Timestamptz(3) | Yes; export presence profiled below | TRANSFORM | Canonical UTC instant; retain raw input privately. Source-zone interpretation precedes offset-less import (R25 HIGH); R18 schema decision resolved. |
| `updated_date` | Implicit date string; no declaration | Unknown; system metadata | Platform-managed; exact contract unknown | — | — | `legacyUpdatedAt` | DateTime @db.Timestamptz(3) | Yes; export presence profiled below | TRANSFORM | Canonical UTC instant; retain raw input privately. Source-zone interpretation precedes offset-less import (R25 HIGH); R18 schema decision resolved. |

### InformationRequest

Schema: [InformationRequest.jsonc](../../myais-connect-base44-archive/base44/entities/InformationRequest.jsonc). Declared fields: **9**.

Code evidence (archive-relative): `src/pages/admin/ApplicationReviewPage.jsx:86-96`; `src/pages/member/InformationResponse.jsx:21-56`; `src/pages/member/InformationResponse.jsx:93-118`.

Ownership is indirect through applicationId; there is no applicant userId property. requester's identity must not be mistaken for the applicant. Response attachments are stored directly on this entity, not automatically in ApplicationDocument.

| Base44 field | Base44 type | Required/optional | Default | Enum values | Relationship/reference | Proposed PostgreSQL/Prisma field | Proposed Prisma type | Nullable? | Migration action | Notes / validation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `applicationId` | string | Required | — | — | MembershipApplication.id via legacyBase44Id; logical reference, not declared FK | `applicationId` | String @db.Uuid | No | TRANSFORM | No field-specific constraint beyond declared type. |
| `requestedByUserId` | string | Required | — | — | User.id via legacyBase44Id; logical reference, not declared FK | `requestedByUserId` | String @db.Uuid | No | TRANSFORM | No field-specific constraint beyond declared type. |
| `requestedByName` | string | Optional | — | — | — | `requestedByName` | String | Yes | MIGRATE | Reviewer-name snapshot. |
| `message` | string | Required | — | — | — | `message` | String | No | MIGRATE | No field-specific constraint beyond declared type. |
| `dueDate` | string (date) | Optional | — | — | — | `dueDate` | DateTime @db.Date | Yes | TRANSFORM | Reviewer UI permits omission and writes null; no automatic OVERDUE transition found. |
| `status` | string | Optional | `"OPEN"` | `OPEN`, `RESPONDED`, `RESOLVED`, `OVERDUE` | — | `status` | InformationRequestStatus | Yes | MIGRATE | UI creates OPEN and responds with RESPONDED; no RESOLVED/OVERDUE writer found. |
| `applicantResponse` | string | Optional | — | — | — | `applicantResponse` | String | Yes | MIGRATE | UI requires nonblank response; optional in schema. |
| `responseAttachmentUrl` | string | Optional | — | — | — | `responseAttachmentUrl` | String | Yes | MIGRATE | Response writer sets null when no attachment; not an ApplicationDocument FK. |
| `respondedAt` | string (date-time) | Optional | — | — | — | `respondedAt` | DateTime @db.Timestamptz(3) | Yes | TRANSFORM | No field-specific constraint beyond declared type. |
| `id` | Implicit string; no declaration | System; contract absent | Platform-generated; algorithm unknown | — | This entity's legacy identity | `legacyBase44Id` | String | No for imported records; native rows may be null | RENAME | New id generated independently. Copy original ID exactly. |
| `created_date` | Implicit date string; no declaration | Unknown; system metadata | Platform-managed; exact contract unknown | — | — | `legacyCreatedAt` | DateTime @db.Timestamptz(3) | Yes; export presence profiled below | TRANSFORM | Canonical UTC instant; retain raw input privately. Source-zone interpretation precedes offset-less import (R25 HIGH); R18 schema decision resolved. |
| `updated_date` | Implicit date string; no declaration | Unknown; system metadata | Platform-managed; exact contract unknown | — | — | `legacyUpdatedAt` | DateTime @db.Timestamptz(3) | Yes; export presence profiled below | TRANSFORM | Canonical UTC instant; retain raw input privately. Source-zone interpretation precedes offset-less import (R25 HIGH); R18 schema decision resolved. |

### Membership

Schema: [Membership.jsonc](../../myais-connect-base44-archive/base44/entities/Membership.jsonc). Declared fields: **13**.

Code evidence (archive-relative): `src/pages/admin/ApplicationReviewPage.jsx:140-156`; `src/pages/admin/PaymentManagement.jsx:78-122`; `src/pages/member/DigitalCard.jsx:17-39`; `src/lib/membershipStatus.js:6-45`.

Can be created by honorary approval or payment verification. Payment verification does not check for an existing membership before creation. No uniqueness per user or application is established.

| Base44 field | Base44 type | Required/optional | Default | Enum values | Relationship/reference | Proposed PostgreSQL/Prisma field | Proposed Prisma type | Nullable? | Migration action | Notes / validation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `membershipNumber` | string | Optional | — | — | — | `membershipNumber` | String | Yes | MIGRATE | Generated display identifier; not primary key, uniqueness not declared. |
| `userId` | string | Required | — | — | User.id via legacyBase44Id; logical reference, not declared FK | `userId` | String @db.Uuid | No | TRANSFORM | No field-specific constraint beyond declared type. |
| `applicationId` | string | Optional | — | — | MembershipApplication.id via legacyBase44Id; logical reference, not declared FK | `applicationId` | String @db.Uuid | Yes | TRANSFORM | No field-specific constraint beyond declared type. |
| `membershipTypeId` | string | Required | — | — | MembershipType.id via legacyBase44Id; logical reference, not declared FK | `membershipTypeId` | String @db.Uuid | No | TRANSFORM | No field-specific constraint beyond declared type. |
| `membershipTypeCode` | string | Optional | — | — | MembershipType.code snapshot; no FK/enum constraint | `membershipTypeCode` | String | Yes | MIGRATE | Snapshot of application-approved code with type-code fallback; no enum constraint. |
| `membershipTypeName` | string | Optional | — | — | MembershipType.name snapshot | `membershipTypeName` | String | Yes | MIGRATE | Snapshot of type.name at activation. |
| `startDate` | string (date) | Optional | — | — | — | `startDate` | DateTime @db.Date | Yes | TRANSFORM | Writers use UTC ISO date substring of activation time. |
| `expiryDate` | string (date) | Optional | — | — | — | `expiryDate` | DateTime @db.Date | Yes | TRANSFORM | Paid path calculates from live validityMonths when >0; otherwise null. Honorary path omits it. |
| `status` | string | Optional | `"PENDING"` | `PENDING`, `ACTIVE`, `EXPIRED`, `SUSPENDED`, `TERMINATED` | — | `status` | MembershipStatus | Yes | MIGRATE | No automatic expiry/suspension/termination writer found in archive. |
| `votingEligible` | boolean | Optional | `false` | — | — | `votingEligible` | Boolean | Yes | MIGRATE | Snapshot of type.votingRights \|\| false. |
| `activatedAt` | string (date-time) | Optional | — | — | — | `activatedAt` | DateTime @db.Timestamptz(3) | Yes | TRANSFORM | No field-specific constraint beyond declared type. |
| `suspendedAt` | string (date-time) | Optional | — | — | — | `suspendedAt` | DateTime @db.Timestamptz(3) | Yes | TRANSFORM | No field-specific constraint beyond declared type. |
| `terminatedAt` | string (date-time) | Optional | — | — | — | `terminatedAt` | DateTime @db.Timestamptz(3) | Yes | TRANSFORM | No field-specific constraint beyond declared type. |
| `id` | Implicit string; no declaration | System; contract absent | Platform-generated; algorithm unknown | — | This entity's legacy identity | `legacyBase44Id` | String | No for imported records; native rows may be null | RENAME | New id generated independently. Copy original ID exactly. |
| `created_date` | Implicit date string; no declaration | Unknown; system metadata | Platform-managed; exact contract unknown | — | — | `legacyCreatedAt` | DateTime @db.Timestamptz(3) | Yes; export presence profiled below | TRANSFORM | Canonical UTC instant; retain raw input privately. Source-zone interpretation precedes offset-less import (R25 HIGH); R18 schema decision resolved. |
| `updated_date` | Implicit date string; no declaration | Unknown; system metadata | Platform-managed; exact contract unknown | — | — | `legacyUpdatedAt` | DateTime @db.Timestamptz(3) | Yes; export presence profiled below | TRANSFORM | Canonical UTC instant; retain raw input privately. Source-zone interpretation precedes offset-less import (R25 HIGH); R18 schema decision resolved. |

### Payment

Schema: [Payment.jsonc](../../myais-connect-base44-archive/base44/entities/Payment.jsonc). Declared fields: **20**.

Code evidence (archive-relative): `src/pages/admin/ApplicationReviewPage.jsx:114-127`; `src/pages/member/PaymentPage.jsx:62-112`; `src/pages/member/PaymentPage.jsx:178-223`; `src/pages/admin/PaymentManagement.jsx:68-149`.

Manual payment proof/verification only. A VERIFIED honorary payment can lack paidAt, submittedAt, verifiedAt, verifiedByUserId, receiptUrl and membershipId. Required status-dependent constraints must account for that source behavior.

| Base44 field | Base44 type | Required/optional | Default | Enum values | Relationship/reference | Proposed PostgreSQL/Prisma field | Proposed Prisma type | Nullable? | Migration action | Notes / validation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `paymentReference` | string | Optional | — | — | — | `paymentReference` | String | Yes | MIGRATE | Generated independently from bank transactionReference. |
| `userId` | string | Required | — | — | User.id via legacyBase44Id; logical reference, not declared FK | `userId` | String @db.Uuid | No | TRANSFORM | No field-specific constraint beyond declared type. |
| `applicationId` | string | Optional | — | — | MembershipApplication.id via legacyBase44Id; logical reference, not declared FK | `applicationId` | String @db.Uuid | Yes | TRANSFORM | No field-specific constraint beyond declared type. |
| `membershipId` | string | Optional | — | — | Membership.id via legacyBase44Id; logical reference, not declared FK | `membershipId` | String @db.Uuid | Yes | TRANSFORM | No activation writer backfills it; do not assume one-to-one paid membership link. |
| `paymentType` | string | Required | — | `ENTRANCE_AND_ANNUAL`, `ENTRANCE_AND_LIFETIME`, `RENEWAL`, `OTHER` | — | `paymentType` | PaymentPaymentType | No | MIGRATE | Honorary approval writes OTHER and VERIFIED; normal fallback submit path only annual/lifetime. |
| `entranceFee` | number | Optional | `0` | — | — | `entranceFee` | Decimal (precision/scale TBD) | Yes | TRANSFORM | Fee snapshot from MembershipType at record creation; retained when existing payment is submitted. |
| `membershipFee` | number | Optional | `0` | — | — | `membershipFee` | Decimal (precision/scale TBD) | Yes | TRANSFORM | Fee snapshot; do not refresh from live settings during import. |
| `totalAmount` | number | Required | `0` | — | — | `totalAmount` | Decimal (precision/scale TBD) | No | TRANSFORM | Derived fee sum on creation but independently stored; required even though schema default is 0. |
| `currency` | string | Optional | `"MYR"` | — | — | `currency` | String | Yes | MIGRATE | Free string, schema default MYR; writers use MYR. |
| `paymentMethod` | string | Optional | — | — | — | `paymentMethod` | String | Yes | MIGRATE | Schema free string; UI choices BANK_TRANSFER, ONLINE_BANKING, CASH_DEPOSIT only. |
| `bankName` | string | Optional | — | — | — | `bankName` | String | Yes | MIGRATE | No field-specific constraint beyond declared type. |
| `transactionReference` | string | Optional | — | — | — | `transactionReference` | String | Yes | MIGRATE | User-entered bank reference; UI-required but not schema-required or unique. |
| `receiptUrl` | string | Optional | — | — | — | `receiptUrl` | String | Yes | MIGRATE | Receipt upload URL; schema optional, submission UI requires a newly selected file. |
| `status` | string | Optional | `"NOT_SUBMITTED"` | `NOT_SUBMITTED`, `SUBMITTED`, `UNDER_VERIFICATION`, `VERIFIED`, `REJECTED` | — | `status` | PaymentStatus | Yes | MIGRATE | UI can verify SUBMITTED directly; UNDER_VERIFICATION has no assignment path found. |
| `paidAt` | string (date-time) | Optional | — | — | — | `paidAt` | DateTime @db.Timestamptz(3) | Yes | TRANSFORM | Writer parses date input to ISO; defaults to current time when omitted. Not provider-confirmed timestamp. |
| `submittedAt` | string (date-time) | Optional | — | — | — | `submittedAt` | DateTime @db.Timestamptz(3) | Yes | TRANSFORM | No field-specific constraint beyond declared type. |
| `verifiedByUserId` | string | Optional | — | — | User.id via legacyBase44Id; logical reference, not declared FK | `verifiedByUserId` | String @db.Uuid | Yes | TRANSFORM | Set on manual verify; honorary approval creates VERIFIED payment without this field. |
| `verifiedAt` | string (date-time) | Optional | — | — | — | `verifiedAt` | DateTime @db.Timestamptz(3) | Yes | TRANSFORM | Set on manual verify; honorary VERIFIED payment omits it. |
| `rejectionReason` | string | Optional | — | — | — | `rejectionReason` | String | Yes | MIGRATE | Not cleared on re-submission or verify in shown code; preserve stale historical content. |
| `treasurerRemarks` | string | Optional | — | — | — | `treasurerRemarks` | String | Yes | MIGRATE | Copied from same remarks as rejectionReason on rejection. |
| `id` | Implicit string; no declaration | System; contract absent | Platform-generated; algorithm unknown | — | This entity's legacy identity | `legacyBase44Id` | String | No for imported records; native rows may be null | RENAME | New id generated independently. Copy original ID exactly. |
| `created_date` | Implicit date string; no declaration | Unknown; system metadata | Platform-managed; exact contract unknown | — | — | `legacyCreatedAt` | DateTime @db.Timestamptz(3) | Yes; export presence profiled below | TRANSFORM | Canonical UTC instant; retain raw input privately. Source-zone interpretation precedes offset-less import (R25 HIGH); R18 schema decision resolved. |
| `updated_date` | Implicit date string; no declaration | Unknown; system metadata | Platform-managed; exact contract unknown | — | — | `legacyUpdatedAt` | DateTime @db.Timestamptz(3) | Yes; export presence profiled below | TRANSFORM | Canonical UTC instant; retain raw input privately. Source-zone interpretation precedes offset-less import (R25 HIGH); R18 schema decision resolved. |

### RenewalApplication

Schema: [RenewalApplication.jsonc](../../myais-connect-base44-archive/base44/entities/RenewalApplication.jsonc). Declared fields: **10**.

Code evidence (archive-relative): `src/App.jsx:106`.

Schema-only entity: no SDK read/write or reference-number generator found. /renew routes to Dashboard. paymentId suggests a link to Payment, but no runtime workflow proves multiplicity.

| Base44 field | Base44 type | Required/optional | Default | Enum values | Relationship/reference | Proposed PostgreSQL/Prisma field | Proposed Prisma type | Nullable? | Migration action | Notes / validation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `renewalNumber` | string | Optional | — | — | — | `renewalNumber` | String | Yes | MIGRATE | No generation rule or writer found. |
| `membershipId` | string | Required | — | — | Membership.id via legacyBase44Id; logical reference, not declared FK | `membershipId` | String @db.Uuid | No | TRANSFORM | No field-specific constraint beyond declared type. |
| `userId` | string | Required | — | — | User.id via legacyBase44Id; logical reference, not declared FK | `userId` | String @db.Uuid | No | TRANSFORM | No field-specific constraint beyond declared type. |
| `previousExpiryDate` | string (date) | Optional | — | — | — | `previousExpiryDate` | DateTime @db.Date | Yes | TRANSFORM | Historical expiry snapshot by field name; no population rule found. |
| `newExpiryDate` | string (date) | Optional | — | — | — | `newExpiryDate` | DateTime @db.Date | Yes | TRANSFORM | Proposed renewal date by field name; no computation rule found. |
| `fee` | number | Optional | — | — | — | `fee` | Decimal (precision/scale TBD) | Yes | TRANSFORM | No fee computation/writer found; preserve numeric value. |
| `status` | string | Optional | `"PENDING"` | `PENDING`, `PAYMENT_SUBMITTED`, `APPROVED`, `REJECTED` | — | `status` | RenewalApplicationStatus | Yes | MIGRATE | No field-specific constraint beyond declared type. |
| `submittedAt` | string (date-time) | Optional | — | — | — | `submittedAt` | DateTime @db.Timestamptz(3) | Yes | TRANSFORM | No field-specific constraint beyond declared type. |
| `paymentId` | string | Optional | — | — | Payment.id via legacyBase44Id; logical reference, not declared FK | `paymentId` | String @db.Uuid | Yes | TRANSFORM | Schema-name reference only; no code proving cardinality or creation order. |
| `approvedAt` | string (date-time) | Optional | — | — | — | `approvedAt` | DateTime @db.Timestamptz(3) | Yes | TRANSFORM | No field-specific constraint beyond declared type. |
| `id` | Implicit string; no declaration | System; contract absent | Platform-generated; algorithm unknown | — | This entity's legacy identity | `legacyBase44Id` | String | No for imported records; native rows may be null | RENAME | New id generated independently. Copy original ID exactly. |
| `created_date` | Implicit date string; no declaration | Unknown; system metadata | Platform-managed; exact contract unknown | — | — | `legacyCreatedAt` | DateTime @db.Timestamptz(3) | Yes; export presence profiled below | TRANSFORM | Canonical UTC instant; retain raw input privately. Source-zone interpretation precedes offset-less import (R25 HIGH); R18 schema decision resolved. |
| `updated_date` | Implicit date string; no declaration | Unknown; system metadata | Platform-managed; exact contract unknown | — | — | `legacyUpdatedAt` | DateTime @db.Timestamptz(3) | Yes; export presence profiled below | TRANSFORM | Canonical UTC instant; retain raw input privately. Source-zone interpretation precedes offset-less import (R25 HIGH); R18 schema decision resolved. |

### Event

Schema: [Event.jsonc](../../myais-connect-base44-archive/base44/entities/Event.jsonc). Declared fields: **36**.

Code evidence (archive-relative): `base44/functions/manageEvent/entry.ts:10-146`; `src/pages/admin/EventFormPage.jsx:10-35`; `src/components/events/EventForm.jsx:35-69`; `src/components/events/eventUtils.jsx:1-26`; `src/pages/events/EventDetail.jsx:14-43`.

Only entity with explicit createdAt/updatedAt business fields in addition to implicit platform metadata. Server write path is manageEvent; preserve both timestamp pairs independently.

| Base44 field | Base44 type | Required/optional | Default | Enum values | Relationship/reference | Proposed PostgreSQL/Prisma field | Proposed Prisma type | Nullable? | Migration action | Notes / validation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `eventNumber` | string | Optional | — | — | — | `eventNumber` | String | Yes | MIGRATE | Two conflicting generators; create permits caller-supplied value. See reference-number rules. |
| `title` | string | Required | — | — | — | `title` | String | No | MIGRATE | No field-specific constraint beyond declared type. |
| `slug` | string | Optional | — | — | — | `slug` | String | Yes | MIGRATE | Generated on create/update or preserved if supplied; not unique; detail routes use id. |
| `category` | string | Required | — | `Seminars and Webinars`, `Workshops`, `Meetings`, `MyDCIS`, `Conferences`, `Other` | — | `category` | EventCategory | No | MIGRATE | Enum labels include spaces and mixed case; preserve stored labels with enum value mapping. |
| `summary` | string | Optional | — | — | — | `summary` | String | Yes | MIGRATE | No field-specific constraint beyond declared type. |
| `description` | string | Required | — | — | — | `description` | String | No | MIGRATE | No field-specific constraint beyond declared type. |
| `coverImage` | string | Optional | — | — | — | `coverImage` | String | Yes | MIGRATE | External image URL; upload button disabled. Keep separate from placeholderImageNotice. |
| `speakerName` | string | Optional | — | — | — | `speakerName` | String | Yes | MIGRATE | No field-specific constraint beyond declared type. |
| `speakerTitle` | string | Optional | — | — | — | `speakerTitle` | String | Yes | MIGRATE | No field-specific constraint beyond declared type. |
| `eventType` | string | Optional | — | — | — | `eventType` | String | Yes | MIGRATE | Free string, no writer or consumer found; not an alias for category or venueType. |
| `venueType` | string | Required | — | `PHYSICAL`, `ONLINE`, `HYBRID` | — | `venueType` | EventVenueType | No | MIGRATE | No field-specific constraint beyond declared type. |
| `venueName` | string | Optional | — | — | — | `venueName` | String | Yes | MIGRATE | Conditionally required by manageEvent for PHYSICAL/HYBRID. |
| `physicalAddress` | string | Optional | — | — | — | `physicalAddress` | String | Yes | MIGRATE | Conditionally required by manageEvent for PHYSICAL/HYBRID. |
| `onlineMeetingUrl` | string | Optional | — | — | — | `onlineMeetingUrl` | String | Yes | MIGRATE | Conditionally required for ONLINE/HYBRID; only presence is checked. |
| `startDate` | string (date) | Required | — | — | — | `startDate` | DateTime @db.Date | No | TRANSFORM | No field-specific constraint beyond declared type. |
| `startTime` | string | Required | — | — | — | `startTime` | String | No | MIGRATE | Preserve local clock time separately from startDate; use canonical Event.timezone (default Asia/Kuala_Lumpur); do not convert standalone clock to UTC. |
| `endDate` | string (date) | Optional | — | — | — | `endDate` | DateTime @db.Date | Yes | TRANSFORM | No field-specific constraint beyond declared type. |
| `endTime` | string | Optional | — | — | — | `endTime` | String | Yes | MIGRATE | Preserve local clock time separately from endDate; optional blank -> NULL. Use Event.timezone; source ordering validation requires both endDate and endTime. |
| `registrationStart` | string (date) | Optional | — | — | — | `registrationStart` | DateTime @db.Date | Yes | TRANSFORM | No active registration-window enforcement found. |
| `registrationDeadline` | string (date) | Optional | — | — | — | `registrationDeadline` | DateTime @db.Date | Yes | TRANSFORM | Server rejects dates after startDate; UI closes when parsed date is earlier than current instant. |
| `capacity` | number | Optional | — | — | — | `capacity` | Float | Yes | MIGRATE | Server tests positivity only when truthy; numeric 0 bypasses check. No integer constraint. |
| `limitedSeats` | boolean | Optional | `false` | — | — | `limitedSeats` | Boolean | Yes | MIGRATE | Presentation flag, not evidence of capacity enforcement. |
| `memberFee` | number | Optional | `0` | — | — | `memberFee` | Decimal (precision/scale TBD) | Yes | TRANSFORM | Server rejects negative Number(value \|\| 0); Decimal scale/range unresolved. |
| `nonMemberFee` | number | Optional | `0` | — | — | `nonMemberFee` | Decimal (precision/scale TBD) | Yes | TRANSFORM | Server rejects negative Number(value \|\| 0); Decimal scale/range unresolved. |
| `currency` | string | Optional | `"MYR"` | — | — | `currency` | String | Yes | MIGRATE | Free string, not ISO-code enum; no length constraint. |
| `paymentInstructions` | string | Optional | — | — | — | `paymentInstructions` | String | Yes | MIGRATE | No field-specific constraint beyond declared type. |
| `registrationUrl` | string | Optional | — | — | — | `registrationUrl` | String | Yes | MIGRATE | Stored and editable, but public registration button is disabled. |
| `status` | string | Optional | `"DRAFT"` | `DRAFT`, `PUBLISHED`, `REGISTRATION_CLOSED`, `CANCELLED`, `COMPLETED`, `ARCHIVED` | — | `status` | EventStatus | Yes | MIGRATE | Server status action lacks a transition whitelist and skips validateEvent. |
| `targetAudience` | string | Optional | `"MEMBERS_AND_NON_MEMBERS"` | `MEMBERS`, `NON_MEMBERS`, `MEMBERS_AND_NON_MEMBERS` | — | `targetAudience` | EventTargetAudience | Yes | MIGRATE | No field-specific constraint beyond declared type. |
| `createdBy` | string | Optional | — | — | Real User via legacy-ID lookup; platform principals are not Users | `createdByUserId` | String @db.Uuid | Yes | TRANSFORM | Populate nullable User FK for a real User; system/service/platform creator becomes NULL (R12 resolved). |
| `createdBy` (platform principal copy) | Source string | Optional | — | — | Platform/system/service provenance; no FK | `legacyCreatedBy` | String | Yes | LEGACY_ONLY | Preserve exact principal identifier/value; exported system sentinel is retained. No authenticatable fake user. |
| No Base44 field (approved target addition) | — | — | — | — | Event local scheduling timezone | `timezone` | String | No | TRANSFORM | Default Asia/Kuala_Lumpur unless explicitly migrated otherwise; IANA timezone, separate from local clocks. |
| `createdAt` | string (date-time) | Optional | — | — | — | `createdAt` | DateTime @db.Timestamptz(3) | Yes | TRANSFORM | Explicit business timestamp; distinct from platform created_date. Both must survive. |
| `updatedAt` | string (date-time) | Optional | — | — | — | `updatedAt` | DateTime @db.Timestamptz(3) | Yes | TRANSFORM | Explicit business timestamp; distinct from platform updated_date. Both must survive. |
| `publishedAt` | string (date-time) | Optional | — | — | — | `publishedAt` | DateTime @db.Timestamptz(3) | Yes | TRANSFORM | Set on create(PUBLISHED)/status(PUBLISHED); generic update-to-PUBLISHED does not set it. Duplicate clears it. |
| `cancelledAt` | string (date-time) | Optional | — | — | — | `cancelledAt` | DateTime @db.Timestamptz(3) | Yes | TRANSFORM | Set by status(CANCELLED); duplication does not clear it. |
| `cancellationReason` | string | Optional | — | — | — | `cancellationReason` | String | Yes | MIGRATE | Set by status(CANCELLED), including empty string; duplication retains it. |
| `placeholderImageNotice` | boolean | Optional | `false` | — | — | `placeholderImageNotice` | Boolean | Yes | MIGRATE | Independent boolean; not automatically derived from missing coverImage. |
| `id` | Implicit string; no declaration | System; contract absent | Platform-generated; algorithm unknown | — | This entity's legacy identity | `legacyBase44Id` | String | No for imported records; native rows may be null | RENAME | New id generated independently. Copy original ID exactly. |
| `created_date` | Implicit date string; no declaration | Unknown; system metadata | Platform-managed; exact contract unknown | — | — | `legacyCreatedAt` | DateTime @db.Timestamptz(3) | Yes; export presence profiled below | TRANSFORM | Canonical UTC instant; retain raw input privately. Source-zone interpretation precedes offset-less import (R25 HIGH); R18 schema decision resolved. |
| `updated_date` | Implicit date string; no declaration | Unknown; system metadata | Platform-managed; exact contract unknown | — | — | `legacyUpdatedAt` | DateTime @db.Timestamptz(3) | Yes; export presence profiled below | TRANSFORM | Canonical UTC instant; retain raw input privately. Source-zone interpretation precedes offset-less import (R25 HIGH); R18 schema decision resolved. |

### EventRegistration

Schema: [EventRegistration.jsonc](../../myais-connect-base44-archive/base44/entities/EventRegistration.jsonc). Declared fields: **8**.

Code evidence (archive-relative): `src/pages/admin/EventRegistrations.jsx:10-51`; `src/pages/member/Profile.jsx:102-105`; `src/pages/events/EventDetail.jsx:43`.

Reader and attendeeName-update path exist; creation, attendance marking and event payment processing are not implemented in the archive. Schema nevertheless requires userId, including for events targeted at non-members; do not silently allow anonymous registrations.

| Base44 field | Base44 type | Required/optional | Default | Enum values | Relationship/reference | Proposed PostgreSQL/Prisma field | Proposed Prisma type | Nullable? | Migration action | Notes / validation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `eventId` | string | Required | — | — | Event.id via legacyBase44Id; logical reference, not declared FK | `eventId` | String @db.Uuid | No | TRANSFORM | No field-specific constraint beyond declared type. |
| `userId` | string | Required | — | — | User.id via legacyBase44Id; logical reference, not declared FK | `userId` | String @db.Uuid | No | TRANSFORM | No field-specific constraint beyond declared type. |
| `attendeeName` | string | Optional | — | — | — | `attendeeName` | String | Yes | MIGRATE | Denormalized user/profile name; Profile save rewrites existing registrations. |
| `attendeeEmail` | string | Optional | — | — | — | `attendeeEmail` | String | Yes | MIGRATE | Name suggests email snapshot; no producer or sync rule found. |
| `status` | string | Optional | `"REGISTERED"` | `REGISTERED`, `CANCELLED`, `ATTENDED`, `NO_SHOW` | — | `status` | EventRegistrationStatus | Yes | MIGRATE | No field-specific constraint beyond declared type. |
| `paymentStatus` | string | Optional | `"PENDING"` | `NOT_REQUIRED`, `PENDING`, `PAID`, `FAILED` | — | `paymentStatus` | EventRegistrationPaymentStatus | Yes | MIGRATE | Independent enum; no Payment relation/amount/currency in this entity. |
| `registeredAt` | string (date-time) | Optional | — | — | — | `registeredAt` | DateTime @db.Timestamptz(3) | Yes | TRANSFORM | No registration-creation writer found. |
| `notes` | string | Optional | — | — | — | `notes` | String | Yes | MIGRATE | No field-specific constraint beyond declared type. |
| `id` | Implicit string; no declaration | System; contract absent | Platform-generated; algorithm unknown | — | This entity's legacy identity | `legacyBase44Id` | String | No for imported records; native rows may be null | RENAME | New id generated independently. Copy original ID exactly. |
| `created_date` | Implicit date string; no declaration | Unknown; system metadata | Platform-managed; exact contract unknown | — | — | `legacyCreatedAt` | DateTime @db.Timestamptz(3) | Yes; export presence profiled below | TRANSFORM | Canonical UTC instant; retain raw input privately. Source-zone interpretation precedes offset-less import (R25 HIGH); R18 schema decision resolved. |
| `updated_date` | Implicit date string; no declaration | Unknown; system metadata | Platform-managed; exact contract unknown | — | — | `legacyUpdatedAt` | DateTime @db.Timestamptz(3) | Yes; export presence profiled below | TRANSFORM | Canonical UTC instant; retain raw input privately. Source-zone interpretation precedes offset-less import (R25 HIGH); R18 schema decision resolved. |

### Announcement

Schema: [Announcement.jsonc](../../myais-connect-base44-archive/base44/entities/Announcement.jsonc). Declared fields: **12**.

Code evidence (archive-relative): `src/pages/admin/AnnouncementManagement.jsx:24-50`; `src/pages/admin/AnnouncementManagement.jsx:136-146`; `src/pages/member/Announcements.jsx:11-43`.

Editing overwrites creator fields; scheduled publishing/expiry and audience enforcement are not demonstrated. Empty or unused attachment/cover fields still belong in the migration inventory.

| Base44 field | Base44 type | Required/optional | Default | Enum values | Relationship/reference | Proposed PostgreSQL/Prisma field | Proposed Prisma type | Nullable? | Migration action | Notes / validation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `title` | string | Required | — | — | — | `title` | String | No | MIGRATE | No field-specific constraint beyond declared type. |
| `category` | string | Optional | — | `GENERAL`, `EVENT`, `MEMBERSHIP`, `POLICY`, `TRAINING` | — | `category` | AnnouncementCategory | Yes | MIGRATE | UI default GENERAL; no schema default. |
| `summary` | string | Optional | — | — | — | `summary` | String | Yes | MIGRATE | No field-specific constraint beyond declared type. |
| `content` | string | Required | — | — | — | `content` | String | No | MIGRATE | No field-specific constraint beyond declared type. |
| `coverImageUrl` | string | Optional | — | — | — | `coverImageUrl` | String | Yes | MIGRATE | No field-specific constraint beyond declared type. |
| `attachmentUrl` | string | Optional | — | — | — | `attachmentUrl` | String | Yes | MIGRATE | No field-specific constraint beyond declared type. |
| `targetAudience` | string | Optional | `"ALL"` | `ALL`, `MEMBERS`, `APPLICANTS`, `COMMITTEE` | — | `targetAudience` | AnnouncementTargetAudience | Yes | MIGRATE | No field-specific constraint beyond declared type. |
| `status` | string | Optional | `"DRAFT"` | `DRAFT`, `SCHEDULED`, `PUBLISHED`, `ARCHIVED` | — | `status` | AnnouncementStatus | Yes | MIGRATE | SCHEDULED is in schema but absent from form choices. |
| `publishAt` | string (date-time) | Optional | — | — | — | `publishAt` | DateTime @db.Timestamptz(3) | Yes | TRANSFORM | No scheduler or writer found; preserve if present. |
| `expiryAt` | string (date-time) | Optional | — | — | — | `expiryAt` | DateTime @db.Timestamptz(3) | Yes | TRANSFORM | No expiration enforcement or writer found. |
| `createdByUserId` | string | Optional | — | — | User.id via legacyBase44Id; logical reference, not declared FK | `createdByUserId` | String @db.Uuid | Yes | TRANSFORM | Overwritten with current editor on both create and update; not reliably the original author. |
| `createdByName` | string | Optional | — | — | — | `createdByName` | String | Yes | MIGRATE | Snapshot from user.full_name; also overwritten on edit. |
| `id` | Implicit string; no declaration | System; contract absent | Platform-generated; algorithm unknown | — | This entity's legacy identity | `legacyBase44Id` | String | No for imported records; native rows may be null | RENAME | New id generated independently. Copy original ID exactly. |
| `created_date` | Implicit date string; no declaration | Unknown; system metadata | Platform-managed; exact contract unknown | — | — | `legacyCreatedAt` | DateTime @db.Timestamptz(3) | Yes; export presence profiled below | TRANSFORM | Canonical UTC instant; retain raw input privately. Source-zone interpretation precedes offset-less import (R25 HIGH); R18 schema decision resolved. |
| `updated_date` | Implicit date string; no declaration | Unknown; system metadata | Platform-managed; exact contract unknown | — | — | `legacyUpdatedAt` | DateTime @db.Timestamptz(3) | Yes; export presence profiled below | TRANSFORM | Canonical UTC instant; retain raw input privately. Source-zone interpretation precedes offset-less import (R25 HIGH); R18 schema decision resolved. |

### Notification

Schema: [Notification.jsonc](../../myais-connect-base44-archive/base44/entities/Notification.jsonc). Declared fields: **9**.

Code evidence (archive-relative): `src/pages/member/MyApplication.jsx:166-174`; `src/pages/admin/ApplicationReviewPage.jsx:130-138`; `src/pages/admin/PaymentManagement.jsx:115-138`; `src/pages/member/Notifications.jsx:25-41`.

Related-entity metadata is optional and not consistently supplied. No FK is inferred from actionUrl. The source exposes notification creation with a literal null RLS condition.

| Base44 field | Base44 type | Required/optional | Default | Enum values | Relationship/reference | Proposed PostgreSQL/Prisma field | Proposed Prisma type | Nullable? | Migration action | Notes / validation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `userId` | string | Required | — | — | User.id via legacyBase44Id; logical reference, not declared FK | `userId` | String @db.Uuid | No | TRANSFORM | No field-specific constraint beyond declared type. |
| `title` | string | Required | — | — | — | `title` | String | No | MIGRATE | No field-specific constraint beyond declared type. |
| `message` | string | Required | — | — | — | `message` | String | No | MIGRATE | No field-specific constraint beyond declared type. |
| `type` | string | Optional | — | `APPLICATION`, `PAYMENT`, `MEMBERSHIP`, `ANNOUNCEMENT`, `SYSTEM` | — | `type` | NotificationType | Yes | MIGRATE | No field-specific constraint beyond declared type. |
| `relatedEntityType` | string | Optional | — | — | — | `relatedEntityType` | String | Yes | MIGRATE | Free string; observed MembershipApplication and Membership. Discriminator is not an enum. |
| `relatedEntityId` | string | Optional | — | — | Polymorphic by relatedEntityType; optional, no FK | `legacyRelatedEntityId` | String | Yes | RENAME | Optional polymorphic legacy ID; activation notification omits it despite specifying Membership. |
| `actionUrl` | string | Optional | — | — | — | `actionUrl` | String | Yes | MIGRATE | Internal navigation path, not a file URL or FK; preserve and review legacy routes. |
| `isRead` | boolean | Optional | `false` | — | — | `isRead` | Boolean | Yes | MIGRATE | No field-specific constraint beyond declared type. |
| `readAt` | string (date-time) | Optional | — | — | — | `readAt` | DateTime @db.Timestamptz(3) | Yes | TRANSFORM | Both single/bulk UI mark-read operations write an ISO timestamp. |
| `id` | Implicit string; no declaration | System; contract absent | Platform-generated; algorithm unknown | — | This entity's legacy identity | `legacyBase44Id` | String | No for imported records; native rows may be null | RENAME | New id generated independently. Copy original ID exactly. |
| `created_date` | Implicit date string; no declaration | Unknown; system metadata | Platform-managed; exact contract unknown | — | — | `legacyCreatedAt` | DateTime @db.Timestamptz(3) | Yes; export presence profiled below | TRANSFORM | Canonical UTC instant; retain raw input privately. Source-zone interpretation precedes offset-less import (R25 HIGH); R18 schema decision resolved. |
| `updated_date` | Implicit date string; no declaration | Unknown; system metadata | Platform-managed; exact contract unknown | — | — | `legacyUpdatedAt` | DateTime @db.Timestamptz(3) | Yes; export presence profiled below | TRANSFORM | Canonical UTC instant; retain raw input privately. Source-zone interpretation precedes offset-less import (R25 HIGH); R18 schema decision resolved. |

### AuditLog

Schema: [AuditLog.jsonc](../../myais-connect-base44-archive/base44/entities/AuditLog.jsonc). Declared fields: **8**.

Code evidence (archive-relative): `src/pages/member/PaymentPage.jsx:106-113`; `src/pages/admin/PaymentManagement.jsx:142-149`; `src/pages/admin/ApplicationReviewPage.jsx:193-199`; `src/pages/member/Profile.jsx:107-114`; `base44/functions/manageEvent/entry.ts:72-78`.

Retain recorded actor names, actions and raw polymorphic references. The payment submission writer has a discriminator/ID mismatch. JSON text snapshots are not guaranteed valid JSON; no destructive conversion is proposed.

| Base44 field | Base44 type | Required/optional | Default | Enum values | Relationship/reference | Proposed PostgreSQL/Prisma field | Proposed Prisma type | Nullable? | Migration action | Notes / validation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `actorUserId` | string | Required | — | — | User.id via legacyBase44Id; logical reference, not declared FK | `actorUserId` | String @db.Uuid | No | TRANSFORM | No field-specific constraint beyond declared type. |
| `actorName` | string | Optional | — | — | — | `actorName` | String | Yes | MIGRATE | Historical snapshot; writers disagree between fullName and full_name/email. |
| `action` | string | Required | — | — | — | `action` | String | No | MIGRATE | No field-specific constraint beyond declared type. |
| `entityType` | string | Optional | — | — | — | `entityType` | String | Yes | MIGRATE | Free string discriminator. Known writers: MembershipApplication, Payment, InformationRequest, MemberProfile, Event. |
| `entityId` | string | Optional | — | — | Polymorphic by entityType; known mismatch, no FK | `legacyEntityId` | String | Yes | RENAME | Polymorphic raw legacy ID; PaymentPage supplies application.id while entityType is Payment. Do not blindly remap. |
| `oldValues` | string | Optional | — | — | — | `oldValues` | String | Yes | MIGRATE | JSON-encoded string by description only; no writer found. Keep text, including invalid JSON and whitespace. |
| `newValues` | string | Optional | — | — | — | `newValues` | String | Yes | MIGRATE | JSON-encoded string by description only; no writer found. Keep text, including invalid JSON and whitespace. |
| `description` | string | Required | — | — | — | `description` | String | No | MIGRATE | No field-specific constraint beyond declared type. |
| `id` | Implicit string; no declaration | System; contract absent | Platform-generated; algorithm unknown | — | This entity's legacy identity | `legacyBase44Id` | String | No for imported records; native rows may be null | RENAME | New id generated independently. Copy original ID exactly. |
| `created_date` | Implicit date string; no declaration | Unknown; system metadata | Platform-managed; exact contract unknown | — | — | `legacyCreatedAt` | DateTime @db.Timestamptz(3) | Yes; export presence profiled below | TRANSFORM | Canonical UTC instant; retain raw input privately. Source-zone interpretation precedes offset-less import (R25 HIGH); R18 schema decision resolved. |
| `updated_date` | Implicit date string; no declaration | Unknown; system metadata | Platform-managed; exact contract unknown | — | — | `legacyUpdatedAt` | DateTime @db.Timestamptz(3) | Yes; export presence profiled below | TRANSFORM | Canonical UTC instant; retain raw input privately. Source-zone interpretation precedes offset-less import (R25 HIGH); R18 schema decision resolved. |

### SystemSetting

Schema: [SystemSetting.jsonc](../../myais-connect-base44-archive/base44/entities/SystemSetting.jsonc). Declared fields: **5**.

Code evidence (archive-relative): `src/pages/admin/AdminSettings.jsx:128-150`.

Schema-only entity: no SDK reads/writes found. AdminSettings edits MembershipType and displays hardcoded organisation details. No key registry or settingValue serialization contract is available.

| Base44 field | Base44 type | Required/optional | Default | Enum values | Relationship/reference | Proposed PostgreSQL/Prisma field | Proposed Prisma type | Nullable? | Migration action | Notes / validation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `settingKey` | string | Required | — | — | — | `settingKey` | String | No | MIGRATE | No uniqueness or key catalogue declared; organisation form is hardcoded. |
| `settingValue` | string | Required | — | — | — | `settingValue` | String | No | MIGRATE | String even for NUMBER/BOOLEAN/JSON settingType; no parser contract found. |
| `settingType` | string | Optional | — | `STRING`, `NUMBER`, `BOOLEAN`, `JSON` | — | `settingType` | SystemSettingSettingType | Yes | MIGRATE | No field-specific constraint beyond declared type. |
| `description` | string | Optional | — | — | — | `description` | String | Yes | MIGRATE | No field-specific constraint beyond declared type. |
| `updatedByUserId` | string | Optional | — | — | User.id via legacyBase44Id; logical reference, not declared FK | `updatedByUserId` | String @db.Uuid | Yes | TRANSFORM | No field-specific constraint beyond declared type. |
| `id` | Implicit string; no declaration | System; contract absent | Platform-generated; algorithm unknown | — | This entity's legacy identity | `legacyBase44Id` | String | No for imported records; native rows may be null | RENAME | New id generated independently. Copy original ID exactly. |
| `created_date` | Implicit date string; no declaration | Unknown; system metadata | Platform-managed; exact contract unknown | — | — | `legacyCreatedAt` | DateTime @db.Timestamptz(3) | Yes; export presence profiled below | TRANSFORM | Canonical UTC instant; retain raw input privately. Source-zone interpretation precedes offset-less import (R25 HIGH); R18 schema decision resolved. |
| `updated_date` | Implicit date string; no declaration | Unknown; system metadata | Platform-managed; exact contract unknown | — | — | `legacyUpdatedAt` | DateTime @db.Timestamptz(3) | Yes; export presence profiled below | TRANSFORM | Canonical UTC instant; retain raw input privately. Source-zone interpretation precedes offset-less import (R25 HIGH); R18 schema decision resolved. |

## All entity relationships

The following **34 direct reference fields** exist. They are ordinary schema strings; targets are inferred from their names and corroborated where a reader/writer exists. “Required” describes the source field, not an enforced Base44 FK. Default draft cardinality is many child records to one target; no one-to-one constraint is established by these schemas.

| Source field | Target | Source presence | Evidence / limitation |
| --- | --- | --- | --- |
| `Announcement.createdByUserId` | `User.id` | Optional | Corroborated by entity-specific reader/writer listed above; no schema FK or uniqueness. |
| `ApplicationDocument.applicationId` | `MembershipApplication.id` | Required | Corroborated by entity-specific reader/writer listed above; no schema FK or uniqueness. |
| `ApplicationDocument.userId` | `User.id` | Required | Corroborated by entity-specific reader/writer listed above; no schema FK or uniqueness. |
| `ApplicationDocument.verifiedByUserId` | `User.id` | Optional | Schema-name inference; no assignment/relationship resolution found in archived code. |
| `ApplicationReview.applicationId` | `MembershipApplication.id` | Required | Corroborated by entity-specific reader/writer listed above; no schema FK or uniqueness. |
| `ApplicationReview.reviewerUserId` | `User.id` | Required | Corroborated by entity-specific reader/writer listed above; no schema FK or uniqueness. |
| `AuditLog.actorUserId` | `User.id` | Required | Corroborated by entity-specific reader/writer listed above; no schema FK or uniqueness. |
| `EligibilityAnswer.applicationId` | `MembershipApplication.id` | Required | Schema-name inference; no assignment/relationship resolution found in archived code. |
| `EligibilityAnswer.questionId` | `EligibilityQuestion.id` | Required | Schema-name inference; no assignment/relationship resolution found in archived code. |
| `EligibilityAnswer.userId` | `User.id` | Required | Schema-name inference; no assignment/relationship resolution found in archived code. |
| `Event.createdBy` | Nullable canonical User FK via legacy ID for real users | Optional | R12 resolved: system/service/platform -> NULL createdByUserId plus original legacyCreatedBy; never substitute created_by_id. |
| `EventRegistration.eventId` | `Event.id` | Required | Corroborated by entity-specific reader/writer listed above; no schema FK or uniqueness. |
| `EventRegistration.userId` | `User.id` | Required | Corroborated by entity-specific reader/writer listed above; no schema FK or uniqueness. |
| `InformationRequest.applicationId` | `MembershipApplication.id` | Required | Corroborated by entity-specific reader/writer listed above; no schema FK or uniqueness. |
| `InformationRequest.requestedByUserId` | `User.id` | Required | Corroborated by entity-specific reader/writer listed above; no schema FK or uniqueness. |
| `MemberProfile.userId` | `User.id` | Required | Corroborated by entity-specific reader/writer listed above; no schema FK or uniqueness. |
| `Membership.userId` | `User.id` | Required | Corroborated by entity-specific reader/writer listed above; no schema FK or uniqueness. |
| `Membership.applicationId` | `MembershipApplication.id` | Optional | Corroborated by entity-specific reader/writer listed above; no schema FK or uniqueness. |
| `Membership.membershipTypeId` | `MembershipType.id` | Required | Corroborated by entity-specific reader/writer listed above; no schema FK or uniqueness. |
| `MembershipApplication.userId` | `User.id` | Required | Corroborated by entity-specific reader/writer listed above; no schema FK or uniqueness. |
| `MembershipApplication.requestedMembershipTypeId` | `MembershipType.id` | Optional | Corroborated by entity-specific reader/writer listed above; no schema FK or uniqueness. |
| `MembershipApplication.recommendedMembershipTypeId` | `MembershipType.id` | Optional | Corroborated by entity-specific reader/writer listed above; no schema FK or uniqueness. |
| `MembershipApplication.approvedMembershipTypeId` | `MembershipType.id` | Optional | Corroborated by entity-specific reader/writer listed above; no schema FK or uniqueness. |
| `MembershipApplication.reviewedByUserId` | `User.id` | Optional | Corroborated by entity-specific reader/writer listed above; no schema FK or uniqueness. |
| `MembershipApplication.approvedByUserId` | `User.id` | Optional | Corroborated by entity-specific reader/writer listed above; no schema FK or uniqueness. |
| `Notification.userId` | `User.id` | Required | Corroborated by entity-specific reader/writer listed above; no schema FK or uniqueness. |
| `Payment.userId` | `User.id` | Required | Corroborated by entity-specific reader/writer listed above; no schema FK or uniqueness. |
| `Payment.applicationId` | `MembershipApplication.id` | Optional | Corroborated by entity-specific reader/writer listed above; no schema FK or uniqueness. |
| `Payment.membershipId` | `Membership.id` | Optional | Schema-name inference; no assignment/relationship resolution found in archived code. |
| `Payment.verifiedByUserId` | `User.id` | Optional | Corroborated by entity-specific reader/writer listed above; no schema FK or uniqueness. |
| `RenewalApplication.membershipId` | `Membership.id` | Required | Schema-name inference; no assignment/relationship resolution found in archived code. |
| `RenewalApplication.userId` | `User.id` | Required | Schema-name inference; no assignment/relationship resolution found in archived code. |
| `RenewalApplication.paymentId` | `Payment.id` | Optional | Schema-name inference; no assignment/relationship resolution found in archived code. |
| `SystemSetting.updatedByUserId` | `User.id` | Optional | Schema-name inference; no assignment/relationship resolution found in archived code. |

Additional associations are deliberately not modeled as direct foreign keys:

| Source | Association | Preservation decision |
| --- | --- | --- |
| AuditLog.entityType + entityId | Polymorphic historical target. | Keep entityType and raw legacyEntityId. Resolve only after checking both target type and actual ID; known Payment mismatch requires explicit correction evidence. |
| Notification.relatedEntityType + relatedEntityId | Optional polymorphic target. | Keep type and raw legacyRelatedEntityId; a type may exist without an ID. |
| Common created_by_id, where exported | Possible platform creator. | Export confirms user IDs, two deleted identities and one service-marked principal; preserve raw legacyCreatedById without mandatory User FK (R25). |
| Application type codes, Membership type code/name, EligibilityAnswer.questionCode | Snapshots/denormalization of referenced records. | Retain alongside IDs, without independent cascading updates or code-based FKs. |
| Notification.actionUrl | Navigation destination. | No relational constraint; route strings are not entity IDs. |
| File URL fields | Uploaded/external objects. | No File entity or storage-object foreign key is defined. |
| EventRegistration.paymentStatus | Event-specific payment state. | No Payment/eventRegistrationId/eventId bridge exists in Payment. Do not invent one. |

Important cardinality and integrity limits:

- MemberProfile is selected with `filter({ userId })[0]`; other pages build a map keyed by userId. This implies expected single-profile display but does not prove one-to-one data. Newest-first list/map loops can also overwrite a newer profile with an older duplicate.
- Users can have multiple MembershipApplication, Membership, Payment, and EventRegistration records. Latest-record queries and UI hiding are not database uniqueness constraints. Do not add unique(userId), unique(applicationId), or unique(eventId, userId) without export checks and an approved rule.
- ApplicationDocument allows repeated documentType values per application. “Replace” creates another row; it does not overwrite/delete the old one automatically.
- EligibilityAnswer has no declared unique(applicationId, questionId) or exactly-one-answer constraint.
- Multiple InformationRequest and ApplicationReview rows can reference one application. No status uniqueness is declared for OPEN requests.
- Membership.applicationId and Payment.applicationId are optional; Membership.membershipTypeId is required. Payment.membershipId is optional and never backfilled by the activation code. Do not infer that a verified payment must already carry it.
- RenewalApplication points to Membership and optionally Payment. Payment has no renewalApplicationId. No source transaction/cycle resolver or one-payment-per-renewal constraint is established.
- Ownership duplicates (`userId` on documents/answers/payments/memberships) must agree with linked application owners before relational import. Source RLS does not encode those cross-record equalities. Likewise compare Payment.userId with Membership.userId where membershipId exists, and RenewalApplication.userId with the linked Membership/Payment owners.
- Reference strings must never be cast directly from Base44 IDs into UUIDs. Build a lookup for each entity using legacyBase44Id. Preserve both old and new identities in the restricted import ledger.
- Follow AGENTS.md for the two known deleted-user references: represent the users as disabled, non-login legacy identities with new IDs, preserving historical FKs. No email, role, or personal details are inferred. Other unexpected missing references must be reported separately, not silently linked to a generic user.
- No source delete cascade, referential action, unique business key, or SQL index is defined. Analyze duplicate emails, type codes, question codes, setting keys, display reference numbers, and slugs before choosing constraints.

## All declared enums

These **26 enums** are attached to fields in their respective JSONC files. A default in an entity table does not remove other enum values. Optional enum fields remain nullable in this draft.

| Source field | Proposed Prisma enum | Exact source values |
| --- | --- | --- |
| `Announcement.category` | `AnnouncementCategory` | `GENERAL`, `EVENT`, `MEMBERSHIP`, `POLICY`, `TRAINING` |
| `Announcement.targetAudience` | `AnnouncementTargetAudience` | `ALL`, `MEMBERS`, `APPLICANTS`, `COMMITTEE` |
| `Announcement.status` | `AnnouncementStatus` | `DRAFT`, `SCHEDULED`, `PUBLISHED`, `ARCHIVED` |
| `ApplicationDocument.documentType` | `ApplicationDocumentDocumentType` | `IDENTIFICATION`, `AIS_MEMBERSHIP_PROOF`, `PROFILE_PHOTO`, `PAYMENT_RECEIPT`, `ADDITIONAL_SUPPORTING_DOCUMENT`, `REQUESTED_INFORMATION` |
| `ApplicationDocument.verificationStatus` | `ApplicationDocumentVerificationStatus` | `PENDING`, `VERIFIED`, `INVALID`, `RESUBMISSION_REQUIRED` |
| `ApplicationReview.decision` | `ApplicationReviewDecision` | `START_REVIEW`, `REQUEST_INFORMATION`, `RECOMMEND_APPROVAL`, `APPROVE`, `REJECT`, `RETURN_FOR_CORRECTION` |
| `EligibilityQuestion.inputType` | `EligibilityQuestionInputType` | `BOOLEAN`, `DATE`, `TEXT`, `SELECT` |
| `Event.category` | `EventCategory` | `Seminars and Webinars`, `Workshops`, `Meetings`, `MyDCIS`, `Conferences`, `Other` |
| `Event.venueType` | `EventVenueType` | `PHYSICAL`, `ONLINE`, `HYBRID` |
| `Event.status` | `EventStatus` | `DRAFT`, `PUBLISHED`, `REGISTRATION_CLOSED`, `CANCELLED`, `COMPLETED`, `ARCHIVED` |
| `Event.targetAudience` | `EventTargetAudience` | `MEMBERS`, `NON_MEMBERS`, `MEMBERS_AND_NON_MEMBERS` |
| `EventRegistration.status` | `EventRegistrationStatus` | `REGISTERED`, `CANCELLED`, `ATTENDED`, `NO_SHOW` |
| `EventRegistration.paymentStatus` | `EventRegistrationPaymentStatus` | `NOT_REQUIRED`, `PENDING`, `PAID`, `FAILED` |
| `InformationRequest.status` | `InformationRequestStatus` | `OPEN`, `RESPONDED`, `RESOLVED`, `OVERDUE` |
| `MemberProfile.identificationType` | `MemberProfileIdentificationType` | `NRIC`, `PASSPORT`, `OTHER` |
| `MemberProfile.gender` | `MemberProfileGender` | `MALE`, `FEMALE`, `OTHER` |
| `Membership.status` | `MembershipStatus` | `PENDING`, `ACTIVE`, `EXPIRED`, `SUSPENDED`, `TERMINATED` |
| `MembershipApplication.status` | `MembershipApplicationStatus` | `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `ADDITIONAL_INFORMATION_REQUIRED`, `ELIGIBLE`, `RECOMMENDED_FOR_APPROVAL`, `APPROVED_PENDING_PAYMENT`, `PAYMENT_SUBMITTED`, `PAYMENT_UNDER_VERIFICATION`, `ACTIVE`, `REJECTED`, `EXPIRED`, `SUSPENDED`, `TERMINATED` |
| `MembershipType.code` | `MembershipTypeCode` | `ORDINARY`, `LIFETIME`, `ASSOCIATE`, `HONORARY` |
| `Notification.type` | `NotificationType` | `APPLICATION`, `PAYMENT`, `MEMBERSHIP`, `ANNOUNCEMENT`, `SYSTEM` |
| `Payment.paymentType` | `PaymentPaymentType` | `ENTRANCE_AND_ANNUAL`, `ENTRANCE_AND_LIFETIME`, `RENEWAL`, `OTHER` |
| `Payment.status` | `PaymentStatus` | `NOT_SUBMITTED`, `SUBMITTED`, `UNDER_VERIFICATION`, `VERIFIED`, `REJECTED` |
| `RenewalApplication.status` | `RenewalApplicationStatus` | `PENDING`, `PAYMENT_SUBMITTED`, `APPROVED`, `REJECTED` |
| `SystemSetting.settingType` | `SystemSettingSettingType` | `STRING`, `NUMBER`, `BOOLEAN`, `JSON` |
| `User.role` | `UserRole` | `applicant`, `ordinary_member`, `lifetime_member`, `associate_member`, `honorary_member`, `president`, `deputy_president`, `secretary`, `assistant_secretary`, `treasurer`, `committee_member`, `system_administrator` |
| `User.accountStatus` | `UserAccountStatus` | `ACTIVE`, `DISABLED`, `SUSPENDED` |

### Enum conversion and code-only value sets

- Approved canonical UserRole: `APPLICANT`, `ORDINARY_MEMBER`, `LIFETIME_MEMBER`, `ASSOCIATE_MEMBER`, `HONORARY_MEMBER`, `PRESIDENT`, `DEPUTY_PRESIDENT`, `SECRETARY`, `ASSISTANT_SECRETARY`, `TREASURER`, `COMMITTEE_MEMBER`, `SYSTEM_ADMINISTRATOR`. Map user -> APPLICANT and admin -> SYSTEM_ADMINISTRATOR; normalize equivalent declared roles. Preserve original imported value in nullable legacyRole. USER/ADMIN are not canonical members. Blank optional roles become NULL; unknown undeclared aliases require review (R02).
- `SYSTEM_ADMIN` occurs in Login.jsx, AuthCallback.jsx and App.jsx role arrays but not User.jsonc or constants.js's effective AdminLayout guard. Its equivalence to SYSTEM_ADMINISTRATOR is **unresolved**, not an approved mapping. Retain raw values and block automatic normalization of this alias.
- Uppercase member-role variants are required to be handled by migration instructions, but constants.js's isMember only accepts the lowercase member values. Preserve casing provenance; do not assume this helper validates the full migration input domain.
- EventCategory needs legal Prisma identifiers while preserving exact stored labels. Proposed explicit mappings: `SEMINARS_AND_WEBINARS -> "Seminars and Webinars"`, `WORKSHOPS -> "Workshops"`, `MEETINGS -> "Meetings"`, `MYDCIS -> "MyDCIS"`, `CONFERENCES -> "Conferences"`, `OTHER -> "Other"`. Use enum-value mapping rather than silently changing category data. This is a naming proposal, not generated Prisma code.
- Payment.paymentMethod is **not a schema enum**. The UI offers `BANK_TRANSFER, ONLINE_BANKING, CASH_DEPOSIT` (PaymentPage.jsx:178-185). Preserve any other exported strings pending review.
- ApplicationReview.previousStatus/newStatus, membership type code snapshots, Event.eventType, currencies, AuditLog.action/entityType, and Notification.relatedEntityType are all free strings, even when existing writers use a finite subset.
- Known AuditLog action strings from writers: `APPLICATION_SUBMITTED`, `APPLICATION_START_REVIEW`, `APPLICATION_REQUEST_INFORMATION`, `APPLICATION_RECOMMEND_APPROVAL`, `APPLICATION_APPROVE`, `APPLICATION_REJECT`, `PAYMENT_SUBMITTED`, `PAYMENT_VERIFY`, `PAYMENT_REJECT`, `INFO_RESPONSE_SUBMITTED`, `PROFILE_NAME_SYNCED`, `EVENT_CREATED`, `EVENT_UPDATED`, and `EVENT_` plus the requested status. Preserve exact strings; do not rename PAYMENT_VERIFY to PAYMENT_VERIFIED.
- Event/announcement/payment filters use `All`/`ALL`; these are UI filter sentinels, not extra status/category values. Announcement.targetAudience's uppercase ALL **is** a real enum value. Tracker keys `INFO_REQ` and `PAYMENT` are presentation steps, not application statuses.
- MemberProfile.state is free text. Profile.jsx:18 offers `Johor, Kedah, Kelantan, Melaka, Negeri Sembilan, Pahang, Perak, Perlis, Pulau Pinang, Sabah, Sarawak, Selangor, Terengganu, W.P. Kuala Lumpur, W.P. Labuan, W.P. Putrajaya`; do not convert it to a database enum merely from this UI list.
## Generated references and persisted derived values

### Reference-number rules found in source

The shared helper is [constants.js:190-193](../../myais-connect-base44-archive/src/lib/constants.js#L190):

`generateRefNumber(prefix, count) = prefix + "-" + new Date().getFullYear() + "-" + String(count + 1).padStart(6, "0")`

| Stored/derived value | Exact caller behavior | Timing / source |
| --- | --- | --- |
| MembershipApplication.applicationNumber | Prefix `MYAIS-APP`; count = length returned by `MembershipApplication.list()`. | On submission, after the draft already exists; MyApplication.jsx:148-156. Format `MYAIS-APP-YYYY-NNNNNN`. Includes returned drafts/all years; no year filtering. |
| Payment.paymentReference (approval) | Prefix `MYAIS-PAY`; count = length returned by `Payment.list()`. | Before creating approval payment, including honorary OTHER/VERIFIED payment; ApplicationReviewPage.jsx:114-127. Format `MYAIS-PAY-YYYY-NNNNNN`. |
| Payment.paymentReference (member fallback) | Same helper/prefix and Payment.list length. | Only when no current payment exists; PaymentPage.jsx:80-99. Existing payment submission retains its reference. |
| Membership.membershipNumber (honorary) | Prefix `MYAIS`; count = length returned by `Membership.list()`. | Before honorary membership creation; ApplicationReviewPage.jsx:140-156. Format `MYAIS-YYYY-NNNNNN`. |
| Membership.membershipNumber (verification) | Same helper/prefix and Membership.list length. | Before membership creation on payment verification; PaymentManagement.jsx:82-106. |
| Event.eventNumber (create) | Supplied truthy eventData.eventNumber wins; otherwise `MYAIS-EVT-` + local year + `-` + `String(allEvents.length + 1).padStart(4, "0")`; allEvents comes from service-role `Event.list("-created_date", 500)`. | manageEvent/entry.ts:59-70. Format normally `MYAIS-EVT-YYYY-NNNN`. |
| Event.eventNumber (duplicate) | `MYAIS-EVT-` + local year + `-` + last four decimal digits of `Date.now()`. | manageEvent/entry.ts:130-146. Same visual format, different algorithm. |
| Event.slug | Supplied truthy slug wins on create/update. Otherwise stringify title, lowercase, trim, replace runs of non-ASCII-alphanumeric characters with `-`, strip edge hyphens; if empty use `event-` + Date.now(). | manageEvent/entry.ts:15-20,66,88. Duplicate derives slug from original title + ` Copy` at line 141. No uniqueness check. |
| RenewalApplication.renewalNumber | **No generator found.** | Schema-only property. Do not assume a MYAIS-RENEW prefix or numbering scheme. |
| Digital-card verifyCode | `"V-" + (membership.membershipNumber?.slice(-6) || "000000")`. | DigitalCard.jsx:38. **Not stored in any entity**; QR graphic is a UI icon, not evidence of a stored credential or verification endpoint. |
| Payment.transactionReference / MemberProfile.aisMembershipNumber | User-entered/external references, not generated by these helpers. | PaymentPage.jsx:193-194; Profile.jsx AIS inputs. |

Reference risks: list counts may be filtered by RLS or capped/paginated by the SDK; its default page size is not established by source. Six-digit padStart is a minimum width, not a six-digit maximum. Count-based numbering is not locked, not necessarily monotonic, includes existing drafts/deleted-record effects, and does not reset the count annually. Event creation explicitly caps the count at 500; assuming ordinary limit semantics, later creations can repeatedly propose 0501. Duplicate-event suffixes repeat every 10,000 milliseconds and can collide with count-generated numbers. Local runtime year may differ from UTC timestamp dates around midnight/year boundaries. No schema uniqueness is declared. **Migrate stored reference strings as-is; never regenerate them from import order.** A future allocator requires an approved rule, not an implicit change in this draft.

### Other derived and duplicated calculations

- MemberProfile.profileCompletionPercentage: `Math.round(filled / 15 * 100)`; a field is filled if `String(data[field] || "").trim()` is truthy. The 15 fields are identificationType, identificationNumber, nationality, dateOfBirth, gender, phoneNumber, addressLine1, city, state, postcode, country, institution, occupation, department, areaOfExpertise. Excludes fullName, addressLine2 and AIS membership fields. Stored on profile save (Profile.jsx:20-35,63-86); do not recalculate historical values during import.
- Eligibility result uses five conditions: Malaysian nationality substring or local citizenship answer; age >=18 using floor of elapsed milliseconds / (365.25 days); country containing malaysia or local residence answer; AIS membership flag or local answer; AIS expiry parsed date strictly greater than now. All five => recommendation ORDINARY, score 100, permitted choices ORDINARY/LIFETIME. Otherwise => ASSOCIATE, score max(0,100 - failedConditionCount * 20). Explanation text describes failing conditions (MyApplication.jsx:70-94).
- Profile values and local answers have asymmetric `||` fallback. A true stored AIS flag cannot be overridden by local false; the collected local AIS number does not participate in eligibility evaluation. These are observed behaviors, not approved redesign choices.
- Payment.totalAmount is assigned entranceFee + membershipFee with each falsy fee replaced by 0. Verification reads current MembershipType validity/name/votingRights, while the Payment keeps the earlier fee snapshot; neither type changes nor import should rewrite those amounts.
- Paid Membership.startDate is current UTC ISO date substring. For truthy positive validityMonths, expiry is computed using JavaScript local `setMonth(currentMonth + validityMonths)`, then converted to a UTC ISO date substring; otherwise expiry is null. This is not necessarily “end of month” arithmetic. Honorary creation omits expiryDate regardless of configured validityMonths.
- Membership type code/name, voting eligibility, review remarks and actor names are persisted snapshots/copies, not generated primary keys. The display helpers can prefer live profile names over historical event-registration names; preserve the underlying source fields.

## Workflow and validation dependencies

### Declared application transition graph

[constants.js:116-126](../../myais-connect-base44-archive/src/lib/constants.js#L116) exactly defines:

| From | Allowed next statuses in VALID_TRANSITIONS |
| --- | --- |
| DRAFT | SUBMITTED |
| SUBMITTED | UNDER_REVIEW |
| UNDER_REVIEW | ADDITIONAL_INFORMATION_REQUIRED, RECOMMENDED_FOR_APPROVAL, REJECTED |
| ADDITIONAL_INFORMATION_REQUIRED | UNDER_REVIEW |
| RECOMMENDED_FOR_APPROVAL | APPROVED_PENDING_PAYMENT, REJECTED |
| APPROVED_PENDING_PAYMENT | PAYMENT_SUBMITTED |
| PAYMENT_SUBMITTED | PAYMENT_UNDER_VERIFICATION |
| PAYMENT_UNDER_VERIFICATION | ACTIVE, APPROVED_PENDING_PAYMENT |
| ACTIVE | EXPIRED, SUSPENDED, TERMINATED |

ELIGIBLE is a declared schema/constant value but has no transition entry or incoming transition. REJECTED, EXPIRED, SUSPENDED and TERMINATED have no outgoing transitions here. Do not remove these values or infer extra transitions. AGENTS.md reproduces this graph but omits ELIGIBLE from the described states.

### Actual writes, which do not always follow that graph

| Trigger | Writes and dependencies observed | Migration implication |
| --- | --- | --- |
| Application creation/submission | Create DRAFT with requested/recommended type IDs/codes, score/explanation and currentStep=2. Submit sets SUBMITTED, reference, submittedAt, currentStep=4, then creates audit and applicant notification. | Local eligibility answers and declaration are not stored; side effects are separate calls. |
| START_REVIEW / RECOMMEND_APPROVAL | Check VALID_TRANSITIONS, update status/latest reviewer fields, create ApplicationReview and AuditLog. | “Recommend approval” changes status, not recommendedMembershipTypeId/code or eligibility result. |
| REQUEST_INFORMATION | Check transition, create OPEN InformationRequest with actor/name/message and dueDate or null, then update application and log review/audit. | Request exists separately from the application transition. No applicant-notification write is present in this branch. |
| Respond to information | Update one OPEN request to RESPONDED with response, attachment URL or null and respondedAt; set application UNDER_REVIEW; create AuditLog. | Does not check all other OPEN requests. Returning application to review can hide remaining requests from the member page, which queries only applications in ADDITIONAL_INFORMATION_REQUIRED. |
| Approve paid type | Check transition and canApproveApplications; set approved type/time/actor; create NOT_SUBMITTED Payment with fee snapshot; notify; finish application as APPROVED_PENDING_PAYMENT; create review/audit. | No transaction or idempotency guard in this frontend mutation. Honorary-specific behavior is separate. |
| Approve HONORARY | Same initial approval path, but Payment.paymentType=OTHER and status=VERIFIED; create ACTIVE Membership immediately; application goes directly from RECOMMENDED_FOR_APPROVAL to ACTIVE. | Contradicts a literal reading of the generic transition graph. No User.role update and no verifier metadata/expiry on this path. Notification says active before Membership.create finishes. |
| Submit/re-submit payment | Update existing payment or create fallback payment; status SUBMITTED, proof and bank fields, paidAt/submittedAt; application PAYMENT_SUBMITTED; audit. | Old rejectionReason/verifier fields are not explicitly cleared. Existing snapshot fees remain; displayed summary uses current type fees. |
| Verify payment | UI offers verify for SUBMITTED/UNDER_VERIFICATION. Mutation immediately marks VERIFIED, then creates ACTIVE Membership if application resolves, marks application ACTIVE, overwrites User.role, notifies, audits. | No assignment to UNDER_VERIFICATION/PAYMENT_UNDER_VERIFICATION found. No state guard inside mutation, transaction, existing-membership check, or Payment.membershipId backfill. Verification can finish without membership when application is absent. |
| Reject payment | Set REJECTED + two remarks fields; application APPROVED_PENDING_PAYMENT when applicationId exists; notify and audit. | Can happen directly from PAYMENT_SUBMITTED via UI; no verification-stage transition requirement enforced. |
| Event lifecycle | create/update validates content; status action changes status directly and sets timestamp fields for PUBLISHED/CANCELLED; deleteDraft checks current DRAFT; duplicate copies then modifies selected fields. | No event transition graph, automatic completion/closure worker, or relation-aware draft-delete rule found. |
| Announcement lifecycle | Form offers DRAFT/PUBLISHED/ARCHIVED and writes selected status directly. | SCHEDULED remains in schema; no publisher/expiration scheduler found. Audience/date fields are not enforced by member read query. |
| Document review / renewal / membership expiry | Statuses exist in schema; no corresponding mutation/worker in the archive. | Preserve existing values and empty entity support; do not create new workflows as part of mapping. |
| Notification read | Set isRead=true and readAt to current ISO time, singly or in a loop. | Keep flags/timestamps independently if exported records disagree. |

### Validation: schema versus implementation

- JSONC declares no minLength/maxLength, numeric min/max, integer types, regex patterns, unique fields, relational constraints, URL/email formats, nested item definitions, or explicit additionalProperties policy. Date/date-time formats and listed enums/required arrays are the only field-level structural constraints beyond type/default. Do not treat defaults as backfills for explicit nulls or historical omissions.
- Profile save requires full name trimmed length >=2 and all 15 completion fields to contain non-whitespace values. If aisMember is truthy, number and expiry must be truthy. Name is normalized by trimming and collapsing whitespace. Schema only requires userId; stricter UI rules must not make older incomplete profiles unimportable.
- Registration validates full-name length and matching passwords; HTML requires email/password/name and uses email input. OTP UI uses six characters. SDK auth field persistence and credential rules are not exported; these UI checks are not proof of database columns or password policy.
- Application UI requires existing IDENTIFICATION, AIS_MEMBERSHIP_PROOF and PROFILE_PHOTO document rows for **all selectable types**, even ASSOCIATE. It checks neither verificationStatus nor fileUrl. Each application upload checks size <=5*1024*1024 bytes and MIME in application/pdf, image/jpeg, image/jpg, image/png. The declaration is required only in component state. All these are client checks, not JSONC constraints.
- Payment submission UI requires paymentMethod, transactionReference and a newly selected receiptFile. Bank name/payment date are optional. Receipt input accepts .pdf/.jpg/.jpeg/.png but has **no explicit size or MIME validation** in its handler. Information-response attachment has the same accept list and no explicit size/MIME guard. Profile photo accepts image/* with no explicit size limit. Do not claim the application's 5 MiB limit applies uniformly to all uploads.
- Review dialog requires nonblank remarks for request-information/rejection, and a type for approval. Payment rejection dialog requires nonblank remarks. The JSONC does not make ApplicationReview.remarks or Payment.rejectionReason universally required.
- manageEvent's create/update validation requires truthy title, category, description, startDate, startTime, venueType; requires onlineMeetingUrl for ONLINE/HYBRID; venueName and physicalAddress for PHYSICAL/HYBRID; checks end > start **only if both endDate and endTime exist**; rejects registrationDeadline after startDate; rejects negative fees; checks positive capacity only if capacity is truthy. It does not enforce positive-integer capacity, registrationStart ordering, URL syntax, an explicit timezone, or finite/valid numeric/date parsing.
- EventForm's draft button sends DRAFT, publish button sends PUBLISHED, overwriting the separately selected form status. update receives a spread of the loaded record, with no field whitelist in the function. Status/duplicate paths bypass validateEvent.
- MembershipType settings converts input with Number and does not enforce non-negative fees or integer validityMonths. “0 = lifetime” is a UI convention; membership expiry also treats missing/nonpositive months as no expiry. Do not infer that LIFETIME always has validityMonths=0 without data.
## Row-level security and role/user dependencies

This table transcribes **source policy shape**, not a claim that deployed Base44 permissions were tested:

- **A** = `{ user_condition: { role: "admin" } }`, exactly lowercase admin.
- **Owner** = `{ "data.userId": "{{user.id}}" }`.
- **Actor** = `{ "data.actorUserId": "{{user.id}}" }`.
- “or” is the JSONC `$or` array. A literal `null` has no explicit rule in the file; exact platform enforcement/authentication context must be verified. Do not equate it to an ownership condition.
- User.jsonc declares no `rls` block; platform User authorization cannot be reconstructed from it.

| Entity | Create | Read | Update | Delete |
| --- | --- | --- | --- | --- |
| Announcement | A | `null` (no explicit condition) | A | A |
| ApplicationDocument | Owner or A | Owner or A | Owner or A | Owner or A |
| ApplicationReview | A | `null` (no explicit condition) | A | A |
| AuditLog | Actor or A | A | A | A |
| EligibilityAnswer | Owner or A | Owner or A | Owner or A | Owner or A |
| EligibilityQuestion | A | `null` (no explicit condition) | A | A |
| Event | A | `null` (no explicit condition) | A | A |
| EventRegistration | Owner or A | Owner or A | Owner or A | Owner or A |
| InformationRequest | A | `null` (no explicit condition) | `null` (no explicit condition) | A |
| MemberProfile | Owner or A | Owner or A | Owner or A | Owner or A |
| Membership | A | Owner or A | A | A |
| MembershipApplication | Owner or A | Owner or A | Owner or A | Owner or A |
| MembershipType | A | `null` (no explicit condition) | A | A |
| Notification | `null` (no explicit condition) | Owner or A | Owner or A | Owner or A |
| Payment | Owner or A | Owner or A | Owner or A | Owner or A |
| RenewalApplication | Owner or A | Owner or A | Owner or A | Owner or A |
| SystemSetting | A | A | A | A |
| User | Not declared | Not declared | Not declared | Not declared |

The new-system security requirement remains server-side identity, ownership, role and transition authorization. Owner-based entity access is not permission to change protected workflow fields. Source policy conflicts are findings to resolve, not instructions to copy an exposure.

| Capability | Source role intent / conflict |
| --- | --- |
| Application review | constants.js REVIEW_ROLES includes six uppercase committee/system roles; canReviewApplications adds lowercase forms and lowercase admin, but excludes uppercase ADMIN. ADMIN_PERMISSIONS.applications includes both admin cases. Actual review page does not call canReviewApplications. |
| Final approval | canApproveApplications allows President, System Administrator and legacy Admin in upper/lower forms; it is called inside the frontend approval mutation. |
| Payment verification | canVerifyPayments permits Treasurer, System Administrator, legacy Admin; PaymentManagement does not call it. |
| Events | ADMIN_PERMISSIONS.events includes Committee Member. manageEvent EVENT_MANAGERS excludes both Committee Member and Treasurer for mutations. Its broader ADMIN_ROLES permits them past the first check; action view is exempted at the second check but has no implementation branch. |
| Directory / announcements / reports / audit / settings | constants.js ADMIN_PERMISSIONS matches documented capability intent, but navigation filtering is not per-operation backend authorization. AdminLayout checks only global isAdmin. |
| Account status / role updates | accountStatus is declared, but no custom guard checks it. Payment verification replaces the single User.role with a member role; no preservation of an existing committee role is implemented. Unknown platform protections must be verified. |

The event function uses service-role entity writes after its own role gate. Other shown business workflows call Base44 entities directly from frontend mutations. ApplicationReview.read and InformationRequest.read/update have literal null policies, Payment owners have update/delete rules, and AuditLog admins can update/delete. These differ materially from the intended protected data and immutable/auditable payment handling in the new repo.

## Denormalized, duplicated and snapshot fields

| Fields | Observed relationship / preservation rule |
| --- | --- |
| User.fullName, User.full_name, MemberProfile.fullName | Competing name representations. Profile save synchronizes only User.fullName. nameUtils.getCurrentFullName prefers non-incomplete profile.fullName, then user.fullName, rejecting a name equal to email/email local part; it ignores user.full_name. Keep each source value separately before an approved reconciliation. |
| User.phoneNumber, MemberProfile.phoneNumber | Duplicate contact concept; only profile field is edited in Profile. No synchronization proven. Preserve both. |
| EventRegistration.attendeeName, attendeeEmail | Name/email snapshots by schema naming. Profile save rewrites attendeeName for all that user's registrations; no attendeeEmail synchronization found. Admin registration display uses live profile/User name and ignores stored attendeeName, so an empty live join can mask historical data. |
| ApplicationReview.reviewerName, InformationRequest.requestedByName, AuditLog.actorName | Actor-name snapshots; name format varies by writer. Do not regenerate history from current User names. |
| Announcement.createdByName + createdByUserId | Denormalized attribution; both are overwritten on edit, so they may represent latest editor rather than creator. Preserve recorded values. |
| MembershipApplication requested/recommended/approved type IDs and code strings | Three distinct decisions, each with independent code snapshot. Do not collapse them or resolve IDs exclusively by mutable code. |
| Membership.membershipTypeId + membershipTypeCode + membershipTypeName | Type reference plus activation-time snapshot. Verification code can prefer application's approved code over live type code. Retain disagreement for review. |
| Membership.votingEligible versus MembershipType.votingRights | Activation-time copy. Do not recalculate historical eligibility from current settings. |
| Payment.entranceFee, membershipFee, totalAmount versus MembershipType fees | Historical amount snapshot plus stored sum. Current fee changes may make the fields disagree; no import-time recalculation or implicit rounding. |
| Membership.expiryDate versus MembershipType.validityMonths | Derived at activation; current policy does not reconstruct historical expiry reliably. |
| RenewalApplication.previousExpiryDate, newExpiryDate, fee | Intended snapshot/result fields by names, but no writer proves computation. Preserve them; do not infer renewal from Membership's current expiry. |
| EligibilityAnswer.questionCode versus EligibilityQuestion.code | Declared duplicate with no writer. Preserve original code alongside questionId. |
| MembershipApplication.eligibilityScore, eligibilityExplanation | Stored evaluation result; source questions/answers are not persisted by current UI. Historical results cannot be reliably recomputed. |
| MemberProfile.profileCompletionPercentage | Persisted computed value; preserve rather than refreshing during migration. |
| MembershipApplication.latestReviewerRemarks, reviewedByUserId, reviewedAt versus ApplicationReview history | Latest-review cache; empty remarks retain previous text. Both summary and event history can diverge and must be retained. |
| MembershipApplication.status, Membership.status, User.role, Payment.status | Related but distinct stored state; honorary path and partial failures can leave them inconsistent. Do not repair by inferring one solely from another. |
| Event.createdAt/updatedAt versus platform created_date/updated_date | Independent timestamp pairs; explicit function writes and platform generation may differ. Map system pair to legacyCreatedAt/legacyUpdatedAt. |
| Event.createdBy versus platform created_by_id if exported | Business attribution versus platform creator metadata; duplicate retains original createdBy. Do not collapse based on names. |
| Payment.rejectionReason, treasurerRemarks | Same remarks copied to both on rejection; may later diverge or stay stale. |
| Payment.receiptUrl versus ApplicationDocument PAYMENT_RECEIPT | Two potential representations, but payment upload does not create a document row. Not evidence they refer to the same file. |
| User.photoUrl versus ApplicationDocument PROFILE_PHOTO | Independent upload flows; never replace one with the other automatically. |
| InformationRequest.responseAttachmentUrl versus ApplicationDocument REQUESTED_INFORMATION | Response upload writes only InformationRequest. Do not invent a document row or relationship. |
| Notification.message, AuditLog.description | Human-readable snapshots can embed names/reference numbers/statuses; preserve verbatim and keep restricted. |

Event speakerName/speakerTitle are embedded speaker details with no Speaker entity or relationship; do not infer a deduplication key. UI statistics, formatted membership card name/initials, verifyCode, registrationLabel, fee displays and the fallback event image are computed presentation values, not additional stored fields.

## File and navigation URL inventory

| Source field | Category | Source handling / migration implications |
| --- | --- | --- |
| User.photoUrl | Uploaded profile image | Core.UploadFile result persisted via auth.updateMe. Preserve source URL privately; distinct from application photo. |
| ApplicationDocument.fileUrl | Uploaded identification/AIS/photo/support/receipt/requested-information document | Core.UploadFile result. Metadata fields originalFileName, mimeType, fileSize are separately stored; no target file-ownership key defined. |
| Payment.receiptUrl | Uploaded financial proof | Direct UploadFile result; no ApplicationDocument row, byte count or MIME metadata writer in payment flow. |
| InformationRequest.responseAttachmentUrl | Uploaded response evidence | Optional; writer sends null when absent. No corresponding ApplicationDocument write. |
| Announcement.coverImageUrl | Image URL | Schema-only field in current form; retain any exported value. |
| Announcement.attachmentUrl | Attachment URL | Member page renders direct link; editor shown has no input/uploader. Audience/privacy must be assessed before publication. |
| Event.coverImage | External image URL | Direct text input; uploader disabled. EVENT_PLACEHOLDER is a presentation fallback, not a schema default or mandatory stored URL. |
| Event.onlineMeetingUrl | Meeting/access link | Conditional venue field, not a stored-file foreign key. May contain private access details. |
| Event.registrationUrl | External registration/navigation link | Editable string; actual public registration control remains disabled. |
| Notification.actionUrl | Internal navigation route | Known values include /my-application/tracker, /my-application/payment, /my-card; no file or ID remapping can be assumed. |

None of these schemas declares URL validation, a private/public flag, object key, expiry, signed-URL contract, upload checksum, file ownership relation, or backing object availability. Preserve the source string; track any future copy/authorization mapping separately. The new system must use private storage and signed/authorized retrieval for protected uploads. This analysis contains no real exported URLs, member records, credentials, or file contents.

## Inconsistencies and risks requiring resolution

Severity counts below use unique R01–R27 issue groups, not individual cells or repeated references. R01, R12 and R18 are resolved by user approval; the other 24 groups retain unresolved findings; factual subfindings resolved by exports are explicitly identified in the last column. BLOCKER prevents finalizing the affected canonical mapping; HIGH risks integrity/security; MEDIUM needs specification before its affected workflow/constraint; LOW is documentation/provenance follow-up.

| ID | Current severity / status | Source evidence | Finding and consequence | Current export disposition |
| --- | --- | --- | --- | --- |
| R01 | RESOLVED | User approval; User.jsonc; constants.js | Legacy/custom role discrepancy remains source evidence; canonical mapping is explicitly approved. | user -> APPLICANT; admin -> SYSTEM_ADMINISTRATOR; other declared roles -> uppercase equivalents; original -> nullable legacyRole. No USER/ADMIN canonical enum members. Permission issues remain in R02/R03/R05/R25. |
| R02 | MEDIUM | Login.jsx:11-14; AuthCallback.jsx:5-8; App.jsx; constants.js | SYSTEM_ADMIN is an unrecognized alias in some route arrays. Login/callback also omit several lowercase admin roles and uppercase ADMIN/SYSTEM_ADMINISTRATOR accepted by AdminLayout. Preserve raw role values; alias mapping requires confirmation. | No SYSTEM_ADMIN or uppercase variants occur in these three users. Absence does not settle alias semantics for future/other records. |
| R03 | HIGH | constants.js:178-187, ADMIN_PERMISSIONS; ApplicationReviewPage/PaymentManagement; AdminLayout | Capability helpers/nav rules are not enforced by the shown global admin layout or payment mutation. Uppercase ADMIN is also missing from canReviewApplications despite being in navigation permissions. Preserve intended capabilities, not accidental broad access. | CSV roles/states cannot establish authorization intent or enforce capabilities. Requires backend permission decisions before workflows are ported. |
| R04 | HIGH | constants.js ADMIN_PERMISSIONS.events; manageEvent:10-12,49-51 | Committee Member is allowed by documented/frontend event permissions but cannot mutate events in the backend function. “view” passes a gate but is not implemented. Resolve authority conflict before porting. | One event does not resolve committee permission disagreement; backend source remains the higher-priority evidence. |
| R05 | HIGH | MembershipApplication/Payment/ApplicationDocument RLS; InformationRequest/Review RLS; AuditLog RLS | Owner update/delete or null policies do not protect status/verifier fields or indirect ownership; audit is mutable by admins. New backend authorization is required; no live exploitability assessment was performed. | All 11 documents are PENDING, including documents on ACTIVE applications. CSV cannot prove privileged field protection; retain independent states and require server authorization. |
| R06 | MEDIUM | MembershipApplication.jsonc; constants.js:81-126; ApplicationTracker:25-30 | ELIGIBLE exists in enum/display helpers but no transition or tracker ordering exists; docs omit it. Preserve values; do not fabricate a lifecycle edge. | No ELIGIBLE applications occur (ACTIVE=2, DRAFT=1, REJECTED=1); preserve the declared enum and leave its transitions unresolved. |
| R07 | HIGH | PaymentManagement:68-131; constants.js:123-124 | Verification/rejection can move directly from submitted to final states, bypassing declared verification stages. No writer starts verification. Stored history may legitimately omit intermediate values. | Both payments are VERIFIED; review history contains approval but no payment-verification stage. A current-state export is not complete state-transition evidence. |
| R08 | HIGH | ApplicationReviewPage:114-156 | HONORARY creates VERIFIED payment and ACTIVE membership/application without a User.role update, verifier metadata or expiry. Generic state graph and “activation updates role” descriptions are incomplete for this path. | HONORARY type exists with zero fees/nonrenewable configuration, but there are no honorary payments or memberships. Runtime exception remains unresolved. |
| R09 | HIGH | ApplicationReviewPage:77-200; PaymentManagement:68-149; Profile:90-114 | Multiple entity changes are separate awaited calls with no transaction/idempotency. Partial approvals, duplicate memberships, role/status divergence and missing audit/notifications are possible. Do not silently repair on import. | Two distinct ACTIVE, overlapping memberships and two ACTIVE applications belong to one user. Preserve both; data cannot establish whether duplication was intentional or a retry/partial-write bug. |
| R10 | HIGH | PaymentPage:106-112 | AuditLog.entityType=Payment but entityId=application.id. Raw polymorphic ID must survive; a type-based FK rewrite would mislink or lose history. | Confirmed in AuditLog rows 2 and 9: PAYMENT_SUBMITTED declares Payment but references MembershipApplication. Preserve discriminator and raw legacy entity ID; correction requires approval. |
| R11 | MEDIUM | constants.js:190-193; MyApplication:148-151; manageEvent:60-61,142 | Reference generation uses visible list lengths or repeating timestamp suffixes, no lock/uniqueness, and no annual count reset. The draft's new UUID keys must remain separate from these business references. | All eight nonblank generated references match source formats and are unique in this sample; collision risk remains. APPLICATION_NUMBER_PREFIX=APP differs from hardcoded MYAIS-APP and has no consuming writer. |
| R12 | RESOLVED | User approval; Event.jsonc; manageEvent | Canonical creator and timestamp separation are approved despite source/system differences. | Nullable createdByUserId for real User matches; platform principals -> NULL FK plus exact legacyCreatedBy. No authenticatable fake users. Keep business/system dates separate. Workflow issues remain R21; platform contract remains R25. |
| R13 | HIGH | User.jsonc; Register:54; Profile:59,100; nameUtils:18-26 | fullName and full_name are undeclared competing User fields; profile helper ignores full_name. Do not rename both into one target column and lose a populated value. | User.fullName is absent from the CSV. Two comparable profile names differ from full_name (one profile value is blank); one phone differs. Preserve all original values; no authoritative-name/phone merge is established. |
| R14 | MEDIUM | AnnouncementManagement:33-35; Profile:102-105; EventRegistrations:43-45 | Author snapshots are overwritten by editors, registration names are resynchronized, and displays use current identity instead of historical snapshot. Snapshot does not necessarily mean immutable. | Three reviewer-name and six actor-name snapshots differ from current User.full_name. All four announcements lack createdByUserId. Preserve snapshots; do not infer identity from names or metadata. |
| R15 | HIGH | All schemas; latest/first-record queries; AGENTS.md orphan requirement | FK/cardinality/uniqueness are not schema-enforced. Export integrity and orphan findings below qualify the earlier source-only uncertainty; schema names do not prove constraints. | All 34 candidate references checked. Exactly two mapped deleted users account for nine required domain references and eight creator metadata cells; identity handling is mandated by AGENTS.md. Other conventional non-User targets resolve, but observed multiplicity forbids unique(userId) for membership/application. On-delete and other uniqueness rules remain unapproved. |
| R16 | MEDIUM | EligibilityQuestion/Answer, RenewalApplication, SystemSetting schemas; MyApplication:70-118; App.jsx /renew | Four entities have no SDK readers/writers. Question rules are bypassed by hardcoded eligibility; answers/declaration are not persisted; renewal/settings behavior is incomplete. Empty entities still need future schema support. | All four confirmed empty exports are zero-byte files; retain their schemas. Six questions and nine settings are populated despite missing SDK consumers. Answer/renewal semantics, unseen setting types and unused rule grammar remain unresolved. |
| R17 | HIGH | MyApplication:183-195,236-237; PaymentPage:203-223; Profile:145-150; InformationResponse:99-118 | Application MIME/5 MiB validation is not shared across upload flows. AIS proof is required even for ASSOCIATE; a document row without a URL can satisfy the UI gate. Preserve data, flag policy conflict rather than “fixing” imports. | Eleven document rows declare application/pdf, including three PROFILE_PHOTO rows, all within 5 MiB. Fifteen stored upload/image URLs have /public/ paths. File bytes, ownership/access and policy across flows remain unverified; no retrieval occurred. |
| R18 | RESOLVED | User approval; date/null export audit | Canonical date/time/null representation is approved. | System/event/action instants -> UTC timestamptz; business dates -> date; Event clocks stay local with timezone Asia/Kuala_Lumpur unless explicitly migrated otherwise; blank optional values -> NULL. Offset-less source-zone interpretation remains an import-execution follow-up within R25 HIGH, not a canonical-type blocker. |
| R19 | HIGH | All number fields; AdminSettings:64-75; manageEvent:35-36 | Number is not integer, monetary scale is undeclared, negative type fees are not blocked, and zero event capacity bypasses validation. Do not impose Int or Decimal(…,2) without profiling. | All observed schema numbers are finite, nonnegative integral text. This supports parsing these rows, not permanent Int constraints or money scale; financial precision and allowed future ranges need approval. |
| R20 | MEDIUM | PaymentPage:70-99,158-170; PaymentManagement:82-113 | Stored payment fees may differ from current type fee display; activation uses live validity/name/voting policy. Preserve amounts and membership snapshots rather than recalculating from present settings. | All checked type codes, membership name/voting snapshots and payment fee sums agree in the sample. Preserve separately; sample agreement does not authorize recomputation or removal. |
| R21 | MEDIUM | manageEvent:54-56,85-119,130-146; EventForm:21,68-69 | Event status action bypasses validation/transitions; generic update can publish without publishedAt; duplicate keeps cancellation metadata; form buttons override selected status. Timestamp/status invariants cannot be assumed. | One PUBLISHED event has publishedAt. No cancelled/archived/duplicate samples settle the source timestamp/transition defects. |
| R22 | HIGH | Event.jsonc / Announcement.jsonc RLS; EventDetail:14; Events:18; Announcements:13 | Public event detail queries by ID without publication filter; announcement read filters only PUBLISHED, not audience/schedule/expiry. Actual platform read restrictions unknown. Do not expose restricted rows/links based on UI alone. | Published event and announcements do not establish audience/access enforcement. /public/ URL structure is not proof of authorized retrieval. |
| R23 | MEDIUM | InformationResponse:24,32,43-49 | Responding to one request returns the application to review even if other OPEN requests exist; they may disappear from this UI. No automatic OVERDUE/RESOLVED worker. | InformationRequest has no exported rows; multiple-request state behavior and overdue/resolution semantics remain source-only. |
| R24 | HIGH | PaymentManagement:87-113; DigitalCard:20,98; membershipStatus.js | Expiry is computed with local-month arithmetic and not automatically enforced in archived code. Role is overwritten with a member role; missing type lookup defaults to ordinary_member. Null expiry displays Lifetime regardless of actual type. | Two ACTIVE ASSOCIATE memberships have overlapping periods and matching associate_member role. No lifetime/ordinary/honorary or expired examples settle role replacement, month arithmetic or expiry enforcement. |
| R25 | HIGH | Common metadata references; User.jsonc only five fields | Complete Base44 system/auth field contract is absent. A source-only map cannot certify export completeness, email uniqueness, verification flags, credential portability, or system-field defaults. | Six non-User platform columns and User.status are confirmed. User CSV omits id; mapping supplies three exact email matches. One AuditLog created_by_id is service-marked, outside user IDs. User status conflicts with mapping text in all three rows; preserve CSV values separately from accountStatus. Platform auth/credential contract remains unknown. Approved principal preservation and optional-blank handling settle those target representations. Source-zone interpretation for 156 offset-less system timestamp cells must be established before import; UTC storage and Event timezone do not establish that source zone. |
| R26 | MEDIUM | Schema descriptions for JSON strings; AuditLog/Notification polymorphic fields | Converting text snapshots to Json, narrowing free strings to enums, or inferring missing polymorphic IDs could destroy unsupported historical values. Preserve text/raw IDs until reviewed. | Question options has one valid JSON string-array; five blanks. Audit oldValues/newValues are all blank. Two Membership notifications lack relatedEntityId. Do not narrow strings, infer IDs or convert unseen JSON payloads. |
| R27 | LOW | Source inventory; docs/migration-status.md | Archive relocation and supplied-export inspection are complete. Phase status and deployed/export-version attestation remain documentation/provenance gaps. | Sibling archive now exists at the same recorded commit; previous location blocker and lack-of-export evidence are resolved. Phase-status doc remains stale and export/deployed-version alignment has no attestation; only this draft is updated. |

## Explicit ambiguity register and next-phase gates

No decision here authorizes code/schema changes. These gates summarize the issue groups above and are **not additional issues** for severity counting.

1. **User roles/platform fields — R01 resolved; HIGH R13/R25; MEDIUM R02.** Approved role mapping and nullable legacyRole apply. Name reconciliation, unknown route aliases, auth and future uniqueness contracts remain open.
2. **System metadata — R18 resolved; HIGH R25.** UTC timestamptz is approved. Preserve platform creators/raw timestamp provenance; establish source-zone interpretation before offset-less imports.
3. **Direct references — R12 resolved; HIGH R15/R09.** Nullable Event creator FK and legacyCreatedBy are approved. Preserve disabled human identities and overlapping memberships; on-delete/other uniqueness choices remain open.
4. **Optional fields/defaults — R18 resolved.** Blank optional values become NULL, including User.accountStatus. Do not apply source defaults retrospectively or conflate false/zero with blank.
5. **Numbers/dates — R18 resolved; HIGH R19/R24/R25.** Target time/date/clock semantics are approved. Money precision, numeric bounds, calendar-month behavior and source-zone import interpretation remain open.
6. **Empty/unused concepts — MEDIUM R16/R26.** Preserve the four empty schemas. Available question/settings values establish only those samples, not answer/renewal logic or unseen JSON/BOOLEAN setting grammars.
7. **Workflow/status rules — HIGH R07/R08/R24; MEDIUM R06/R21/R23.** Actual statuses do not authorize new transitions or settle absent honorary/renewal/overdue/expiry branches.
8. **Snapshots — HIGH R13; MEDIUM R14/R20.** Retain discrepant names/phone values and matching type/fee/review snapshots independently. Agreement today does not justify deriving or dropping historical fields.
9. **Unpopulated fields — HIGH R25; MEDIUM R16/R26.** The field profile distinguishes all-blank columns from empty exports. Unseen values and platform behavior remain unknown; no absence-based drops.
10. **Files/access — HIGH R17/R22/R05.** Preserve URLs privately. Availability, ownership, byte-level MIME/size/checksums and access policy were not established by CSV inspection.
11. **References/polymorphism — HIGH R10; MEDIUM R11/R26.** Reference formats/uniqueness are checked; generation safety and settings conflict remain. Preserve two misdiscriminated audit targets and two blank notification targets without auto-repair.
12. **Scope/provenance — LOW R27.** Sibling path and unchanged source commit are verified. No deployment/export alignment attestation was supplied; phase-status documentation is not updated by this task.

The supplied export reconciliation is complete below. Canonical Prisma design may now begin using the approved representations. Before finalizing affected constraints or executing imports, address the remaining findings and approve any stricter constraints/business mappings; do not treat this audit as approval of the draft proposals. Retain restricted originals for transformations and unknown values. This draft selects **no destructive drops**, implements **no models**, and creates **no migrations**.

## Export Data Audit

Audit date: **2026-09-14**. Read-only inputs: sibling archive at the commit recorded above; every CSV recursively discovered under `../migration-private`; and `Base44_User_ID_Mapping.txt`. Source schemas/writers outrank exports for intended semantics; exports establish the actual supplied values. This audit changes only this document.

CSV parsing used UTF-8, a CSV-aware parser supporting quoted delimiters/newlines, strict row-width checks, exact legacy-ID comparisons and decimal/date parsing. All 18 files parse; none has a BOM or duplicate header. Counts exclude headers. No network access, file downloads, execution of archive code, imports or persisted audit scripts were used. Raw private IDs, names, contact details, reference numbers and URLs are deliberately not reproduced. Row numbers below are **1-based data-record ordinals**, not physical line numbers; multiline CSV records remain one record.

### Inventory and record counts

| CSV file | Entity | Records | Columns | Schema/header result |
| --- | --- | --- | --- | --- |
| `Announcement_export.csv` | Announcement | 4 | 18 | All declared properties + 6 system columns; no missing business column. |
| `ApplicationDocument_export.csv` | ApplicationDocument | 11 | 17 | All declared properties + 6 system columns; no missing business column. |
| `ApplicationReview_export.csv` | ApplicationReview | 8 | 13 | All declared properties + 6 system columns; no missing business column. |
| `AuditLog_export.csv` | AuditLog | 16 | 14 | All declared properties + 6 system columns; no missing business column. |
| `EligibilityAnswer_export.csv` | EligibilityAnswer | 0 | 0 | Zero bytes; no header; user-confirmed empty. Schema retained. |
| `EligibilityQuestion_export.csv` | EligibilityQuestion | 6 | 15 | All declared properties + 6 system columns; no missing business column. |
| `Event_export.csv` | Event | 1 | 42 | All declared properties + 6 system columns; no missing business column. |
| `EventRegistration_export.csv` | EventRegistration | 0 | 0 | Zero bytes; no header; user-confirmed empty. Schema retained. |
| `InformationRequest_export.csv` | InformationRequest | 0 | 0 | Zero bytes; no header; user-confirmed empty. Schema retained. |
| `MemberProfile_export.csv` | MemberProfile | 3 | 28 | All declared properties + 6 system columns; no missing business column. |
| `Membership_export.csv` | Membership | 2 | 19 | All declared properties + 6 system columns; no missing business column. |
| `MembershipApplication_export.csv` | MembershipApplication | 4 | 26 | All declared properties + 6 system columns; no missing business column. |
| `MembershipType_export.csv` | MembershipType | 4 | 16 | All declared properties + 6 system columns; no missing business column. |
| `MyAIS_Connect-users.csv` | User | 3 | 10 | All 5 custom fields; 5 platform columns; no id column. |
| `Notification_export.csv` | Notification | 8 | 15 | All declared properties + 6 system columns; no missing business column. |
| `Payment_export.csv` | Payment | 2 | 26 | All declared properties + 6 system columns; no missing business column. |
| `RenewalApplication_export.csv` | RenewalApplication | 0 | 0 | Zero bytes; no header; user-confirmed empty. Schema retained. |
| `SystemSetting_export.csv` | SystemSetting | 9 | 11 | All declared properties + 6 system columns; no missing business column. |

**Total: 18 CSVs, 81 records, 14 populated files, 4 zero-byte empty files.** There are 78 non-User records and 3 current users. EligibilityAnswer, EventRegistration, InformationRequest and RenewalApplication retain all **34 declared properties combined**, all enum members/defaults and all reference candidates despite having no header/data evidence.

All 78 exported entity IDs and the three IDs supplied for current users are nonempty and distinct, including across entity types. The three emails are distinct under both exact and case-folded comparison; this small export does not prove the platform's email uniqueness/case contract.

### Reconciled system/platform fields and mapping additions

All 13 populated non-User exports contain exactly these platform columns in addition to their declared properties: `id`, `created_date`, `updated_date`, `created_by_id`, `created_by`, `is_sample`. All six are nonblank in all 78 rows. These common rows supplement **each** of those entity mapping sections. Their presence on the four empty entities is unproven; retain the source/system checklist without inventing exported rows.

| Base44 field / scope | Observed Base44/export type | Required/default/enum contract | Reference | Proposed field | Proposed Prisma type | Nullable? | Action | Evidence / constraint |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| id / non-User | Platform string | Undeclared; no default/enum established | Legacy entity identity | legacyBase44Id | String | No on these imports; native rows may be null | RENAME | 78 present/unique. New independent primary key; never reuse legacy ID as PK. |
| id / User | Absent CSV; mapping string | Platform contract unknown | Current User identity | legacyBase44Id | String | No on mapped imports | TRANSFORM | Exact email join supplies all 3 IDs; retain mapping provenance privately. |
| created_date / all populated entities | Platform date string | Undeclared; platform-managed; no enum | None | legacyCreatedAt | DateTime @db.Timestamptz(3) | Yes in generic foundation; all 81 supplied rows populated | TRANSFORM | UTC canonical instant; raw input retained privately; offset-less source-zone interpretation before import (R25 HIGH). |
| updated_date / all populated entities | Platform date string | Undeclared; platform-managed; no enum | None | legacyUpdatedAt | DateTime @db.Timestamptz(3) | Yes in generic foundation; all 81 supplied rows populated | TRANSFORM | UTC canonical instant; raw input retained privately; offset-less source-zone interpretation before import (R25 HIGH). |
| created_by_id / non-User | Platform string | Undeclared; default/enum unknown | Creator principal; not always User | legacyCreatedById | String | Yes until full contract; all 78 populated | LEGACY_ONLY | 69 current-user matches, 8 known-deleted-user cells, 1 service-marked principal. No mandatory User FK. |
| created_by / non-User | Platform string; email-like attribution | Undeclared; default/enum unknown | Creator label/email snapshot; not FK | legacyCreatedBy | String | Yes until full contract; all 78 populated | LEGACY_ONLY | All 69 current-user joins match email exactly. Preserve restricted raw value; no identity by email inference. |
| is_sample / non-User | Platform boolean exported as text | Undeclared; default unknown; observed false only | None | legacyIsSample | Boolean | Yes until full contract; all 78 populated | LEGACY_ONLY | Parse exact lowercase false as false. Not a basis to drop records or assume default. |
| status / User | Platform string | Undeclared; default unknown; observed active/invited, not a declared enum | Separate from custom accountStatus | legacyPlatformStatus | String | Yes; all 3 supplied values populated | LEGACY_ONLY | active=2, invited=1. CSV outranks mapping's not-set claims. Do not uppercase into accountStatus or infer login permissions. |
| createdBy / Event | Schema string; exported system sentinel | Optional; no declared default/enum | Real User or platform principal | createdByUserId + legacyCreatedBy | String @db.Uuid FK + String provenance | Both nullable | TRANSFORM | Real User -> FK; platform/system/service -> NULL FK and exact legacyCreatedBy. R12 resolved; no authenticatable fake user. |

User `email` and `full_name` were already covered as undeclared fields; both are populated in all 3 rows. User `fullName` is written by source but absent from both schema and CSV. This is **not evidence that it was always empty or an alias**. User has no exported `created_by_id`, `created_by` or `is_sample`; do not synthesize them. No credential hashes, provider IDs, verification/deletion flags or full platform auth schema were supplied (R25 HIGH).

### User identity reconciliation and orphaned references

The mapping file's 3 current users match the CSV **3/3 by exact email**, with no unmatched CSV or mapping users. Labels U01–U03 follow current-user mapping order; O01–O02 follow its orphan headings. These labels carry no new identity/role decisions.

| User label | Export role | Export platform status | accountStatus | Result |
| --- | --- | --- | --- | --- |
| U01 | `associate_member` | `active` | Blank | Approved ASSOCIATE_MEMBER; legacyRole=associate_member |
| U02 | `user` | `invited` | Blank -> NULL | Approved APPLICANT; legacyRole=user |
| U03 | `admin` | `active` | Blank -> NULL | Approved SYSTEM_ADMINISTRATOR; legacyRole=admin |

All six mapped creation/update timestamps represent exactly the same instant as the User CSV: mapping uses millisecond Z notation; CSV uses six-digit fractional Z notation. Differences are formatting, not conflicting timestamps. All other overlapping fields agree except `status`: the mapping says not set for all 3, whereas CSV has active/invited. Preserve CSV status as its own platform field. The mapping's description of status as a schema field conflicts with User.jsonc; it is a platform field.

The mapping's nine claimed orphan records were checked by entity, exact record ID, field name and exact deleted-user ID: **9/9 agree**.

| Deleted identity | Required domain-reference records | Additional platform creator cells | Required treatment |
| --- | --- | --- | --- |
| O01 | MemberProfile row 2: userId (1) | MemberProfile row 2: created_by_id (1) | New disabled, non-login legacy identity; preserve original legacyBase44Id. |
| O02 | MembershipApplication row 4: userId; Notification rows 5, 8: userId; ApplicationDocument rows 8–11: userId; AuditLog row 16: actorUserId (8) | ApplicationDocument rows 8–11; AuditLog row 16; MembershipApplication row 4; Notification row 8: created_by_id (7) | Same mandated preservation; no invented contact details, login credentials or privileged roles. |

Thus **2 known deleted identities, 9 required domain reference cells in 9 records, plus 8 platform creator cells** refer to those identities. The 8 metadata cells overlap the same affected records; they are not 8 additional missing users. AGENTS.md resolves treatment: disabled non-login identities. Alternatives in the private mapping that suggest fake emails or nullable orphan FKs do not override it.

Separate exceptions, not additional confirmed deleted users:

- **Event row 1, createdBy=system:** literal sentinel; no match to any current/deleted user or current email; differs from platform created_by_id, which does resolve. The archived create function writes user.id. Approved mapping: createdByUserId=NULL and legacyCreatedBy=system (R12 resolved); origin need not be invented to preserve it.
- **AuditLog row 7, created_by_id:** a non-24-hex, service-marked principal string with service-marked created_by attribution; it matches no current/deleted user. Its actorUserId resolves to a current user and its Event target resolves. Source uses asServiceRole for event audit writes, which is consistent with a service principal, but the exact platform identity contract is unproven (R25 HIGH). Preserve raw metadata, do not replace actor or fabricate a human.

### All direct reference checks

“Resolved” means exact equality with a supplied target legacy ID; User resolution includes the private mapping. “Deleted” means one of the two confirmed missing-user identities, not a resolved exported User row. “Other” is the Event sentinel. Blank optional references remain blank; zero source rows prove no relationship enforcement.

| Source field | Target | Rows | Blank | Resolved | Deleted | Other |
| --- | --- | --- | --- | --- | --- | --- |
| `Announcement.createdByUserId` | User | 4 | 4 | 0 | 0 | 0 |
| `ApplicationDocument.applicationId` | MembershipApplication | 11 | 0 | 11 | 0 | 0 |
| `ApplicationDocument.userId` | User | 11 | 0 | 7 | 4 | 0 |
| `ApplicationDocument.verifiedByUserId` | User | 11 | 11 | 0 | 0 | 0 |
| `ApplicationReview.applicationId` | MembershipApplication | 8 | 0 | 8 | 0 | 0 |
| `ApplicationReview.reviewerUserId` | User | 8 | 0 | 8 | 0 | 0 |
| `AuditLog.actorUserId` | User | 16 | 0 | 15 | 1 | 0 |
| `EligibilityAnswer.applicationId` | MembershipApplication | 0 | 0 | 0 | 0 | 0 |
| `EligibilityAnswer.questionId` | EligibilityQuestion | 0 | 0 | 0 | 0 | 0 |
| `EligibilityAnswer.userId` | User | 0 | 0 | 0 | 0 | 0 |
| `Event.createdBy` | User | 1 | 0 | 0 | 0 | 1 |
| `EventRegistration.eventId` | Event | 0 | 0 | 0 | 0 | 0 |
| `EventRegistration.userId` | User | 0 | 0 | 0 | 0 | 0 |
| `InformationRequest.applicationId` | MembershipApplication | 0 | 0 | 0 | 0 | 0 |
| `InformationRequest.requestedByUserId` | User | 0 | 0 | 0 | 0 | 0 |
| `MemberProfile.userId` | User | 3 | 0 | 2 | 1 | 0 |
| `Membership.userId` | User | 2 | 0 | 2 | 0 | 0 |
| `Membership.applicationId` | MembershipApplication | 2 | 0 | 2 | 0 | 0 |
| `Membership.membershipTypeId` | MembershipType | 2 | 0 | 2 | 0 | 0 |
| `MembershipApplication.userId` | User | 4 | 0 | 3 | 1 | 0 |
| `MembershipApplication.requestedMembershipTypeId` | MembershipType | 4 | 0 | 4 | 0 | 0 |
| `MembershipApplication.recommendedMembershipTypeId` | MembershipType | 4 | 0 | 4 | 0 | 0 |
| `MembershipApplication.approvedMembershipTypeId` | MembershipType | 4 | 2 | 2 | 0 | 0 |
| `MembershipApplication.reviewedByUserId` | User | 4 | 1 | 3 | 0 | 0 |
| `MembershipApplication.approvedByUserId` | User | 4 | 2 | 2 | 0 | 0 |
| `Notification.userId` | User | 8 | 0 | 6 | 2 | 0 |
| `Payment.userId` | User | 2 | 0 | 2 | 0 | 0 |
| `Payment.applicationId` | MembershipApplication | 2 | 0 | 2 | 0 | 0 |
| `Payment.membershipId` | Membership | 2 | 2 | 0 | 0 | 0 |
| `Payment.verifiedByUserId` | User | 2 | 0 | 2 | 0 | 0 |
| `RenewalApplication.membershipId` | Membership | 0 | 0 | 0 | 0 | 0 |
| `RenewalApplication.userId` | User | 0 | 0 | 0 | 0 | 0 |
| `RenewalApplication.paymentId` | Payment | 0 | 0 | 0 | 0 | 0 |
| `SystemSetting.updatedByUserId` | User | 9 | 9 | 0 | 0 | 0 |

There are **no unexplained dangling non-User conventional target IDs**. All 11 document owners, both membership owners and both payment owners agree with the owner of the referenced application, including deleted-user ownership where applicable. All populated requested/recommended/approved type references resolve.

### Polymorphic references and multiplicity

- AuditLog: **14/16** targets resolve to the declared entity. Rows **2 and 9** are PAYMENT_SUBMITTED with entityType=Payment, but both IDs resolve to MembershipApplication instead; no Payment has either ID. This exactly matches `src/pages/member/PaymentPage.jsx:106-112`. Preserve the original discriminator and raw legacy ID. An application link may be added only through an approved, auditable correction (R10 HIGH).
- Notification: **6/8** related targets resolve to MembershipApplication. Rows **1 and 4** declare Membership but have blank relatedEntityId; they are missing optional targets, not dangling nonempty IDs. Do not backfill from current membership or user, particularly because the user has two memberships (R26 MEDIUM).
- MembershipApplication rows **1 and 2** belong to the same user and are both ACTIVE. Membership rows **1 and 2** belong to that same user, are both ACTIVE ASSOCIATE, have different application IDs/reference numbers and overlapping start/expiry periods. Two separate VERIFIED payments each reference one application. Preserve all records; no merge or unique(userId) for these entities (R09/R15 HIGH).
- Payment.membershipId is blank **2/2**, despite both referenced applications having a membership. Application linkage supports comparison, not automatic backfill or a new mandatory FK.
- No duplicate nonempty applicationNumber, membershipNumber, paymentReference, transactionReference, eventNumber, slug, MembershipType.code, EligibilityQuestion.code, SystemSetting.settingKey, MemberProfile.userId, Membership.applicationId or Payment.applicationId occurs. No duplicate (applicationId, documentType) occurs in 11 documents. Sample uniqueness is not approval for unique constraints or on-delete policy (R15 HIGH).

### Per-column data and nullability profile

The following covers **every exported column** and every declared field of the four empty entities. “Nonblank / blank” counts raw CSV cells, not SQL nulls. `N/A` means no header and no records, not a missing populated-schema column. Schema required/default/enum declarations remain in the entity tables; **no declared required field is blank on any existing record**. There are no whitespace-only cells and no literal null/undefined/none/NaN/n/a markers. Blank CSV cells cannot reconstruct the original JSON distinction; the approved target rule maps optional blanks/null/omissions to NULL (R18 resolved).

#### Announcement export columns

| Field | Source classification / type | Nonblank | Blank | Observed representation / limitation |
| --- | --- | --- | --- | --- |
| `summary` | string; optional | 4 | 0 | Text; 4 distinct nonblank values; private content omitted. |
| `createdByUserId` | string; optional | 0 | 4 | Column present, all values blank; not a drop/default instruction. |
| `createdByName` | string; optional | 4 | 0 | Text; 1 distinct nonblank values; private content omitted. |
| `attachmentUrl` | string; optional | 0 | 4 | Column present, all values blank; not a drop/default instruction. |
| `targetAudience` | string; optional | 4 | 0 | `ALL`: 2; `MEMBERS`: 2 |
| `coverImageUrl` | string; optional | 0 | 4 | Column present, all values blank; not a drop/default instruction. |
| `publishAt` | string (date-time); optional | 0 | 4 | None; fraction digits None; invalid 0. |
| `expiryAt` | string (date-time); optional | 0 | 4 | None; fraction digits None; invalid 0. |
| `title` | string; required | 4 | 0 | Text; 4 distinct nonblank values; private content omitted. |
| `category` | string; optional | 4 | 0 | `POLICY`: 1; `MEMBERSHIP`: 1; `EVENT`: 1; `GENERAL`: 1 |
| `content` | string; required | 4 | 0 | Text; 4 distinct nonblank values; private content omitted. |
| `status` | string; optional | 4 | 0 | `DRAFT`: 1; `PUBLISHED`: 3 |
| `id` | Undeclared platform field | 4 | 0 | Text; 4 distinct nonblank values; private content omitted. |
| `created_date` | Undeclared platform field | 4 | 0 | `ISO datetime NO OFFSET`: 4; fraction digits `6`: 4; invalid 0. |
| `updated_date` | Undeclared platform field | 4 | 0 | `ISO datetime NO OFFSET`: 4; fraction digits `6`: 4; invalid 0. |
| `created_by_id` | Undeclared platform field | 4 | 0 | Text; 1 distinct nonblank values; private content omitted. |
| `created_by` | Undeclared platform field | 4 | 0 | Text; 1 distinct nonblank values; private content omitted. |
| `is_sample` | Undeclared platform field | 4 | 0 | `false`: 4 |

#### ApplicationDocument export columns

| Field | Source classification / type | Nonblank | Blank | Observed representation / limitation |
| --- | --- | --- | --- | --- |
| `originalFileName` | string; optional | 11 | 0 | Text; 6 distinct nonblank values; private content omitted. |
| `documentType` | string; required | 11 | 0 | `PROFILE_PHOTO`: 3; `AIS_MEMBERSHIP_PROOF`: 3; `IDENTIFICATION`: 3; `ADDITIONAL_SUPPORTING_DOCUMENT`: 2 |
| `fileSize` | number; optional | 11 | 0 | Numeric text; valid 11; integer 11; range 2371–2648295; invalid 0. |
| `verificationStatus` | string; optional | 11 | 0 | `PENDING`: 11 |
| `verifiedAt` | string (date-time); optional | 0 | 11 | None; fraction digits None; invalid 0. |
| `fileUrl` | string; optional | 11 | 0 | Text; 11 distinct nonblank values; private content omitted. |
| `mimeType` | string; optional | 11 | 0 | Text; 1 distinct nonblank values; private content omitted. |
| `applicationId` | string; required | 11 | 0 | Text; 3 distinct nonblank values; private content omitted. |
| `userId` | string; required | 11 | 0 | Text; 2 distinct nonblank values; private content omitted. |
| `verifiedByUserId` | string; optional | 0 | 11 | Column present, all values blank; not a drop/default instruction. |
| `reviewerRemarks` | string; optional | 0 | 11 | Column present, all values blank; not a drop/default instruction. |
| `id` | Undeclared platform field | 11 | 0 | Text; 11 distinct nonblank values; private content omitted. |
| `created_date` | Undeclared platform field | 11 | 0 | `ISO datetime NO OFFSET`: 11; fraction digits `6`: 11; invalid 0. |
| `updated_date` | Undeclared platform field | 11 | 0 | `ISO datetime NO OFFSET`: 11; fraction digits `6`: 11; invalid 0. |
| `created_by_id` | Undeclared platform field | 11 | 0 | Text; 2 distinct nonblank values; private content omitted. |
| `created_by` | Undeclared platform field | 11 | 0 | Text; 1 distinct nonblank values; private content omitted. |
| `is_sample` | Undeclared platform field | 11 | 0 | `false`: 11 |

#### ApplicationReview export columns

| Field | Source classification / type | Nonblank | Blank | Observed representation / limitation |
| --- | --- | --- | --- | --- |
| `reviewerUserId` | string; required | 8 | 0 | Text; 1 distinct nonblank values; private content omitted. |
| `reviewerName` | string; optional | 8 | 0 | Text; 2 distinct nonblank values; private content omitted. |
| `decision` | string; required | 8 | 0 | `APPROVE`: 2; `RECOMMEND_APPROVAL`: 2; `START_REVIEW`: 3; `REJECT`: 1 |
| `newStatus` | string; optional | 8 | 0 | Text; 4 distinct nonblank values; private content omitted. |
| `applicationId` | string; required | 8 | 0 | Text; 3 distinct nonblank values; private content omitted. |
| `remarks` | string; optional | 3 | 5 | Text; 3 distinct nonblank values; private content omitted. |
| `previousStatus` | string; optional | 8 | 0 | Text; 3 distinct nonblank values; private content omitted. |
| `id` | Undeclared platform field | 8 | 0 | Text; 8 distinct nonblank values; private content omitted. |
| `created_date` | Undeclared platform field | 8 | 0 | `ISO datetime NO OFFSET`: 8; fraction digits `6`: 8; invalid 0. |
| `updated_date` | Undeclared platform field | 8 | 0 | `ISO datetime NO OFFSET`: 8; fraction digits `6`: 8; invalid 0. |
| `created_by_id` | Undeclared platform field | 8 | 0 | Text; 1 distinct nonblank values; private content omitted. |
| `created_by` | Undeclared platform field | 8 | 0 | Text; 1 distinct nonblank values; private content omitted. |
| `is_sample` | Undeclared platform field | 8 | 0 | `false`: 8 |

#### AuditLog export columns

| Field | Source classification / type | Nonblank | Blank | Observed representation / limitation |
| --- | --- | --- | --- | --- |
| `actorUserId` | string; required | 16 | 0 | Text; 3 distinct nonblank values; private content omitted. |
| `entityType` | string; optional | 16 | 0 | `Payment`: 4; `MembershipApplication`: 11; `Event`: 1 |
| `action` | string; required | 16 | 0 | `PAYMENT_VERIFY`: 2; `PAYMENT_SUBMITTED`: 2; `APPLICATION_APPROVE`: 2; `APPLICATION_RECOMMEND_APPROVAL`: 2; `APPLICATION_START_REVIEW`: 3; `APPLICATION_SUBMITTED`: 3; `EVENT_UPDATED`: 1; `APPLICATION_REJECT`: 1 |
| `description` | string; required | 16 | 0 | Text; 16 distinct nonblank values; private content omitted. |
| `actorName` | string; optional | 16 | 0 | Text; 4 distinct nonblank values; private content omitted. |
| `entityId` | string; optional | 16 | 0 | Text; 6 distinct nonblank values; private content omitted. |
| `newValues` | string; optional | 0 | 16 | No nonblank JSON payload to validate. |
| `oldValues` | string; optional | 0 | 16 | No nonblank JSON payload to validate. |
| `id` | Undeclared platform field | 16 | 0 | Text; 16 distinct nonblank values; private content omitted. |
| `created_date` | Undeclared platform field | 16 | 0 | `ISO datetime NO OFFSET`: 16; fraction digits `6`: 16; invalid 0. |
| `updated_date` | Undeclared platform field | 16 | 0 | `ISO datetime NO OFFSET`: 16; fraction digits `6`: 16; invalid 0. |
| `created_by_id` | Undeclared platform field | 16 | 0 | Text; 4 distinct nonblank values; private content omitted. |
| `created_by` | Undeclared platform field | 16 | 0 | Text; 3 distinct nonblank values; private content omitted. |
| `is_sample` | Undeclared platform field | 16 | 0 | `false`: 16 |

#### EligibilityAnswer export columns

| Field | Source classification / type | Nonblank | Blank | Observed representation / limitation |
| --- | --- | --- | --- | --- |
| `applicationId` | string; required | N/A | N/A | No header or records; preserve schema, required/default/enum rules and relationships. |
| `questionId` | string; required | N/A | N/A | No header or records; preserve schema, required/default/enum rules and relationships. |
| `userId` | string; required | N/A | N/A | No header or records; preserve schema, required/default/enum rules and relationships. |
| `questionCode` | string; optional | N/A | N/A | No header or records; preserve schema, required/default/enum rules and relationships. |
| `answerText` | string; optional | N/A | N/A | No header or records; preserve schema, required/default/enum rules and relationships. |
| `answerBoolean` | boolean; optional | N/A | N/A | No header or records; preserve schema, required/default/enum rules and relationships. |
| `answerOption` | string; optional | N/A | N/A | No header or records; preserve schema, required/default/enum rules and relationships. |

#### EligibilityQuestion export columns

| Field | Source classification / type | Nonblank | Blank | Observed representation / limitation |
| --- | --- | --- | --- | --- |
| `code` | string; required | 6 | 0 | Text; 6 distinct nonblank values; private content omitted. |
| `question` | string; required | 6 | 0 | Text; 6 distinct nonblank values; private content omitted. |
| `options` | string; optional | 1 | 5 | 1 valid JSON string-array; retain original text. |
| `displayOrder` | number; optional | 6 | 0 | Numeric text; valid 6; integer 6; range 1–6; invalid 0. |
| `ordinaryRule` | string; optional | 4 | 2 | Text; 2 distinct nonblank values; private content omitted. |
| `active` | boolean; optional | 6 | 0 | `true`: 6 |
| `inputType` | string; required | 6 | 0 | `BOOLEAN`: 3; `SELECT`: 1; `TEXT`: 1; `DATE`: 1 |
| `lifetimeRule` | string; optional | 4 | 2 | Text; 2 distinct nonblank values; private content omitted. |
| `required` | boolean; optional | 6 | 0 | `true`: 4; `false`: 2 |
| `id` | Undeclared platform field | 6 | 0 | Text; 6 distinct nonblank values; private content omitted. |
| `created_date` | Undeclared platform field | 6 | 0 | `ISO datetime NO OFFSET`: 6; fraction digits `6`: 6; invalid 0. |
| `updated_date` | Undeclared platform field | 6 | 0 | `ISO datetime NO OFFSET`: 6; fraction digits `6`: 6; invalid 0. |
| `created_by_id` | Undeclared platform field | 6 | 0 | Text; 1 distinct nonblank values; private content omitted. |
| `created_by` | Undeclared platform field | 6 | 0 | Text; 1 distinct nonblank values; private content omitted. |
| `is_sample` | Undeclared platform field | 6 | 0 | `false`: 6 |

#### Event export columns

| Field | Source classification / type | Nonblank | Blank | Observed representation / limitation |
| --- | --- | --- | --- | --- |
| `nonMemberFee` | number; optional | 1 | 0 | Numeric text; valid 1; integer 1; range 20–20; invalid 0. |
| `speakerName` | string; optional | 1 | 0 | Text; 1 distinct nonblank values; private content omitted. |
| `endDate` | string (date); optional | 1 | 0 | `YYYY-MM-DD`: 1; fraction digits None; invalid 0. |
| `description` | string; required | 1 | 0 | Text; 1 distinct nonblank values; private content omitted. |
| `title` | string; required | 1 | 0 | Text; 1 distinct nonblank values; private content omitted. |
| `registrationStart` | string (date); optional | 1 | 0 | `YYYY-MM-DD`: 1; fraction digits None; invalid 0. |
| `memberFee` | number; optional | 1 | 0 | Numeric text; valid 1; integer 1; range 10–10; invalid 0. |
| `limitedSeats` | boolean; optional | 1 | 0 | `true`: 1 |
| `capacity` | number; optional | 1 | 0 | Numeric text; valid 1; integer 1; range 100–100; invalid 0. |
| `createdAt` | string (date-time); optional | 1 | 0 | `ISO datetime Z`: 1; fraction digits `3`: 1; invalid 0. |
| `speakerTitle` | string; optional | 1 | 0 | Text; 1 distinct nonblank values; private content omitted. |
| `coverImage` | string; optional | 1 | 0 | Text; 1 distinct nonblank values; private content omitted. |
| `physicalAddress` | string; optional | 0 | 1 | Column present, all values blank; not a drop/default instruction. |
| `startTime` | string; required | 1 | 0 | HH:mm 1; other 0. |
| `currency` | string; optional | 1 | 0 | `MYR`: 1 |
| `slug` | string; optional | 1 | 0 | Text; 1 distinct nonblank values; private content omitted. |
| `registrationDeadline` | string (date); optional | 1 | 0 | `YYYY-MM-DD`: 1; fraction digits None; invalid 0. |
| `registrationUrl` | string; optional | 0 | 1 | Column present, all values blank; not a drop/default instruction. |
| `updatedAt` | string (date-time); optional | 1 | 0 | `ISO datetime Z`: 1; fraction digits `3`: 1; invalid 0. |
| `summary` | string; optional | 1 | 0 | Text; 1 distinct nonblank values; private content omitted. |
| `venueType` | string; required | 1 | 0 | `ONLINE`: 1 |
| `eventNumber` | string; optional | 1 | 0 | Text; 1 distinct nonblank values; private content omitted. |
| `publishedAt` | string (date-time); optional | 1 | 0 | `ISO datetime Z`: 1; fraction digits `3`: 1; invalid 0. |
| `cancellationReason` | string; optional | 0 | 1 | Column present, all values blank; not a drop/default instruction. |
| `cancelledAt` | string (date-time); optional | 0 | 1 | None; fraction digits None; invalid 0. |
| `paymentInstructions` | string; optional | 1 | 0 | Text; 1 distinct nonblank values; private content omitted. |
| `eventType` | string; optional | 1 | 0 | `Webinar`: 1 |
| `venueName` | string; optional | 1 | 0 | Text; 1 distinct nonblank values; private content omitted. |
| `targetAudience` | string; optional | 1 | 0 | `MEMBERS_AND_NON_MEMBERS`: 1 |
| `placeholderImageNotice` | boolean; optional | 1 | 0 | `true`: 1 |
| `createdBy` | string; optional | 1 | 0 | Text; 1 distinct nonblank values; private content omitted. |
| `onlineMeetingUrl` | string; optional | 1 | 0 | Text; 1 distinct nonblank values; private content omitted. |
| `endTime` | string; optional | 1 | 0 | HH:mm 1; other 0. |
| `category` | string; required | 1 | 0 | `Seminars and Webinars`: 1 |
| `startDate` | string (date); required | 1 | 0 | `YYYY-MM-DD`: 1; fraction digits None; invalid 0. |
| `status` | string; optional | 1 | 0 | `PUBLISHED`: 1 |
| `id` | Undeclared platform field | 1 | 0 | Text; 1 distinct nonblank values; private content omitted. |
| `created_date` | Undeclared platform field | 1 | 0 | `ISO datetime NO OFFSET`: 1; fraction digits `6`: 1; invalid 0. |
| `updated_date` | Undeclared platform field | 1 | 0 | `ISO datetime NO OFFSET`: 1; fraction digits `6`: 1; invalid 0. |
| `created_by_id` | Undeclared platform field | 1 | 0 | Text; 1 distinct nonblank values; private content omitted. |
| `created_by` | Undeclared platform field | 1 | 0 | Text; 1 distinct nonblank values; private content omitted. |
| `is_sample` | Undeclared platform field | 1 | 0 | `false`: 1 |

#### EventRegistration export columns

| Field | Source classification / type | Nonblank | Blank | Observed representation / limitation |
| --- | --- | --- | --- | --- |
| `eventId` | string; required | N/A | N/A | No header or records; preserve schema, required/default/enum rules and relationships. |
| `userId` | string; required | N/A | N/A | No header or records; preserve schema, required/default/enum rules and relationships. |
| `attendeeName` | string; optional | N/A | N/A | No header or records; preserve schema, required/default/enum rules and relationships. |
| `attendeeEmail` | string; optional | N/A | N/A | No header or records; preserve schema, required/default/enum rules and relationships. |
| `status` | string; optional | N/A | N/A | No header or records; preserve schema, required/default/enum rules and relationships. |
| `paymentStatus` | string; optional | N/A | N/A | No header or records; preserve schema, required/default/enum rules and relationships. |
| `registeredAt` | string (date-time); optional | N/A | N/A | No header or records; preserve schema, required/default/enum rules and relationships. |
| `notes` | string; optional | N/A | N/A | No header or records; preserve schema, required/default/enum rules and relationships. |

#### InformationRequest export columns

| Field | Source classification / type | Nonblank | Blank | Observed representation / limitation |
| --- | --- | --- | --- | --- |
| `applicationId` | string; required | N/A | N/A | No header or records; preserve schema, required/default/enum rules and relationships. |
| `requestedByUserId` | string; required | N/A | N/A | No header or records; preserve schema, required/default/enum rules and relationships. |
| `requestedByName` | string; optional | N/A | N/A | No header or records; preserve schema, required/default/enum rules and relationships. |
| `message` | string; required | N/A | N/A | No header or records; preserve schema, required/default/enum rules and relationships. |
| `dueDate` | string (date); optional | N/A | N/A | No header or records; preserve schema, required/default/enum rules and relationships. |
| `status` | string; optional | N/A | N/A | No header or records; preserve schema, required/default/enum rules and relationships. |
| `applicantResponse` | string; optional | N/A | N/A | No header or records; preserve schema, required/default/enum rules and relationships. |
| `responseAttachmentUrl` | string; optional | N/A | N/A | No header or records; preserve schema, required/default/enum rules and relationships. |
| `respondedAt` | string (date-time); optional | N/A | N/A | No header or records; preserve schema, required/default/enum rules and relationships. |

#### MemberProfile export columns

| Field | Source classification / type | Nonblank | Blank | Observed representation / limitation |
| --- | --- | --- | --- | --- |
| `areaOfExpertise` | string; optional | 1 | 2 | Text; 1 distinct nonblank values; private content omitted. |
| `country` | string; optional | 1 | 2 | Text; 1 distinct nonblank values; private content omitted. |
| `occupation` | string; optional | 1 | 2 | Text; 1 distinct nonblank values; private content omitted. |
| `aisMembershipExpiry` | string (date); optional | 0 | 3 | None; fraction digits None; invalid 0. |
| `gender` | string; optional | 1 | 2 | `MALE`: 1 |
| `city` | string; optional | 1 | 2 | Text; 1 distinct nonblank values; private content omitted. |
| `postcode` | string; optional | 1 | 2 | Text; 1 distinct nonblank values; private content omitted. |
| `fullName` | string; optional | 1 | 2 | Text; 1 distinct nonblank values; private content omitted. |
| `profileCompletionPercentage` | number; optional | 3 | 0 | Numeric text; valid 3; integer 3; range 0–100; invalid 0. |
| `identificationType` | string; optional | 1 | 2 | `PASSPORT`: 1 |
| `dateOfBirth` | string (date); optional | 1 | 2 | `YYYY-MM-DD`: 1; fraction digits None; invalid 0. |
| `userId` | string; required | 3 | 0 | Text; 3 distinct nonblank values; private content omitted. |
| `aisMembershipNumber` | string; optional | 0 | 3 | Column present, all values blank; not a drop/default instruction. |
| `institution` | string; optional | 1 | 2 | Text; 1 distinct nonblank values; private content omitted. |
| `phoneNumber` | string; optional | 1 | 2 | Text; 1 distinct nonblank values; private content omitted. |
| `nationality` | string; optional | 1 | 2 | Text; 1 distinct nonblank values; private content omitted. |
| `aisMember` | boolean; optional | 3 | 0 | `false`: 3 |
| `identificationNumber` | string; optional | 1 | 2 | Text; 1 distinct nonblank values; private content omitted. |
| `addressLine1` | string; optional | 1 | 2 | Text; 1 distinct nonblank values; private content omitted. |
| `addressLine2` | string; optional | 0 | 3 | Column present, all values blank; not a drop/default instruction. |
| `state` | string; optional | 1 | 2 | Text; 1 distinct nonblank values; private content omitted. |
| `department` | string; optional | 1 | 2 | Text; 1 distinct nonblank values; private content omitted. |
| `id` | Undeclared platform field | 3 | 0 | Text; 3 distinct nonblank values; private content omitted. |
| `created_date` | Undeclared platform field | 3 | 0 | `ISO datetime NO OFFSET`: 3; fraction digits `6`: 3; invalid 0. |
| `updated_date` | Undeclared platform field | 3 | 0 | `ISO datetime NO OFFSET`: 3; fraction digits `6`: 3; invalid 0. |
| `created_by_id` | Undeclared platform field | 3 | 0 | Text; 3 distinct nonblank values; private content omitted. |
| `created_by` | Undeclared platform field | 3 | 0 | Text; 2 distinct nonblank values; private content omitted. |
| `is_sample` | Undeclared platform field | 3 | 0 | `false`: 3 |

#### Membership export columns

| Field | Source classification / type | Nonblank | Blank | Observed representation / limitation |
| --- | --- | --- | --- | --- |
| `membershipTypeCode` | string; optional | 2 | 0 | Text; 1 distinct nonblank values; private content omitted. |
| `terminatedAt` | string (date-time); optional | 0 | 2 | None; fraction digits None; invalid 0. |
| `activatedAt` | string (date-time); optional | 2 | 0 | `ISO datetime Z`: 2; fraction digits `3`: 2; invalid 0. |
| `suspendedAt` | string (date-time); optional | 0 | 2 | None; fraction digits None; invalid 0. |
| `userId` | string; required | 2 | 0 | Text; 1 distinct nonblank values; private content omitted. |
| `membershipTypeId` | string; required | 2 | 0 | Text; 1 distinct nonblank values; private content omitted. |
| `membershipNumber` | string; optional | 2 | 0 | Text; 2 distinct nonblank values; private content omitted. |
| `expiryDate` | string (date); optional | 2 | 0 | `YYYY-MM-DD`: 2; fraction digits None; invalid 0. |
| `votingEligible` | boolean; optional | 2 | 0 | `false`: 2 |
| `membershipTypeName` | string; optional | 2 | 0 | Text; 1 distinct nonblank values; private content omitted. |
| `applicationId` | string; optional | 2 | 0 | Text; 2 distinct nonblank values; private content omitted. |
| `startDate` | string (date); optional | 2 | 0 | `YYYY-MM-DD`: 2; fraction digits None; invalid 0. |
| `status` | string; optional | 2 | 0 | `ACTIVE`: 2 |
| `id` | Undeclared platform field | 2 | 0 | Text; 2 distinct nonblank values; private content omitted. |
| `created_date` | Undeclared platform field | 2 | 0 | `ISO datetime NO OFFSET`: 2; fraction digits `6`: 2; invalid 0. |
| `updated_date` | Undeclared platform field | 2 | 0 | `ISO datetime NO OFFSET`: 2; fraction digits `6`: 2; invalid 0. |
| `created_by_id` | Undeclared platform field | 2 | 0 | Text; 1 distinct nonblank values; private content omitted. |
| `created_by` | Undeclared platform field | 2 | 0 | Text; 1 distinct nonblank values; private content omitted. |
| `is_sample` | Undeclared platform field | 2 | 0 | `false`: 2 |

#### MembershipApplication export columns

| Field | Source classification / type | Nonblank | Blank | Observed representation / limitation |
| --- | --- | --- | --- | --- |
| `recommendedMembershipTypeId` | string; optional | 4 | 0 | Text; 1 distinct nonblank values; private content omitted. |
| `applicationNumber` | string; optional | 3 | 1 | Text; 3 distinct nonblank values; private content omitted. |
| `reviewedAt` | string (date-time); optional | 3 | 1 | `ISO datetime Z`: 3; fraction digits `3`: 3; invalid 0. |
| `eligibilityExplanation` | string; optional | 4 | 0 | Text; 4 distinct nonblank values; private content omitted. |
| `approvedAt` | string (date-time); optional | 2 | 2 | `ISO datetime Z`: 2; fraction digits `3`: 2; invalid 0. |
| `userId` | string; required | 4 | 0 | Text; 3 distinct nonblank values; private content omitted. |
| `approvedByUserId` | string; optional | 2 | 2 | Text; 1 distinct nonblank values; private content omitted. |
| `requestedMembershipTypeId` | string; optional | 4 | 0 | Text; 2 distinct nonblank values; private content omitted. |
| `currentStep` | number; optional | 4 | 0 | Numeric text; valid 4; integer 4; range 2–4; invalid 0. |
| `approvedMembershipTypeCode` | string; optional | 2 | 2 | Text; 1 distinct nonblank values; private content omitted. |
| `approvedMembershipTypeId` | string; optional | 2 | 2 | Text; 1 distinct nonblank values; private content omitted. |
| `recommendedMembershipTypeCode` | string; optional | 4 | 0 | Text; 1 distinct nonblank values; private content omitted. |
| `rejectedAt` | string (date-time); optional | 1 | 3 | `ISO datetime Z`: 1; fraction digits `3`: 1; invalid 0. |
| `requestedMembershipTypeCode` | string; optional | 4 | 0 | Text; 2 distinct nonblank values; private content omitted. |
| `eligibilityScore` | number; optional | 4 | 0 | Numeric text; valid 4; integer 4; range 0–80; invalid 0. |
| `submittedAt` | string (date-time); optional | 3 | 1 | `ISO datetime Z`: 3; fraction digits `3`: 3; invalid 0. |
| `rejectionReason` | string; optional | 1 | 3 | Text; 1 distinct nonblank values; private content omitted. |
| `reviewedByUserId` | string; optional | 3 | 1 | Text; 1 distinct nonblank values; private content omitted. |
| `status` | string; optional | 4 | 0 | `ACTIVE`: 2; `DRAFT`: 1; `REJECTED`: 1 |
| `latestReviewerRemarks` | string; optional | 2 | 2 | Text; 2 distinct nonblank values; private content omitted. |
| `id` | Undeclared platform field | 4 | 0 | Text; 4 distinct nonblank values; private content omitted. |
| `created_date` | Undeclared platform field | 4 | 0 | `ISO datetime NO OFFSET`: 4; fraction digits `0`: 1; `6`: 3; invalid 0. |
| `updated_date` | Undeclared platform field | 4 | 0 | `ISO datetime NO OFFSET`: 4; fraction digits `6`: 4; invalid 0. |
| `created_by_id` | Undeclared platform field | 4 | 0 | Text; 3 distinct nonblank values; private content omitted. |
| `created_by` | Undeclared platform field | 4 | 0 | Text; 2 distinct nonblank values; private content omitted. |
| `is_sample` | Undeclared platform field | 4 | 0 | `false`: 4 |

#### MembershipType export columns

| Field | Source classification / type | Nonblank | Blank | Observed representation / limitation |
| --- | --- | --- | --- | --- |
| `code` | string; required | 4 | 0 | `ORDINARY`: 1; `HONORARY`: 1; `ASSOCIATE`: 1; `LIFETIME`: 1 |
| `membershipFee` | number; optional | 4 | 0 | Numeric text; valid 4; integer 4; range 0–300; invalid 0. |
| `votingRights` | boolean; optional | 4 | 0 | `true`: 2; `false`: 2 |
| `entranceFee` | number; optional | 4 | 0 | Numeric text; valid 4; integer 4; range 0–30; invalid 0. |
| `validityMonths` | number; optional | 4 | 0 | Numeric text; valid 4; integer 4; range 0–12; invalid 0. |
| `renewable` | boolean; optional | 4 | 0 | `true`: 2; `false`: 2 |
| `applicantSelectable` | boolean; optional | 4 | 0 | `true`: 3; `false`: 1 |
| `name` | string; required | 4 | 0 | Text; 4 distinct nonblank values; private content omitted. |
| `description` | string; optional | 4 | 0 | Text; 4 distinct nonblank values; private content omitted. |
| `active` | boolean; optional | 4 | 0 | `true`: 4 |
| `id` | Undeclared platform field | 4 | 0 | Text; 4 distinct nonblank values; private content omitted. |
| `created_date` | Undeclared platform field | 4 | 0 | `ISO datetime NO OFFSET`: 4; fraction digits `6`: 4; invalid 0. |
| `updated_date` | Undeclared platform field | 4 | 0 | `ISO datetime NO OFFSET`: 4; fraction digits `6`: 4; invalid 0. |
| `created_by_id` | Undeclared platform field | 4 | 0 | Text; 1 distinct nonblank values; private content omitted. |
| `created_by` | Undeclared platform field | 4 | 0 | Text; 1 distinct nonblank values; private content omitted. |
| `is_sample` | Undeclared platform field | 4 | 0 | `false`: 4 |

#### Notification export columns

| Field | Source classification / type | Nonblank | Blank | Observed representation / limitation |
| --- | --- | --- | --- | --- |
| `relatedEntityId` | string; optional | 6 | 2 | Text; 3 distinct nonblank values; private content omitted. |
| `actionUrl` | string; optional | 8 | 0 | Text; 3 distinct nonblank values; private content omitted. |
| `isRead` | boolean; optional | 8 | 0 | `false`: 5; `true`: 3 |
| `relatedEntityType` | string; optional | 8 | 0 | `Membership`: 2; `MembershipApplication`: 6 |
| `title` | string; required | 8 | 0 | Text; 4 distinct nonblank values; private content omitted. |
| `message` | string; required | 8 | 0 | Text; 7 distinct nonblank values; private content omitted. |
| `type` | string; optional | 8 | 0 | `MEMBERSHIP`: 2; `APPLICATION`: 6 |
| `readAt` | string (date-time); optional | 3 | 5 | `ISO datetime Z`: 3; fraction digits `3`: 3; invalid 0. |
| `userId` | string; required | 8 | 0 | Text; 2 distinct nonblank values; private content omitted. |
| `id` | Undeclared platform field | 8 | 0 | Text; 8 distinct nonblank values; private content omitted. |
| `created_date` | Undeclared platform field | 8 | 0 | `ISO datetime NO OFFSET`: 8; fraction digits `6`: 8; invalid 0. |
| `updated_date` | Undeclared platform field | 8 | 0 | `ISO datetime NO OFFSET`: 8; fraction digits `6`: 8; invalid 0. |
| `created_by_id` | Undeclared platform field | 8 | 0 | Text; 3 distinct nonblank values; private content omitted. |
| `created_by` | Undeclared platform field | 8 | 0 | Text; 2 distinct nonblank values; private content omitted. |
| `is_sample` | Undeclared platform field | 8 | 0 | `false`: 8 |

#### Payment export columns

| Field | Source classification / type | Nonblank | Blank | Observed representation / limitation |
| --- | --- | --- | --- | --- |
| `transactionReference` | string; optional | 2 | 0 | Text; 2 distinct nonblank values; private content omitted. |
| `paymentReference` | string; optional | 2 | 0 | Text; 2 distinct nonblank values; private content omitted. |
| `verifiedAt` | string (date-time); optional | 2 | 0 | `ISO datetime Z`: 2; fraction digits `3`: 2; invalid 0. |
| `bankName` | string; optional | 2 | 0 | Text; 2 distinct nonblank values; private content omitted. |
| `membershipId` | string; optional | 0 | 2 | Column present, all values blank; not a drop/default instruction. |
| `userId` | string; required | 2 | 0 | Text; 1 distinct nonblank values; private content omitted. |
| `verifiedByUserId` | string; optional | 2 | 0 | Text; 1 distinct nonblank values; private content omitted. |
| `paymentType` | string; required | 2 | 0 | `ENTRANCE_AND_ANNUAL`: 2 |
| `totalAmount` | number; required | 2 | 0 | Numeric text; valid 2; integer 2; range 60–60; invalid 0. |
| `membershipFee` | number; optional | 2 | 0 | Numeric text; valid 2; integer 2; range 40–40; invalid 0. |
| `entranceFee` | number; optional | 2 | 0 | Numeric text; valid 2; integer 2; range 20–20; invalid 0. |
| `treasurerRemarks` | string; optional | 0 | 2 | Column present, all values blank; not a drop/default instruction. |
| `paymentMethod` | string; optional | 2 | 0 | `ONLINE_BANKING`: 1; `BANK_TRANSFER`: 1 |
| `paidAt` | string (date-time); optional | 2 | 0 | `ISO datetime Z`: 2; fraction digits `3`: 2; invalid 0. |
| `currency` | string; optional | 2 | 0 | `MYR`: 2 |
| `applicationId` | string; optional | 2 | 0 | Text; 2 distinct nonblank values; private content omitted. |
| `receiptUrl` | string; optional | 2 | 0 | Text; 2 distinct nonblank values; private content omitted. |
| `submittedAt` | string (date-time); optional | 2 | 0 | `ISO datetime Z`: 2; fraction digits `3`: 2; invalid 0. |
| `rejectionReason` | string; optional | 0 | 2 | Column present, all values blank; not a drop/default instruction. |
| `status` | string; optional | 2 | 0 | `VERIFIED`: 2 |
| `id` | Undeclared platform field | 2 | 0 | Text; 2 distinct nonblank values; private content omitted. |
| `created_date` | Undeclared platform field | 2 | 0 | `ISO datetime NO OFFSET`: 2; fraction digits `6`: 2; invalid 0. |
| `updated_date` | Undeclared platform field | 2 | 0 | `ISO datetime NO OFFSET`: 2; fraction digits `6`: 2; invalid 0. |
| `created_by_id` | Undeclared platform field | 2 | 0 | Text; 1 distinct nonblank values; private content omitted. |
| `created_by` | Undeclared platform field | 2 | 0 | Text; 1 distinct nonblank values; private content omitted. |
| `is_sample` | Undeclared platform field | 2 | 0 | `false`: 2 |

#### RenewalApplication export columns

| Field | Source classification / type | Nonblank | Blank | Observed representation / limitation |
| --- | --- | --- | --- | --- |
| `renewalNumber` | string; optional | N/A | N/A | No header or records; preserve schema, required/default/enum rules and relationships. |
| `membershipId` | string; required | N/A | N/A | No header or records; preserve schema, required/default/enum rules and relationships. |
| `userId` | string; required | N/A | N/A | No header or records; preserve schema, required/default/enum rules and relationships. |
| `previousExpiryDate` | string (date); optional | N/A | N/A | No header or records; preserve schema, required/default/enum rules and relationships. |
| `newExpiryDate` | string (date); optional | N/A | N/A | No header or records; preserve schema, required/default/enum rules and relationships. |
| `fee` | number; optional | N/A | N/A | No header or records; preserve schema, required/default/enum rules and relationships. |
| `status` | string; optional | N/A | N/A | No header or records; preserve schema, required/default/enum rules and relationships. |
| `submittedAt` | string (date-time); optional | N/A | N/A | No header or records; preserve schema, required/default/enum rules and relationships. |
| `paymentId` | string; optional | N/A | N/A | No header or records; preserve schema, required/default/enum rules and relationships. |
| `approvedAt` | string (date-time); optional | N/A | N/A | No header or records; preserve schema, required/default/enum rules and relationships. |

#### SystemSetting export columns

| Field | Source classification / type | Nonblank | Blank | Observed representation / limitation |
| --- | --- | --- | --- | --- |
| `description` | string; optional | 9 | 0 | Text; 9 distinct nonblank values; private content omitted. |
| `updatedByUserId` | string; optional | 0 | 9 | Column present, all values blank; not a drop/default instruction. |
| `settingKey` | string; required | 9 | 0 | Text; 9 distinct nonblank values; private content omitted. |
| `settingType` | string; optional | 9 | 0 | `STRING`: 7; `NUMBER`: 2 |
| `settingValue` | string; required | 9 | 0 | Text; 9 distinct nonblank values; private content omitted. |
| `id` | Undeclared platform field | 9 | 0 | Text; 9 distinct nonblank values; private content omitted. |
| `created_date` | Undeclared platform field | 9 | 0 | `ISO datetime NO OFFSET`: 9; fraction digits `6`: 9; invalid 0. |
| `updated_date` | Undeclared platform field | 9 | 0 | `ISO datetime NO OFFSET`: 9; fraction digits `6`: 9; invalid 0. |
| `created_by_id` | Undeclared platform field | 9 | 0 | Text; 1 distinct nonblank values; private content omitted. |
| `created_by` | Undeclared platform field | 9 | 0 | Text; 1 distinct nonblank values; private content omitted. |
| `is_sample` | Undeclared platform field | 9 | 0 | `false`: 9 |

#### User export columns

| Field | Source classification / type | Nonblank | Blank | Observed representation / limitation |
| --- | --- | --- | --- | --- |
| `email` | Undeclared platform field | 3 | 0 | Text; 3 distinct nonblank values; private content omitted. |
| `full_name` | Undeclared platform field | 3 | 0 | Text; 3 distinct nonblank values; private content omitted. |
| `role` | string; optional | 3 | 0 | `associate_member`: 1; `user`: 1; `admin`: 1 |
| `status` | Undeclared platform field | 3 | 0 | `active`: 2; `invited`: 1 |
| `created_date` | Undeclared platform field | 3 | 0 | `ISO datetime Z`: 3; fraction digits `6`: 3; invalid 0. |
| `updated_date` | Undeclared platform field | 3 | 0 | `ISO datetime Z`: 3; fraction digits `6`: 3; invalid 0. |
| `phoneNumber` | string; optional | 0 | 3 | Column present, all values blank; not a drop/default instruction. |
| `photoUrl` | string; optional | 1 | 2 | Text; 1 distinct nonblank values; private content omitted. |
| `accountStatus` | string; optional | 0 | 3 | None |
| `lastLoginAt` | string (date-time); optional | 0 | 3 | None; fraction digits None; invalid 0. |

### All declared enums: actual versus unobserved values

All **26 source field-level enums** remain documented in full, including empty entities and values never observed. Canonical UserRole uses the explicitly approved normalization/mapping. The only observed custom-schema enum violations are User.role=`admin` and `user` (one each); their approved canonical mappings are SYSTEM_ADMINISTRATOR and APPLICANT respectively. The source violations remain audit evidence, not unresolved target-role decisions. Absence from this small export does not justify deleting enum members.

| Entity.field | Observed nonblank values : count | Declared values not observed | Out-of-schema values |
| --- | --- | --- | --- |
| `Announcement.category` | `POLICY`: 1; `MEMBERSHIP`: 1; `EVENT`: 1; `GENERAL`: 1 | `TRAINING` | None |
| `Announcement.targetAudience` | `ALL`: 2; `MEMBERS`: 2 | `APPLICANTS`, `COMMITTEE` | None |
| `Announcement.status` | `DRAFT`: 1; `PUBLISHED`: 3 | `SCHEDULED`, `ARCHIVED` | None |
| `ApplicationDocument.documentType` | `PROFILE_PHOTO`: 3; `AIS_MEMBERSHIP_PROOF`: 3; `IDENTIFICATION`: 3; `ADDITIONAL_SUPPORTING_DOCUMENT`: 2 | `PAYMENT_RECEIPT`, `REQUESTED_INFORMATION` | None |
| `ApplicationDocument.verificationStatus` | `PENDING`: 11 | `VERIFIED`, `INVALID`, `RESUBMISSION_REQUIRED` | None |
| `ApplicationReview.decision` | `APPROVE`: 2; `RECOMMEND_APPROVAL`: 2; `START_REVIEW`: 3; `REJECT`: 1 | `REQUEST_INFORMATION`, `RETURN_FOR_CORRECTION` | None |
| `EligibilityQuestion.inputType` | `BOOLEAN`: 3; `SELECT`: 1; `TEXT`: 1; `DATE`: 1 | None | None |
| `Event.category` | `Seminars and Webinars`: 1 | `Workshops`, `Meetings`, `MyDCIS`, `Conferences`, `Other` | None |
| `Event.venueType` | `ONLINE`: 1 | `PHYSICAL`, `HYBRID` | None |
| `Event.status` | `PUBLISHED`: 1 | `DRAFT`, `REGISTRATION_CLOSED`, `CANCELLED`, `COMPLETED`, `ARCHIVED` | None |
| `Event.targetAudience` | `MEMBERS_AND_NON_MEMBERS`: 1 | `MEMBERS`, `NON_MEMBERS` | None |
| `EventRegistration.status` | No rows/header | `REGISTERED`, `CANCELLED`, `ATTENDED`, `NO_SHOW` | Not testable |
| `EventRegistration.paymentStatus` | No rows/header | `NOT_REQUIRED`, `PENDING`, `PAID`, `FAILED` | Not testable |
| `InformationRequest.status` | No rows/header | `OPEN`, `RESPONDED`, `RESOLVED`, `OVERDUE` | Not testable |
| `MemberProfile.identificationType` | `PASSPORT`: 1 | `NRIC`, `OTHER` | None |
| `MemberProfile.gender` | `MALE`: 1 | `FEMALE`, `OTHER` | None |
| `Membership.status` | `ACTIVE`: 2 | `PENDING`, `EXPIRED`, `SUSPENDED`, `TERMINATED` | None |
| `MembershipApplication.status` | `ACTIVE`: 2; `DRAFT`: 1; `REJECTED`: 1 | `SUBMITTED`, `UNDER_REVIEW`, `ADDITIONAL_INFORMATION_REQUIRED`, `ELIGIBLE`, `RECOMMENDED_FOR_APPROVAL`, `APPROVED_PENDING_PAYMENT`, `PAYMENT_SUBMITTED`, `PAYMENT_UNDER_VERIFICATION`, `EXPIRED`, `SUSPENDED`, `TERMINATED` | None |
| `MembershipType.code` | `ORDINARY`: 1; `HONORARY`: 1; `ASSOCIATE`: 1; `LIFETIME`: 1 | None | None |
| `Notification.type` | `MEMBERSHIP`: 2; `APPLICATION`: 6 | `PAYMENT`, `ANNOUNCEMENT`, `SYSTEM` | None |
| `Payment.paymentType` | `ENTRANCE_AND_ANNUAL`: 2 | `ENTRANCE_AND_LIFETIME`, `RENEWAL`, `OTHER` | None |
| `Payment.status` | `VERIFIED`: 2 | `NOT_SUBMITTED`, `SUBMITTED`, `UNDER_VERIFICATION`, `REJECTED` | None |
| `RenewalApplication.status` | No rows/header | `PENDING`, `PAYMENT_SUBMITTED`, `APPROVED`, `REJECTED` | Not testable |
| `SystemSetting.settingType` | `STRING`: 7; `NUMBER`: 2 | `BOOLEAN`, `JSON` | None |
| `User.role` | `associate_member`: 1; `user`: 1; `admin`: 1 | `applicant`, `ordinary_member`, `lifetime_member`, `honorary_member`, `president`, `deputy_president`, `secretary`, `assistant_secretary`, `treasurer`, `committee_member`, `system_administrator` | `user`: 1; `admin`: 1 |
| `User.accountStatus` | None | `ACTIVE`, `DISABLED`, `SUSPENDED` | None |

Free strings remain free strings even when the sample resembles an enum:

| Field | Observed values : count |
| --- | --- |
| `AuditLog.action` | `PAYMENT_VERIFY`: 2; `PAYMENT_SUBMITTED`: 2; `APPLICATION_APPROVE`: 2; `APPLICATION_RECOMMEND_APPROVAL`: 2; `APPLICATION_START_REVIEW`: 3; `APPLICATION_SUBMITTED`: 3; `EVENT_UPDATED`: 1; `APPLICATION_REJECT`: 1 |
| `AuditLog.entityType` | `Payment`: 4; `MembershipApplication`: 11; `Event`: 1 |
| `Notification.relatedEntityType` | `Membership`: 2; `MembershipApplication`: 6 |
| `ApplicationReview.previousStatus` | `RECOMMENDED_FOR_APPROVAL`: 2; `UNDER_REVIEW`: 3; `SUBMITTED`: 3 |
| `ApplicationReview.newStatus` | `APPROVED_PENDING_PAYMENT`: 2; `RECOMMENDED_FOR_APPROVAL`: 2; `UNDER_REVIEW`: 3; `REJECTED`: 1 |
| `Payment.paymentMethod` | `ONLINE_BANKING`: 1; `BANK_TRANSFER`: 1 |
| `Payment.currency` | `MYR`: 2 |
| `Event.eventType` | `Webinar`: 1 |
| `Event.currency` | `MYR`: 1 |
| `User.status` | `active`: 2; `invited`: 1 |

### Date, boolean, numeric and serialized-value verification

- **System dates:** 156 non-User created_date/updated_date cells are valid ISO datetime syntax **without timezone offset**. Fraction digits: six in 155 cells, zero in 1 application creation cell. All are millisecond-aligned; no observed value would lose numerical fractional precision at millisecond resolution. The six User system cells use Z and six fractional digits, also millisecond-aligned. Do not confuse six-digit syntax with measured sub-millisecond precision. Canonical UTC timestamptz is approved (R18 resolved). Preserve raw provenance and establish source-zone interpretation before importing offset-less values (R25 HIGH).
- **Domain dates:** populated declared date-only fields parse as YYYY-MM-DD; populated declared date-time fields use Z with three fractional digits. Event startTime/endTime parse as HH:mm. No invalid dates or reversed pairs were found in the checks below; Event local timezone is now explicitly Asia/Kuala_Lumpur unless migrated otherwise; calendar-month policy remains R24 HIGH.
| Ordering check | Comparable rows | Reversed |
| --- | --- | --- |
| `Membership.startDate <= expiryDate` | 2 | 0 |
| `MembershipApplication.submittedAt <= reviewedAt` | 3 | 0 |
| `MembershipApplication.submittedAt <= approvedAt` | 2 | 0 |
| `MembershipApplication.submittedAt <= rejectedAt` | 1 | 0 |
| `Payment.submittedAt <= verifiedAt` | 2 | 0 |
| `Event.registrationStart <= registrationDeadline` | 1 | 0 |
| `Event.registrationDeadline <= startDate` | 1 | 0 |

- **Booleans:** every populated schema boolean and is_sample uses exact lowercase true/false; no numeric or mixed-case boolean representations. All is_sample values are false. Notification isRead agrees with presence of readAt in 8/8 rows.
- **Numbers:** all populated schema numbers parse as finite decimals, have no fractional digits, negative signs representing negative values or scientific notation. Per-field ranges appear above. File sizes are 2,371–2,648,295 bytes. Existing values can be parsed without rounding; they cannot settle future bounds, integer-only semantics or monetary scale (R19 HIGH).
- **Defaults:** the only blank cells in populated schema-defaulted columns are User.accountStatus (3/3), despite schema default ACTIVE. Other observed defaults/nondefaults are populated, but CSV does not identify whether the platform, writer or seed supplied them. Do not apply defaults retrospectively.
- **Question options:** one SELECT row has valid JSON text representing [ORDINARY, LIFETIME, ASSOCIATE]; other five options are blank. Keep string storage unless a lossless conversion is explicitly approved. BOOLEAN-rule strings are text `true`, not boolean-typed columns. Both audit oldValues/newValues are blank in all 16 records, so no real historical JSON shape is verified.
- **Settings:** seven STRING and two NUMBER rows. Both numeric values parse: MAX_DOCUMENT_SIZE_MB=5 and APPLICATION_EXPIRY_DAYS=90. MEMBERSHIP_NUMBER_PREFIX=MYAIS agrees with code, but APPLICATION_NUMBER_PREFIX=APP differs from hardcoded MYAIS-APP. No source consumer applies either setting to reference generation. No BOOLEAN or JSON setting values are exported; neither grammar nor expiry behavior can be silently inferred (R11/R16/R26).

| Question code | inputType | options | ordinaryRule | lifetimeRule | required | active |
| --- | --- | --- | --- | --- | --- | --- |
| IS_MALAYSIAN | BOOLEAN | Blank | true | true | true | true |
| PREFERRED_TYPE | SELECT | JSON array: ORDINARY, LIFETIME, ASSOCIATE | ORDINARY | LIFETIME | true | true |
| AIS_MEMBERSHIP_NUMBER | TEXT | Blank | Blank | Blank | false | true |
| HAS_AIS_MEMBERSHIP | BOOLEAN | Blank | true | true | true | true |
| AIS_MEMBERSHIP_EXPIRY | DATE | Blank | Blank | Blank | false | true |
| IS_18_OR_ABOVE | BOOLEAN | Blank | true | true | true | true |

The six question rows are configuration evidence, not persisted applicant answers. They do not establish the evaluator used by the hardcoded application UI; EligibilityAnswer is empty.

### Generated references: actual data versus source rules

| Field | Source rule / observed format | Nonblank | Unique | Audit outcome |
| --- | --- | --- | --- | --- |
| MembershipApplication.applicationNumber | MYAIS-APP-YYYY-######; count+1 padded to 6 | 3 | 3 | 3/3 match; one DRAFT row has blank number. |
| Membership.membershipNumber | MYAIS-YYYY-######; count+1 padded to 6 | 2 | 2 | 2/2 match; different memberships retained. |
| Payment.paymentReference | MYAIS-PAY-YYYY-######; count+1 padded to 6 | 2 | 2 | 2/2 match. |
| Event.eventNumber | MYAIS-EVT-YYYY-####; create count+1 padded to 4; duplicate uses last 4 timestamp digits | 1 | 1 | 1/1 matches syntax; data cannot prove which generator produced it. |
| Event.slug | slugify(title), or supplied slug; fallback event-<timestamp> | 1 | 1 | Nonempty/unique; syntax alone does not prove generation provenance. |
| RenewalApplication.renewalNumber | No archived generator established | 0 | 0 | Empty entity; no new rule inferred. |
| Payment.transactionReference | User-entered external reference, not application-generated | 2 | 2 | Preserve privately; no imposed pattern. |

Format agreement does not prove count provenance, annual reset, concurrency safety or globally unique historical sequences. Source list visibility/limits and timestamp suffix reuse remain R11 MEDIUM. Preserve all original business reference numbers separately from new primary keys and legacyBase44Id.

### Duplicated/denormalized values and workflow checks

| Comparison | Comparable | Equal | Different |
| --- | --- | --- | --- |
| `ApplicationDocument.userId vs MembershipApplication.userId` | 11 | 11 | 0 |
| `Membership.userId vs MembershipApplication.userId` | 2 | 2 | 0 |
| `Payment.userId vs MembershipApplication.userId` | 2 | 2 | 0 |
| `MembershipApplication.requestedMembershipTypeCode vs MembershipType.code` | 4 | 4 | 0 |
| `MembershipApplication.recommendedMembershipTypeCode vs MembershipType.code` | 4 | 4 | 0 |
| `MembershipApplication.approvedMembershipTypeCode vs MembershipType.code` | 2 | 2 | 0 |
| `Membership.membershipTypeCode vs MembershipType.code` | 2 | 2 | 0 |
| `Membership.membershipTypeName vs MembershipType.name` | 2 | 2 | 0 |
| `Membership.votingEligible vs MembershipType.votingRights` | 2 | 2 | 0 |
| `Payment.entranceFee vs approved MembershipType.entranceFee` | 2 | 2 | 0 |
| `Payment.membershipFee vs approved MembershipType.membershipFee` | 2 | 2 | 0 |
| `Payment.totalAmount vs stored fee sum` | 2 | 2 | 0 |
| `MemberProfile.fullName vs User.full_name` | 2 | 0 | 2 |
| `MemberProfile.phoneNumber vs User.phoneNumber` | 2 | 1 | 1 |
| `MemberProfile.profileCompletionPercentage vs current 15-field formula` | 3 | 3 | 0 |
| `ApplicationReview.reviewerName vs current User.full_name` | 8 | 5 | 3 |
| `AuditLog.actorName vs current User.full_name` | 15 | 9 | 6 |
| `Announcement.createdByName vs current User.full_name` | 0 | 0 | 0 |

Details that affect interpretation:

- Of the two profile-name disagreements, one has two populated differing names; the other has blank profile.fullName and populated User.full_name. Both current User.phoneNumber cells are blank; one corresponding profile phone is populated. Keep separate fields; do not prefer nonblank as a silent identity repair (R13 HIGH).
- The 3 reviewer-name differences and 6 actor-name differences have populated values on both sides. They demonstrate live identity and stored attribution are not interchangeable. The deleted actor/profile cannot be compared to an exported User name.
- Latest review selected by exported review.created_date agrees with application.latestReviewerRemarks and reviewedByUserId for all **3 reviewed applications**; the draft has no review. It does not establish equality of review/application timestamp instants because system timestamps lack offsets.
- Both payment fee snapshots are entrance=20, membership=40, total=60, currency MYR. Both matching membership snapshots are ASSOCIATE/ACTIVE with votingEligible=false, and current user role is associate_member. Both payments are VERIFIED with verifier references/timestamps; membershipId remains blank. Do not regenerate snapshots or infer a one-to-one user/membership constraint.
- All 11 application documents are PENDING with blank verifier/verifiedAt/remarks, including documents attached to ACTIVE applications. Approval/activation is not evidence of document verification.
- All four announcements have creator-name text but no business createdByUserId. Platform creator resolves, but cannot prove business attribution and must not fill it.
- All three profileCompletionPercentage values agree with the current source's 15-field formula. Preserve the stored values; a future formula must not rewrite historical exports.
- User photo matches no document URL; neither payment receipt matches a document URL. All 11 document URLs are distinct. No equality justifies consolidating file records; distinct URLs do not prove distinct bytes.
- Empty eligibility answers, event registrations, information requests and renewals provide no data-level validation of their denormalized fields, dates, statuses or payment references. Preserve their source mappings.

### File URL evidence

| Field | Nonblank | Distinct | Schemes | Paths containing /public/ |
| --- | --- | --- | --- | --- |
| `User.photoUrl` | 1 | 1 | `https`: 1 | 1 |
| `ApplicationDocument.fileUrl` | 11 | 11 | `https`: 11 | 11 |
| `Payment.receiptUrl` | 2 | 2 | `https`: 2 | 2 |
| `InformationRequest.responseAttachmentUrl` | 0 | 0 | None | 0 |
| `Announcement.attachmentUrl` | 0 | 0 | None | 0 |
| `Announcement.coverImageUrl` | 0 | 0 | None | 0 |
| `Event.coverImage` | 1 | 1 | `https`: 1 | 1 |
| `Event.onlineMeetingUrl` | 1 | 1 | `https`: 1 | 0 |
| `Event.registrationUrl` | 0 | 0 | None | 0 |

Fifteen upload/image URL cells (11 documents, 2 payment receipts, 1 User photo, 1 event cover) use HTTPS paths containing /public/. This proves a stored URL pattern, **not** anonymous accessibility, ownership or source-object availability. One separate online meeting URL is HTTPS. No network requests or downloads were made.

All 11 document MIME fields declare application/pdf, including 3 PROFILE_PHOTO documents; the broad application upload accepts PDF, so image-only conversion would alter data. CSV metadata is not a byte-level MIME/size/checksum check. Keep originalFileName, MIME, byte size and URL privately and independently. Protected documents/receipts require private storage and server-authorized retrieval in the future system; copying a public-looking URL does not meet that requirement (R17/R22 HIGH).

### Findings resolved by export evidence

These are resolved factual questions, **not approval of the remaining business rules**:

1. Archive is now at the requested sibling path with the same source commit; all 18 exports are available.
2. Exact record counts and headers are established; all populated declared columns are present. Four named empty files have zero bytes, not malformed populated exports.
3. All 3 User legacy IDs are recovered from the mapping by exact email; all 9 mapped orphan assertions match actual record IDs/fields.
4. The two historical identities have a mandated disabled, non-login preservation treatment; no destructive/null-away alternative is selected.
5. System column presence is established for all 13 populated non-User entities; User.status is confirmed as platform-only.
6. User timestamp discrepancies between CSV/mapping are representation-only. User status discrepancies are resolved in favor of CSV **as raw platform status**, not custom accountStatus.
7. Export roles are established; subsequent user approval resolves user -> APPLICANT, admin -> SYSTEM_ADMINISTRATOR, and equivalent uppercase roles, with nullable legacyRole preservation.
8. The two payment audit discriminator errors are confirmed, rather than hypothetical; their original raw targets are retained pending approved repair.
9. Actual duplicates, blank optional targets, ownership consistency, enum values, numeric ranges, boolean/date syntax and snapshot disagreements are measured.
10. Six-digit system timestamp fractions are millisecond-aligned; precision loss is not observed in this dataset. Canonical UTC timestamp storage is now approved; source-zone interpretation remains an import follow-up in R25 HIGH.
11. Question options and the two numeric settings parse; this does not establish grammar for unobserved values or runtime enforcement.
12. No observed reference-number collision or non-User dangling conventional FK exists; this does not authorize new uniqueness constraints.

### Remaining severity counts and canonical-design readiness

The reassessment covers all R01–R27 groups. **R01, R12 and R18 are RESOLVED** by the approved decisions above and excluded from open counts.

| BLOCKER | HIGH | MEDIUM | LOW | Total open groups | Resolved groups |
| --- | --- | --- | --- | --- | --- |
| 0 | 14 | 9 | 1 | 24 | 3 |

Remaining groups retain their severities because these approvals do not settle their separate findings:

- **HIGH (14):** R03, R04, R05, R07, R08, R09, R10, R13, R15, R17, R19, R22, R24, R25. These concern permissions, workflow/payment integrity, duplicate memberships/cardinality, polymorphic history, identity snapshots, numeric precision, files/access and platform/import contracts. R25 now explicitly tracks source-zone interpretation before offset-less import; this is an existing platform-contract group, not a new issue.
- **MEDIUM (9):** R02, R06, R11, R14, R16, R20, R21, R23, R26. Unknown route aliases, missing workflow paths, numbering, mutable snapshots, empty/unused concepts and free-string/JSON semantics are unaffected.
- **LOW (1):** R27, phase/provenance documentation follow-up.

**Canonical Prisma design can now begin.** The approved representations allow design without guessing canonical roles, Event creator cardinality, timestamp/date/clock types or optional blank handling. Remaining findings must be addressed when finalizing their affected constraints, importing data or implementing workflows; this is not approval to silently repair historical data or invent business rules. Preserve all empty entity schemas and both disabled historical human identities. No Prisma models, migrations or application code are created by this documentation update.

### Audit validation and repository boundaries

Coverage checks passed for 18 schemas, all 221 declared properties, all 270 exported columns, 34 direct-reference fields and 26 declared enums. The severity register contains exactly 27 unique issue IDs. Exact exported IDs, emails and file URLs were checked against this document; none is included. Archive-relative document links resolve after accounting for line fragments.

SHA-256 comparison of the 205 baseline source/private/project files found all archive and private inputs unchanged, with no files removed. The only baseline difference was a separate edit to AGENTS.md during the session; the audit did not write or revert that file. This task wrote only docs/database-mapping-draft.md. Application build/lint/typecheck tests were not needed for this documentation-only audit.

### Approved-decision update validation

R01/R12/R18 are marked resolved in the register, field mappings and readiness summary. Canonical role members exclude USER/ADMIN; legacyRole is nullable. Event creator FK/provenance and timezone mappings are explicit. System timestamp field mappings use UTC timestamptz, business dates remain date, local Event clocks remain separate, and optional blanks map to NULL. All remaining issue groups were reassessed; 24 remain open. Historical export observations and counts are unchanged. This update modifies only this document.
