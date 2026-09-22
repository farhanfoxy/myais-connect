# Base44 controlled importer

From the repository root:

```sh
pnpm --filter @myais/database migration:dry-run --input ../migration-private
pnpm --filter @myais/database migration:import --input ../migration-private
```

Both commands default to the existing read-only audit. Only an explicit `--write` enables database access:

```sh
pnpm --filter @myais/database migration:import --input ../migration-private --write
```

The default input is `../../../migration-private` relative to **packages/database**, independent of the caller's working directory. An explicit input path is relative to the caller. Requires the project's Node version with TypeScript stripping and installed workspace dependencies. Write mode requires `DIRECT_URL` supplied through the process environment and an already provisioned database matching the approved Prisma schema. This tool does not load dotenv, create tables, run migrations or generate a Prisma client. It reuses the PostgreSQL driver pinned by the installed Prisma CLI; no packages were added.

The strict CSV reader supports quoted commas/newlines, doubled quotes, BOMs and CRLF. It reads all CSVs and Base44_User_ID_Mapping.txt; four documented zero-byte entity files are valid. Unknown files, malformed input, missing required fields, invalid enums/types, duplicate legacy IDs/approved keys and unresolved direct foreign keys fail the audit. Reports use trusted entity/field names, row ordinals and sequential deleted-user labels only. No file URLs are accessed.

Dry-run PASS means the source audit has no ERROR. Write mode repeats that audit, retains its exact parsed snapshot, then validates canonical transformations before opening a connection. It maps roles, preserves nullable values and snapshots, validates exact Decimal(12,2) amounts without rounding, interprets offset-less **system** timestamps explicitly as UTC, and retains date-only calendars and Event local clock strings. Event timezone defaults to Asia/Kuala_Lumpur. Offset-less action timestamps remain invalid. Timestamp precision matches the schema's milliseconds. Event lifecycle and Base44 platform timestamps stay separate. Unmapped platform fields on future exports of the four empty entities block import.

Exactly two mapping-listed deleted users receive new UUIDs and DISABLED status. Their identity/role/platform-status fields remain NULL, with no credentials or invented personal data. Polymorphic IDs and platform provenance remain raw legacy values; known discriminator mismatches are not repaired. The Event system creator has a NULL User FK and preserved legacyCreatedBy.

The approved order covers all 34 direct relationships. One serializable transaction covers the entire import, with an advisory lock, parameterized statements and timeouts. Existing legacy IDs are looked up first and their UUIDs reused before comparing foreign keys. Identical rows are skipped. Conflicting scalar/FK values abort without updates; uniqueness conflicts with other database records also abort. Lifecycle timestamps generated for records lacking source timestamps are retained on retry. No updates, deletes or upserts occur.

The safe final report includes attempted, inserted, existing, skipped and failed counts per entity, unresolved references and transaction outcome. Inserted counts describe confirmed committed records; rollback clears staged insert counts. A lost commit acknowledgement reports COMMIT_UNCONFIRMED and unconfirmedInsertRecords: a controlled retry checks existing legacy IDs rather than assuming rollback. Driver exception details are suppressed.

Run synthetic tests and package typecheck from packages/database:

```sh
node --test src/migration/base44/audit.test.ts src/migration/base44/write.test.ts
pnpm typecheck
```

Tests use an in-memory transactional database double, never PostgreSQL. Live database compatibility and write execution require separate operator validation. Metadata snapshots in contract.ts and write-contract.ts must follow approved schema changes; write-contract.ts covers all 18 models and their scalar columns.
