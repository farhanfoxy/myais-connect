import { run } from "./cli.ts";

const { report, exitCode } = await run(process.argv.slice(2));
// Never print rows, exceptions, credentials or raw IDs.
process.stdout.write(JSON.stringify(report, null, 2) + "\n");
process.exitCode = exitCode;
