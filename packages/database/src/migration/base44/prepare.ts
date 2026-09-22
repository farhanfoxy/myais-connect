import { randomUUID } from "node:crypto";
import { auditDirectory, transformRole } from "./audit.ts";
import type { InputSnapshot } from "./audit.ts";
import { fields, references } from "./contract.ts";
import { columns } from "./write-contract.ts";

export type Scalar = string | number | boolean | null;
export interface PlannedRow {
  entity: string;
  label: string;
  legacyId: string;
  proposedId: string;
  data: Record<string, Scalar>;
  generatedLifecycle: string[];
}
export interface ImportPlan {
  rows: PlannedRow[];
  order: string[];
  maps: Map<string, Map<string, string>>;
}
export class ImportFailure extends Error {
  code: string;
  entity?: string;
  label?: string;
  field?: string;
  constructor(code: string, entity?: string, label?: string, field?: string) {
    super(code); this.code = code; this.entity = entity; this.label = label; this.field = field;
  }
}
export function calendarDate(raw: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new ImportFailure("DATE_INVALID");
  const parsed = new Date(raw + "T00:00:00.000Z");
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== raw)
    throw new ImportFailure("DATE_INVALID");
  return raw;
}
export function utcTimestamp(raw: string, system = false): string {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})?$/.exec(raw);
  if (!m || !m[1] || (!m[6] && !system)) throw new ImportFailure("TIMESTAMP_INVALID");
  calendarDate(m[1]);
  if (Number(m[2]) > 23 || Number(m[3]) > 59 || Number(m[4]) > 59)
    throw new ImportFailure("TIMESTAMP_INVALID");
  const offset = m[6] ?? "Z";
  if (offset !== "Z" && (Number(offset.slice(1, 3)) > 23 || Number(offset.slice(4)) > 59))
    throw new ImportFailure("TIMESTAMP_INVALID");
  // Prisma DateTime/target timestamptz(3) use milliseconds. No host-local parsing.
  const explicit = m[1] + "T" + m[2] + ":" + m[3] + ":" + m[4] + "." +
    (m[5] ?? "").padEnd(3, "0").slice(0, 3) + offset;
  const parsed = new Date(explicit);
  if (!Number.isFinite(parsed.getTime())) throw new ImportFailure("TIMESTAMP_INVALID");
  return parsed.toISOString();
}
export function decimal12_2(raw: string): string {
  const m = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(raw);
  if (!m || !(m[2] || m[3])) throw new ImportFailure("DECIMAL_INVALID");
  const fraction = m[3] ?? "", exponent = Number(m[4] ?? "0");
  if (!Number.isInteger(exponent) || Math.abs(exponent) > 1000 || raw.length > 1100)
    throw new ImportFailure("DECIMAL_RANGE");
  let cents = BigInt((m[2] || "0") + fraction);
  const shift = 2 + exponent - fraction.length;
  if (shift >= 0) cents *= 10n ** BigInt(shift);
  else {
    const divisor = 10n ** BigInt(-shift);
    if (cents % divisor !== 0n) throw new ImportFailure("DECIMAL_SCALE");
    cents /= divisor;
  }
  if (cents > 999999999999n) throw new ImportFailure("DECIMAL_RANGE");
  return (m[1] === "-" && cents !== 0n ? "-" : "") + (cents / 100n) + "." + String(cents % 100n).padStart(2, "0");
}
const money = new Set(["MembershipType.entranceFee", "MembershipType.membershipFee", "Payment.entranceFee",
  "Payment.membershipFee", "Payment.totalAmount", "RenewalApplication.fee", "Event.memberFee", "Event.nonMemberFee"]);
const sourceNames: Record<string, Record<string, string>> = {
  User: { legacyFullName: "full_name", legacyPlatformStatus: "status" },
  AuditLog: { legacyEntityId: "entityId" },
  Notification: { legacyRelatedEntityId: "relatedEntityId" },
  Event: { createdByUserId: "createdBy", legacyCreatedBy: "createdBy", legacyPlatformCreatedBy: "created_by" },
};
function converted(entity: string, target: string, source: string, raw: string | undefined): Scalar {
  if (raw === undefined || raw === "") return null;
  if (money.has(entity + "." + target)) return decimal12_2(raw);
  const rule = fields[entity]?.[source], col = columns[entity]?.[target];
  if (col?.type === "Boolean") {
    if (raw !== "true" && raw !== "false") throw new ImportFailure("BOOLEAN_INVALID");
    return raw === "true";
  }
  if (rule?.format === "date") return calendarDate(raw);
  if (rule?.format === "date-time") return utcTimestamp(raw);
  if (col?.type === "Float") {
    const value = Number(raw);
    if (!raw.trim() || !Number.isFinite(value)) throw new ImportFailure("NUMBER_INVALID");
    return value;
  }
  if (rule?.values && !rule.values.includes(raw)) throw new ImportFailure("ENUM_INVALID");
  return raw;
}
export function buildPlan(snapshot: InputSnapshot, order: string[], now = new Date().toISOString()): ImportPlan {
  if (snapshot.mapping.deleted.length !== 2 || new Set(snapshot.mapping.deleted).size !== 2)
    throw new ImportFailure("EXACTLY_TWO_DELETED_IDENTITIES_REQUIRED");
  const maps = new Map(order.map(entity => [entity, new Map<string, string>()]));
  for (const [entity, table] of snapshot.tables) {
    const map = maps.get(entity);
    if (!map) throw new ImportFailure("ENTITY_UNMAPPED");
    for (const row of table.rows) {
      if (!row.id || map.has(row.id)) throw new ImportFailure("LEGACY_ID_INVALID", entity);
      map.set(row.id, randomUUID());
    }
  }
  const userMap = maps.get("User");
  if (!userMap) throw new ImportFailure("USER_STAGE_MISSING");
  for (const id of snapshot.mapping.deleted) {
    if (!id || userMap.has(id)) throw new ImportFailure("DELETED_ID_CONFLICT");
    userMap.set(id, randomUUID());
  }
  const rows: PlannedRow[] = [];
  for (const entity of order) {
    const definition = columns[entity];
    if (!definition) throw new ImportFailure("SCHEMA_ENTITY_UNMAPPED");
    for (const [index, source] of (snapshot.tables.get(entity)?.rows ?? []).entries()) {
      const label = entity + "Row" + (index + 1), data: Record<string, Scalar> = {};
      for (const [target, col] of Object.entries(definition)) {
        if (target === "id") continue;
        try {
          let value: Scalar;
          if (target === "legacyBase44Id") value = source.id ?? null;
          else if (target === "legacyCreatedAt" || target === "legacyUpdatedAt") {
            const raw = source[target === "legacyCreatedAt" ? "created_date" : "updated_date"];
            value = raw ? utcTimestamp(raw, true) : null;
          } else if (target === "createdAt" || target === "updatedAt") {
            const raw = source[entity === "Event" ? target : target === "createdAt" ? "created_date" : "updated_date"];
            value = raw ? utcTimestamp(raw, entity !== "Event") : now;
          } else if (entity === "User" && target === "role") value = transformRole(source.role ?? "").role;
          else if (entity === "User" && target === "legacyRole") value = transformRole(source.role ?? "").legacyRole;
          else if (entity === "Event" && target === "timezone") {
            value = source.timezone || "Asia/Kuala_Lumpur";
            new Intl.DateTimeFormat("en", { timeZone: value });
          } else {
            const field = sourceNames[entity]?.[target] ??
              ({ legacyCreatedById: "created_by_id", legacyCreatedBy: "created_by", legacyIsSample: "is_sample" } as Record<string, string>)[target] ?? target;
            value = converted(entity, target, field, source[field]);
          }
          if (value === null && !col.nullable) throw new ImportFailure("REQUIRED_TARGET_NULL");
          data[target] = value;
        } catch {
          throw new ImportFailure("TRANSFORM_INVALID", entity, label, target);
        }
      }
      // Future exports of schema-only empty entities must not silently lose platform data.
      for (const [sourceField, target] of [["created_by_id", "legacyCreatedById"], ["created_by", "legacyCreatedBy"], ["is_sample", "legacyIsSample"]] as const)
        if (source[sourceField] && !definition[target]) throw new ImportFailure("UNMAPPED_PLATFORM_DATA", entity, label);
      if (entity === "Event") {
        const creator = source.createdBy;
        data.createdByUserId = creator === "system" ? null : creator || null;
        data.legacyCreatedBy = creator && !userMap.has(creator) ? creator : null;
      }
      const legacyId = source.id;
      const proposedId = legacyId ? maps.get(entity)?.get(legacyId) : undefined;
      if (!legacyId || !proposedId) throw new ImportFailure("LEGACY_ID_INVALID", entity, label);
      const dateSource = entity === "Event" ? ["createdAt", "updatedAt"] : ["created_date", "updated_date"];
      rows.push({ entity, label, legacyId, proposedId, data,
        generatedLifecycle: dateSource.flatMap((field, i) => source[field] ? [] : [i === 0 ? "createdAt" : "updatedAt"]) });
    }
    if (entity === "User") snapshot.mapping.deleted.forEach((id, i) => {
      const data: Record<string, Scalar> = Object.fromEntries(Object.keys(definition).filter(f => f !== "id").map(f => [f, null]));
      Object.assign(data, { legacyBase44Id: id, accountStatus: "DISABLED", createdAt: now, updatedAt: now });
      const proposedId = userMap.get(id);
      if (!proposedId) throw new ImportFailure("DELETED_ID_MAP_MISSING");
      rows.push({ entity, label: "DeletedUser" + (i + 1), legacyId: id, proposedId, data, generatedLifecycle: ["createdAt", "updatedAt"] });
    });
  }
  return { rows, order, maps };
}
export async function prepareImport(directory: string) {
  let snapshot: InputSnapshot | undefined;
  const audit = await auditDirectory(directory, value => { snapshot = value; });
  if (audit.validation.errors || !snapshot) return { audit, plan: null, failure: "DRY_RUN_ERRORS" };
  try { return { audit, plan: buildPlan(snapshot, audit.proposedImportOrder), failure: null }; }
  catch (error) { return { audit, plan: null, failure: error instanceof ImportFailure ? error.code : "PREFLIGHT_FAILED" }; }
}
export function resolveData(row: PlannedRow, maps: ImportPlan["maps"]): Record<string, Scalar> {
  const data = { ...row.data };
  for (const ref of references.filter(r => r.entity === row.entity)) {
    const field = ref.entity === "Event" ? "createdByUserId" : ref.field;
    const legacy = data[field];
    if (legacy === null) continue;
    const id = typeof legacy === "string" ? maps.get(ref.target)?.get(legacy) : undefined;
    if (!id) throw new ImportFailure("UNRESOLVED_REFERENCE", row.entity, row.label, field);
    data[field] = id;
  }
  return data;
}
