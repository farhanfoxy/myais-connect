import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join, dirname, basename, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fields, fileFor, emptyEntities } from "./contract.ts";
import { parseArguments, run } from "./cli.ts";
import { calendarDate, utcTimestamp, decimal12_2, prepareImport, resolveData } from "./prepare.ts";
import type { ImportPlan, Scalar } from "./prepare.ts";
import { executeImport } from "./writer.ts";
import type { ImportDatabase } from "./writer.ts";

async function fixture(work: (directory: string) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "base44-write-test-"));
  try {
    for (const [entity, rules] of Object.entries(fields)) {
      const headers = [...new Set([...Object.keys(rules), "id", "created_date", "updated_date"])];
      await writeFile(join(directory, fileFor(entity)), emptyEntities.has(entity) ? "" : headers.join(",") + "\n");
    }
    await writeFile(join(directory, fileFor("User")), "email,role,created_date,updated_date\nsynthetic@example.invalid,user,2026-09-08T12:30:45.123Z,2026-09-08T12:30:45.123Z\n");
    await writeFile(join(directory, "Base44_User_ID_Mapping.txt"), "| id | email |\n| --- | --- |\n| u1 | synthetic@example.invalid |\n## Orphaned User References\n### Orphaned User ID: `deleted1`\n### Orphaned User ID: `deleted2`\n");
    await writeFile(join(directory, fileFor("MembershipType")), "id,code,name,entranceFee,membershipFee\nt1,ASSOCIATE,Synthetic Type,20,40\n");
    await writeFile(join(directory, fileFor("MembershipApplication")), "id,userId,status,approvedMembershipTypeId\na1,u1,ACTIVE,t1\n");
    await writeFile(join(directory, fileFor("Membership")), "id,userId,membershipTypeId,applicationId\nm1,u1,t1,a1\n");
    await writeFile(join(directory, fileFor("AuditLog")), "id,actorUserId,action,description,entityType,entityId\nl1,deleted1,Synthetic,Synthetic,MembershipApplication,p1\n");
    await writeFile(join(directory, fileFor("Notification")), "id,userId,title,message,relatedEntityType,relatedEntityId\nn1,u1,Synthetic,Synthetic,Payment,p1\n");
    await writeFile(join(directory, fileFor("Payment")), "id,userId,paymentType,totalAmount,applicationId,membershipId,verifiedByUserId,created_date,updated_date\np1,u1,ENTRANCE_AND_ANNUAL,60,a1,m1,deleted1,2026-09-08T12:30:45.123456,2026-09-08T12:30:45.123456\n");
    await writeFile(join(directory, fileFor("Event")), "id,title,category,description,venueType,startDate,startTime,createdBy,createdAt,updatedAt,created_date,updated_date,created_by\ne1,Synthetic,Seminars and Webinars,Synthetic,ONLINE,2026-09-09,09:30,system,2026-09-08T12:00:00.000Z,2026-09-08T13:00:00.000Z,2026-09-08T12:00:00,2026-09-08T13:00:00,synthetic-platform\n");
    await work(directory);
  } finally {
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    assert(basename(directory).startsWith("base44-write-test-"));
    await rm(directory, { recursive: true, force: true });
  }
}
class MemoryDatabase implements ImportDatabase {
  rows = new Map<string, Record<string, Scalar>>();
  insertCalls = 0;
  failAt = Infinity;
  closed = false;
  loseCommitAcknowledgement = false;
  async transaction<T>(work: Parameters<ImportDatabase["transaction"]>[0]): Promise<T> {
    const staged = new Map([...this.rows].map(([key, row]) => [key, { ...row }]));
    const result = await work({
      find: async (entity, legacyId) => staged.get(entity + ":" + legacyId) ?? null,
      insert: async (entity, id, data) => {
        this.insertCalls++;
        if (this.insertCalls === this.failAt) throw new Error("PRIVATE_DATABASE_CREDENTIAL_MUST_NOT_LEAK");
        staged.set(entity + ":" + data.legacyBase44Id, { id, ...data });
      },
    });
    this.rows = staged;
    if (this.loseCommitAcknowledgement) throw new Error("PRIVATE_COMMIT_ERROR");
    return result as T;
  }
  async close() { this.closed = true; }
}
async function planFor(directory: string): Promise<ImportPlan> {
  const prepared = await prepareImport(directory);
  assert.equal(prepared.audit.validation.errors, 0);
  assert.equal(prepared.failure, null);
  assert(prepared.plan);
  return prepared.plan;
}
test("timestamps use explicit UTC and calendar validation; decimals never silently round", () => {
  assert.equal(utcTimestamp("2026-09-08T12:30:45.123456", true), "2026-09-08T12:30:45.123Z");
  assert.equal(utcTimestamp("2026-09-08T12:30:45.123Z"), "2026-09-08T12:30:45.123Z");
  assert.equal(utcTimestamp("2026-09-08T12:30:45+08:00"), "2026-09-08T04:30:45.000Z");
  assert.throws(() => utcTimestamp("2026-09-08T12:30:45"));
  assert.throws(() => utcTimestamp("2026-02-30T12:00:00Z"));
  assert.throws(() => calendarDate("2026-02-30"));
  assert.equal(calendarDate("2024-02-29"), "2024-02-29");
  assert.equal(decimal12_2("60"), "60.00");
  assert.equal(decimal12_2("1.234e1"), "12.34");
  assert.equal(decimal12_2("9999999999.99"), "9999999999.99");
  assert.throws(() => decimal12_2("10000000000"));
  assert.throws(() => decimal12_2("1.001"));
});
test("CLI defaults to dry-run and rejects ambiguous write flags", async () => {
  assert.equal(parseArguments([]).write, false);
  assert.equal(parseArguments(["--input", "synthetic"]).write, false);
  assert.equal(parseArguments(["--write"]).write, true);
  for (const args of [["--write=true"], ["--write", "--write"], ["--input"], ["--unknown"]])
    assert.throws(() => parseArguments(args));
  await fixture(async directory => {
    const result = await run(["--input", directory]);
    assert.equal(result.exitCode, 0);
    assert.equal((result.report as { mode: string }).mode, "DRY_RUN");
  });
});
test("preflight builds exactly two disabled identities, NULL optionals and separate Event provenance", async () => {
  await fixture(async directory => {
    const plan = await planFor(directory);
    const historical = plan.rows.filter(row => row.label.startsWith("DeletedUser"));
    assert.equal(historical.length, 2);
    for (const row of historical) {
      assert.equal(row.data.accountStatus, "DISABLED");
      for (const key of ["email", "fullName", "legacyFullName", "role", "legacyRole", "legacyPlatformStatus", "phoneNumber", "photoUrl"])
        assert.equal(row.data[key], null);
      assert.notEqual(row.proposedId, row.legacyId);
    }
    const user = plan.rows.find(row => row.legacyId === "u1");
    assert.equal(user?.data.role, "APPLICANT");
    assert.equal(user?.data.legacyRole, "user");
    assert.equal(user?.data.accountStatus, null);
    const event = plan.rows.find(row => row.entity === "Event");
    assert.equal(event?.data.createdByUserId, null);
    assert.equal(event?.data.legacyCreatedBy, "system");
    assert.equal(event?.data.legacyPlatformCreatedBy, "synthetic-platform");
    assert.equal(event?.data.startTime, "09:30");
    assert.equal(event?.data.timezone, "Asia/Kuala_Lumpur");
    assert.equal(event?.data.createdAt, "2026-09-08T12:00:00.000Z");
    const payment = plan.rows.find(row => row.entity === "Payment");
    assert(payment);
    assert.equal(payment.data.totalAmount, "60.00");
    assert.equal(payment.data.entranceFee, null);
    assert.equal(resolveData(payment, plan.maps).verifiedByUserId, plan.maps.get("User")?.get("deleted1"));
    const log = plan.rows.find(row => row.entity === "AuditLog");
    const notification = plan.rows.find(row => row.entity === "Notification");
    assert(log && notification);
    assert.equal(resolveData(log, plan.maps).legacyEntityId, "p1");
    assert.equal(log.data.entityType, "MembershipApplication");
    assert.equal(resolveData(notification, plan.maps).legacyRelatedEntityId, "p1");
  });
});
test("write gate and dry-run errors refuse even opening a connection", async () => {
  await fixture(async directory => {
    const plan = await planFor(directory);
    let connections = 0;
    const connect = async () => { connections++; return new MemoryDatabase(); };
    assert.equal((await executeImport(plan, { write: false, validationErrors: 0 }, connect)).transaction, "NOT_STARTED");
    assert.equal((await executeImport(plan, { write: true, validationErrors: 1 }, connect)).transaction, "NOT_STARTED");
    assert.equal(connections, 0);
    await writeFile(join(directory, fileFor("Payment")), "id\np1\n");
    assert.equal((await prepareImport(directory)).plan, null);
  });
});
test("mock transaction inserts once, reuses existing UUIDs and skips identical retry", async () => {
  await fixture(async directory => {
    const db = new MemoryDatabase(), first = await planFor(directory);
    const one = await executeImport(first, { write: true, validationErrors: 0 }, async () => db);
    assert.equal(one.transaction, "COMMITTED");
    assert.equal(one.insertedRecords, first.rows.length);
    const second = await planFor(directory);
    const two = await executeImport(second, { write: true, validationErrors: 0 }, async () => db);
    assert.equal(two.result, "PASS");
    assert.equal(two.insertedRecords, 0);
    assert.equal(two.skippedRecords, first.rows.length);
    assert.equal(db.rows.get("Payment:p1")?.userId, db.rows.get("User:u1")?.id);
    assert(db.closed);
  });
});
test("existing conflicts abort without overwrites and reports never include private values", async () => {
  await fixture(async directory => {
    const db = new MemoryDatabase();
    const plan = await planFor(directory);
    await executeImport(plan, { write: true, validationErrors: 0 }, async () => db);
    const user = db.rows.get("User:u1");
    assert(user); user.fullName = "PRIVATE_NAME_NEVER_PRINT";
    const before = db.insertCalls;
    const report = await executeImport(await planFor(directory), { write: true, validationErrors: 0 }, async () => db);
    assert.equal(report.transaction, "ROLLED_BACK");
    assert.equal(report.failure?.code, "EXISTING_VALUE_CONFLICT");
    assert.equal(db.insertCalls, before);
    assert.equal(db.rows.get("User:u1")?.fullName, "PRIVATE_NAME_NEVER_PRINT");
    for (const secret of ["PRIVATE_NAME_NEVER_PRINT", "synthetic@example.invalid"])
      assert(!JSON.stringify(report).includes(secret));
  });
});
test("mock database failure rolls back all staged inserts and hides driver details", async () => {
  await fixture(async directory => {
    const db = new MemoryDatabase(); db.failAt = 3;
    const report = await executeImport(await planFor(directory), { write: true, validationErrors: 0 }, async () => db);
    assert.equal(report.transaction, "ROLLED_BACK");
    assert.equal(report.insertedRecords, 0);
    assert.equal(db.rows.size, 0);
    assert(!JSON.stringify(report).includes("PRIVATE_DATABASE_CREDENTIAL"));
  });
});

test("lost commit acknowledgement is reported as uncertain and retry remains idempotent", async () => {
  await fixture(async directory => {
    const db = new MemoryDatabase(); db.loseCommitAcknowledgement = true;
    const plan = await planFor(directory);
    const report = await executeImport(plan, { write: true, validationErrors: 0 }, async () => db);
    assert.equal(report.transaction, "COMMIT_UNCONFIRMED");
    assert.equal(report.insertedRecords, 0);
    assert.equal(report.unconfirmedInsertRecords, plan.rows.length);
    assert(!JSON.stringify(report).includes("PRIVATE_COMMIT_ERROR"));
    db.loseCommitAcknowledgement = false;
    const retry = await executeImport(await planFor(directory), { write: true, validationErrors: 0 }, async () => db);
    assert.equal(retry.skippedRecords, plan.rows.length);
    assert.equal(retry.insertedRecords, 0);
  });
});
