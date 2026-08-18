import React, { useState } from 'react';
import {
  Scale,
  Plus,
  Clock,
  FileText,
  ShieldAlert,
  Sparkles,
  Download,
  Filter,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { DecisionRecord } from '../types';
import { INITIAL_DECISIONS } from '../data/mockData';
import { GovernancePostureBar } from './decisions/GovernancePostureBar';
import { DecisionQueue } from './decisions/DecisionQueue';
import { DecisionRegister } from './decisions/DecisionRegister';
import { DecisionDetailDrawer } from './decisions/DecisionDetailDrawer';
import { GovernanceReviewSurface } from './decisions/GovernanceReviewSurface';
import { NewDecisionModal } from './decisions/NewDecisionModal';
import { Button } from './ui/Button';

interface DecisionRegisterViewProps {
  decisions?: DecisionRecord[];
  onUpdateDecisions?: (decisions: DecisionRecord[]) => void;
  onNavigateIncident?: (incidentId: string) => void;
  onNavigateRisk?: (riskId: string) => void;
  onNavigateCompliance?: (controlId: string) => void;
  onNavigatePlaybook?: (playbookId: string) => void;
}

export const DecisionRegisterView: React.FC<DecisionRegisterViewProps> = ({
  decisions: initialDecisionsProp,
  onUpdateDecisions,
  onNavigateIncident,
  onNavigateRisk,
  onNavigateCompliance,
  onNavigatePlaybook,
}) => {
  const [decisions, setDecisions] = useState<DecisionRecord[]>(
    initialDecisionsProp || INITIAL_DECISIONS
  );

  // Sub-view: 'queue' (Operational Queue + Posture) | 'register' (System of Record Table) | 'consequential' (Executive Reviews)
  const [activeSubTab, setActiveSubTab] = useState<'queue' | 'register' | 'consequential'>('queue');
  const [activeMetricFilter, setActiveMetricFilter] = useState<string | null>(null);

  // Modal / Drawer states
  const [selectedDecision, setSelectedDecision] = useState<DecisionRecord | null>(null);
  const [drawerInitialSection, setDrawerInitialSection] = useState<string | undefined>(undefined);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  const handleUpdateDecision = (updated: DecisionRecord) => {
    const nextList = decisions.map((d) => (d.id === updated.id ? updated : d));
    setDecisions(nextList);
    setSelectedDecision(updated);
    onUpdateDecisions?.(nextList);
  };

  const handleAddDecision = (newRec: DecisionRecord) => {
    const nextList = [newRec, ...decisions];
    setDecisions(nextList);
    setSelectedDecision(newRec);
    onUpdateDecisions?.(nextList);
  };

  const handleOpenDecisionDetail = (decision: DecisionRecord, initialSection?: string) => {
    setSelectedDecision(decision);
    setDrawerInitialSection(initialSection);
  };

  const pendingCount = decisions.filter(
    (d) => d.status === 'Pending' || d.status === 'Under Review'
  ).length;

  const consequentialCount = decisions.filter(
    (d) => d.isConsequential || d.priority === 'P1 - Critical'
  ).length;

  return (
    <div className="space-y-5 font-sans animate-in fade-in duration-150" id="decisions-governance-hub">
      {/* Top Workspace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-100 tracking-tight">
                  Decisions, ADRs & Governance Center
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                  SYSTEM OF RECORD
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Authoritative governance records, risk acceptances, policy exemptions, and auditable AI advisory trade-offs
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-end sm:self-auto">
          <Button
            size="sm"
            variant="primary"
            onClick={() => setIsNewModalOpen(true)}
            className="font-medium"
            id="new-decision-btn"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Create Decision / ADR
          </Button>
        </div>
      </div>

      {/* Governance Posture Bar with Clickable Filter Cards */}
      <GovernancePostureBar
        decisions={decisions}
        activeFilter={activeMetricFilter}
        onSelectFilter={(filter) => {
          setActiveMetricFilter(filter);
          if (filter === 'consequential') {
            setActiveSubTab('consequential');
          } else if (filter === 'pending' || filter === 'awaiting_auth') {
            setActiveSubTab('queue');
          } else if (filter) {
            setActiveSubTab('register');
          }
        }}
        onOpenNewModal={() => setIsNewModalOpen(true)}
      />

      {/* Sub-Workspace Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-1">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setActiveSubTab('queue')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold font-mono transition-colors flex items-center gap-2 ${
              activeSubTab === 'queue'
                ? 'bg-slate-800 text-indigo-300 border border-indigo-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
            id="tab-decision-queue"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Decision Queue</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-300 font-bold">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('register')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold font-mono transition-colors flex items-center gap-2 ${
              activeSubTab === 'register'
                ? 'bg-slate-800 text-indigo-300 border border-indigo-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
            id="tab-decision-register"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Historical Register & ADRs</span>
            <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-900 text-slate-400">
              {decisions.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('consequential')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold font-mono transition-colors flex items-center gap-2 ${
              activeSubTab === 'consequential'
                ? 'bg-slate-800 text-rose-300 border border-rose-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
            id="tab-consequential-reviews"
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Consequential Governance Reviews</span>
            {consequentialCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500/20 text-rose-300 font-bold">
                {consequentialCount}
              </span>
            )}
          </button>
        </div>

        {activeMetricFilter && (
          <button
            onClick={() => setActiveMetricFilter(null)}
            className="text-[11px] font-mono text-indigo-400 hover:text-indigo-300 underline"
          >
            Clear Active Metric Filter ({activeMetricFilter})
          </button>
        )}
      </div>

      {/* Primary Workspace Views */}
      {activeSubTab === 'queue' && (
        <div className="space-y-4">
          <DecisionQueue
            decisions={decisions}
            onSelectDecision={handleOpenDecisionDetail}
            onNavigateIncident={onNavigateIncident}
            onNavigateRisk={onNavigateRisk}
            onNavigateCompliance={onNavigateCompliance}
            onNavigatePlaybook={onNavigatePlaybook}
          />
        </div>
      )}

      {activeSubTab === 'register' && (
        <div className="space-y-4">
          <DecisionRegister
            decisions={decisions}
            activeFilter={activeMetricFilter}
            onSelectDecision={handleOpenDecisionDetail}
            onNavigateIncident={onNavigateIncident}
            onNavigateRisk={onNavigateRisk}
            onNavigateCompliance={onNavigateCompliance}
            onNavigatePlaybook={onNavigatePlaybook}
          />
        </div>
      )}

      {activeSubTab === 'consequential' && (
        <div className="space-y-4">
          <GovernanceReviewSurface
            decisions={decisions}
            onSelectDecision={handleOpenDecisionDetail}
            onNavigateIncident={onNavigateIncident}
            onNavigateRisk={onNavigateRisk}
            onNavigateCompliance={onNavigateCompliance}
            onNavigatePlaybook={onNavigatePlaybook}
          />
        </div>
      )}

      {/* Decision Detail Drawer */}
      <DecisionDetailDrawer
        isOpen={Boolean(selectedDecision)}
        onClose={() => {
          setSelectedDecision(null);
          setDrawerInitialSection(undefined);
        }}
        decision={selectedDecision}
        onUpdateDecision={handleUpdateDecision}
        onNavigateIncident={onNavigateIncident}
        onNavigateRisk={onNavigateRisk}
        onNavigateCompliance={onNavigateCompliance}
        onNavigatePlaybook={onNavigatePlaybook}
        initialSection={drawerInitialSection}
      />

      {/* New Decision / ADR Modal */}
      <NewDecisionModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onAddDecision={handleAddDecision}
      />
    </div>
  );
};
