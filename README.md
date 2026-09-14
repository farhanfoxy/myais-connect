# MyAIS Connect

Phase 1 foundation only. No authentication, business entities, API routes, payments, or migration scripts are implemented. AGENTS.md and docs/ remain the migration contract.

## Prerequisites

- Node.js 24 LTS (24.20.0 used for validation).
- pnpm 10.34.5: install with `npm install --global pnpm@10.34.5`.
- Expo Go on a compatible device, or Android Studio / an iOS simulator (macOS) for native runtime testing.
- PostgreSQL is required when database work begins in Phase 2; it is not needed for foundation checks.

## Commands

```sh
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test
```

`pnpm dev` starts Next.js at http://localhost:3000, the NestJS listener at http://127.0.0.1:3001, and Expo Metro. The API has no controllers; requests return 404. API `PORT` and `HOST` can be set in the process environment; bind `HOST=0.0.0.0` when deploying in a container.

Run one app interactively with `pnpm --filter @myais/mobile dev`, `pnpm --filter @myais/web dev`, or `pnpm --filter @myais/api dev`. Expo lists device connection options; use `pnpm --filter @myais/mobile android` or `pnpm --filter @myais/mobile ios` to open an installed emulator.

Build produces Next.js output, compiled NestJS JavaScript, shared package declarations/JavaScript, and Expo iOS/Android JavaScript/assets in `apps/mobile/dist`. Expo export is not a signed native application binary. Start built servers with `pnpm --filter @myais/web start` and `pnpm --filter @myais/api start`.

Vitest is configured through the root test command to accept no tests at this foundation stage. No business tests are present yet.

## Workspace

- `apps/web`: Next.js App Router shell.
- `apps/mobile`: Expo React Native shell.
- `apps/api`: NestJS bootstrap without endpoints.
- `packages/database`: PostgreSQL Prisma configuration and an empty schema.
- `packages/types`: shared TypeScript package, ready for approved domain types.
- `packages/validation`: shared Zod entry point, without domain schemas.
- `packages/config`: shared strict TypeScript and ESLint configuration.

Prisma validation runs during build without a database connection. When a local connection is needed, copy `packages/database/.env.example` to `packages/database/.env` and provide local credentials. Run `pnpm --filter @myais/database db:validate` to validate the schema. Client generation and migrations are deferred until Phase 2 introduces approved models. Never develop against production or commit private data or secrets.

Framework versions are pinned; `pnpm-lock.yaml` records the resolved dependency tree. Mobile React/React Native versions follow the official Expo template. Expo supports pnpm workspaces without custom Metro resolution: [Expo monorepo guidance](https://docs.expo.dev/guides/monorepos/).
