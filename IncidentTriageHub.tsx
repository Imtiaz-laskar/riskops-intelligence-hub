import React, { useState, useMemo } from 'react';
import {
  Flame,
  ShieldAlert,
  Play,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Terminal,
  Sparkles,
  Layers,
  Copy,
  Check,
  FileSpreadsheet,
  PlusCircle,
  X,
  Clock,
  Globe,
  Radio,
  Filter,
  Search,
  Lock,
  Unlock,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  AlertOctagon,
  ArrowRight,
  UserCheck,
  HelpCircle,
  CheckSquare,
  History,
  Activity,
  FileText,
  RotateCcw,
  Zap,
} from 'lucide-react';
import {
  IncidentItem,
  SeverityLevel,
  AITriageResult,
  RiskDomain,
  Region,
  TelemetrySource,
  IncidentStatus,
} from '../types';
import { runAITriage } from '../services/aiService';
import { Button } from './ui/Button';
import { AIInsight } from './ui/AIInsight';
import { ConfirmModal } from './ConfirmModal';
import { StatusBadge } from './ui/StatusBadge';

interface IncidentTriageHubProps {
  incidents: IncidentItem[];
  onUpdateIncident: (incident: IncidentItem) => void;
  onAddIncident: (incident: IncidentItem) => void;
  onOpenSheetsModal: () => void;
}

interface IncidentAuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  category: 'SYSTEM FACT' | 'AI INFERENCE' | 'HUMAN DECISION' | 'AUTOMATED ACTION' | 'VERIFICATION';
  details: string;
  outcome: 'Success' | 'Warning' | 'Pending';
}

export const IncidentTriageHub: React.FC<IncidentTriageHubProps> = ({
  incidents,
  onUpdateIncident,
  onAddIncident,
  onOpenSheetsModal,
}) => {
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>(
    incidents[0]?.id || ''
  );

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [domainFilter, setDomainFilter] = useState<string>('All');
  const [severityFilter, setSeverityFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Progressive Disclosure States
  const [showRawLogs, setShowRawLogs] = useState<boolean>(false);
  const [showDetailedEvidence, setShowDetailedEvidence] = useState<boolean>(false);
  const [showPlaybookCommands, setShowPlaybookCommands] = useState<boolean>(false);
  const [showFullAudit, setShowFullAudit] = useState<boolean>(false);

  // Async Execution / Processing States
  const [isTriaging, setIsTriaging] = useState<boolean>(false);
  const [triageError, setTriageError] = useState<string | null>(null);
  const [executingStepIndex, setExecutingStepIndex] = useState<number | null>(null);
  const [copiedBrief, setCopiedBrief] = useState<boolean>(false);

  // Human Decision State
  const [decisionReason, setDecisionReason] = useState<string>('');
  const [decisionActionType, setDecisionActionType] = useState<'approved' | 'rejected' | 'modified' | null>(null);

  // Safety Confirmation Modals State
  const [isEscalateModalOpen, setIsEscalateModalOpen] = useState(false);
  const [isAuthorizeModalOpen, setIsAuthorizeModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isExecuteAllModalOpen, setIsExecuteAllModalOpen] = useState(false);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);

  // Verification Checklist State
  const [verificationChecks, setVerificationChecks] = useState<{
    telemetryBaseline: boolean;
    servicesHealthy: boolean;
    threatSignalNeutralized: boolean;
    controlsRestored: boolean;
  }>({
    telemetryBaseline: true,
    servicesHealthy: true,
    threatSignalNeutralized: true,
    controlsRestored: true,
  });

  // New incident form state
  const [newTitle, setNewTitle] = useState('');
  const [newSeverity, setNewSeverity] = useState<SeverityLevel>('P1 - Critical');
  const [newDomain, setNewDomain] = useState<RiskDomain>('AI / Deepfake');
  const [newRegion, setNewRegion] = useState<Region>('South Asia');
  const [newSource, setNewSource] = useState<TelemetrySource>('LLM Monitoring Gateway');
  const [newServices, setNewServices] = useState('auth-service, api-gateway');
  const [newDesc, setNewDesc] = useState('');
  const [newLogs, setNewLogs] = useState('');

  // Filtered incidents
  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      const matchesSearch =
        !searchQuery ||
        inc.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (inc.threatVector && inc.threatVector.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesDomain = domainFilter === 'All' || inc.riskDomain === domainFilter;
      const matchesSeverity = severityFilter === 'All' || inc.severity.startsWith(severityFilter);
      const matchesStatus = statusFilter === 'All' || inc.status === statusFilter;

      return matchesSearch && matchesDomain && matchesSeverity && matchesStatus;
    });
  }, [incidents, searchQuery, domainFilter, severityFilter, statusFilter]);

  const activeIncident =
    incidents.find((i) => i.id === selectedIncidentId) ||
    filteredIncidents[0] ||
    incidents[0];

  // Derived SLA and Owner metrics
  const slaTargetMinutes = activeIncident?.severity.startsWith('P1') ? 30 : 120;
  const incidentAgeMinutes = useMemo(() => {
    if (!activeIncident) return 0;
    const ts = activeIncident.timestamp ? new Date(activeIncident.timestamp.replace(' UTC', 'Z')).getTime() : Date.now();
    return Math.max(5, Math.floor((Date.now() - (isNaN(ts) ? Date.now() - 15 * 60000 : ts)) / 60000));
  }, [activeIncident]);

  const slaRemainingMinutes = Math.max(0, slaTargetMinutes - incidentAgeMinutes);
  const isSlaBreached = slaRemainingMinutes === 0 && activeIncident?.status !== 'Resolved';

  // Authorization Status of Current Incident
  const isIncidentAuthorized = useMemo(() => {
    if (!activeIncident) return false;
    // An incident is authorized if its status is Mitigating, Contained, or Resolved,
    // or if containment actions have been approved
    return (
      activeIncident.status === 'Mitigating' ||
      activeIncident.status === 'Contained' ||
      activeIncident.status === 'Resolved' ||
      decisionActionType === 'approved'
    );
  }, [activeIncident, decisionActionType]);

  // AI Triage Trigger Handler (Preserving Backend API Contract)
  const handleRunAITriage = async () => {
    if (!activeIncident) return;
    setIsTriaging(true);
    setTriageError(null);
    try {
      const triageResult: AITriageResult = await runAITriage({
        incidentTitle: activeIncident.title,
        description: activeIncident.description,
        severity: activeIncident.severity,
        affectedServices: activeIncident.affectedServices,
        logs: activeIncident.logs,
      });

      const updated: IncidentItem = {
        ...activeIncident,
        cvssScore: triageResult.cvssScore,
        threatVector: triageResult.threatVector,
        rootCause: triageResult.rootCauseHypothesis,
        aiTriageResult: triageResult,
        status: activeIncident.status === 'Active' ? 'Investigating' : activeIncident.status,
      };

      onUpdateIncident(updated);
    } catch (err: any) {
      console.error('AI Triage error:', err);
      setTriageError(err.message || 'Gemini Threat Intelligence analysis failed to respond.');
    } finally {
      setIsTriaging(false);
    }
  };

  // Human Authorization Flow
  const handleAuthorizePlan = () => {
    if (!activeIncident) return;
    const updated: IncidentItem = {
      ...activeIncident,
      status: 'Mitigating',
      description: activeIncident.description.includes('[AUTHORIZED]')
        ? activeIncident.description
        : `${activeIncident.description} [AUTHORIZED by SecOps Commander on ${new Date().toLocaleTimeString()} — Rationale: ${decisionReason || 'Standard runbook authorization'}]`,
    };
    onUpdateIncident(updated);
    setDecisionActionType('approved');
    setIsAuthorizeModalOpen(false);
  };

  const handleRejectPlan = () => {
    if (!activeIncident) return;
    setDecisionActionType('rejected');
    setIsRejectModalOpen(false);
  };

  // Containment Step Execution (Preserving Logic)
  const handleExecuteContainmentStep = (stepIndex: number) => {
    if (!activeIncident || !activeIncident.aiTriageResult) return;
    setExecutingStepIndex(stepIndex);

    setTimeout(() => {
      const currentActions = [...activeIncident.aiTriageResult!.immediateContainmentActions];
      if (currentActions[stepIndex]) {
        currentActions[stepIndex].status = 'completed';
      }

      const allCompleted = currentActions.every((a) => a.status === 'completed');

      const updated: IncidentItem = {
        ...activeIncident,
        status: allCompleted ? 'Contained' : 'Mitigating',
        containedAt: allCompleted ? new Date().toISOString() : activeIncident.containedAt,
        aiTriageResult: {
          ...activeIncident.aiTriageResult!,
          immediateContainmentActions: currentActions,
        },
      };

      onUpdateIncident(updated);
      setExecutingStepIndex(null);
    }, 900);
  };

  // Execute All Steps
  const handleExecuteAllSteps = () => {
    if (!activeIncident || !activeIncident.aiTriageResult) return;
    setIsExecuteAllModalOpen(false);
    setIsTriaging(true);

    setTimeout(() => {
      const currentActions = activeIncident.aiTriageResult!.immediateContainmentActions.map((a) => ({
        ...a,
        status: 'completed' as const,
      }));

      const updated: IncidentItem = {
        ...activeIncident,
        status: 'Contained',
        containedAt: new Date().toISOString(),
        aiTriageResult: {
          ...activeIncident.aiTriageResult!,
          immediateContainmentActions: currentActions,
        },
      };

      onUpdateIncident(updated);
      setIsTriaging(false);
    }, 1200);
  };

  // Verification & Resolution Flow
  const handleVerifyAndResolve = () => {
    if (!activeIncident) return;
    const updated: IncidentItem = {
      ...activeIncident,
      status: 'Resolved',
    };
    onUpdateIncident(updated);
    setIsVerifyModalOpen(false);
  };

  // Escalation Handler
  const handleConfirmEscalation = () => {
    if (!activeIncident) return;
    const updated: IncidentItem = {
      ...activeIncident,
      status: 'Investigating',
      description: `${activeIncident.description} [ESCALATED to Tier 3 Executive Incident Commander by SecOps on ${new Date().toLocaleTimeString()}]`,
    };
    onUpdateIncident(updated);
    setIsEscalateModalOpen(false);
  };

  const handleCopyBrief = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedBrief(true);
    setTimeout(() => setCopiedBrief(false), 2000);
  };

  // Manual Incident Creator
  const handleCreateIncident = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newInc: IncidentItem = {
      id: `INC-${Math.floor(1000 + Math.random() * 9000)}`,
      title: newTitle.trim(),
      createdAt: new Date().toISOString().split('T')[0],
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
      riskDomain: newDomain,
      riskType: 'Impersonation',
      source: newSource,
      region: newRegion,
      severity: newSeverity,
      status: 'Active',
      affectedServices: newServices.split(',').map((s) => s.trim()).filter(Boolean),
      description: newDesc.trim() || 'Manual operational threat event recorded for incident command investigation.',
      logs: newLogs.trim() || `[${new Date().toISOString()}] WARN telemetry-ingress: Anomaly flagged by real-time agent`,
      cvssScore: newSeverity.startsWith('P1') ? 9.2 : 7.6,
    };

    onAddIncident(newInc);
    setSelectedIncidentId(newInc.id);
    setIsCreateModalOpen(false);
    setNewTitle('');
    setNewDesc('');
    setNewLogs('');
  };

  // Dynamic Audit Events for Active Incident
  const incidentAuditEvents: IncidentAuditEvent[] = useMemo(() => {
    if (!activeIncident) return [];
    const events: IncidentAuditEvent[] = [
      {
        id: 'aud-1',
        timestamp: activeIncident.timestamp || '2026-08-16 08:30:00 UTC',
        actor: activeIncident.source || 'Telemetry Sensor',
        action: 'Anomaly Ingress Detected & Logged',
        category: 'SYSTEM FACT',
        details: `Ingress telemetry match on source [${activeIncident.source || 'LLM Gateway'}]. Affects services: ${activeIncident.affectedServices?.join(', ') || 'Core API'}.`,
        outcome: 'Success',
      },
    ];

    if (activeIncident.aiTriageResult) {
      events.push({
        id: 'aud-2',
        timestamp: activeIncident.timestamp ? 'Triage +45s' : '08:30:45 UTC',
        actor: 'Gemini 3.7 Flash',
        action: 'Threat Intelligence Triage & CVSS Calculated',
        category: 'AI INFERENCE',
        details: `Calculated CVSS ${activeIncident.aiTriageResult.cvssScore} (${activeIncident.aiTriageResult.strideCategory}). Blast radius assessed across ${activeIncident.affectedServices?.length || 1} services.`,
        outcome: 'Success',
      });
    }

    if (activeIncident.description.includes('ESCALATED')) {
      events.push({
        id: 'aud-3',
        timestamp: 'Escalation Event',
        actor: 'SecOps Incident Commander',
        action: 'Severity Escalated to Tier 3 Executive Command',
        category: 'HUMAN DECISION',
        details: 'Dispatched emergency pager notifications and established high-priority response room.',
        outcome: 'Warning',
      });
    }

    if (isIncidentAuthorized) {
      events.push({
        id: 'aud-4',
        timestamp: 'Authorization Event',
        actor: 'SecOps Commander (Current User)',
        action: 'Containment Playbook Authorized',
        category: 'HUMAN DECISION',
        details: decisionReason ? `Reason: ${decisionReason}` : 'Human commander approved automated playbook containment steps.',
        outcome: 'Success',
      });
    }

    if (activeIncident.status === 'Mitigating' || activeIncident.status === 'Contained' || activeIncident.status === 'Resolved') {
      const completedCount = activeIncident.aiTriageResult?.immediateContainmentActions?.filter((a) => a.status === 'completed').length || 0;
      events.push({
        id: 'aud-5',
        timestamp: activeIncident.containedAt || 'Containment Step',
        actor: 'Automated Playbook Runner',
        action: `Controlled Containment Step(s) Enforced (${completedCount} steps)`,
        category: 'AUTOMATED ACTION',
        details: 'Executed sandboxed containment commands against target infrastructure.',
        outcome: 'Success',
      });
    }

    if (activeIncident.status === 'Contained' || activeIncident.status === 'Resolved') {
      events.push({
        id: 'aud-6',
        timestamp: activeIncident.containedAt || 'Verification',
        actor: 'SecOps Validation Agent',
        action: 'Containment Baseline Verified',
        category: 'VERIFICATION',
        details: 'Healthcheck probe verified telemetry noise reduced to baseline < 0.05 anomaly threshold.',
        outcome: 'Success',
      });
    }

    if (activeIncident.status === 'Resolved') {
      events.push({
        id: 'aud-7',
        timestamp: 'Resolution Event',
        actor: 'Incident Commander',
        action: 'Incident Marked Formally Resolved',
        category: 'VERIFICATION',
        details: 'Closed incident with residual risk downgraded to Low. Synced with audit register.',
        outcome: 'Success',
      });
    }

    return events;
  }, [activeIncident, isIncidentAuthorized, decisionReason]);

  return (
    <div id="incident-command-workspace" className="space-y-5">
      {/* Top Action Bar: Command Navigation, Manual Ingress & Sheets Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              Incident Command Center
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
              01_Incidents Stream
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Operational investigation, AI-assisted root-cause hypothesis, human decision gates, and verified response execution.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-1.5 shadow-xs"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Log Threat Event</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onOpenSheetsModal}
            className="flex items-center gap-1.5 text-emerald-400 border-emerald-500/30 hover:bg-emerald-950/40"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Sync to Sheet</span>
          </Button>
        </div>
      </div>

      {/* Main Command Layout: Left Stream (4 cols) & Right Deep Command Center (8 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN: Incidents Stream & Filter Navigator (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          {/* Stream Filter Controls */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search ID, title, threat vector..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-slate-300 focus:outline-none"
              >
                <option value="All">All Severity</option>
                <option value="P1">P1 Critical</option>
                <option value="P2">P2 High</option>
                <option value="P3">P3 Medium</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-slate-300 focus:outline-none"
              >
                <option value="All">All Status</option>
                <option value="Active">Active</option>
                <option value="Investigating">Investigating</option>
                <option value="Mitigating">Mitigating</option>
                <option value="Contained">Contained</option>
                <option value="Resolved">Resolved</option>
              </select>

              <select
                value={domainFilter}
                onChange={(e) => setDomainFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-slate-300 focus:outline-none truncate"
              >
                <option value="All">All Domains</option>
                <option value="AI / Deepfake">AI/Deepfake</option>
                <option value="Platform Abuse">Platform Abuse</option>
                <option value="System Integrity">System Integrity</option>
                <option value="Data Privacy">Data Privacy</option>
                <option value="Platform Security">Platform Security</option>
              </select>
            </div>
          </div>

          {/* Stream Header & Active Count */}
          <div className="flex items-center justify-between px-1 text-xs">
            <span className="font-semibold text-slate-400 uppercase tracking-wider text-[11px]">
              Triage Queue ({filteredIncidents.length})
            </span>
            <span className="font-mono text-[11px] text-slate-500">
              {filteredIncidents.filter((i) => i.status !== 'Resolved').length} Unresolved
            </span>
          </div>

          {/* Incidents Stream List */}
          <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
            {filteredIncidents.map((inc) => {
              const isSelected = activeIncident?.id === inc.id;
              const isP1 = inc.severity.startsWith('P1');
              const isP2 = inc.severity.startsWith('P2');

              return (
                <div
                  key={inc.id}
                  id={`incident-stream-card-${inc.id}`}
                  onClick={() => {
                    setSelectedIncidentId(inc.id);
                    setDecisionActionType(null);
                    setDecisionReason('');
                  }}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-slate-850 border-indigo-500 shadow-sm ring-1 ring-indigo-500/20'
                      : 'bg-slate-900/80 border-slate-800 hover:bg-slate-850 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono font-bold text-slate-300">
                      {inc.id}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${
                          isP1
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : isP2
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        }`}
                      >
                        {inc.severity.split(' - ')[0]}
                      </span>
                      <StatusBadge status={inc.status} />
                    </div>
                  </div>

                  <h4 className="mt-1 text-xs font-semibold text-slate-100 line-clamp-1">
                    {inc.title}
                  </h4>

                  <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[10px] font-mono">
                    <span className="px-1.5 py-0.5 rounded bg-slate-950 text-indigo-300 border border-slate-800">
                      {inc.riskDomain || 'General'}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
                      {inc.region || 'Global'}
                    </span>
                    {inc.cvssScore && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-950 text-rose-300 border border-slate-800 font-bold">
                        CVSS {inc.cvssScore}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredIncidents.length === 0 && (
              <div className="p-8 text-center bg-slate-900/60 border border-slate-800 rounded-xl">
                <p className="text-xs text-slate-400">No matching incidents found in queue.</p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Operational Investigation & Command Center (8 cols) */}
        {activeIncident ? (
          <div
            id="incident-command-panel"
            className="lg:col-span-8 space-y-4"
          >
            {/* ======================================================== */}
            {/* INCIDENT HEADER: Compact, High-Information Operational Header */}
            {/* ======================================================== */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-mono font-bold text-indigo-300 bg-indigo-500/10 px-2.5 py-0.5 rounded-md border border-indigo-500/20">
                      {activeIncident.id}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                        activeIncident.severity.startsWith('P1')
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {activeIncident.severity}
                    </span>
                    <StatusBadge status={activeIncident.status} />
                    <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {activeIncident.timestamp}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-100 tracking-tight mt-1">
                    {activeIncident.title}
                  </h3>

                  {/* Metadata Chips */}
                  <div className="flex flex-wrap items-center gap-2 text-xs pt-1">
                    <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300 text-[11px] font-mono">
                      Domain: <strong className="text-indigo-300 font-semibold">{activeIncident.riskDomain || 'AI / Deepfake'}</strong>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300 text-[11px] font-mono">
                      Source: <strong className="text-slate-200">{activeIncident.source || 'Telemetry Sensor'}</strong>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300 text-[11px] font-mono">
                      Region: <strong className="text-slate-200">{activeIncident.region || 'Global Operations'}</strong>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300 text-[11px] font-mono">
                      Owner: <strong className="text-slate-200">SecOps Incident Commander</strong>
                    </span>
                  </div>
                </div>

                {/* Header Metrics: Risk Score, CVSS & SLA Tracker */}
                <div className="flex sm:flex-col items-end gap-2 shrink-0">
                  <div className="text-right flex sm:flex-col items-center sm:items-end gap-2 sm:gap-0">
                    <div className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">
                      Severity Posture
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-sm font-bold font-mono text-rose-400">
                        CVSS {activeIncident.cvssScore ?? (activeIncident.severity.startsWith('P1') ? 9.2 : 7.5)}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">
                        (Risk {activeIncident.severity.startsWith('P1') ? '94/100' : '72/100'})
                      </span>
                    </div>
                  </div>

                  <div className="text-right pt-1">
                    <div className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">
                      SLA Target
                    </div>
                    <div className="flex items-center gap-1 font-mono text-xs font-semibold mt-0.5">
                      {activeIncident.status === 'Resolved' ? (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Met
                        </span>
                      ) : isSlaBreached ? (
                        <span className="text-rose-400 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Breached
                        </span>
                      ) : (
                        <span className="text-amber-300">
                          {slaRemainingMinutes}m remaining
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* State-Aware Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-slate-400">
                    Current Stage: <strong className="text-slate-200">{activeIncident.status}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Action 1: Investigate / Deep Triage */}
                  <Button
                    size="xs"
                    variant="primary"
                    onClick={handleRunAITriage}
                    disabled={isTriaging}
                    className="flex items-center gap-1.5"
                  >
                    {isTriaging ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
                    )}
                    <span>{isTriaging ? 'Triaging Threat...' : activeIncident.aiTriageResult ? 'Re-Run AI Triage' : 'Run AI Deep Triage'}</span>
                  </Button>

                  {/* Action 2: Escalate (Available for Active / Investigating) */}
                  {(activeIncident.status === 'Active' || activeIncident.status === 'Investigating') && (
                    <Button
                      size="xs"
                      variant="destructive"
                      onClick={() => setIsEscalateModalOpen(true)}
                      className="flex items-center gap-1.5"
                    >
                      <AlertOctagon className="w-3.5 h-3.5" />
                      <span>Escalate Incident</span>
                    </Button>
                  )}

                  {/* Action 3: Verify Containment (Only if Contained) */}
                  {activeIncident.status === 'Contained' && (
                    <Button
                      size="xs"
                      variant="primary"
                      onClick={() => setIsVerifyModalOpen(true)}
                      className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Verify Baseline & Resolve</span>
                    </Button>
                  )}

                  {/* Action 4: Formally Resolve (If Investigating / Mitigating manual override) */}
                  {activeIncident.status !== 'Resolved' && activeIncident.status !== 'Contained' && (
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => setIsVerifyModalOpen(true)}
                      className="flex items-center gap-1.5 text-emerald-400 border-emerald-500/30 hover:bg-emerald-950/30"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Verify & Resolve</span>
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* ======================================================== */}
            {/* SECTION 1 — INCIDENT SUMMARY: WHAT HAPPENED? */}
            {/* ======================================================== */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  Section 1 • Incident Summary & Ingress Scope
                </h4>
                <button
                  type="button"
                  onClick={() => setShowRawLogs(!showRawLogs)}
                  className="text-[11px] font-mono text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  <Terminal className="w-3 h-3" />
                  <span>{showRawLogs ? 'Hide Raw Log Buffer' : 'View Ingress Logs'}</span>
                  {showRawLogs ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="md:col-span-2 space-y-2">
                  <div className="text-[11px] font-mono text-slate-400">Observed Description:</div>
                  <p className="text-xs text-slate-200 leading-relaxed bg-slate-950 p-3 rounded-lg border border-slate-800">
                    {activeIncident.description}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="text-[11px] font-mono text-slate-400">Affected Infrastructure:</div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1.5">
                    {activeIncident.affectedServices?.map((srv, i) => (
                      <div key={i} className="flex items-center gap-1.5 font-mono text-[11px] text-cyan-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                        <span>{srv}</span>
                      </div>
                    ))}
                    {(!activeIncident.affectedServices || activeIncident.affectedServices.length === 0) && (
                      <span className="text-[11px] text-slate-500">No service tags registered</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Progressive Disclosure: Raw Log Buffer */}
              {showRawLogs && (
                <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span className="flex items-center gap-1 text-emerald-400">
                      <Terminal className="w-3 h-3" />
                      STDERR / STDOUT Ingress Telemetry
                    </span>
                    <span>Raw Stream Capture</span>
                  </div>
                  <pre className="text-[11px] font-mono text-emerald-400/90 bg-slate-950 p-3 rounded-lg border border-slate-800 max-h-36 overflow-y-auto whitespace-pre-wrap">
                    {activeIncident.logs}
                  </pre>
                </div>
              )}
            </div>

            {/* ======================================================== */}
            {/* SECTION 2 — EVIDENCE & TELEMETRY WORKSPACE */}
            {/* Strict Separation: OBSERVED FACTS vs AI INTERPRETATION vs UNKNOWN */}
            {/* ======================================================== */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  Section 2 • Evidence & Telemetry Triangulation
                </h4>
                <span className="text-[10px] font-mono text-slate-500 uppercase">
                  Zero-Hypothesis Fact Grounding
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                {/* 1. OBSERVED FACTS (SYSTEM FACT) */}
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                    <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      SYSTEM FACTS
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">Confirmed</span>
                  </div>
                  <ul className="space-y-1.5 text-[11px] text-slate-300">
                    <li className="flex items-start gap-1.5">
                      <span className="text-emerald-500 font-mono">•</span>
                      <span>Sensor: <strong>{activeIncident.source || 'LLM Gateway'}</strong></span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-emerald-500 font-mono">•</span>
                      <span>Ingress Timestamp: <span className="font-mono text-slate-400">{activeIncident.timestamp}</span></span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-emerald-500 font-mono">•</span>
                      <span>Active Services Impacted: <strong className="text-slate-200">{activeIncident.affectedServices?.join(', ') || '1 node'}</strong></span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-emerald-500 font-mono">•</span>
                      <span>Telemetry Signature Matched: <span className="font-mono text-cyan-300">{activeIncident.riskType || 'Threat Event'}</span></span>
                    </li>
                  </ul>
                </div>

                {/* 2. AI INTERPRETATION (AI INFERENCE) */}
                <div className="bg-slate-950 p-3.5 rounded-xl border border-indigo-500/20 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                    <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-indigo-400 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      AI INFERENCES
                    </span>
                    <span className="text-[10px] font-mono text-indigo-400/80">Hypothesis</span>
                  </div>
                  <ul className="space-y-1.5 text-[11px] text-slate-300">
                    <li className="flex items-start gap-1.5">
                      <span className="text-indigo-400 font-mono">•</span>
                      <span>Inferred Vector: <strong>{activeIncident.threatVector || 'Vector extraction pending triage'}</strong></span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-indigo-400 font-mono">•</span>
                      <span>STRIDE Category: <strong className="text-indigo-300">{activeIncident.aiTriageResult?.strideCategory || 'Elevation of Privilege / Spoofing'}</strong></span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-indigo-400 font-mono">•</span>
                      <span>Assessed Blast: <span className="text-slate-300">{activeIncident.aiTriageResult?.blastRadius || 'Contained to ingress proxy'}</span></span>
                    </li>
                  </ul>
                </div>

                {/* 3. UNKNOWN / INFORMATION GAPS (UNKNOWN) */}
                <div className="bg-slate-950 p-3.5 rounded-xl border border-amber-500/20 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                    <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-amber-400 flex items-center gap-1">
                      <HelpCircle className="w-3 h-3" />
                      UNKNOWNS
                    </span>
                    <span className="text-[10px] font-mono text-amber-400/80">Unconfirmed</span>
                  </div>
                  <ul className="space-y-1.5 text-[11px] text-slate-400">
                    <li className="flex items-start gap-1.5">
                      <span className="text-amber-500 font-mono">•</span>
                      <span>Full external adversary actor IP identity & ASN origin</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-amber-500 font-mono">•</span>
                      <span>Downstream cached token reuse outside telemetry window</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-amber-500 font-mono">•</span>
                      <span>Residual secondary database replication consistency</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* ======================================================== */}
            {/* SECTION 3 — RISK ASSESSMENT: HOW SERIOUS IS IT? */}
            {/* ======================================================== */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-amber-400" />
                  Section 3 • Risk Assessment & Blast Radius Posture
                </h4>
                <span className="text-[10px] font-mono text-slate-400">
                  CVSS v3.1 Matrix
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 font-mono uppercase block">Likelihood</span>
                  <span className="text-sm font-bold font-mono text-slate-200">
                    {activeIncident.severity.startsWith('P1') ? '5 / 5 (High)' : '4 / 5 (Medium)'}
                  </span>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 font-mono uppercase block">Impact</span>
                  <span className="text-sm font-bold font-mono text-slate-200">
                    {activeIncident.severity.startsWith('P1') ? '5 / 5 (Critical)' : '4 / 5 (Major)'}
                  </span>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 font-mono uppercase block">Current CVSS</span>
                  <span className="text-sm font-bold font-mono text-rose-400">
                    {activeIncident.cvssScore ?? (activeIncident.severity.startsWith('P1') ? 9.2 : 7.6)}
                  </span>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 font-mono uppercase block">Blast Radius</span>
                  <span className="text-sm font-bold font-mono text-indigo-300">
                    {activeIncident.affectedServices?.length || 1} Tier Services
                  </span>
                </div>
              </div>
            </div>

            {/* ======================================================== */}
            {/* SECTION 4 — INCIDENT TIMELINE: OPERATIONAL CHRONOLOGY */}
            {/* ======================================================== */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  Section 4 • Incident Lifecycle Timeline
                </h4>
                <span className="text-[10px] font-mono text-slate-500">
                  Single Chronological Narrative
                </span>
              </div>

              {/* Visual Linear Narrative Timeline */}
              <div className="relative pl-6 space-y-3.5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800 text-xs">
                {incidentAuditEvents.map((evt, idx) => (
                  <div key={evt.id || idx} className="relative flex items-start gap-3">
                    <span
                      className={`absolute -left-6 top-1 w-4 h-4 rounded-full border-2 border-slate-900 flex items-center justify-center text-[9px] font-bold ${
                        evt.category === 'SYSTEM FACT'
                          ? 'bg-emerald-500 text-slate-950'
                          : evt.category === 'AI INFERENCE'
                          ? 'bg-indigo-500 text-white'
                          : evt.category === 'HUMAN DECISION'
                          ? 'bg-amber-500 text-slate-950'
                          : evt.category === 'AUTOMATED ACTION'
                          ? 'bg-cyan-500 text-slate-950'
                          : 'bg-emerald-400 text-slate-950'
                      }`}
                    />
                    <div className="flex-1 bg-slate-950 p-2.5 rounded-lg border border-slate-800/90 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-slate-200">{evt.action}</span>
                        <div className="flex items-center gap-2 text-[10px] font-mono">
                          <span className="text-slate-500">{evt.timestamp}</span>
                          <span className="px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-slate-400">
                            {evt.category}
                          </span>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">{evt.details}</p>
                      <div className="text-[10px] font-mono text-slate-500 pt-0.5">
                        Actor: <strong className="text-slate-400">{evt.actor}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ======================================================== */}
            {/* SECTION 5 — AI ASSESSMENT: WHAT DOES AI THINK? */}
            {/* Graceful Fallback & Contextual Enrichment with Gemini */}
            {/* ======================================================== */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  Section 5 • AI Threat Intelligence Assessment
                </h4>
                <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                  Gemini 3.7 Flash
                </span>
              </div>

              {triageError && (
                <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <strong>AI Assessment Unavailable:</strong> {triageError}
                    <div className="mt-1 text-[11px] text-slate-400">
                      Core incident data, telemetry, and manual command controls remain fully accessible.
                    </div>
                  </div>
                </div>
              )}

              {activeIncident.aiTriageResult ? (
                <div className="space-y-3 text-xs">
                  <AIInsight
                    title="Gemini Contextual Threat Assessment"
                    hypothesis={activeIncident.aiTriageResult.rootCauseHypothesis}
                    confidence={84}
                    provenance="Gemini 3.7 Flash • Contextual Assessment"
                    recommendedAction={activeIncident.aiTriageResult.immediateContainmentActions?.[0]?.title}
                    evidence={[
                      `Matched threat vector: ${activeIncident.aiTriageResult.threatVector}`,
                      `Classification: ${activeIncident.aiTriageResult.strideCategory}`,
                    ]}
                    unknowns={[
                      'Attacker session persistent duration outside edge proxy window',
                      'Cross-tenant token contamination risk during token invalidation',
                    ]}
                  />

                  {/* Stakeholder Briefing */}
                  {activeIncident.aiTriageResult.stakeholderBriefing && (
                    <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <span className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-wider block mb-1">
                          CISO & Leadership Briefing
                        </span>
                        <p className="text-xs text-slate-300 italic leading-relaxed">
                          "{activeIncident.aiTriageResult.stakeholderBriefing}"
                        </p>
                      </div>
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => handleCopyBrief(activeIncident.aiTriageResult!.stakeholderBriefing)}
                        className="shrink-0"
                      >
                        {copiedBrief ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-6 rounded-xl bg-slate-950 border border-slate-800 text-center space-y-2">
                  <p className="text-xs text-slate-400">
                    AI deep triage has not been executed on this incident yet.
                  </p>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={handleRunAITriage}
                    disabled={isTriaging}
                    className="inline-flex items-center gap-1.5"
                  >
                    {isTriaging ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    <span>Run AI Threat Assessment</span>
                  </Button>
                </div>
              )}
            </div>

            {/* ======================================================== */}
            {/* SECTION 6 — HUMAN DECISION: AI PROPOSAL VS HUMAN GATE */}
            {/* ======================================================== */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-amber-400" />
                  Section 6 • Human Decision & Command Authorization Gate
                </h4>
                <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  Required Prior to Execution
                </span>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 text-xs">
                {/* AI Recommendation display */}
                <div className="space-y-1 border-b border-slate-800/80 pb-3">
                  <span className="text-[10px] font-bold font-mono text-indigo-400 uppercase tracking-wider block">
                    AI Recommended Countermeasure:
                  </span>
                  <p className="text-xs text-slate-200">
                    {activeIncident.aiTriageResult?.immediateContainmentActions?.[0]?.title ||
                      'Automated endpoint token revocation and ingress firewall rate-limiting'}
                  </p>
                </div>

                {/* Decision Form & Reason */}
                <div className="space-y-2">
                  <label className="block text-[11px] font-mono text-slate-400">
                    Incident Commander Rationale / Operational Note:
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Containment authorized following telemetry confirmation and active blast radius bounds"
                    value={decisionReason}
                    onChange={(e) => setDecisionReason(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-0.5">
                    <span>Decision Maker: <strong>SecOps Commander (Current User)</strong></span>
                    <span>Audit Time: <strong>{new Date().toLocaleTimeString()}</strong></span>
                  </div>
                </div>

                {/* Human Authorization Controls */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
                  <div className="flex items-center gap-2">
                    {isIncidentAuthorized ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                        <Lock className="w-3.5 h-3.5" />
                        <span>Containment Plan Authorized</span>
                      </span>
                    ) : decisionActionType === 'rejected' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold">
                        <X className="w-3.5 h-3.5" />
                        <span>Plan Rejected by Commander</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
                        <Unlock className="w-3.5 h-3.5" />
                        <span>Awaiting Commander Authorization</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {!isIncidentAuthorized && (
                      <>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setIsRejectModalOpen(true)}
                          className="text-xs"
                        >
                          Reject Recommendation
                        </Button>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => setIsAuthorizeModalOpen(true)}
                          className="text-xs flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Authorize Containment Plan</span>
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ======================================================== */}
            {/* SECTION 7 — CONTROLLED RESPONSE: PLAYBOOK & STEP RUNNER */}
            {/* ======================================================== */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Terminal className="w-4 h-4 text-cyan-400" />
                    Section 7 • Controlled Containment Playbook Execution
                  </h4>
                  <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                    State: {isIncidentAuthorized ? 'Authorized for Execution' : 'Awaiting Authorization Gate'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPlaybookCommands(!showPlaybookCommands)}
                    className="text-[11px] font-mono text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                  >
                    <span>{showPlaybookCommands ? 'Hide Commands' : 'Show Commands'}</span>
                    {showPlaybookCommands ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>

                  {isIncidentAuthorized && activeIncident.aiTriageResult?.immediateContainmentActions?.some((a) => a.status !== 'completed') && (
                    <Button
                      size="xs"
                      variant="primary"
                      onClick={() => setIsExecuteAllModalOpen(true)}
                      className="bg-indigo-600 hover:bg-indigo-500 text-xs"
                    >
                      Execute All Authorized Steps
                    </Button>
                  )}
                </div>
              </div>

              {/* Playbook Steps Container */}
              {activeIncident.aiTriageResult?.immediateContainmentActions && activeIncident.aiTriageResult.immediateContainmentActions.length > 0 ? (
                <div className="space-y-2.5">
                  {activeIncident.aiTriageResult.immediateContainmentActions.map((action, idx) => (
                    <div
                      key={action.step || idx}
                      id={`containment-step-card-${idx}`}
                      className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-md bg-slate-850 text-indigo-300 font-mono text-xs flex items-center justify-center font-bold border border-slate-800">
                            {action.step}
                          </span>
                          <span className="font-semibold text-slate-200">
                            {action.title}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500">
                            ~{action.estimatedDuration}
                          </span>
                        </div>

                        {showPlaybookCommands && (
                          <pre className="mt-2 text-[11px] font-mono text-cyan-300/90 bg-slate-900 p-2.5 rounded border border-slate-800 overflow-x-auto">
                            {action.command}
                          </pre>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="xs"
                          variant={action.status === 'completed' ? 'outline' : isIncidentAuthorized ? 'primary' : 'outline'}
                          disabled={action.status === 'completed' || executingStepIndex === idx || !isIncidentAuthorized}
                          onClick={() => handleExecuteContainmentStep(idx)}
                          className={action.status === 'completed' ? 'text-emerald-400 border-emerald-500/30' : ''}
                        >
                          {action.status === 'completed' ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Enforced</span>
                            </>
                          ) : executingStepIndex === idx ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Executing...</span>
                            </>
                          ) : !isIncidentAuthorized ? (
                            <>
                              <Lock className="w-3.5 h-3.5 text-amber-400" />
                              <span>Awaiting Authorization</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5" />
                              <span>Execute Step</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center text-xs text-slate-400">
                  Playbook actions will generate automatically following AI Threat Triage.
                </div>
              )}
            </div>

            {/* ======================================================== */}
            {/* SECTION 8 & 9 — VERIFICATION & RESIDUAL RISK */}
            {/* ======================================================== */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Section 8 & 9 • Containment Verification & Residual Risk
                </h4>
                <StatusBadge status={activeIncident.status} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Verification Checks */}
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                  <span className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider block border-b border-slate-800 pb-1">
                    Telemetry Verification Probes
                  </span>
                  <div className="space-y-1.5 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                      <input
                        type="checkbox"
                        checked={verificationChecks.telemetryBaseline}
                        onChange={(e) => setVerificationChecks({ ...verificationChecks, telemetryBaseline: e.target.checked })}
                        className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0"
                      />
                      <span>Telemetry noise returned to baseline (&lt; 0.05 anomaly index)</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                      <input
                        type="checkbox"
                        checked={verificationChecks.servicesHealthy}
                        onChange={(e) => setVerificationChecks({ ...verificationChecks, servicesHealthy: e.target.checked })}
                        className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0"
                      />
                      <span>Affected microservices healthy & latency normalized</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                      <input
                        type="checkbox"
                        checked={verificationChecks.threatSignalNeutralized}
                        onChange={(e) => setVerificationChecks({ ...verificationChecks, threatSignalNeutralized: e.target.checked })}
                        className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0"
                      />
                      <span>Adversarial exploit vector severed & tokens rotated</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                      <input
                        type="checkbox"
                        checked={verificationChecks.controlsRestored}
                        onChange={(e) => setVerificationChecks({ ...verificationChecks, controlsRestored: e.target.checked })}
                        className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0"
                      />
                      <span>Compliance control state enforced (SOC 2 / ISO 27001)</span>
                    </label>
                  </div>
                </div>

                {/* Residual Risk Before & After */}
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                  <span className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider block border-b border-slate-800 pb-1">
                    Risk Posture Delta (Before → After)
                  </span>
                  <div className="space-y-2 pt-1 font-mono">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-500">Initial Threat Severity:</span>
                      <span className="text-rose-400 font-bold">{activeIncident.severity} (CVSS {activeIncident.cvssScore || '9.0+'})</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-500">Containment Enforcement:</span>
                      <span className="text-cyan-400 font-bold">{activeIncident.status === 'Resolved' || activeIncident.status === 'Contained' ? '100% Enforced' : 'In Progress'}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] pt-1 border-t border-slate-800">
                      <span className="text-slate-400">Residual Risk Exposure:</span>
                      <span className="text-emerald-400 font-bold">Low / Controlled</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-400">Resolution Status:</span>
                      <span className={activeIncident.status === 'Resolved' ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                        {activeIncident.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ======================================================== */}
            {/* SECTION 10 — TAMPER-EVIDENT AUDIT TRAIL */}
            {/* ======================================================== */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <History className="w-4 h-4 text-slate-400" />
                  Section 10 • Tamper-Evident Incident Audit Ledger
                </h4>
                <button
                  type="button"
                  onClick={() => setShowFullAudit(!showFullAudit)}
                  className="text-[11px] font-mono text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  <span>{showFullAudit ? 'Compact View' : `View Full History (${incidentAuditEvents.length})`}</span>
                </button>
              </div>

              <div className="space-y-2">
                {(showFullAudit ? incidentAuditEvents : incidentAuditEvents.slice(0, 3)).map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-200">{item.action}</span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-900 text-slate-400 border border-slate-800">
                          {item.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{item.details}</p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] font-mono text-slate-500">
                        <span>Actor: {item.actor}</span>
                        <span>•</span>
                        <span>{item.timestamp}</span>
                      </div>
                    </div>

                    <div className="shrink-0">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {item.outcome}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* ======================================================== */}
      {/* SAFETY CONFIRMATION MODALS */}
      {/* ======================================================== */}

      {/* Safety Modal: ESCALATION CONFIRMATION */}
      {isEscalateModalOpen && activeIncident && (
        <ConfirmModal
          isOpen={isEscalateModalOpen}
          title={`Escalate Incident ${activeIncident.id}`}
          isDestructive={true}
          confirmText="Confirm Operational Escalation"
          cancelLabel="Cancel"
          onConfirm={handleConfirmEscalation}
          onCancel={() => setIsEscalateModalOpen(false)}
          onClose={() => setIsEscalateModalOpen(false)}
        >
          <div className="space-y-2 text-xs text-slate-300">
            <p>
              Initiating operational severity escalation for <strong className="text-slate-100">{activeIncident.title}</strong> will alert on-call Tier 3 Commanders, publish high-priority dispatch webhooks, and log an audit escalation entry.
            </p>
            <div className="p-2.5 rounded bg-slate-950 border border-slate-800 text-[11px] font-mono text-rose-300">
              Severity: {activeIncident.severity} • CVSS {activeIncident.cvssScore || '9.0+'}
            </div>
          </div>
        </ConfirmModal>
      )}

      {/* Safety Modal: AUTHORIZATION CONFIRMATION */}
      {isAuthorizeModalOpen && activeIncident && (
        <ConfirmModal
          isOpen={isAuthorizeModalOpen}
          title={`Authorize Containment Plan for ${activeIncident.id}`}
          isDestructive={false}
          confirmText="Authorize & Enable Execution"
          cancelLabel="Cancel"
          onConfirm={handleAuthorizePlan}
          onCancel={() => setIsAuthorizeModalOpen(false)}
          onClose={() => setIsAuthorizeModalOpen(false)}
        >
          <div className="space-y-2 text-xs text-slate-300">
            <p>
              You are authorizing the controlled containment countermeasure. Human authorization is cryptographically logged in the immutable audit ledger.
            </p>
            <div className="p-2.5 rounded bg-slate-950 border border-slate-800 text-[11px] font-mono text-cyan-300 space-y-1">
              <div>Incident: {activeIncident.title}</div>
              <div>Rationale: {decisionReason || 'Standard runbook authorization by Commander'}</div>
            </div>
          </div>
        </ConfirmModal>
      )}

      {/* Safety Modal: REJECT CONFIRMATION */}
      {isRejectModalOpen && activeIncident && (
        <ConfirmModal
          isOpen={isRejectModalOpen}
          title={`Reject AI Recommendation for ${activeIncident.id}`}
          isDestructive={true}
          confirmText="Confirm Rejection"
          cancelLabel="Cancel"
          onConfirm={handleRejectPlan}
          onCancel={() => setIsRejectModalOpen(false)}
          onClose={() => setIsRejectModalOpen(false)}
        >
          <div className="space-y-2 text-xs text-slate-300">
            <p>
              Rejecting this AI proposal will retain the incident in an Investigating state until manual countermeasures or alternative runbooks are assigned.
            </p>
          </div>
        </ConfirmModal>
      )}

      {/* Safety Modal: EXECUTE ALL CONFIRMATION */}
      {isExecuteAllModalOpen && activeIncident && (
        <ConfirmModal
          isOpen={isExecuteAllModalOpen}
          title={`Execute All Containment Steps for ${activeIncident.id}`}
          isDestructive={false}
          confirmText="Execute All Steps"
          cancelLabel="Cancel"
          onConfirm={handleExecuteAllSteps}
          onCancel={() => setIsExecuteAllModalOpen(false)}
          onClose={() => setIsExecuteAllModalOpen(false)}
        >
          <div className="space-y-2 text-xs text-slate-300">
            <p>
              This will sequentially execute all {activeIncident.aiTriageResult?.immediateContainmentActions?.length || 0} authorized containment commands and transition the incident to <strong>Contained</strong>.
            </p>
          </div>
        </ConfirmModal>
      )}

      {/* Safety Modal: VERIFY & RESOLVE CONFIRMATION */}
      {isVerifyModalOpen && activeIncident && (
        <ConfirmModal
          isOpen={isVerifyModalOpen}
          title={`Verify Containment & Resolve ${activeIncident.id}`}
          isDestructive={false}
          confirmText="Mark Incident Formally Resolved"
          cancelLabel="Cancel"
          onConfirm={handleVerifyAndResolve}
          onCancel={() => setIsVerifyModalOpen(false)}
          onClose={() => setIsVerifyModalOpen(false)}
        >
          <div className="space-y-2 text-xs text-slate-300">
            <p>
              Verifying that all containment probes pass and operational risk has normalized to <strong>Low</strong>.
            </p>
            <div className="p-2.5 rounded bg-slate-950 border border-slate-800 text-[11px] font-mono text-emerald-300">
              Target State: Resolved • SLA Criteria Met
            </div>
          </div>
        </ConfirmModal>
      )}

      {/* Log Threat Event Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Flame className="w-5 h-5 text-rose-500" />
                Log Security Threat Incident
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateIncident} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Incident Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Synthetic Voice Clone Ingress on Support IVR"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Risk Domain
                  </label>
                  <select
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value as RiskDomain)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200"
                  >
                    <option value="AI / Deepfake">AI / Deepfake</option>
                    <option value="Platform Abuse">Platform Abuse</option>
                    <option value="System Integrity">System Integrity</option>
                    <option value="Data Privacy">Data Privacy</option>
                    <option value="Platform Security">Platform Security</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Region
                  </label>
                  <select
                    value={newRegion}
                    onChange={(e) => setNewRegion(e.target.value as Region)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200"
                  >
                    <option value="South Asia">South Asia</option>
                    <option value="Europe">Europe</option>
                    <option value="North America">North America</option>
                    <option value="Global Operations">Global Operations</option>
                    <option value="Latin America">Latin America</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Telemetry Source
                  </label>
                  <select
                    value={newSource}
                    onChange={(e) => setNewSource(e.target.value as TelemetrySource)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200"
                  >
                    <option value="LLM Monitoring Gateway">LLM Monitoring Gateway</option>
                    <option value="KYC Verification Service">KYC Verification Service</option>
                    <option value="Database Firewall">Database Firewall</option>
                    <option value="API Gateway Telemetry">API Gateway Telemetry</option>
                    <option value="OSINT Monitoring">OSINT Monitoring</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Severity Level
                  </label>
                  <select
                    value={newSeverity}
                    onChange={(e) => setNewSeverity(e.target.value as SeverityLevel)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200"
                  >
                    <option value="P1 - Critical">P1 - Critical</option>
                    <option value="P2 - High">P2 - High</option>
                    <option value="P3 - Medium">P3 - Medium</option>
                    <option value="P4 - Low">P4 - Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Describe detected telemetry anomaly..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Raw Logs (Optional)
                </label>
                <textarea
                  rows={2}
                  value={newLogs}
                  onChange={(e) => setNewLogs(e.target.value)}
                  placeholder="[19:30:11] ALERT gateway: Deepfake signature flagged..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200 font-mono text-[11px]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  size="sm"
                >
                  Record Incident
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

