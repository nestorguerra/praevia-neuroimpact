import type { AdminAuditEvent, DeletedAssetRecord } from "./types";

const auditKey = (organizationId: string) => `praevia:admin:audit:${organizationId}`;
const deletionKey = (organizationId: string) => `praevia:admin:deletions:${organizationId}`;

export function loadStoredAuditEvents(organizationId: string): AdminAuditEvent[] {
  try {
    const raw = localStorage.getItem(auditKey(organizationId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStoredAuditEvents(organizationId: string, events: AdminAuditEvent[]) {
  localStorage.setItem(auditKey(organizationId), JSON.stringify(events));
}

export function appendStoredAuditEvent(event: AdminAuditEvent) {
  const current = loadStoredAuditEvents(event.organizationId);
  saveStoredAuditEvents(event.organizationId, [event, ...current].slice(0, 200));
}

export function loadDeletedAssetRecords(organizationId: string): DeletedAssetRecord[] {
  try {
    const raw = localStorage.getItem(deletionKey(organizationId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveDeletedAssetRecords(organizationId: string, records: DeletedAssetRecord[]) {
  localStorage.setItem(deletionKey(organizationId), JSON.stringify(records));
}

export function appendDeletedAssetRecord(record: DeletedAssetRecord) {
  const current = loadDeletedAssetRecords(record.organizationId);
  saveDeletedAssetRecords(record.organizationId, [record, ...current].slice(0, 100));
}
