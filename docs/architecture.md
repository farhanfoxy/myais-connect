# MyAIS Connect — Target Architecture

## Repository
```text
myais-connect/
├─ apps/
│  ├─ web/        # Next.js admin + web experience
│  ├─ mobile/     # Expo React Native member app
│  └─ api/        # NestJS REST API
├─ packages/
│  ├─ database/   # Prisma schema/client/migrations
│  ├─ types/      # shared TypeScript domain types
│  ├─ validation/ # shared Zod schemas where safe to share
│  └─ config/     # shared lint/ts config
├─ docs/
├─ .github/
└─ AGENTS.md
```

## Runtime flow
Web and mobile call the same NestJS API. NestJS owns authorization, workflow transitions, payment verification, membership activation, notifications, and audit logging. PostgreSQL is the system of record.

## Boundaries
- UI may request an action; it does not directly mutate protected workflow fields.
- API validates identity, role, ownership, input, and allowed status transition.
- Prisma enforces relationships/constraints and transactions.
- Storage uses signed/private access for sensitive member documents.
- Payment integration is isolated behind a provider interface so provider choice can change without rewriting membership logic.

## Environments
- local
- staging
- production

Never develop directly against production.
