import React, { useState } from 'react';
import { ComplianceControl, RiskItem } from '../types';
import {
  CompliancePostureBar,
  ComplianceQuickFilter,
} from './compliance/CompliancePostureBar';
import { PriorityGapsTriage } from './compliance/PriorityGapsTriage';
import { ControlRegisterTable } from './compliance/ControlRegisterTable';
import { ControlDetailDrawer } from './compliance/ControlDetailDrawer';
import { AIComplianceAuditModal } from './compliance/AIComplianceAuditModal';

interface ComplianceCenterProps {
  controls: ComplianceControl[];
  risks?: RiskItem[];
  onUpdateControl: (control: ComplianceControl) => void;
  onAddControls: (controls: ComplianceControl[]) => void;
  onOpenSheetsModal: () => void;
  onNavigateTab?: (tab: string) => void;
}

export const ComplianceCenter: React.FC<ComplianceCenterProps> = ({
  controls,
  risks = [],
  onUpdateControl,
  onAddControls,
  onOpenSheetsModal,
  onNavigateTab,
}) => {
  const [selectedFramework, setSelectedFramework] = useState<string>('All');
  const [activeQuickFilter, setActiveQuickFilter] = useState<ComplianceQuickFilter>({
    type: 'all',
    label: 'All Controls',
  });

  const [selectedControl, setSelectedControl] = useState<ComplianceControl | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState<boolean>(false);

  const handleSelectControl = (control: ComplianceControl) => {
    setSelectedControl(control);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedControl(null);
  };

  const handleQuickUpdateStatus = (
    control: ComplianceControl,
    newStatus: 'Pass' | 'Warning' | 'Gap'
  ) => {
    const updated: ComplianceControl = {
      ...control,
      status: newStatus,
      lastTested: new Date().toISOString().split('T')[0],
      auditHistory: [
        ...(control.auditHistory || []),
        {
          id: `HIST-${Date.now()}`,
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
          actor: 'Lead SecOps (Quick Action)',
          action: `Status toggled to ${newStatus}`,
        },
      ],
    };
    onUpdateControl(updated);
    if (selectedControl && selectedControl.id === control.id) {
      setSelectedControl(updated);
    }
  };

  const handleDrawerUpdate = (updated: ComplianceControl) => {
    onUpdateControl(updated);
    setSelectedControl(updated);
  };

  return (
    <div id="compliance-center-workspace" className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Executive Posture Bar & Framework Filter */}
      <CompliancePostureBar
        controls={controls}
        risks={risks}
        selectedFramework={selectedFramework}
        onSelectFramework={setSelectedFramework}
        activeQuickFilter={activeQuickFilter}
        onSelectQuickFilter={setActiveQuickFilter}
        onOpenAuditModal={() => setIsAuditModalOpen(true)}
        onOpenSheetsModal={onOpenSheetsModal}
      />

      {/* 2. Priority Gaps & Remediation Queue */}
      <PriorityGapsTriage
        controls={controls}
        risks={risks}
        onSelectControl={handleSelectControl}
        onNavigateTab={onNavigateTab}
      />

      {/* 3. Definitive Control Register & Evidence Catalog Table */}
      <ControlRegisterTable
        controls={controls}
        risks={risks}
        selectedFramework={selectedFramework}
        activeQuickFilter={activeQuickFilter}
        onSelectControl={handleSelectControl}
        onQuickUpdateStatus={handleQuickUpdateStatus}
      />

      {/* 4. Slide-Over Deep Dive Control Inspector */}
      <ControlDetailDrawer
        control={selectedControl}
        risks={risks}
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        onUpdateControl={handleDrawerUpdate}
        onNavigateTab={onNavigateTab}
      />

      {/* 5. AI Compliance Auditor Modal (Gemini) */}
      <AIComplianceAuditModal
        isOpen={isAuditModalOpen}
        selectedFramework={selectedFramework}
        onClose={() => setIsAuditModalOpen(false)}
        onAddControls={onAddControls}
      />
    </div>
  );
};
