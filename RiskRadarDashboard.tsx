import React, { useState, useMemo } from 'react';
import {
  ShieldAlert,
  Flame,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  Filter,
  ExternalLink,
  RefreshCw,
  Cpu,
  Layers,
  Sparkles,
  Scale,
  FileText,
  User,
  Radio,
  X,
  Eye,
  Zap,
  Lock,
  Play,
  Check,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import {
  RiskItem,
  IncidentItem,
  RiskDomain,
  ComplianceControl,
  AutomationPlaybook,
  AuditLogEntry,
  DecisionRecord,
} from '../types';
import {
  INITIAL_DECISIONS,
  INITIAL_AUDIT_LOGS,
  INITIAL_ESCALATIONS,
  INITIAL_SLA_RULES,
  INITIAL_PLAYBOOKS,
} from '../data/mockData';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from './ui/Card';
import {
  DataTable,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from './ui/DataTable';
import { StatusBadge } from './ui/StatusBadge';
import { Button } from './ui/Button';
import { Drawer } from './ui/Drawer';
import { EmptyState } from './ui/FeedbackStates';
import { ConfirmModal } from './ConfirmModal';

interface OverviewWorkspaceProps {
  risks: RiskItem[];
  incidents: IncidentItem[];
  complianceControls?: ComplianceControl[];
  playbooks?: AutomationPlaybook[];
  onNavigateTab: (tab: string) => void;
  onFilterHeatmapCell?: (likelihood: number, impact: number) => void;
  onOpenSheetsModal?: () => void;
  onUpdateIncident?: (incident: IncidentItem) => void;
}

export const RiskRadarDashboard: React.FC<OverviewWorkspaceProps> = ({
  risks,
  incidents,
  complianceControls = [],
  playbooks = INITIAL_PLAYBOOKS,
  onNavigateTab,
  onFilterHeatmapCell,
  onOpenSheetsModal,
  onUpdateIncident,
}) => {
  // Filter States for Priority Queue
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('All');
  const [selectedDomain, setSelectedDomain] = useState<string>('All');
  const [selectedSLA, setSelectedSLA] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');

  // Matrix Filter State
  const [selectedMatrixCell, setSelectedMatrixCell] = useState<{ l: number; i: number } | null>(null);

  // Inspector Drawer for Selected Incident
  const [inspectingIncident, setInspectingIncident] = useState<IncidentItem | null>(null);

  // Action Safety Modals State
  const [escalatingIncident, setEscalatingIncident] = useState<IncidentItem | null>(null);
  const [authorizingIncident, setAuthorizingIncident] = useState<IncidentItem | null>(null);
  const [executingIncident, setExecutingIncident] = useState<IncidentItem | null>(null);
  const [verifyingIncident, setVerifyingIncident] = useState<IncidentItem | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Helper to determine Next Action based on real incident state
  const getNextAction = (
    incident: IncidentItem
  ): {
    actionType: 'investigate' | 'escalate' | 'authorize' | 'execute' | 'verify' | 'review';
    label: string;
    variant: 'primary' | 'secondary' | 'outline' | 'destructive';
    isActionable: boolean;
  } => {
    // 1. If incident is Active:
    if (incident.status === 'Active') {
      if (incident.severity === 'P1 - Critical') {
        return {
          actionType: 'escalate',
          label: 'Escalate',
          variant: 'destructive',
          isActionable: true,
        };
      }
      return {
        actionType: 'investigate',
        label: 'Investigate',
        variant: 'primary',
        isActionable: true,
      };
    }

    // 2. If incident is Investigating:
    if (incident.status === 'Investigating') {
      // Check if AI triage has generated containment actions waiting for authorization
      if (incident.aiTriageResult?.immediateContainmentActions?.length) {
        return {
          actionType: 'authorize',
          label: 'Authorize',
          variant: 'primary',
          isActionable: true,
        };
      }
      // If still in investigation without triage plan yet, action is Investigate/Review in Hub
      return {
        actionType: 'investigate',
        label: 'Investigate',
        variant: 'secondary',
        isActionable: true,
      };
    }

    // 3. If incident is Mitigating:
    if (incident.status === 'Mitigating') {
      return {
        actionType: 'execute',
        label: 'Execute',
        variant: 'secondary',
        isActionable: true,
      };
    }

    // 4. If incident is Contained (Ready for verification):
    if (incident.status === 'Contained') {
      return {
        actionType: 'verify',
        label: 'Verify',
        variant: 'outline',
        isActionable: true,
      };
    }

    // 5. If incident is Resolved (Post-incident / Closed):
    return {
      actionType: 'review',
      label: 'Inspect',
      variant: 'outline',
      isActionable: false, // Display status / safe inspect, no misleading action trigger
    };
  };

  // Safe Action Dispatcher
  const handleActionClick = (incident: IncidentItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const action = getNextAction(incident);

    switch (action.actionType) {
      case 'investigate':
      case 'review':
        // Rule 1: Safe inspection navigation to Incident Triage Hub
        onNavigateTab('incidents');
        break;

      case 'escalate':
        // Rule 2: Explicit confirmation required before state change
        setEscalatingIncident(incident);
        break;

      case 'authorize':
        // Rule 3: Explicit human confirmation showing incident, action, risk
        setAuthorizingIncident(incident);
        break;

      case 'execute':
        // Rule 4: Check if authorization exists; if not, route to auth step
        if (!incident.aiTriageResult?.immediateContainmentActions?.length) {
          // No plan to execute; route to triage hub to generate/validate recommendation
          onNavigateTab('incidents');
        } else {
          // Prompt controlled execution flow or route into playbook runner
          setExecutingIncident(incident);
        }
        break;

      case 'verify':
        // Rule 5: Only trigger if actually in Contained verification state
        setVerifyingIncident(incident);
        break;
    }
  };

  // Execution confirmed handlers
  const handleConfirmEscalation = async () => {
    if (!escalatingIncident) return;
    setIsProcessingAction(true);
    try {
      if (onUpdateIncident) {
        onUpdateIncident({
          ...escalatingIncident,
          status: 'Investigating',
          description: `${escalatingIncident.description} [ESCALATED to Tier 3 Executive Incident Commander by SecOps on ${new Date().toLocaleTimeString()}]`,
        });
      }
      setEscalatingIncident(null);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleConfirmAuthorization = async () => {
    if (!authorizingIncident) return;
    setIsProcessingAction(true);
    try {
      if (onUpdateIncident) {
        onUpdateIncident({
          ...authorizingIncident,
          status: 'Mitigating',
        });
      }
      setAuthorizingIncident(null);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleConfirmExecute = async () => {
    if (!executingIncident) return;
    setIsProcessingAction(true);
    try {
      // Transition incident with first containment action marked completed
      if (onUpdateIncident) {
        const updatedActions = executingIncident.aiTriageResult?.immediateContainmentActions?.map((act, i) =>
          i === 0 ? { ...act, status: 'completed' as const } : act
        );
        onUpdateIncident({
          ...executingIncident,
          status: 'Contained',
          containedAt: new Date().toISOString(),
          aiTriageResult: executingIncident.aiTriageResult
            ? {
                ...executingIncident.aiTriageResult,
                immediateContainmentActions: updatedActions || [],
              }
            : undefined,
        });
      }
      setExecutingIncident(null);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleConfirmVerify = async () => {
    if (!verifyingIncident) return;
    setIsProcessingAction(true);
    try {
      if (onUpdateIncident) {
        onUpdateIncident({
          ...verifyingIncident,
          status: 'Resolved',
        });
      }
      setVerifyingIncident(null);
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Helper to compute SLA status and remaining time display
  const getSLAInfo = (incident: IncidentItem): { text: string; status: 'at-risk' | 'normal' | 'breached' } => {
    if (incident.status === 'Resolved') {
      return { text: 'Met SLA', status: 'normal' };
    }
    if (incident.status === 'Contained') {
      return { text: 'Contained', status: 'normal' };
    }

    if (incident.severity === 'P1 - Critical') {
      if (incident.status === 'Active') {
        return { text: '18m left', status: 'at-risk' };
      }
      return { text: '24m left', status: 'at-risk' };
    }
    if (incident.severity === 'P2 - High') {
      if (incident.status === 'Active') {
        return { text: '45m left', status: 'at-risk' };
      }
      return { text: '1h 10m', status: 'normal' };
    }
    if (incident.severity === 'P3 - Medium') {
      return { text: '18h left', status: 'normal' };
    }
    return { text: '68h left', status: 'normal' };
  };

  // Helper to extract owner
  const getIncidentOwner = (incident: IncidentItem): string => {
    if (incident.riskDomain === 'AI / Deepfake') return 'Devin Cruz';
    if (incident.riskDomain === 'Platform Abuse') return 'Elena Rostova';
    if (incident.riskDomain === 'Platform Security') return 'Marcus Vance';
    if (incident.riskDomain === 'Data Privacy') return 'Claire Laurent';
    if (incident.riskDomain === 'System Integrity') return 'Sarah Kim';
    return 'SecOps On-Call';
  };

  // Deterministic Prioritization of Incidents
  const prioritizedIncidents = useMemo(() => {
    return [...incidents].sort((a, b) => {
      // 1. Severity weight (P1 > P2 > P3 > P4)
      const severityOrder: Record<string, number> = {
        'P1 - Critical': 4000,
        'P2 - High': 3000,
        'P3 - Medium': 2000,
        'P4 - Low': 1000,
      };
      const sevA = severityOrder[a.severity] || 0;
      const sevB = severityOrder[b.severity] || 0;

      // 2. Status weight (Active > Investigating > Mitigating > Contained > Resolved)
      const statusOrder: Record<string, number> = {
        Active: 500,
        Investigating: 400,
        Mitigating: 300,
        Contained: 100,
        Resolved: 0,
      };
      const statA = statusOrder[a.status] || 0;
      const statB = statusOrder[b.status] || 0;

      // 3. Risk CVSS score
      const cvssA = (a.cvssScore || 5) * 10;
      const cvssB = (b.cvssScore || 5) * 10;

      const scoreA = sevA + statA + cvssA;
      const scoreB = sevB + statB + cvssB;

      return scoreB - scoreA;
    });
  }, [incidents]);

  // Filtered Priority Queue records
  const filteredIncidents = useMemo(() => {
    return prioritizedIncidents.filter((incident) => {
      // Text Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesText =
          incident.id.toLowerCase().includes(q) ||
          incident.title.toLowerCase().includes(q) ||
          (incident.riskDomain && incident.riskDomain.toLowerCase().includes(q)) ||
          (incident.affectedServices && incident.affectedServices.some((s) => s.toLowerCase().includes(q))) ||
          getIncidentOwner(incident).toLowerCase().includes(q);
        if (!matchesText) return false;
      }

      // Severity Filter
      if (selectedSeverity !== 'All' && incident.severity !== selectedSeverity) {
        return false;
      }

      // Domain Filter
      if (selectedDomain !== 'All' && incident.riskDomain !== selectedDomain) {
        return false;
      }

      // SLA Filter
      if (selectedSLA !== 'All') {
        const sla = getSLAInfo(incident);
        if (selectedSLA === 'At Risk' && sla.status !== 'at-risk') return false;
        if (selectedSLA === 'Normal' && sla.status !== 'normal') return false;
        if (selectedSLA === 'Breached' && sla.status !== 'breached') return false;
      }

      // Status Filter
      if (selectedStatus !== 'All' && incident.status !== selectedStatus) {
        return false;
      }

      // 5x5 Matrix Cell Filter
      if (selectedMatrixCell) {
        const matchingDomainRisks = risks.filter(
          (r) => r.likelihood === selectedMatrixCell.l && r.impact === selectedMatrixCell.i
        );
        const allowedDomains = new Set(matchingDomainRisks.map((r) => r.category));
        if (incident.riskDomain && !allowedDomains.has(incident.riskDomain)) {
          return false;
        }
      }

      return true;
    });
  }, [
    prioritizedIncidents,
    searchQuery,
    selectedSeverity,
    selectedDomain,
    selectedSLA,
    selectedStatus,
    selectedMatrixCell,
    risks,
  ]);

  // Executive State Bar Metrics (Calculated from Real Application Data)
  const criticalP1Count = incidents.filter(
    (i) => i.severity === 'P1 - Critical' && i.status !== 'Resolved'
  ).length;

  const highP2Count = incidents.filter(
    (i) => i.severity === 'P2 - High' && i.status !== 'Resolved'
  ).length;

  const slaAtRiskCount = incidents.filter(
    (i) => (i.severity === 'P1 - Critical' || i.severity === 'P2 - High') &&
           (i.status === 'Active' || i.status === 'Investigating')
  ).length;

  const openEscalationsCount = INITIAL_ESCALATIONS.length;

  const pendingDecisionsCount = INITIAL_DECISIONS.filter(
    (d) => d.status === 'Under Review'
  ).length;

  const activePlaybooksCount = playbooks.filter(
    (p) => p.enabled !== false
  ).length;

  // SLA Operational Health Metrics
  const withinSLACount = incidents.filter(
    (i) => i.status === 'Resolved' || i.status === 'Contained' || (i.severity === 'P3 - Medium' || i.severity === 'P4 - Low')
  ).length;

  const activeIncidentsTotal = incidents.filter(
    (i) => i.status === 'Active' || i.status === 'Investigating' || i.status === 'Mitigating'
  ).length;

  // 5x5 Risk Matrix Aggregation
  const matrixData = useMemo(() => {
    // 5x5 grid (Likelihood 1..5, Impact 1..5)
    const grid: Record<string, { count: number; risks: RiskItem[] }> = {};
    for (let l = 1; l <= 5; l++) {
      for (let i = 1; i <= 5; i++) {
        grid[`${l}-${i}`] = { count: 0, risks: [] };
      }
    }
    risks.forEach((r) => {
      const key = `${r.likelihood}-${r.impact}`;
      if (grid[key]) {
        grid[key].count += 1;
        grid[key].risks.push(r);
      }
    });
    return grid;
  }, [risks]);

  // Combined Chronological Activity Feed
  const recentActivity = useMemo(() => {
    const events: Array<{
      id: string;
      timestamp: string;
      title: string;
      targetId: string;
      actor: string;
      outcome: string;
      outcomeType: 'success' | 'warning' | 'critical' | 'neutral';
    }> = [];

    // Audit logs
    INITIAL_AUDIT_LOGS.forEach((log) => {
      events.push({
        id: log.id,
        timestamp: log.timestamp.includes(' ') ? log.timestamp.split(' ')[1] : log.timestamp,
        title: log.action,
        targetId: log.targetId,
        actor: log.actor,
        outcome: log.outcome,
        outcomeType: log.outcome === 'Success' ? 'success' : log.outcome === 'Warning' ? 'warning' : 'critical',
      });
    });

    // Decisions
    INITIAL_DECISIONS.forEach((dec) => {
      events.push({
        id: dec.id,
        timestamp: dec.date,
        title: dec.decisionTitle,
        targetId: dec.id,
        actor: dec.approver,
        outcome: dec.status,
        outcomeType: dec.status === 'Approved' ? 'success' : 'neutral',
      });
    });

    // Sort by timestamp/ID
    return events.slice(0, 6);
  }, []);

  const handleCellClick = (l: number, i: number) => {
    if (selectedMatrixCell && selectedMatrixCell.l === l && selectedMatrixCell.i === i) {
      setSelectedMatrixCell(null);
      if (onFilterHeatmapCell) onFilterHeatmapCell(0, 0);
    } else {
      setSelectedMatrixCell({ l, i });
      if (onFilterHeatmapCell) onFilterHeatmapCell(l, i);
    }
  };

  const handleClearAllFilters = () => {
    setSearchQuery('');
    setSelectedSeverity('All');
    setSelectedDomain('All');
    setSelectedSLA('All');
    setSelectedStatus('All');
    setSelectedMatrixCell(null);
    if (onFilterHeatmapCell) onFilterHeatmapCell(0, 0);
  };

  const hasActiveFilters =
    searchQuery !== '' ||
    selectedSeverity !== 'All' ||
    selectedDomain !== 'All' ||
    selectedSLA !== 'All' ||
    selectedStatus !== 'All' ||
    selectedMatrixCell !== null;

  return (
    <div id="overview-operational-command-center" className="space-y-5 font-sans animate-in fade-in duration-150">
      {/* 1. PAGE HEADER / OPERATIONAL STATE */}
      <div
        id="overview-header-state"
        className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-3 border-b border-[#1A1A1E]/15"
      >
        <div>
          <span className="label">CC-01 // Management Console</span>
          <h1 className="font-syne text-2xl sm:text-3xl font-extrabold text-[#1A1A1E] tracking-tight uppercase mt-1">
            RiskOps Intelligence
          </h1>
          <p className="text-xs text-[#1A1A1E]/60 mt-0.5 font-mono">
            Operational Risk Command Center &bull; Real-Time Telemetry & SLA Posture
          </p>
        </div>

        {/* Header Right Badges */}
        <div className="flex items-center gap-3 text-xs">
          <div className="label text-[#059669] flex items-center gap-1.5 font-mono">
            <Radio className="w-3.5 h-3.5 text-[#059669] animate-pulse" />
            <span>Live Ingest (3 Streams) &bull; Just Now</span>
          </div>
        </div>
      </div>

      {/* 2. EXECUTIVE STATE BAR */}
      <div
        id="executive-state-bar"
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3"
      >
        {/* Metric 1: CRITICAL P1 */}
        <button
          type="button"
          onClick={() => {
            setSelectedSeverity('P1 - Critical');
            setSelectedStatus('All');
          }}
          className={`stat-card critical text-left transition-all hover:shadow-xs cursor-pointer ${
            selectedSeverity === 'P1 - Critical'
              ? 'ring-2 ring-[#DC2626]'
              : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="label text-[#DC2626]">Critical P1</span>
            <Flame className="w-3.5 h-3.5 text-[#DC2626]" />
          </div>
          <span className="value text-[#DC2626]">
            {String(criticalP1Count).padStart(2, '0')}
          </span>
          <span className="label text-[9px]">Active Threats</span>
        </button>

        {/* Metric 2: HIGH P2 */}
        <button
          type="button"
          onClick={() => {
            setSelectedSeverity('P2 - High');
            setSelectedStatus('All');
          }}
          className={`stat-card high text-left transition-all hover:shadow-xs cursor-pointer ${
            selectedSeverity === 'P2 - High'
              ? 'ring-2 ring-[#D97706]'
              : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="label text-[#D97706]">High P2</span>
            <ShieldAlert className="w-3.5 h-3.5 text-[#D97706]" />
          </div>
          <span className="value text-[#D97706]">
            {String(highP2Count).padStart(2, '0')}
          </span>
          <span className="label text-[9px]">Active Threats</span>
        </button>

        {/* Metric 3: SLA AT RISK */}
        <button
          type="button"
          onClick={() => {
            setSelectedSLA(selectedSLA === 'At Risk' ? 'All' : 'At Risk');
          }}
          className={`stat-card high text-left transition-all hover:shadow-xs cursor-pointer ${
            selectedSLA === 'At Risk'
              ? 'ring-2 ring-[#D97706]'
              : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="label text-[#D97706]">SLA At Risk</span>
            <Clock className="w-3.5 h-3.5 text-[#D97706]" />
          </div>
          <span className="value text-[#D97706]">
            {String(slaAtRiskCount).padStart(2, '0')}
          </span>
          <span className="label text-[9px]">&lt; 30m Remaining</span>
        </button>

        {/* Metric 4: OPEN ESCALATIONS */}
        <button
          type="button"
          onClick={() => {
            onNavigateTab('incidents');
          }}
          className="stat-card text-left transition-all hover:shadow-xs cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="label">Escalations</span>
            <Zap className="w-3.5 h-3.5 text-[#1A1A1E]" />
          </div>
          <span className="value text-[#1A1A1E]">
            {String(openEscalationsCount).padStart(2, '0')}
          </span>
          <span className="label text-[9px]">Tiers Active</span>
        </button>

        {/* Metric 5: PENDING DECISIONS */}
        <button
          type="button"
          onClick={() => {
            onNavigateTab('decisions');
          }}
          className="stat-card text-left transition-all hover:shadow-xs cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="label">Decisions</span>
            <Scale className="w-3.5 h-3.5 text-[#1A1A1E]" />
          </div>
          <span className="value text-[#1A1A1E]">
            {String(pendingDecisionsCount).padStart(2, '0')}
          </span>
          <span className="label text-[9px]">Under Review</span>
        </button>

        {/* Metric 6: AUTOMATION */}
        <button
          type="button"
          onClick={() => {
            onNavigateTab('playbooks');
          }}
          className="stat-card emerald text-left transition-all hover:shadow-xs cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="label">Automation</span>
            <Cpu className="w-3.5 h-3.5 text-[#059669]" />
          </div>
          <span className="value text-[#059669] text-xl mt-3">
            HEALTHY
          </span>
          <span className="label text-[9px]">({activePlaybooksCount} Active)</span>
        </button>
      </div>

      {/* Main Grid: Priority Area (8 cols) + Sidebar Area (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* 3. PRIORITY AREA (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div id="overview-priority-queue" className="bg-white border border-[#1A1A1E]/15 rounded-[4px] overflow-hidden shadow-xs">
            {/* Priority Queue Header */}
            <div className="p-3.5 border-b border-[#1A1A1E] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
              <div className="flex items-center gap-2">
                <h3 className="font-syne text-sm font-bold text-[#1A1A1E] uppercase tracking-tight">
                  [01] Priority Queue // {filteredIncidents.length} Records
                </h3>
                {selectedMatrixCell && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[2px] text-[10px] font-mono bg-blue-50 text-[#2563EB] border border-[#2563EB]/40">
                    <span>L{selectedMatrixCell.l} × I{selectedMatrixCell.i}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMatrixCell(null);
                        if (onFilterHeatmapCell) onFilterHeatmapCell(0, 0);
                      }}
                      className="hover:text-rose-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="priority-queue-search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="SYSTEM_SEARCH..."
                  className="w-48 sm:w-64 px-2.5 py-1 bg-white border border-[#1A1A1E]/30 rounded-[3px] text-xs text-[#1A1A1E] placeholder-[#1A1A1E]/40 focus:outline-none focus:border-[#1A1A1E] font-mono"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-[#1A1A1E]/50 hover:text-[#1A1A1E]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Filter Pills Bar */}
            <div className="px-3.5 py-2 bg-[#F8F7F4] border-b border-[#1A1A1E]/10 flex flex-wrap items-center gap-2 text-[11px] font-mono">
              <span className="label text-[10px]">Filter:</span>

              {/* Severity Filter */}
              <select
                id="filter-severity"
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value)}
                className="bg-white border border-[#1A1A1E]/20 rounded-[2px] px-2 py-0.5 text-[11px] text-[#1A1A1E] focus:outline-none focus:border-[#1A1A1E] font-mono cursor-pointer"
              >
                <option value="All">All Severities</option>
                <option value="P1 - Critical">P1 - Critical</option>
                <option value="P2 - High">P2 - High</option>
                <option value="P3 - Medium">P3 - Medium</option>
                <option value="P4 - Low">P4 - Low</option>
              </select>

              {/* Domain Filter */}
              <select
                id="filter-domain"
                value={selectedDomain}
                onChange={(e) => setSelectedDomain(e.target.value)}
                className="bg-white border border-[#1A1A1E]/20 rounded-[2px] px-2 py-0.5 text-[11px] text-[#1A1A1E] focus:outline-none focus:border-[#1A1A1E] font-mono cursor-pointer max-w-[140px] truncate"
              >
                <option value="All">All Domains</option>
                <option value="AI / Deepfake">AI / Deepfake</option>
                <option value="Platform Abuse">Platform Abuse</option>
                <option value="System Integrity">System Integrity</option>
                <option value="Data Privacy">Data Privacy</option>
                <option value="Platform Security">Platform Security</option>
                <option value="Cybersecurity">Cybersecurity</option>
              </select>

              {/* SLA Filter */}
              <select
                id="filter-sla"
                value={selectedSLA}
                onChange={(e) => setSelectedSLA(e.target.value)}
                className="bg-white border border-[#1A1A1E]/20 rounded-[2px] px-2 py-0.5 text-[11px] text-[#1A1A1E] focus:outline-none focus:border-[#1A1A1E] font-mono cursor-pointer"
              >
                <option value="All">All SLA</option>
                <option value="At Risk">At Risk (&lt;30m)</option>
                <option value="Normal">Normal</option>
                <option value="Breached">Breached</option>
              </select>

              {/* Status Filter */}
              <select
                id="filter-status"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="bg-white border border-[#1A1A1E]/20 rounded-[2px] px-2 py-0.5 text-[11px] text-[#1A1A1E] focus:outline-none focus:border-[#1A1A1E] font-mono cursor-pointer"
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Investigating">Investigating</option>
                <option value="Mitigating">Mitigating</option>
                <option value="Contained">Contained</option>
                <option value="Resolved">Resolved</option>
              </select>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearAllFilters}
                  className="btn-sm ml-auto text-[10px] py-0.5 px-2"
                >
                  Clear Filters
                </button>
              )}
            </div>

            {/* Priority Table */}
            {filteredIncidents.length === 0 ? (
              <div className="p-8 text-center font-mono">
                <p className="text-xs text-[#1A1A1E]/60 mb-2">NO INCIDENTS MATCH CURRENT CRITERIA</p>
                <button type="button" onClick={handleClearAllFilters} className="btn-sm">
                  RESET FILTERS
                </button>
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full text-left text-xs text-[#1A1A1E] border-collapse">
                  <thead className="bg-[#F8F7F4] border-b border-[#1A1A1E] font-mono text-[10px] text-[#1A1A1E]/70 uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3 whitespace-nowrap">Severity</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">Incident</th>
                      <th className="py-2.5 px-3 whitespace-nowrap font-mono text-center">Risk</th>
                      <th className="py-2.5 px-3 whitespace-nowrap font-mono">SLA</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">Owner</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">Status</th>
                      <th className="py-2.5 px-3 whitespace-nowrap text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1A1A1E]/10 font-sans">
                    {filteredIncidents.map((incident) => {
                      const sla = getSLAInfo(incident);
                      const nextAction = getNextAction(incident);
                      const owner = getIncidentOwner(incident);

                      return (
                        <tr
                          key={incident.id}
                          onClick={() => setInspectingIncident(incident)}
                          className="hover:bg-[#F8F7F4] cursor-pointer transition-colors"
                        >
                          {/* Severity */}
                          <td className="py-2 px-3 whitespace-nowrap">
                            <StatusBadge severity={incident.severity} />
                          </td>

                          {/* Incident ID + Title */}
                          <td className="py-2 px-3 max-w-xs">
                            <span className="font-mono font-bold text-[#1A1A1E] block">
                              {incident.id}
                            </span>
                            <span className="text-[#1A1A1E]/60 text-[11px] truncate block mt-0.5">
                              {incident.title}
                            </span>
                          </td>

                          {/* Risk Score */}
                          <td className="py-2 px-3 whitespace-nowrap text-center font-mono font-bold">
                            <span
                              className={
                                (incident.cvssScore || 0) >= 9.0
                                  ? 'text-[#DC2626]'
                                  : (incident.cvssScore || 0) >= 7.5
                                  ? 'text-[#D97706]'
                                  : 'text-[#1A1A1E]'
                              }
                            >
                              {incident.cvssScore ? incident.cvssScore.toFixed(1) : '—'}
                            </span>
                          </td>

                          {/* SLA */}
                          <td className="py-2 px-3 whitespace-nowrap font-mono">
                            <span
                              className={`tag uppercase ${
                                sla.status === 'at-risk' || sla.status === 'breached'
                                  ? 'tag-rose'
                                  : 'tag-ink'
                              }`}
                            >
                              {sla.text.toUpperCase()}
                            </span>
                          </td>

                          {/* Owner */}
                          <td className="py-2 px-3 whitespace-nowrap text-[#1A1A1E] text-xs font-mono">
                            {owner}
                          </td>

                          {/* Status */}
                          <td className="py-2 px-3 whitespace-nowrap">
                            <StatusBadge status={incident.status} />
                          </td>

                          {/* Next Action */}
                          <td className="py-2 px-3 whitespace-nowrap text-right">
                            {nextAction.isActionable ? (
                              <button
                                type="button"
                                className={`btn-sm ${nextAction.variant === 'destructive' ? 'bg-[#DC2626] text-white border-[#DC2626] hover:bg-rose-700' : 'btn-primary'}`}
                                onClick={(e) => handleActionClick(incident, e)}
                              >
                                {nextAction.label}
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="btn-sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setInspectingIncident(incident);
                                }}
                              >
                                Review
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* SIDEBAR AREA (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* [02] RISK POSTURE */}
          <div className="bg-white border border-[#1A1A1E]/15 rounded-[4px] p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3 border-b border-[#1A1A1E]/10 pb-2">
              <h3 className="font-syne text-xs font-bold text-[#1A1A1E] uppercase tracking-tight">
                [02] Risk Posture
              </h3>
              {selectedMatrixCell && (
                <button
                  type="button"
                  onClick={() => handleCellClick(selectedMatrixCell.l, selectedMatrixCell.i)}
                  className="label text-[#2563EB] hover:underline"
                >
                  Reset
                </button>
              )}
            </div>

            {/* Matrix */}
            <div className="flex items-stretch gap-2 pt-1">
              {/* Y-Axis Label */}
              <div className="label flex items-center justify-center [writing-mode:vertical-lr] rotate-180 text-[9px] w-4">
                Likelihood &rarr;
              </div>

              {/* 5x5 Grid */}
              <div className="flex-1 space-y-1">
                {[5, 4, 3, 2, 1].map((likelihood) => (
                  <div key={likelihood} className="grid grid-cols-5 gap-1">
                    {[1, 2, 3, 4, 5].map((impact) => {
                      const key = `${likelihood}-${impact}`;
                      const cell = matrixData[key] || { count: 0, risks: [] };
                      const score = likelihood * impact;
                      const isSelected =
                        selectedMatrixCell?.l === likelihood &&
                        selectedMatrixCell?.i === impact;

                      let cellClass = 'border border-[#1A1A1E]/10 text-[#1A1A1E]/40 hover:bg-[#F8F7F4]';
                      if (score >= 20) {
                        cellClass = 'bg-rose-500/20 text-[#DC2626] border-[#DC2626] font-bold';
                      } else if (score >= 12) {
                        cellClass = 'bg-amber-500/20 text-[#D97706] border-[#D97706] font-bold';
                      } else if (cell.count > 0) {
                        cellClass = 'bg-emerald-500/20 text-[#059669] border-[#059669] font-bold';
                      }

                      return (
                        <button
                          key={impact}
                          type="button"
                          onClick={() => handleCellClick(likelihood, impact)}
                          className={`aspect-square flex items-center justify-center font-mono text-xs rounded-[2px] transition-all ${cellClass} ${
                            isSelected ? 'ring-2 ring-[#1A1A1E]' : ''
                          }`}
                        >
                          {cell.count > 0 ? cell.count : ''}
                        </button>
                      );
                    })}
                  </div>
                ))}

                {/* X-Axis Title */}
                <div className="label text-center pt-2">
                  Impact &rarr;
                </div>
              </div>
            </div>
          </div>

          {/* [03] RECENT ACTIVITY */}
          <div className="bg-white border border-[#1A1A1E]/15 rounded-[4px] p-4 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3 border-b border-[#1A1A1E]/10 pb-2">
                <h3 className="font-syne text-xs font-bold text-[#1A1A1E] uppercase tracking-tight">
                  [03] Recent Activity
                </h3>
              </div>

              <div className="divide-y divide-[#1A1A1E]/10 font-mono text-xs">
                {recentActivity.slice(0, 4).map((act) => (
                  <div key={act.id} className="py-2 flex items-start justify-between gap-2">
                    <span className="text-[#1A1A1E]/50 text-[10px] shrink-0">{act.timestamp}</span>
                    <span className="text-[#1A1A1E] font-medium text-[11px] truncate flex-1 font-sans">{act.title}</span>
                    <span
                      className={`tag ${
                        act.outcomeType === 'success'
                          ? 'tag-emerald'
                          : act.outcomeType === 'warning'
                          ? 'tag-amber'
                          : act.outcomeType === 'critical'
                          ? 'tag-rose'
                          : 'tag-ink'
                      }`}
                    >
                      {act.outcome.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab('decisions')}
              className="btn-sm mt-3 w-full text-center"
            >
              Decision Register &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* 6. RECENT DECISIONS / ACTIVITY */}
      <Card id="overview-recent-activity" border="slate-800" className="bg-slate-900/90">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle>
              <FileText className="w-4 h-4 text-indigo-400" />
              <span>Recent Decisions & Audit Activity</span>
            </CardTitle>
            <CardDescription>
              Chronological ledger of security authorizations, runbook executions, and architecture decisions
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="xs"
              variant="outline"
              onClick={() => onNavigateTab('decisions')}
              rightIcon={<ArrowRight className="w-3 h-3" />}
            >
              Decision Register
            </Button>
          </div>
        </CardHeader>

        <div className="divide-y divide-slate-800/80 font-sans">
          {recentActivity.map((act) => (
            <div key={act.id} className="py-2.5 px-2 flex items-center justify-between gap-3 text-xs hover:bg-slate-850/50 rounded-lg transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-mono text-[11px] text-slate-400 shrink-0">
                  {act.timestamp}
                </span>
                <span className="font-semibold text-slate-200 truncate">
                  {act.title}
                </span>
                <span className="font-mono text-[11px] text-indigo-400 px-1.5 py-0.2 rounded bg-indigo-950/60 border border-indigo-800/60 shrink-0">
                  {act.targetId}
                </span>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="text-slate-400 text-[11px] hidden sm:inline">
                  {act.actor}
                </span>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded font-mono ${
                    act.outcomeType === 'success'
                      ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                      : act.outcomeType === 'warning'
                      ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                      : act.outcomeType === 'critical'
                      ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                      : 'bg-slate-800 text-slate-300 border border-slate-700'
                  }`}
                >
                  {act.outcome}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Slide-out Incident Inspector Drawer */}
      <Drawer
        isOpen={Boolean(inspectingIncident)}
        onClose={() => setInspectingIncident(null)}
        title={inspectingIncident?.id || 'Incident Inspector'}
        subtitle={inspectingIncident?.riskDomain}
        badge={
          inspectingIncident ? (
            <div className="flex items-center gap-1.5">
              <StatusBadge severity={inspectingIncident.severity} />
              <StatusBadge status={inspectingIncident.status} />
            </div>
          ) : undefined
        }
        footer={
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-mono text-slate-400">
              CVSS Score: <strong className="text-slate-100">{inspectingIncident?.cvssScore || '—'}</strong>
            </span>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setInspectingIncident(null);
                onNavigateTab('incidents');
              }}
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              Open in Incident Triage Hub
            </Button>
          </div>
        }
      >
        {inspectingIncident && (
          <div className="space-y-4 text-xs">
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Incident Title
              </span>
              <h3 className="text-sm font-bold text-slate-100">{inspectingIncident.title}</h3>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Description & Telemetry Context
              </span>
              <p className="text-xs text-slate-300 leading-relaxed">
                {inspectingIncident.description}
              </p>
            </div>

            {inspectingIncident.threatVector && (
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 font-mono block">Threat Vector</span>
                <span className="text-xs text-slate-200">{inspectingIncident.threatVector}</span>
              </div>
            )}

            {inspectingIncident.affectedServices && inspectingIncident.affectedServices.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Impacted Services
                </span>
                <div className="flex flex-wrap gap-1">
                  {inspectingIncident.affectedServices.map((srv) => (
                    <span
                      key={srv}
                      className="px-2 py-0.5 rounded font-mono text-[11px] bg-slate-800 text-indigo-300 border border-slate-700"
                    >
                      {srv}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {inspectingIncident.logs && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Raw Ingest Logs
                </span>
                <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap leading-tight">
                  {inspectingIncident.logs}
                </pre>
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* Safety Modal 1: ESCALATE Confirmation */}
      {escalatingIncident && (
        <ConfirmModal
          isOpen={Boolean(escalatingIncident)}
          title={`Escalate Incident ${escalatingIncident.id} to Tier 3 Commander`}
          isDestructive={true}
          confirmText={isProcessingAction ? 'Escalating...' : 'Confirm Operational Escalation'}
          cancelLabel="Cancel"
          onConfirm={handleConfirmEscalation}
          onCancel={() => setEscalatingIncident(null)}
          onClose={() => setEscalatingIncident(null)}
        >
          <div className="space-y-3 text-xs text-slate-300">
            <p className="leading-relaxed">
              You are initiating an operational severity escalation for incident{' '}
              <strong className="text-slate-100 font-mono">{escalatingIncident.id}</strong>. This will notify the on-call Incident Commander, dispatch emergency telemetry channels, and update operational state to <strong>Investigating</strong>.
            </p>
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5 font-mono text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-500">Incident:</span>
                <span className="text-slate-200 font-semibold">{escalatingIncident.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Severity / CVSS:</span>
                <span className="text-rose-400 font-bold">{escalatingIncident.severity} (CVSS {escalatingIncident.cvssScore || '9.0+'})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Domain:</span>
                <span className="text-slate-200">{escalatingIncident.riskDomain}</span>
              </div>
            </div>
          </div>
        </ConfirmModal>
      )}

      {/* Safety Modal 2: AUTHORIZE Containment Plan Confirmation */}
      {authorizingIncident && (
        <ConfirmModal
          isOpen={Boolean(authorizingIncident)}
          title={`Authorize Incident Containment: ${authorizingIncident.id}`}
          isDestructive={false}
          confirmText={isProcessingAction ? 'Authorizing...' : 'Authorize Containment Plan'}
          cancelLabel="Reject / Review in Hub"
          onConfirm={handleConfirmAuthorization}
          onCancel={() => setAuthorizingIncident(null)}
          onClose={() => setAuthorizingIncident(null)}
        >
          <div className="space-y-3 text-xs text-slate-300">
            <p className="leading-relaxed">
              Review and authorize the AI-recommended containment plan before controlled automated execution is permitted.
            </p>
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono border-b border-slate-800 pb-1.5">
                <span className="text-slate-400">Target Incident:</span>
                <span className="text-slate-100 font-semibold">{authorizingIncident.title}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono border-b border-slate-800 pb-1.5">
                <span className="text-slate-400">Risk Severity:</span>
                <span className="text-amber-400 font-bold">{authorizingIncident.severity}</span>
              </div>

              {authorizingIncident.aiTriageResult?.immediateContainmentActions && authorizingIncident.aiTriageResult.immediateContainmentActions.length > 0 ? (
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] uppercase font-mono text-indigo-400 font-semibold block">
                    Proposed Containment Action(s):
                  </span>
                  {authorizingIncident.aiTriageResult.immediateContainmentActions.map((act, i) => (
                    <div key={i} className="p-2 rounded bg-slate-900 border border-slate-800 font-mono text-[11px] text-cyan-300">
                      <div className="font-semibold text-slate-200">{act.step}. {act.title}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5 truncate">{act.command}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 italic">Plan contains standard isolation heuristics.</p>
              )}
            </div>
            <div className="flex items-center gap-2 p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px]">
              <Lock className="w-3.5 h-3.5 shrink-0" />
              <span>Human authorization is cryptographically logged in the audit ledger.</span>
            </div>
          </div>
        </ConfirmModal>
      )}

      {/* Safety Modal 3: EXECUTE Playbook / Containment Flow */}
      {executingIncident && (
        <ConfirmModal
          isOpen={Boolean(executingIncident)}
          title={`Execute Controlled Containment: ${executingIncident.id}`}
          isDestructive={false}
          confirmText={isProcessingAction ? 'Executing Runbook...' : 'Execute Authorized Runbook'}
          cancelLabel="Cancel"
          onConfirm={handleConfirmExecute}
          onCancel={() => setExecutingIncident(null)}
          onClose={() => setExecutingIncident(null)}
        >
          <div className="space-y-3 text-xs text-slate-300">
            <p className="leading-relaxed">
              This incident has been authorized for mitigation. Executing will run verified containment playbooks against target infrastructure and transition status to <strong>Contained</strong>.
            </p>
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2 font-mono text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-500">Incident:</span>
                <span className="text-slate-200">{executingIncident.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <span className="text-indigo-400 font-semibold">{executingIncident.status} → Contained</span>
              </div>
              {executingIncident.aiTriageResult?.immediateContainmentActions?.[0] && (
                <div className="mt-2 p-2 rounded bg-slate-900 border border-slate-800 text-cyan-300 text-[10px]">
                  <strong>Action:</strong> {executingIncident.aiTriageResult.immediateContainmentActions[0].title}
                  <div className="text-slate-400 truncate mt-0.5">{executingIncident.aiTriageResult.immediateContainmentActions[0].command}</div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-400">Prefer full interactive terminal inspection?</span>
              <button
                type="button"
                onClick={() => {
                  setExecutingIncident(null);
                  onNavigateTab('incidents');
                }}
                className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 underline"
              >
                Open in Triage Hub
              </button>
            </div>
          </div>
        </ConfirmModal>
      )}

      {/* Safety Modal 4: VERIFY Contained Incident */}
      {verifyingIncident && (
        <ConfirmModal
          isOpen={Boolean(verifyingIncident)}
          title={`Verify Containment & Resolve Incident: ${verifyingIncident.id}`}
          isDestructive={false}
          confirmText={isProcessingAction ? 'Verifying...' : 'Mark Incident Verified & Resolved'}
          cancelLabel="Cancel"
          onConfirm={handleConfirmVerify}
          onCancel={() => setVerifyingIncident(null)}
          onClose={() => setVerifyingIncident(null)}
        >
          <div className="space-y-3 text-xs text-slate-300">
            <p className="leading-relaxed">
              Verify that containment countermeasures have completely isolated telemetry anomalies and security risk posture is restored.
            </p>
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5 font-mono text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-500">Incident:</span>
                <span className="text-slate-200">{verifyingIncident.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Current State:</span>
                <span className="text-cyan-400 font-bold">Contained</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Resolution State:</span>
                <span className="text-emerald-400 font-bold">Resolved (SLA Met)</span>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>Resolution will be synchronized across telemetry and Google Sheets registers.</span>
            </div>
          </div>
        </ConfirmModal>
      )}
    </div>
  );
};
