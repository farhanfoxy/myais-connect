import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseCsv } from "./csv.ts";
import type { CsvTable } from "./csv.ts";
import { fields, references, uniqueKeys, emptyEntities, canonicalRoles, fileFor } from "./contract.ts";

interface Issue {
  severity: "ERROR" | "WARNING";
  code: string;
  entity?: string;
  field?: string;
  row?: number;
  label?: string;
}
interface FileReport {
  file: string;
  entity: string;
  rows: number;
  parse: "PASS" | "FAIL";
  requiredColumns: "PASS" | "FAIL" | "EMPTY_CONFIRMED";
  missingRequiredColumns: string[];
  absentOptionalColumns: number;
  unknownColumns: number;
  enumChecks: number;
  enumErrors: number;
}
export interface Mapping {
  users: { id: string; email: string; status: string }[];
  deleted: string[];
}
export function parseMapping(text: string): Mapping {
  const current = text.split("## Orphaned User References")[0] ?? "";
  const users: Mapping["users"] = [];
  let headers: string[] = [];
  const clean = (v: string): string => v.trim().replace(/^`|`$/g, "");
  for (const line of current.split(/\r?\n/)) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line.trim().replace(/^\||\|$/g, "").split("|").map(clean);
    if (cells.includes("id") && cells.includes("email")) { headers = cells; continue; }
    if (cells.every(v => /^:?-+:?$/.test(v))) continue;
    if (!headers.length) continue;
    if (cells.length !== headers.length) throw new Error("MAPPING_ROW_WIDTH");
    const record = Object.fromEntries(headers.map((key, i) => [key, cells[i] ?? ""]));
    if (!record.id || !record.email) throw new Error("MAPPING_IDENTITY_MISSING");
    users.push({ id: record.id, email: record.email, status: record.status ?? "" });
  }
  const deleted = [...text.matchAll(/^### Orphaned User ID:\s*`([^`]+)`\s*$/gm)].map(m => m[1] ?? "");
  if (!users.length) throw new Error("MAPPING_USERS_MISSING");
  return { users, deleted };
}

export function transformRole(raw: string): { role: string | null; legacyRole: string | null } {
  if (!raw) return { role: null, legacyRole: null };
  const normalized = raw.toUpperCase();
  const role = normalized === "USER" ? "APPLICANT" :
    normalized === "ADMIN" ? "SYSTEM_ADMINISTRATOR" : normalized;
  if (!canonicalRoles.has(role)) throw new Error("ROLE_UNKNOWN");
  return { role, legacyRole: raw };
}

async function readUtf8(path: string): Promise<string> {
  return new TextDecoder("utf-8", { fatal: true }).decode(await readFile(path));
}

async function csvPaths(directory: string): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error("INPUT_SYMLINK");
    if (entry.isDirectory()) result.push(...await csvPaths(path));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".csv")) result.push(path);
  }
  return result.sort();
}

export interface InputSnapshot {
  tables: Map<string, CsvTable>;
  mapping: Mapping;
}

export async function auditDirectory(directory: string, capture?: (snapshot: InputSnapshot) => void) {
  const issues: Issue[] = [];
  const issue = (severity: Issue["severity"], code: string, entity?: string, field?: string,
    row?: number, label?: string): void => { issues.push({ severity, code, entity, field, row, label }); };
  const tables = new Map<string, CsvTable>();
  const files: FileReport[] = [];
  const entityNames = Object.keys(fields);
  let paths: string[];
  try { paths = await csvPaths(directory); }
  catch { paths = []; issue("ERROR", "INPUT_DIRECTORY_UNREADABLE"); }
  const expected = new Map(entityNames.map(entity => [fileFor(entity), entity]));
  let unknown = 0;
  for (const path of paths) {
    const name = path.split(/[\\/]/).at(-1) ?? "";
    const known = expected.get(name);
    const entity = known ?? "UnmappedCSV" + (++unknown);
    const report: FileReport = { file: known ? fileFor(known) : entity + ".csv", entity,
      rows: 0, parse: "PASS", requiredColumns: "PASS", missingRequiredColumns: [],
      absentOptionalColumns: 0, unknownColumns: 0, enumChecks: 0, enumErrors: 0 };
    files.push(report);
    let table: CsvTable;
    try { table = parseCsv(await readUtf8(path)); }
    catch { report.parse = "FAIL"; report.requiredColumns = "FAIL"; issue("ERROR", "CSV_PARSE_OR_ENCODING", entity); continue; }
    report.rows = table.rows.length;
    if (!known) { issue("ERROR", "UNMAPPED_CSV", entity); continue; }
    if (tables.has(known)) { issue("ERROR", "DUPLICATE_ENTITY_FILE", known); continue; }
    tables.set(known, table);
    if (!table.headers.length) {
      if (emptyEntities.has(known)) report.requiredColumns = "EMPTY_CONFIRMED";
      else { report.requiredColumns = "FAIL"; issue("ERROR", "UNEXPECTED_EMPTY_FILE", known); }
      continue;
    }
    const rules = fields[known] ?? {};
    const required = Object.entries(rules).filter(([, rule]) => rule.required).map(([field]) => field);
    required.push(...(known === "User" ? ["email"] : ["id"]));
    report.missingRequiredColumns = required.filter(field => !table.headers.includes(field));
    report.requiredColumns = report.missingRequiredColumns.length ? "FAIL" : "PASS";
    for (const field of report.missingRequiredColumns) issue("ERROR", "REQUIRED_COLUMN_MISSING", known, field);
    report.absentOptionalColumns = Object.entries(rules).filter(([field, rule]) =>
      !rule.required && !table.headers.includes(field)).length;
    const platform = known === "User" ? ["email", "full_name", "fullName", "status", "id", "created_date", "updated_date"] :
      ["id", "created_date", "updated_date", "created_by_id", "created_by", "is_sample", ...(known === "Event" ? ["timezone"] : [])];
    report.unknownColumns = table.headers.filter(field => !(field in rules) && !platform.includes(field)).length;
    if (report.unknownColumns) issue("ERROR", "UNMAPPED_COLUMNS", known);
    for (const [index, record] of table.rows.entries()) {
      for (const field of required)
        if (!(record[field] ?? "").trim()) issue("ERROR", "REQUIRED_VALUE_BLANK", known, field, index + 1);
      for (const [field, rule] of Object.entries(rules)) {
        const value = record[field] ?? "";
        if (!value) continue;
        if (rule.values) {
          report.enumChecks++;
          let valid = rule.values.includes(value);
          if (known === "User" && field === "role") {
            try { transformRole(value); valid = true; } catch { valid = false; }
          }
          if (!valid) { report.enumErrors++; issue("ERROR", "ENUM_INVALID", known, field, index + 1); }
        }
        if (rule.type === "boolean" && value !== "true" && value !== "false")
          issue("ERROR", "BOOLEAN_INVALID", known, field, index + 1);
        if (rule.type === "number" && (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value) || !Number.isFinite(Number(value))))
          issue("ERROR", "NUMBER_INVALID", known, field, index + 1);
      }
    }
  }
  for (const entity of entityNames)
    if (!tables.has(entity)) issue("ERROR", "ENTITY_FILE_MISSING", entity);

  let mapping: Mapping = { users: [], deleted: [] };
  let mappingRead = false;
  try { mapping = parseMapping(await readUtf8(join(directory, "Base44_User_ID_Mapping.txt"))); mappingRead = true; }
  catch { issue("ERROR", "MAPPING_MISSING_OR_INVALID"); }
  const duplicates = (values: string[], entity: string, field: string, code: string): number => {
    const seen = new Set<string>(); let count = 0;
    values.forEach((value, i) => {
      if (!value) return;
      if (seen.has(value)) { count++; issue("ERROR", code, entity, field, i + 1); }
      seen.add(value);
    });
    return count;
  };
  duplicates(mapping.users.map(u => u.id), "UserMapping", "id", "DUPLICATE_MAPPING_ID");
  duplicates(mapping.users.map(u => u.email), "UserMapping", "email", "DUPLICATE_MAPPING_EMAIL");
  duplicates(mapping.deleted, "DeletedUserMapping", "id", "DUPLICATE_DELETED_ID");
  for (const id of mapping.deleted)
    if (mapping.users.some(u => u.id === id)) issue("ERROR", "CURRENT_DELETED_ID_CONFLICT");
  const deleted = new Map(mapping.deleted.map((id, i) => [id, "DeletedUser" + String(i + 1).padStart(2, "0")]));
  const users = tables.get("User")?.rows ?? [];
  const roles: Record<string, number> = {};
  const transformedUsers: { legacyBase44Id: string; role: string | null; legacyRole: string | null }[] = [];
  const matched = new Set<string>();
  users.forEach((user, i) => {
    const matches = mapping.users.filter(u => u.email === user.email);
    if (matches.length !== 1) { issue("ERROR", "USER_MAPPING_UNRESOLVED", "User", "id", i + 1); return; }
    const match = matches[0];
    if (!match) return;
    if (user.id && user.id !== match.id) issue("ERROR", "USER_MAPPING_ID_CONFLICT", "User", "id", i + 1);
    user.id = match.id;
    matched.add(match.id);
    if (user.status && user.status !== match.status)
      issue("WARNING", "PLATFORM_STATUS_MAPPING_DIFFERS", "User", "status", i + 1);
    try {
      const transformed = transformRole(user.role ?? "");
      transformedUsers.push({ legacyBase44Id: match.id, ...transformed });
      if (transformed.role) roles[transformed.role] = (roles[transformed.role] ?? 0) + 1;
    } catch { /* ENUM_INVALID already recorded without exposing the value. */ }
  });
  for (const user of mapping.users)
    if (!matched.has(user.id)) issue("ERROR", "MAPPED_USER_NOT_EXPORTED", "User");
  const ids = new Map<string, Set<string>>();
  let duplicateLegacyIds = 0;
  for (const [entity, table] of tables) {
    duplicateLegacyIds += duplicates(table.rows.map(r => r.id ?? ""), entity, "id", "DUPLICATE_LEGACY_ID");
    ids.set(entity, new Set(table.rows.map(r => r.id).filter((id): id is string => Boolean(id))));
  }
  const businessKeys = uniqueKeys.map(key => {
    const [entity = "", field = ""] = key.split(".");
    const rows = tables.get(entity)?.rows ?? [];
    return { entity, field, nonblank: rows.filter(r => Boolean(r[field])).length,
      duplicates: duplicates(rows.map(r => r[field] ?? ""), entity, field, "DUPLICATE_BUSINESS_KEY") };
  });
  const referenceChecks = references.map(ref => {
    const counts = { ...ref, rows: 0, blank: 0, resolved: 0, deleted: 0, platform: 0, unresolved: 0 };
    (tables.get(ref.entity)?.rows ?? []).forEach((r, i) => {
      counts.rows++;
      const value = r[ref.field];
      if (!value) { counts.blank++; return; }
      if (ids.get(ref.target)?.has(value)) counts.resolved++;
      else if (ref.target === "User" && deleted.has(value)) {
        counts.deleted++; issue("WARNING", "DELETED_USER_REFERENCE", ref.entity, ref.field, i + 1, deleted.get(value));
      } else if (ref.entity === "Event" && ref.field === "createdBy" && value === "system") {
        counts.platform++; issue("WARNING", "EVENT_SYSTEM_CREATOR", ref.entity, ref.field, i + 1);
      } else { counts.unresolved++; issue("ERROR", "UNRESOLVED_REFERENCE", ref.entity, ref.field, i + 1); }
    });
    return counts;
  });
  const platformCreators = { currentUser: 0, deletedUser: 0, serviceMarked: 0, unresolved: 0 };
  for (const [entity, table] of tables) table.rows.forEach((row, i) => {
    const value = row.created_by_id;
    if (!value) return;
    if (ids.get("User")?.has(value)) platformCreators.currentUser++;
    else if (deleted.has(value)) {
      platformCreators.deletedUser++;
      issue("WARNING", "DELETED_PLATFORM_CREATOR", entity, "created_by_id", i + 1, deleted.get(value));
    } else if (/service/i.test(value)) {
      platformCreators.serviceMarked++;
      issue("WARNING", "SERVICE_MARKED_METADATA_UNVERIFIED", entity, "created_by_id", i + 1);
    } else { platformCreators.unresolved++; issue("WARNING", "UNRESOLVED_PLATFORM_CREATOR", entity, "created_by_id", i + 1); }
  });
  const polymorphic = { resolved: 0, blank: 0, mismatchedType: 0, unresolved: 0 };
  for (const [entity, typeField, idField] of [
    ["AuditLog", "entityType", "entityId"], ["Notification", "relatedEntityType", "relatedEntityId"],
  ] as const) (tables.get(entity)?.rows ?? []).forEach((r, i) => {
    const value = r[idField], type = r[typeField] ?? "";
    if (!value) { polymorphic.blank++; if (type) issue("WARNING", "POLYMORPHIC_TARGET_BLANK", entity, idField, i + 1); }
    else if (ids.get(type)?.has(value)) polymorphic.resolved++;
    else if ([...ids.values()].some(set => set.has(value))) {
      polymorphic.mismatchedType++; issue("WARNING", "POLYMORPHIC_TYPE_MISMATCH", entity, idField, i + 1);
    } else { polymorphic.unresolved++; issue("WARNING", "POLYMORPHIC_TARGET_UNRESOLVED", entity, idField, i + 1); }
  });
  const timestamps: { entity: string; field: string; blank: number; offsetless: number; offsetAware: number; dateOnly: number; invalid: number }[] = [];
  for (const [entity, table] of tables) {
    const rules = fields[entity] ?? {};
    const dateFields = new Set(["created_date", "updated_date", ...Object.entries(rules).filter(([, r]) => r.format).map(([field]) => field)]);
    for (const field of dateFields) {
      if (!table.headers.includes(field)) continue;
      const count = { entity, field, blank: 0, offsetless: 0, offsetAware: 0, dateOnly: 0, invalid: 0 };
      for (const [i, row] of table.rows.entries()) {
        const value = row[field] ?? "";
        if (!value) count.blank++;
        else if (rules[field]?.format === "date" && /^\d{4}-\d{2}-\d{2}$/.test(value)) count.dateOnly++;
        else if (rules[field]?.format !== "date" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value)) count.offsetless++;
        else if (rules[field]?.format !== "date" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) count.offsetAware++;
        else { count.invalid++; issue("ERROR", "TIMESTAMP_SYNTAX_INVALID", entity, field, i + 1); }
      }
      timestamps.push(count);
    }
  }
  const proposedImportOrder: string[] = [];
  const pending = new Set(entityNames);
  while (pending.size) {
    const ready = [...pending].filter(entity => references.filter(r => r.entity === entity).every(r => proposedImportOrder.includes(r.target)));
    if (!ready.length) { issue("ERROR", "REFERENCE_DEPENDENCY_CYCLE"); break; }
    for (const entity of ready) { proposedImportOrder.push(entity); pending.delete(entity); }
  }
  const errors = issues.filter(i => i.severity === "ERROR").length;
  const blockersBeforeWrite = [
    ...(errors ? ["Resolve dry-run validation errors."] : []),
    ...(deleted.size ? ["Create disabled non-login identities for mapping-listed deleted humans; no invented personal data."] : []),
    ...(timestamps.some(t => t.offsetless) ? ["Write mode must interpret offset-less system timestamps as approved UTC; dry-run leaves them unchanged."] : []),
    ...(polymorphic.mismatchedType || polymorphic.unresolved ? ["Implement approved raw polymorphic provenance preservation; do not repair target inconsistencies."] : []),
    ...(platformCreators.serviceMarked || platformCreators.unresolved ? ["Retain and review unresolved platform principal provenance without fake users."] : []),
    "Dry-run does not authorize writes; --write and write-mode preflight are required.",
  ];
  // Pass the exact audited bytes as parsed records to write preflight, never to output.
  capture?.({ tables, mapping });
  // Return only allowlisted metadata/counts. Never return rows, mappings, values or caught errors.
  return {
    mode: "DRY_RUN", result: errors ? "FAIL" : "PASS",
    meaning: "PASS means files were audited without structural/required/enum/key/FK errors; known legacy warnings do not imply write readiness.",
    writeReady: false, files, csvFilesRead: files.filter(f => f.parse === "PASS").length,
    entitiesRead: tables.size, totalRows: files.reduce((sum, f) => sum + f.rows, 0),
    userMapping: { file: "Base44_User_ID_Mapping.txt", read: mappingRead, currentUsers: mapping.users.length,
      matchedUsers: matched.size, rolesTransformedInMemory: transformedUsers.length, canonicalRoleCounts: roles,
      deletedIdentities: [...deleted.values()].map(label => ({ label, writePhaseRequirement: "Disabled non-login identity; no invented personal data." })) },
    validation: { errors, warnings: issues.length - errors, duplicateLegacyIds, businessKeys },
    referenceChecks, platformCreators, polymorphic, timestamps,
    proposedImportOrder, issues, blockersBeforeWrite,
  };
}
