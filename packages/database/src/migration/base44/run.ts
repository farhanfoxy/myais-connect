import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { auditDirectory } from "./audit.ts";

// Anchor the layout default to packages/database, never the caller's cwd.
const databaseDirectory = fileURLToPath(new URL("../../../", import.meta.url));
const args = process.argv.slice(2);
if (args.length !== 0 && (args.length !== 2 || args[0] !== "--input" || !args[1])) {
  process.stdout.write(JSON.stringify({ result: "FAIL", code: "USAGE", usage: "migration:dry-run [--input DIRECTORY]" }) + "\n");
  process.exitCode = 1;
} else {
  try {
    const directory = args[1] ? resolve(args[1]) : resolve(databaseDirectory, "../../../migration-private");
    const report = await auditDirectory(directory);
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    process.exitCode = report.result === "PASS" ? 0 : 1;
  } catch {
    // Never serialize exception messages/stacks: filesystem/parser errors can carry private input.
    process.stdout.write(JSON.stringify({ mode: "DRY_RUN", result: "FAIL", code: "AUDIT_FAILED_SAFE" }) + "\n");
    process.exitCode = 1;
  }
}
