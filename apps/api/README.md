# API database foundation

Use the repository's Node and pnpm versions. From the repository root, run
`pnpm --filter @myais/api... build` to generate/compile the shared Prisma client and build the API.
Then run `pnpm --filter @myais/api start`, or use root `pnpm dev` for development.

Supply `DATABASE_URL` through deployment secrets or `apps/api/.env` (see `.env.example`).
Process environment values take precedence. Missing/invalid configuration stops startup with a
sanitized error. The API never reads `DIRECT_URL`; that variable belongs to Prisma CLI/migrations.
Client generation/build does not connect to PostgreSQL or apply migrations.

`GET /health` performs `SELECT 1` using the shared Prisma client. It returns HTTP 200 with
`{"api":"up","database":"up","timestamp":"<UTC ISO timestamp>"}` or HTTP 503 with
`database: "down"`. Responses are not cached and contain no database diagnostics or connection values.
Connections are lazy, probes have driver timeouts, and Nest shutdown hooks disconnect the client.
This checks connectivity, not schema/migration readiness.

After building the shared package, run `pnpm --filter @myais/api test` and
`pnpm --filter @myais/api typecheck`. Unit tests replace the client and never contact PostgreSQL.
