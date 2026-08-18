import { AITriageResult, SeverityLevel, RiskItem, ComplianceControl, AutomationPlaybook } from '../types';

export interface TriageRequestPayload {
  incidentTitle: string;
  description: string;
  severity: SeverityLevel;
  affectedServices: string[];
  logs?: string;
}

export async function runAITriage(payload: TriageRequestPayload): Promise<AITriageResult> {
  const res = await fetch('/api/ai/triage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Triage API failed: ${res.statusText}`);
  }

  const data = await res.json();
  return data.data;
}

export interface ThreatModelRequestPayload {
  systemDescription: string;
  industry?: string;
  cloudEnvironment?: string;
}

export interface ThreatModelResponse {
  systemRiskScore: number;
  postureSummary: string;
  risks: Partial<RiskItem>[];
}

export async function runAIThreatModel(payload: ThreatModelRequestPayload): Promise<ThreatModelResponse> {
  const res = await fetch('/api/ai/threat-model', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Threat model API failed: ${res.statusText}`);
  }

  const data = await res.json();
  return data.data;
}

export interface ComplianceAuditResponse {
  framework: string;
  readinessScore: number;
  auditStatus: string;
  evaluatedControls: ComplianceControl[];
  topPriorityActions: string[];
}

export async function runAIComplianceAudit(
  framework: string,
  architectureDetails: string
): Promise<ComplianceAuditResponse> {
  const res = await fetch('/api/ai/compliance-audit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ framework, architectureDetails }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Compliance audit API failed: ${res.statusText}`);
  }

  const data = await res.json();
  return data.data;
}

export async function runAIMitigationPlaybook(threatTitle: string, context?: string): Promise<AutomationPlaybook> {
  const res = await fetch('/api/ai/mitigation-playbook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ threatTitle, context }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Playbook generation failed: ${res.statusText}`);
  }

  const data = await res.json();
  return data.data;
}
