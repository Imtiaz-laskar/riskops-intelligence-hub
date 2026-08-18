import { AuditLogEntry } from '../types';
import { INITIAL_AUDIT_LOGS } from '../data/mockData';

export type WorkspaceAuditEventType =
  | 'GOOGLE_OAUTH_STARTED'
  | 'GOOGLE_OAUTH_SUCCESS'
  | 'GOOGLE_OAUTH_FAILED'
  | 'GOOGLE_REAUTH_REQUIRED'
  | 'GOOGLE_WORKBOOK_VERIFIED'
  | 'GOOGLE_SYNC_STARTED'
  | 'GOOGLE_SYNC_COMPLETED'
  | 'GOOGLE_SYNC_FAILED'
  | 'GOOGLE_IMPORT_STARTED'
  | 'GOOGLE_IMPORT_COMPLETED'
  | 'GOOGLE_IMPORT_FAILED'
  | 'GOOGLE_RECORD_CREATED'
  | 'GOOGLE_RECORD_UPDATED'
  | 'GOOGLE_SYNC_CONFLICT'
  | 'GOOGLE_IMPORT_REJECTED';

type AuditLogListener = (entry: AuditLogEntry) => void;

let listeners: AuditLogListener[] = [];
let localAuditLogs: AuditLogEntry[] = [...INITIAL_AUDIT_LOGS];

export function subscribeAuditLogs(listener: AuditLogListener) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function recordAuditEvent(params: {
  action: WorkspaceAuditEventType | string;
  targetId: string;
  details: string;
  outcome: 'Success' | 'Warning' | 'Failed';
  actor?: string;
}): AuditLogEntry {
  const newEntry: AuditLogEntry = {
    id: `AUD-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 899 + 100)}`,
    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
    actor: params.actor || 'SecOps Commander (imtiazh526@gmail.com)',
    action: params.action,
    targetId: params.targetId,
    details: params.details,
    outcome: params.outcome,
  };

  localAuditLogs = [newEntry, ...localAuditLogs];

  // Notify active listeners
  listeners.forEach((listener) => {
    try {
      listener(newEntry);
    } catch (e) {
      console.warn('Audit listener error:', e);
    }
  });

  return newEntry;
}

export function getAuditLogs(): AuditLogEntry[] {
  return localAuditLogs;
}
