import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { parseCsv } from "./csv.ts";
import { auditDirectory, parseMapping, transformRole } from "./audit.ts";
import { fields, fileFor } from "./contract.ts";

test("CSV preserves quoted commas, newlines, escaped quotes, blanks and BOM", () => {
  const parsed = parseCsv('\uFEFFid,text,tail\r\n1,"a,b\r\n""quoted""",\r\n2,plain,last');
  assert.deepEqual(parsed.rows, [
    { id: "1", text: 'a,b\r\n"quoted"', tail: "" }, { id: "2", text: "plain", tail: "last" },
  ]);
  assert.deepEqual(parseCsv(""), { headers: [], rows: [] });
  for (const input of ['id,id\n1,2', 'id,text\n1', 'id\n"unclosed', 'id\na"b', 'id\n"a"x'])
    assert.throws(() => parseCsv(input));
});
test("role conversion is explicit and retains original spelling", () => {
  assert.deepEqual(transformRole("user"), { role: "APPLICANT", legacyRole: "user" });
  assert.equal(transformRole("admin").role, "SYSTEM_ADMINISTRATOR");
  assert.equal(transformRole("ordinary_member").role, "ORDINARY_MEMBER");
  assert.equal(transformRole("").role, null);
  assert.throws(() => transformRole("SYSTEM_ADMIN"));
});
test("mapping extracts real and deleted IDs without generating identity details", () => {
  const parsed = parseMapping('| id | email |\n| --- | --- |\n| synthetic-user | synthetic@example.invalid |\n## Orphaned User References\n### Orphaned User ID: `synthetic-deleted`\n');
  assert.equal(parsed.users[0]?.id, "synthetic-user");
  assert.deepEqual(parsed.deleted, ["synthetic-deleted"]);
});
test("end-to-end validation detects failures without leaking sensitive values", async () => {
  const dir = await mkdtemp(join(tmpdir(), "base44-synthetic-"));
  const secret = "PRIVATE_VALUE_DO_NOT_LOG";
  try {
    for (const [entity, rules] of Object.entries(fields)) {
      const headers = [...new Set([...Object.keys(rules), ...(entity === "User" ? ["email", "full_name"] : ["id"])])];
      await writeFile(join(dir, fileFor(entity)), headers.join(",") + "\n");
    }
    await writeFile(join(dir, "EligibilityAnswer_export.csv"), "");
    await writeFile(join(dir, "EventRegistration_export.csv"), "");
    await writeFile(join(dir, "InformationRequest_export.csv"), "");
    await writeFile(join(dir, "RenewalApplication_export.csv"), "");
    await writeFile(join(dir, "MyAIS_Connect-users.csv"), 'email,full_name,role\nsynthetic@example.invalid,' + secret + ',user\n');
    await writeFile(join(dir, "Base44_User_ID_Mapping.txt"), '| id | email |\n| --- | --- |\n| ' + secret + ' | synthetic@example.invalid |\n');
    await writeFile(join(dir, "MemberProfile_export.csv"), 'id,userId\n' + secret + ',' + secret + '\n' + secret + ',' + secret + '\n');
    await writeFile(join(dir, "Payment_export.csv"), 'id,userId,paymentType,totalAmount\nsynthetic-payment,' + secret + ',' + secret + ',0\n');
    await writeFile(join(dir, "Notification_export.csv"), 'id,userId,title,message\nsynthetic-notification,missing-private-id,' + secret + ',' + secret + '\n');
    const report = await auditDirectory(dir);
    assert.equal(report.result, "FAIL");
    assert.equal(report.files.find(f => f.entity === "EligibilityAnswer")?.requiredColumns, "EMPTY_CONFIRMED");
    assert(report.issues.some(i => i.code === "DUPLICATE_LEGACY_ID"));
    assert(report.issues.some(i => i.code === "DUPLICATE_BUSINESS_KEY"));
    assert(report.issues.some(i => i.code === "ENUM_INVALID"));
    assert(report.issues.some(i => i.code === "UNRESOLVED_REFERENCE"));
    const serialized = JSON.stringify(report);
    for (const privateValue of [secret, "synthetic@example.invalid", "missing-private-id"])
      assert(!serialized.includes(privateValue));
    const rank = new Map(report.proposedImportOrder.map((entity, i) => [entity, i]));
    assert((rank.get("Membership") ?? -1) < (rank.get("Payment") ?? -1));
  } finally {
    assert.equal(dirname(resolve(dir)), resolve(tmpdir()));
    assert(basename(dir).startsWith("base44-synthetic-"));
    await rm(dir, { recursive: true, force: true });
  }
});
