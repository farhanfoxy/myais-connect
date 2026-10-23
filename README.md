# MyAIS Connect

### Membership Management Platform for MyAIS

MyAIS Connect translates the organisation’s membership processes into a structured digital workflow, from registration and eligibility checks to application review, payment verification, and membership activation.

Developed as a final-year project at Universiti Utara Malaysia, the system combines stakeholder requirements analysis, backend engineering, database design, access control, and automated testing.

## Project Highlights

- **Stakeholder collaboration:** Requirements gathered through discussions with MyAIS EXCO members.
- **Membership workflow:** Registration, profile completion, eligibility checks, applications, document review, payment verification, and activation.
- **Backend security:** JWT verification, role-based access, ownership checks, input validation, and protected document access.
- **Legacy migration:** 83 records imported through an idempotent migration process.
- **Automated testing:** 109 API tests and 24 web tests.
- **Workflow validation:** End-to-end verification from applicant registration to ACTIVE membership.

## The Problem

Membership administration involves several connected activities: collecting applicant information, checking eligibility, reviewing documents, verifying payments, and updating membership status.

MyAIS Connect brings these activities into a consistent workflow so that application data, administrative decisions, and membership status can be managed together.

## Membership Workflow

1. Register an account.
2. Complete the membership profile.
3. Check eligibility and submit an application.
4. Upload supporting documents to private storage.
5. Review the application through the administrative workflow.
6. Submit payment evidence for verification.
7. Activate membership following the required approvals.

Sensitive operations are checked on the server, including user permissions, record ownership, and permitted workflow transitions.

## My Contribution

**Achmad Farhan Julyawansyah — Software Development and Requirements Analysis**

- Worked with MyAIS EXCO members to understand membership procedures, administrative needs, and workflow pain points.
- Translated stakeholder discussions into system requirements, application flows, and feature priorities.
- Developed backend functionality using NestJS and TypeScript.
- Designed relational data structures using PostgreSQL and Prisma, with Supabase supporting authentication and private document storage.
- Implemented validation and authorisation controls for membership operations.
- Developed the legacy-data import process and verified membership workflow behaviour through automated tests.
- Used OpenAI Codex and other coding assistants for codebase analysis, implementation planning, debugging, and refactoring, with human review and test validation.

## Technology Stack

| Area | Technologies |
| --- | --- |
| Web application | Next.js, React, Tailwind CSS, shadcn/ui |
| Backend API | NestJS, TypeScript, Zod |
| Database | PostgreSQL, Prisma |
| Authentication | Supabase Auth, JWT/JWKS verification |
| Document storage | Supabase private storage |
| Workspace | pnpm, Turborepo |
| Mobile workspace | Expo, React Native, NativeWind |

## Engineering Decisions

### Server-side authorisation

Role and ownership checks protect administrative actions and user-specific records. Access decisions are enforced on the backend.

### Private document access

Supporting documents are stored privately and accessed through authorised application workflows.

### Data consistency

Transactions, locking, and idempotency controls protect relevant membership operations from inconsistent or repeated updates.

### Repeatable migration

The legacy import process is designed to avoid duplicate records when rerun.

## Validation and Project Scope

The documented development milestone includes:

- Migration of 83 legacy records.
- 109 API tests and 24 web tests.
- Verification of the applicant-to-ACTIVE-membership workflow.

These results describe development validation. Production deployment and completion of each web or mobile interface should be documented separately as those milestones are verified.
