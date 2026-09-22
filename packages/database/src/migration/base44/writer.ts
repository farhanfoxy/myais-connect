import { columns } from "./write-contract.ts";
import { ImportFailure, resolveData, decimal12_2 } from "./prepare.ts";
import type { ImportPlan, PlannedRow, Scalar } from "./prepare.ts";

export interface TransactionStore {
  find(entity: string, legacyId: string): Promise<Record<string, Scalar> | null>;
  insert(entity: string, id: string, data: Record<string, Scalar>): Promise<void>;
}
export interface ImportDatabase {
  transaction<T>(work: (store: TransactionStore) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
export type DatabaseFactory = () => Promise<ImportDatabase>;
function equal(field: string, entity: string, actual: Scalar | undefined, expected: Scalar): boolean {
  if (actual === undefined) return false;
  if (actual === null || expected === null) return actual === expected;
  const type = columns[entity]?.[field]?.type;
  if (type === "Decimal") {
    try { return decimal12_2(String(actual)) === decimal12_2(String(expected)); } catch { return false; }
  }
  if (type === "Float") return Number(actual) === Number(expected);
  if (type === "Boolean") return expected === true ? actual === true || actual === "true" :
    expected === false && (actual === false || actual === "false");
  return actual === expected;
}
export async function executeImport(plan: ImportPlan, options: { write: boolean; validationErrors: number },
  connect: DatabaseFactory) {
  const counts = Object.fromEntries(plan.order.map(entity => [entity, { attempted: 0, inserted: 0, existing: 0, skipped: 0, failed: 0 }]));
  const report = { mode: "WRITE", result: "FAIL", transaction: "NOT_STARTED", attemptedRecords: 0,
    insertedRecords: 0, existingRecords: 0, skippedRecords: 0, failedRecords: 0, unresolvedReferences: 0,
    counts, failure: null as { code: string; entity?: string; label?: string; field?: string } | null,
    unconfirmedInsertRecords: 0, connectionClosed: true };
  if (!options.write || options.validationErrors !== 0) {
    report.failure = { code: !options.write ? "WRITE_FLAG_REQUIRED" : "DRY_RUN_ERRORS" };
    return report;
  }
  let database: ImportDatabase | undefined;
  let active: PlannedRow | undefined;
  let statementsCompleted = false;
  const maps = new Map([...plan.maps].map(([e, map]) => [e, new Map(map)]));
  try {
    database = await connect();
    await database.transaction(async store => {
      report.transaction = "IN_PROGRESS";
      const existing = new Map<PlannedRow, Record<string, Scalar>>();
      for (const row of plan.rows) {
        active = row;
        report.attemptedRecords++;
        const count = counts[row.entity];
        if (!count) throw new ImportFailure("ENTITY_UNMAPPED");
        count.attempted++;
        const found = await store.find(row.entity, row.legacyId);
        if (found) {
          if (typeof found.id !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(found.id))
            throw new ImportFailure("EXISTING_ID_INVALID", row.entity, row.label);
          maps.get(row.entity)?.set(row.legacyId, found.id);
          existing.set(row, found); count.existing++; report.existingRecords++;
        }
      }
      // All existing IDs are mapped before comparing any FK. No upserts/updates.
      const ready = plan.rows.map(row => {
        active = row;
        const data = resolveData(row, maps), found = existing.get(row);
        if (found) for (const [field, value] of Object.entries(data)) {
          if (row.generatedLifecycle.includes(field)) continue;
          if (!equal(field, row.entity, found[field], value))
            throw new ImportFailure("EXISTING_VALUE_CONFLICT", row.entity, row.label, field);
        }
        return { row, data, exists: Boolean(found) };
      });
      for (const { row, data, exists } of ready) {
        active = row;
        const count = counts[row.entity];
        if (!count) throw new ImportFailure("ENTITY_UNMAPPED");
        if (exists) { count.skipped++; report.skippedRecords++; continue; }
        await store.insert(row.entity, row.proposedId, data);
        count.inserted++; report.insertedRecords++;
      }
      statementsCompleted = true;
    });
    report.transaction = "COMMITTED"; report.result = "PASS";
  } catch (error) {
    report.transaction = statementsCompleted ? "COMMIT_UNCONFIRMED" :
      report.transaction === "IN_PROGRESS" ? "ROLLED_BACK" : "NOT_STARTED";
    if (statementsCompleted) report.unconfirmedInsertRecords = report.insertedRecords;
    // Counts describe durable changes, not successful statements later rolled back.
    report.insertedRecords = 0; report.skippedRecords = 0;
    for (const count of Object.values(counts)) { count.inserted = 0; count.skipped = 0; }
    report.failedRecords = active ? 1 : 0;
    if (active && counts[active.entity]) counts[active.entity]!.failed = 1;
    const failure = statementsCompleted ? new ImportFailure("COMMIT_UNCONFIRMED") :
      error instanceof ImportFailure ? error : new ImportFailure("DATABASE_OPERATION_FAILED");
    report.failure = { code: failure.code, entity: failure.entity ?? active?.entity,
      label: failure.label ?? active?.label, field: failure.field };
    if (failure.code === "UNRESOLVED_REFERENCE") report.unresolvedReferences = 1;
  } finally {
    if (database) {
      try { await database.close(); }
      catch { report.connectionClosed = false; }
    }
  }
  return report;
}
