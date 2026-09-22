import { createRequire } from "node:module";
import { columns } from "./write-contract.ts";
import { ImportFailure } from "./prepare.ts";
import type { Scalar } from "./prepare.ts";
import type { ImportDatabase, TransactionStore } from "./writer.ts";

// Reuse postgres 3.4.7 already pinned as a dependency of the installed Prisma CLI.
// No generated Prisma client is needed, and this module is loaded only after --write.
interface Sql {
  unsafe(query: string, parameters?: Scalar[]): Promise<Record<string, Scalar>[]>;
  begin<T>(options: string, work: (sql: Sql) => Promise<T>): Promise<T>;
  end(options: { timeout: number }): Promise<void>;
}
type Driver = (url: string, options: Record<string, unknown>) => Sql;
const quote = (name: string): string => '"' + name + '"';
export async function connectPostgres(): Promise<ImportDatabase> {
  const raw = process.env.DIRECT_URL;
  if (!raw) throw new ImportFailure("DIRECT_URL_REQUIRED");
  let url: URL;
  try { url = new URL(raw); } catch { throw new ImportFailure("DATABASE_URL_INVALID"); }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new ImportFailure("DATABASE_URL_INVALID");
  const namespace = url.searchParams.get("schema") ?? "public";
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(namespace)) throw new ImportFailure("DATABASE_SCHEMA_INVALID");
  url.searchParams.delete("schema");
  const localRequire = createRequire(import.meta.url);
  const prismaRequire = createRequire(localRequire.resolve("prisma/package.json"));
  const driver = prismaRequire("postgres") as Driver;
  const sql = driver(url.toString(), { max: 1, connect_timeout: 10, idle_timeout: 5,
    onnotice: () => {}, debug: false, connection: { application_name: "myais-base44-import", timezone: "UTC" } });
  const table = (entity: string): string => {
    if (!Object.hasOwn(columns, entity)) throw new ImportFailure("ENTITY_UNMAPPED");
    return quote(namespace) + "." + quote(entity);
  };
  return {
    async transaction<T>(work: (store: TransactionStore) => Promise<T>): Promise<T> {
      return sql.begin("isolation level serializable", async tx => {
        await tx.unsafe("SET LOCAL TIME ZONE 'UTC'");
        await tx.unsafe("SET LOCAL lock_timeout = '10s'");
        await tx.unsafe("SET LOCAL statement_timeout = '60s'");
        // Serialize cooperating importer runs. Database constraints also catch other writers.
        await tx.unsafe("SELECT pg_advisory_xact_lock(736204, 3401)");
        const store: TransactionStore = {
          async find(entity, legacyId) {
            const definition = columns[entity];
            if (!definition) throw new ImportFailure("ENTITY_UNMAPPED");
            const selected = Object.entries(definition).map(([field, col]) => {
              const name = quote(field);
              const expr = col.type === "DateTime" ?
                col.dateOnly ? "to_char(" + name + ", 'YYYY-MM-DD')" :
                  "to_char(" + name + " AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')" :
                name + "::text";
              return expr + " AS " + name;
            }).join(", ");
            const rows = await tx.unsafe("SELECT " + selected + " FROM " + table(entity) +
              ' WHERE "legacyBase44Id" = $1 FOR UPDATE', [legacyId]);
            if (rows.length > 1) throw new ImportFailure("EXISTING_LEGACY_ID_DUPLICATE");
            return rows[0] ?? null;
          },
          async insert(entity, id, data) {
            const values = { id, ...data };
            const keys = Object.keys(values);
            const definition = columns[entity];
            if (!definition || keys.some(key => !Object.hasOwn(definition, key)))
              throw new ImportFailure("COLUMN_UNMAPPED");
            await tx.unsafe("INSERT INTO " + table(entity) + " (" + keys.map(quote).join(", ") +
              ") VALUES (" + keys.map((_, i) => "$" + (i + 1)).join(", ") + ")", Object.values(values));
          },
        };
        return work(store);
      });
    },
    async close() { await sql.end({ timeout: 5 }); },
  };
}
