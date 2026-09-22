# API database foundation

Use the repository's Node and pnpm versions. From the repository root, run
`pnpm --filter @myais/api... build` to generate/compile the shared Prisma client and build the API.
Then run `pnpm --filter @myais/api start`, or use root `pnpm dev` for development.

Supply `DATABASE_URL` through deployment secrets or `apps/api/.env` (see `.env.example`).
Process environment values take precedence. Missing/invalid configuration stops startup with a
sanitized error. The API never reads `DIRECT_URL`; that variable belongs to Prisma CLI/migrations.
Client generation/build does not connect to PostgreSQL or apply migrations.

Set `SUPABASE_URL` to the project's origin. `SUPABASE_JWT_AUDIENCE` defaults to `authenticated`.
The API derives the issuer as `${SUPABASE_URL}/auth/v1` and JWKS URL as
`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`. No secret or service-role key is needed for
this identity foundation. JWT validation and guards belong to the next phase.

Client configuration names for later web/mobile work are
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`;
their Supabase URL and API base URL must also be configured. Clients must use NestJS for
MyAIS application data and must not access application tables directly.

Only canonical users with `accountStatus = ACTIVE` may access protected API functionality.
`DISABLED`, `SUSPENDED`, and NULL status are denied. This invariant is represented by
`canAccessProtectedApi`; the guard that enforces it is still to be built.

For the next linking phase: a match on `supabaseAuthUserId` wins. Otherwise, link by
normalized authenticated email only if exactly one canonical User matches, that user's
`accountStatus` is ACTIVE, and `supabaseAuthUserId` is NULL. Never auto-link a DISABLED
or SUSPENDED account. Otherwise provision a new APPLICANT + ACTIVE User. Role and status
must come from the server, never from the client. The two historical disabled users stay
unlinked (`supabaseAuthUserId = NULL`) and retain their disabled status and empty identity
fields; this phase does not update existing rows.

`GET /health` performs `SELECT 1` using the shared Prisma client. It returns HTTP 200 with
`{"api":"up","database":"up","timestamp":"<UTC ISO timestamp>"}` or HTTP 503 with
`database: "down"`. Responses are not cached and contain no database diagnostics or connection values.
Connections are lazy, probes have driver timeouts, and Nest shutdown hooks disconnect the client.
This checks connectivity, not schema/migration readiness.

After building the shared package, run `pnpm --filter @myais/api test` and
`pnpm --filter @myais/api typecheck`. Unit tests replace the client and never contact PostgreSQL.
