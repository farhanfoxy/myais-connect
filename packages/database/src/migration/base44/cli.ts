import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { auditDirectory } from "./audit.ts";

export function parseArguments(args: string[]): { write: boolean; input?: string } {
  let write = false;
  let input: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--write" && !write) write = true;
    else if (args[i] === "--input" && input === undefined && args[i + 1] && !args[i + 1]!.startsWith("--"))
      input = args[++i];
    else throw new Error("USAGE");
  }
  return { write, input };
}
export async function run(args: string[]): Promise<{ report: unknown; exitCode: number }> {
  try {
    const options = parseArguments(args);
    const databaseDirectory = fileURLToPath(new URL("../../../", import.meta.url));
    const directory = options.input ? resolve(options.input) : resolve(databaseDirectory, "../../../migration-private");
    if (!options.write) {
      const report = await auditDirectory(directory);
      return { report, exitCode: report.result === "PASS" ? 0 : 1 };
    }
    const { prepareImport } = await import("./prepare.ts");
    const prepared = await prepareImport(directory);
    if (!prepared.plan) return { exitCode: 1, report: { mode: "WRITE", result: "FAIL",
      transaction: "NOT_STARTED", attemptedRecords: 0, insertedRecords: 0, existingRecords: 0,
      skippedRecords: 0, failedRecords: 0, unresolvedReferences: prepared.audit.referenceChecks.reduce((n, r) => n + r.unresolved, 0),
      failure: prepared.failure, audit: prepared.audit } };
    const { executeImport } = await import("./writer.ts");
    const report = await executeImport(prepared.plan, { write: options.write, validationErrors: prepared.audit.validation.errors },
      async () => {
        const { connectPostgres } = await import("./postgres.ts");
        return connectPostgres();
      });
    return { report, exitCode: report.result === "PASS" ? 0 : 1 };
  } catch {
    return { exitCode: 1, report: { result: "FAIL", code: "IMPORT_FAILED_SAFE",
      usage: "migration:import [--input DIRECTORY] [--write]" } };
  }
}
