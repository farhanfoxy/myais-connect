# Base44 dry-run audit

From packages/database: `pnpm migration:dry-run`.
From the repository root: `pnpm --filter @myais/database migration:dry-run --input ../migration-private`.

The default is `../../../migration-private` relative to **packages/database**: the sibling private directory, independent of the working directory. An explicit --input path is relative to the caller's working directory. No environment variables, dotenv, Prisma client or database configuration are loaded.

The CLI recursively reads all CSVs and the root Base44_User_ID_Mapping.txt. Known filenames are matched exactly; unknown filenames are replaced with safe labels and reported as unmapped. Four documented zero-byte exports are valid; missing files are not. The dependency-free strict CSV reader handles quoted commas/newlines, doubled quotes, BOMs and CRLF. UTF-8 decoding is strict. Malformed records, duplicate headers, missing required columns/values, invalid enums/types, duplicate IDs/approved keys and unresolved direct FKs fail validation.

PASS means the audit completed without those errors. It does **not** mean write-ready. Known deleted humans, the Event system sentinel, service-marked metadata, polymorphic discrepancies and offset-less timestamps remain explicit warnings/follow-ups. An unrecognized service-marked metadata string is not verified as a platform identity and is never used as a User FK. No placeholders are constructed. Role conversion retains legacyRole only in memory.

Timestamp reporting classifies original strings by syntax only; it does not parse Date objects, establish calendar validity/timezones, convert timestamps or initialize lifecycle fields. Empty optional values are not defaulted. Exact string comparisons implement the approved uniqueness contract; no email case-folding or value normalization is introduced.

Output includes trusted entity/field names, record ordinals and sequential deleted-user labels only. Parser/filesystem exception details, arbitrary headers, unknown enum strings, original row values and private paths are never serialized. No file URLs are accessed. No PostgreSQL connection, writes, UUID generation, imports or source-file changes occur.

The proposed order follows all 34 direct references. Before a future write phase, the User stage must also preserve mapping-listed deleted humans as disabled non-login identities. Polymorphic references and raw platform attribution are not FK dependencies.

Source field metadata in contract.ts is a reviewed snapshot of the mapping's 221 declared Base44 properties, including its 26 enums; canonical unique keys and direct references follow the approved Prisma schema. Synthetic tests cover quoting, malformed CSV, identity/role mapping, validation failures and output redaction. Run `node --test src/migration/base44/audit.test.ts` from packages/database.
