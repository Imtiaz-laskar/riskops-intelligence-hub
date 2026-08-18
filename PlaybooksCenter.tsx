import React, { useState } from 'react';
import {
  ShieldAlert,
  Terminal,
  Layers,
  Sparkles,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react';
import {
  AutomationPlaybook,
  PlaybookExecutionRecord,
  IncidentItem,
  RiskItem,
  ComplianceControl,
} from '../types';
import {
  AutomationPostureBar,
  PostureFilterType,
} from './playbooks/AutomationPostureBar';
import { ActiveExecutionsTable } from './playbooks/ActiveExecutionsTable';
import { PlaybookLibraryTable } from './playbooks/PlaybookLibraryTable';
import { PlaybookDetailDrawer } from './playbooks/PlaybookDetailDrawer';
import { PlaybookAuthorizationModal } from './playbooks/PlaybookAuthorizationModal';
import { ExecutionTraceModal } from './playbooks/ExecutionTraceModal';
import { AICandidatePlaybooks } from './playbooks/AICandidatePlaybooks';
import { AISynthPlaybookModal } from './playbooks/AISynthPlaybookModal';
import { SimulationSandboxArea } from './playbooks/SimulationSandboxArea';

interface PlaybooksCenterProps {
  playbooks: AutomationPlaybook[];
  executions: PlaybookExecutionRecord[];
  incidents: IncidentItem[];
  risks: RiskItem[];
  complianceControls: ComplianceControl[];
  onUpdatePlaybooks?: (playbooks: AutomationPlaybook[]) => void;
  onUpdateExecutions?: (executions: PlaybookExecutionRecord[]) => void;
  onNavigateIncident?: (incidentId: string) => void;
  onNavigateRisk?: (riskId: string) => void;
}

export const PlaybooksCenter: React.FC<PlaybooksCenterProps> = ({
  playbooks: initialPlaybooks,
  executions: initialExecutions,
  incidents,
  risks,
  complianceControls,
  onUpdatePlaybooks,
  onUpdateExecutions,
  onNavigateIncident,
  onNavigateRisk,
}) => {
  // Local state for interactive playbooks and executions
  const [playbooks, setPlaybooks] = useState<AutomationPlaybook[]>(initialPlaybooks);
  const [executions, setExecutions] = useState<PlaybookExecutionRecord[]>(initialExecutions);

  // Active filter from Posture Bar
  const [activePostureFilter, setActivePostureFilter] = useState<PostureFilterType>('all');

  // Modal / Drawer Selection states
  const [selectedPlaybookId, setSelectedPlaybookId] = useState<string | null>(null);
  const [authModalExecution, setAuthModalExecution] = useState<PlaybookExecutionRecord | null>(null);
  const [traceModalExecution, setTraceModalExecution] = useState<PlaybookExecutionRecord | null>(null);
  const [isSynthModalOpen, setIsSynthModalOpen] = useState(false);
  const [isSandboxOpen, setIsSandboxOpen] = useState(false);

  // Separate Active catalog from AI Candidates
  const activeCatalogPlaybooks = playbooks.filter(
    (p) => p.status === 'Active' || !p.status || p.status === 'Draft'
  );
  const candidatePlaybooks = playbooks.filter((p) => p.status === 'Candidate');

  // Filtered executions based on Posture filter
  const filteredExecutions = executions.filter((exec) => {
    if (activePostureFilter === 'all') return true;
    if (activePostureFilter === 'awaiting_auth')
      return exec.status === 'Awaiting Authorization';
    if (activePostureFilter === 'executing')
      return (
        exec.status === 'Executing' ||
        exec.status === 'Authorized' ||
        exec.status === 'Paused'
      );
    if (activePostureFilter === 'verification_required')
      return exec.status === 'Verification Required';
    if (activePostureFilter === 'completed') return exec.status === 'Completed';
    if (activePostureFilter === 'rolled_back_failed')
      return exec.status === 'Rolled Back' || exec.status === 'Failed';
    return true;
  });

  // Selected playbook object
  const selectedPlaybook =
    playbooks.find((p) => p.id === selectedPlaybookId) || null;

  // Sync helper
  const updateExecutionsState = (newExecs: PlaybookExecutionRecord[]) => {
    setExecutions(newExecs);
    if (onUpdateExecutions) onUpdateExecutions(newExecs);
  };

  const updatePlaybooksState = (newPbs: AutomationPlaybook[]) => {
    setPlaybooks(newPbs);
    if (onUpdatePlaybooks) onUpdatePlaybooks(newPbs);
  };

  // 1. Stage a new execution from catalog
  const handleStageExecution = (playbook: AutomationPlaybook) => {
    const isAutomated =
      playbook.executionMode === 'Fully Automated' ||
      playbook.authorizationRequirement === 'Not Required';

    const newExecId = `RUN-${Date.now().toString().slice(-4)}`;
    const initialStatus: PlaybookExecutionRecord['status'] = isAutomated
      ? 'Authorized'
      : 'Awaiting Authorization';

    const newRecord: PlaybookExecutionRecord = {
      id: newExecId,
      playbookId: playbook.id,
      playbookName: playbook.name || playbook.title,
      status: initialStatus,
      authorizationStatus: isAutomated ? 'Not Required' : 'Pending',
      authorizedBy: isAutomated ? 'System Auto-Policy' : undefined,
      authorizationNotes: isAutomated
        ? 'Pre-approved deterministic runbook execution'
        : undefined,
      currentStepIndex: 0,
      totalSteps: playbook.steps.length,
      progress: 0,
      steps: playbook.steps.map((s, idx) => ({
        ...s,
        status: idx === 0 && isAutomated ? 'Pending' : 'Pending',
      })),
      verificationStatus: 'Pending',
      verificationChecks: playbook.verificationChecks || [
        {
          id: 'V-01',
          name: 'Threat Signal Baseline Reduction',
          type: 'Threat Signal Reduced',
          status: 'Pending',
          expected: 'Anomaly metric returns to nominal baseline',
        },
        {
          id: 'V-02',
          name: 'Service Health & Latency Metric',
          type: 'Service Health',
          status: 'Pending',
          expected: 'HTTP 5xx error rate < 0.05%',
        },
      ],
      rollbackStatus: playbook.rollbackAvailable ? 'Available' : 'Not Available',
      operator: 'SecOps Orchestrator',
      startedAt: new Date().toLocaleTimeString(),
      incidentId: playbook.relatedIncidentIds?.[0],
      riskId: playbook.relatedRiskIds?.[0],
      logs: [
        `[${new Date().toLocaleTimeString()}] [INIT] Staged execution ${newExecId} for runbook ${playbook.id} (${playbook.name || playbook.title})`,
        isAutomated
          ? `[${new Date().toLocaleTimeString()}] [AUTH] Pre-approved policy active. Ready for dispatch.`
          : `[${new Date().toLocaleTimeString()}] [AUTH] Human authorization required (${playbook.authorizationRequirement || 'SecOps Lead'}). Awaiting sign-off.`,
      ],
    };

    updateExecutionsState([newRecord, ...executions]);

    // If requires authorization, open authorization modal immediately
    if (!isAutomated) {
      setAuthModalExecution(newRecord);
    } else {
      setTraceModalExecution(newRecord);
    }
  };

  // 2. Authorize runbook
  const handleApproveAuthorization = (
    executionId: string,
    approverName: string,
    notes: string
  ) => {
    const updated = executions.map((e) => {
      if (e.id === executionId) {
        return {
          ...e,
          status: 'Authorized' as const,
          authorizationStatus: 'Approved' as const,
          authorizedBy: approverName,
          authorizationNotes: notes,
          logs: [
            ...e.logs,
            `[${new Date().toLocaleTimeString()}] [AUTH] Authorization GRANTED by ${approverName}. Rationale: "${notes}"`,
            `[${new Date().toLocaleTimeString()}] [SYSTEM] Execution locks released. Ready to execute step 1.`,
          ],
        };
      }
      return e;
    });

    updateExecutionsState(updated);
    setAuthModalExecution(null);

    // Also update trace modal if open
    const target = updated.find((e) => e.id === executionId);
    if (target) setTraceModalExecution(target);
  };

  // 3. Reject runbook authorization
  const handleRejectAuthorization = (executionId: string, reason: string) => {
    const updated = executions.map((e) => {
      if (e.id === executionId) {
        return {
          ...e,
          status: 'Failed' as const,
          authorizationStatus: 'Rejected' as const,
          errorReason: `Authorization Rejected: ${reason}`,
          logs: [
            ...e.logs,
            `[${new Date().toLocaleTimeString()}] [AUTH] Authorization REJECTED. Reason: "${reason}"`,
            `[${new Date().toLocaleTimeString()}] [SYSTEM] Execution staging aborted and archived.`,
          ],
        };
      }
      return e;
    });

    updateExecutionsState(updated);
    setAuthModalExecution(null);
  };

  // 4. Advance execution step
  const handleExecuteStep = (executionId: string) => {
    const updated = executions.map((e) => {
      if (e.id === executionId) {
        const nextIdx = e.currentStepIndex + 1;
        const isLastStep = nextIdx >= e.totalSteps;
        const currentStepObj = e.steps[e.currentStepIndex];

        const updatedSteps = e.steps.map((s, idx) => {
          if (idx === e.currentStepIndex) {
            return {
              ...s,
              status: 'Completed' as const,
              output: `Executed command successfully. Subsystem [${s.system || 'service'}] returned status 200 OK.`,
            };
          }
          if (idx === nextIdx && !isLastStep) {
            return { ...s, status: 'Executing' as const };
          }
          return s;
        });

        const newProgress = Math.min(100, Math.round((nextIdx / e.totalSteps) * 100));

        const nextStatus: PlaybookExecutionRecord['status'] = isLastStep
          ? 'Verification Required'
          : 'Executing';

        const updatedRecord: PlaybookExecutionRecord = {
          ...e,
          status: nextStatus,
          currentStepIndex: isLastStep ? e.currentStepIndex : nextIdx,
          progress: newProgress,
          steps: updatedSteps,
          logs: [
            ...e.logs,
            `[${new Date().toLocaleTimeString()}] [EXEC] Step ${e.currentStepIndex + 1}/${e.totalSteps} (${currentStepObj?.name || 'Action'}) completed with exit code 0.`,
            isLastStep
              ? `[${new Date().toLocaleTimeString()}] [SYSTEM] All sequential steps executed. Runbook transitioned to [Verification Required].`
              : `[${new Date().toLocaleTimeString()}] [EXEC] Advancing to Step ${nextIdx + 1}/${e.totalSteps}...`,
          ],
        };

        return updatedRecord;
      }
      return e;
    });

    updateExecutionsState(updated);

    const active = updated.find((e) => e.id === executionId);
    if (active && traceModalExecution?.id === executionId) {
      setTraceModalExecution(active);
    }
  };

  // 5. Pause execution
  const handlePauseExecution = (executionId: string) => {
    const updated = executions.map((e) => {
      if (e.id === executionId) {
        return {
          ...e,
          status: 'Paused' as const,
          logs: [
            ...e.logs,
            `[${new Date().toLocaleTimeString()}] [OPERATOR] Execution paused by operator. Subsystem states held in standby.`,
          ],
        };
      }
      return e;
    });
    updateExecutionsState(updated);
    const active = updated.find((e) => e.id === executionId);
    if (active && traceModalExecution?.id === executionId) {
      setTraceModalExecution(active);
    }
  };

  // 6. Resume execution
  const handleResumeExecution = (executionId: string) => {
    const updated = executions.map((e) => {
      if (e.id === executionId) {
        return {
          ...e,
          status: 'Executing' as const,
          logs: [
            ...e.logs,
            `[${new Date().toLocaleTimeString()}] [OPERATOR] Execution resumed. Resuming step ${e.currentStepIndex + 1}.`,
          ],
        };
      }
      return e;
    });
    updateExecutionsState(updated);
    const active = updated.find((e) => e.id === executionId);
    if (active && traceModalExecution?.id === executionId) {
      setTraceModalExecution(active);
    }
  };

  // 7. Run Verification Checks
  const handleRunVerification = (executionId: string) => {
    const updated = executions.map((e) => {
      if (e.id === executionId) {
        const verifiedChecks = e.verificationChecks.map((c) => ({
          ...c,
          status: 'Passed' as const,
          actual: 'Nominal telemetry restored (score: 0.02, p99: 42ms)',
        }));

        return {
          ...e,
          status: 'Completed' as const,
          verificationStatus: 'Passed' as const,
          verificationChecks: verifiedChecks,
          completedAt: new Date().toLocaleTimeString(),
          logs: [
            ...e.logs,
            `[${new Date().toLocaleTimeString()}] [VERIFY] Commencing automated post-execution telemetry checks...`,
            `[${new Date().toLocaleTimeString()}] [VERIFY] Check V-01 (Threat Signal Reduction): PASSED (Metric: 0.02 nominal)`,
            `[${new Date().toLocaleTimeString()}] [VERIFY] Check V-02 (Service Health & Latency): PASSED (p99: 42ms, 0 errors)`,
            `[${new Date().toLocaleTimeString()}] [SUCCESS] All verification gates PASSED. Runbook execution completed and recorded in audit log.`,
          ],
        };
      }
      return e;
    });

    updateExecutionsState(updated);
    const active = updated.find((e) => e.id === executionId);
    if (active && traceModalExecution?.id === executionId) {
      setTraceModalExecution(active);
    }
  };

  // 8. Trigger Rollback
  const handleInitiateRollback = (executionId: string) => {
    const updated = executions.map((e) => {
      if (e.id === executionId) {
        return {
          ...e,
          status: 'Rolled Back' as const,
          rollbackStatus: 'Executed' as const,
          logs: [
            ...e.logs,
            `[${new Date().toLocaleTimeString()}] [ROLLBACK] Operator/System initiated safety rollback protocol!`,
            `[${new Date().toLocaleTimeString()}] [ROLLBACK] Reverting configuration patches and flushing temporary rate-limits...`,
            `[${new Date().toLocaleTimeString()}] [ROLLBACK] Subsystem telemetry verified at prior baseline. Safe rollback completed.`,
          ],
        };
      }
      return e;
    });

    updateExecutionsState(updated);
    const active = updated.find((e) => e.id === executionId);
    if (active && traceModalExecution?.id === executionId) {
      setTraceModalExecution(active);
    }
  };

  // 9. Launch Dry-Run Sandbox Simulation
  const handleExecuteSandboxRun = (
    playbook: AutomationPlaybook,
    injectChaos: boolean
  ) => {
    const newExecId = `SIM-RUN-${Date.now().toString().slice(-4)}`;

    const newRecord: PlaybookExecutionRecord = {
      id: newExecId,
      playbookId: playbook.id,
      playbookName: `[Sandbox] ${playbook.name || playbook.title}`,
      status: 'Executing',
      authorizationStatus: 'Approved',
      authorizedBy: 'Sandbox Simulator',
      authorizationNotes: 'Dry-run execution against synthetic mock cluster',
      currentStepIndex: 0,
      totalSteps: playbook.steps.length,
      progress: 25,
      isSimulation: true,
      steps: playbook.steps.map((s, idx) => ({
        ...s,
        status: idx === 0 ? 'Completed' : idx === 1 ? 'Executing' : 'Pending',
        output: idx === 0 ? 'Synthetic mock step executed nominal.' : undefined,
      })),
      verificationStatus: 'Pending',
      verificationChecks: playbook.verificationChecks || [
        {
          id: 'V-SIM-01',
          name: 'Synthetic Telemetry Validation',
          type: 'Threat Signal Reduced',
          status: 'Pending',
          expected: 'Anomaly signal reduced to 0',
        },
      ],
      rollbackStatus: 'Available',
      operator: 'Chaos Simulation Engine',
      startedAt: new Date().toLocaleTimeString(),
      logs: [
        `[${new Date().toLocaleTimeString()}] [SANDBOX] Initialized isolated dry-run container for ${playbook.id}`,
        `[${new Date().toLocaleTimeString()}] [SANDBOX] Injecting synthetic telemetry stream...`,
        injectChaos
          ? `[${new Date().toLocaleTimeString()}] [CHAOS] Injected transient pod eviction fault at Step 2.`
          : `[${new Date().toLocaleTimeString()}] [SANDBOX] Nominal cluster conditions active.`,
      ],
    };

    updateExecutionsState([newRecord, ...executions]);
    setTraceModalExecution(newRecord);
  };

  // 10. Candidate Playbook Actions
  const handlePromoteCandidate = (candidateId: string) => {
    const updated = playbooks.map((p) => {
      if (p.id === candidateId) {
        return {
          ...p,
          status: 'Active' as const,
        };
      }
      return p;
    });

    updatePlaybooksState(updated);
  };

  const handleRejectCandidate = (candidateId: string) => {
    const updated = playbooks.filter((p) => p.id !== candidateId);
    updatePlaybooksState(updated);
  };

  const handleAddSynthesizedCandidate = (candidate: AutomationPlaybook) => {
    updatePlaybooksState([candidate, ...playbooks]);
  };

  return (
    <div id="playbooks-controlled-automation-center" className="space-y-6">
      {/* Top Banner & Sandbox Toggle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Terminal className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-slate-100">
              Controlled Response & Automation Center
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Deterministic runbook governance, Human-in-the-Loop authorization gates, and automated post-execution verification.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            id="toggle-sandbox-btn"
            type="button"
            onClick={() => setIsSandboxOpen(!isSandboxOpen)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
              isSandboxOpen
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
            }`}
          >
            <Flame className="w-4 h-4 text-amber-400" />
            <span>{isSandboxOpen ? 'Hide Chaos Sandbox' : 'Dry-Run & Chaos Sandbox'}</span>
          </button>

          <button
            id="synth-candidate-header-btn"
            type="button"
            onClick={() => setIsSynthModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 shadow-md shadow-cyan-600/20 transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-cyan-200" />
            <span>Synthesize AI Runbook</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: Automation Posture Bar */}
      <AutomationPostureBar
        playbooks={activeCatalogPlaybooks}
        executions={executions}
        activeFilter={activePostureFilter}
        onFilterChange={setActivePostureFilter}
        candidateCount={candidatePlaybooks.length}
      />

      {/* SECTION 2: Simulation Sandbox Area (Collapsible) */}
      {isSandboxOpen && (
        <SimulationSandboxArea
          playbooks={playbooks}
          onClose={() => setIsSandboxOpen(false)}
          onExecuteSandboxRun={handleExecuteSandboxRun}
        />
      )}

      {/* SECTION 3: Active Executions Hub */}
      <ActiveExecutionsTable
        executions={filteredExecutions}
        playbooks={playbooks}
        incidents={incidents}
        risks={risks}
        onOpenAuthorizationModal={(exec) => setAuthModalExecution(exec)}
        onOpenTraceModal={(exec) => setTraceModalExecution(exec)}
        onSelectPlaybook={(pId) => setSelectedPlaybookId(pId)}
        onNavigateIncident={onNavigateIncident}
        onNavigateRisk={onNavigateRisk}
        onExecuteStep={handleExecuteStep}
        onPauseExecution={handlePauseExecution}
        onResumeExecution={handleResumeExecution}
        onRunVerification={handleRunVerification}
        onInitiateRollback={handleInitiateRollback}
      />

      {/* SECTION 4: AI Candidate Playbooks (Strictly Separated) */}
      <AICandidatePlaybooks
        candidatePlaybooks={candidatePlaybooks}
        incidents={incidents}
        risks={risks}
        onPromoteCandidate={handlePromoteCandidate}
        onRejectCandidate={handleRejectCandidate}
        onTestSandbox={(candidate) => {
          setIsSandboxOpen(true);
          handleExecuteSandboxRun(candidate, false);
        }}
        onSelectPlaybook={(pId) => setSelectedPlaybookId(pId)}
        onOpenSynthModal={() => setIsSynthModalOpen(true)}
      />

      {/* SECTION 5: Governed Playbook Catalog Library */}
      <PlaybookLibraryTable
        playbooks={activeCatalogPlaybooks}
        incidents={incidents}
        risks={risks}
        complianceControls={complianceControls}
        onSelectPlaybook={(pId) => setSelectedPlaybookId(pId)}
        onStageExecution={handleStageExecution}
        onOpenSynthModal={() => setIsSynthModalOpen(true)}
      />

      {/* MODAL 1: Playbook Detail & Architecture Drawer */}
      {selectedPlaybook && (
        <PlaybookDetailDrawer
          playbook={selectedPlaybook}
          executions={executions}
          incidents={incidents}
          risks={risks}
          complianceControls={complianceControls}
          onClose={() => setSelectedPlaybookId(null)}
          onStageExecution={(pb) => {
            setSelectedPlaybookId(null);
            handleStageExecution(pb);
          }}
          onTestSandbox={(pb) => {
            setIsSandboxOpen(true);
            handleExecuteSandboxRun(pb, false);
          }}
          onNavigateIncident={onNavigateIncident}
          onNavigateRisk={onNavigateRisk}
        />
      )}

      {/* MODAL 2: Human-in-the-Loop Authorization Gate */}
      {authModalExecution && (
        <PlaybookAuthorizationModal
          execution={authModalExecution}
          playbook={
            playbooks.find((p) => p.id === authModalExecution.playbookId) || null
          }
          incident={
            incidents.find((i) => i.id === authModalExecution.incidentId) || null
          }
          onClose={() => setAuthModalExecution(null)}
          onApprove={handleApproveAuthorization}
          onReject={handleRejectAuthorization}
        />
      )}

      {/* MODAL 3: Live Execution Trace & Telemetry Terminal */}
      {traceModalExecution && (
        <ExecutionTraceModal
          execution={traceModalExecution}
          playbook={
            playbooks.find((p) => p.id === traceModalExecution.playbookId) || null
          }
          incident={
            incidents.find((i) => i.id === traceModalExecution.incidentId) || null
          }
          onClose={() => setTraceModalExecution(null)}
          onExecuteStep={handleExecuteStep}
          onPauseExecution={handlePauseExecution}
          onResumeExecution={handleResumeExecution}
          onRunVerification={handleRunVerification}
          onInitiateRollback={handleInitiateRollback}
        />
      )}

      {/* MODAL 4: AI Playbook Synthesis Modal */}
      {isSynthModalOpen && (
        <AISynthPlaybookModal
          incidents={incidents}
          risks={risks}
          onClose={() => setIsSynthModalOpen(false)}
          onAddCandidate={handleAddSynthesizedCandidate}
        />
      )}
    </div>
  );
};
