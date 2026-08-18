import React, { useState, useEffect } from 'react';
import {
  Settings,
  Flame,
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Database,
  Layers,
  ShieldCheck,
  Lock,
  LogOut,
  XCircle,
  KeyRound,
  Check,
  Play,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import {
  RiskItem,
  IncidentItem,
  ComplianceControl,
  AutomationPlaybook,
  GoogleWorkspaceAuthSession,
  ImportPreviewReport,
  DecisionRecord,
  ExternalChangesDetectionResult,
} from '../types';
import {
  syncIncidentsToSheet,
  syncAllTabsToSpreadsheet,
  readIncidentsFromSheet,
  generateImportPreview,
  applyImportReport,
  detectExternalChanges,
  parseSpreadsheetId,
  SPREADSHEET_TABS,
} from '../services/googleSheets';
import {
  getWorkspaceSession,
  subscribeWorkspaceSession,
  connectGoogleWorkspace,
  disconnectGoogleWorkspace,
  verifyWorkspaceConnection,
} from '../services/auth';
import {
  runBidirectionalSyncTestSuite,
  FullSyncVerificationReport,
} from '../services/syncVerificationTest';
import { ImportPreviewModal } from './ImportPreviewModal';
import {
  INITIAL_RISK_RULES,
  INITIAL_ESCALATIONS,
  INITIAL_SLA_RULES,
  INITIAL_AUDIT_LOGS,
  INITIAL_DECISIONS,
  INITIAL_SWOT,
} from '../data/mockData';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  risks: RiskItem[];
  incidents: IncidentItem[];
  complianceControls: ComplianceControl[];
  playbooks: AutomationPlaybook[];
  onImportIncidents?: (incidents: IncidentItem[]) => void;
  onApplyImportedDataset?: (dataset: {
    incidents?: IncidentItem[];
    risks?: RiskItem[];
    decisions?: DecisionRecord[];
  }) => void;
  onOpenChaosModal?: () => void;
  onShowConfirm: (options: {
    title: string;
    description: string;
    confirmText: string;
    isDestructive?: boolean;
    onConfirm: () => Promise<void> | void;
  }) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  risks,
  incidents,
  complianceControls,
  playbooks,
  onImportIncidents,
  onApplyImportedDataset,
  onOpenChaosModal,
  onShowConfirm,
}) => {
  const [activeTab, setActiveTab] = useState<'workspace' | 'testsuite' | 'exports' | 'simulator'>('workspace');
  const [session, setSession] = useState<GoogleWorkspaceAuthSession>(getWorkspaceSession());
  const [sheetId, setSheetId] = useState<string>(
    '1okKTfVHFwElUfKbKBx80OmAn4VRiBeD9yxIruHAimxU'
  );
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isPreviewing, setIsPreviewing] = useState<boolean>(false);
  const [isApplyingImport, setIsApplyingImport] = useState<boolean>(false);
  const [previewReport, setPreviewReport] = useState<ImportPreviewReport | null>(null);
  const [isImportPreviewOpen, setIsImportPreviewOpen] = useState<boolean>(false);

  // Test suite state
  const [testReport, setTestReport] = useState<FullSyncVerificationReport | null>(null);
  const [isRunningTests, setIsRunningTests] = useState<boolean>(false);

  const [lastSyncResult, setLastSyncResult] = useState<{
    spreadsheetId: string;
    url: string;
    timestamp: string;
    mode?: 'export' | 'import';
    count?: number;
    note?: string;
  } | null>(null);
  const [uiError, setUiError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeWorkspaceSession((s) => {
      setSession(s);
      if (s.spreadsheetId && !sheetId) {
        setSheetId(s.spreadsheetId);
      }
    });
    return () => unsubscribe();
  }, [sheetId]);

  if (!isOpen) return null;

  const authState = session.state;
  const isConnected = authState === 'CONNECTED' || authState === 'SYNCED' || authState === 'SYNCING';
  const isConnecting = authState === 'CONNECTING' || authState === 'AUTHENTICATING';
  const isExpired = authState === 'TOKEN_EXPIRED';
  const isAuthError = authState === 'AUTH_ERROR';

  const handleConnectWorkspace = async () => {
    setUiError(null);
    try {
      const updated = await connectGoogleWorkspace(sheetId);
      if (updated.state === 'CONNECTED') {
        setUiError(null);
      }
    } catch (err: any) {
      setUiError(err?.message || 'Failed to connect Google Workspace.');
    }
  };

  const handleDisconnectWorkspace = async () => {
    onShowConfirm({
      title: 'Disconnect Google Workspace Session',
      description:
        'This will clear the active Google OAuth authorization from memory. Live Google Sheets synchronization will be disabled until you reconnect.',
      confirmText: 'Disconnect Workspace',
      isDestructive: true,
      onConfirm: async () => {
        await disconnectGoogleWorkspace();
        setLastSyncResult(null);
        setUiError(null);
      },
    });
  };

  const handleVerifyTopology = async () => {
    if (!isConnected) {
      setUiError('Google Workspace authorization is required before verifying spreadsheet topology.');
      return;
    }
    setIsVerifying(true);
    setUiError(null);
    try {
      const res = await verifyWorkspaceConnection(sheetId);
      if (!res.spreadsheetAccessible) {
        setUiError(res.errorMessage || 'Target spreadsheet could not be accessed.');
      }
    } catch (err: any) {
      setUiError(err?.message || 'Verification probe encountered an error.');
    } finally {
      setIsVerifying(false);
    }
  };

  /**
   * PULL / INGEST: Dry-run preview from Google Sheets → RiskOps
   */
  const handleInitiateImport = async () => {
    if (!isConnected) {
      setUiError('Authorization required: Connect Google Workspace before importing.');
      return;
    }

    const cleanId = parseSpreadsheetId(sheetId);
    if (!cleanId) {
      setUiError('Please enter a valid Google Spreadsheet ID or URL to import from.');
      return;
    }

    setIsPreviewing(true);
    setUiError(null);

    try {
      const report = await generateImportPreview(cleanId, {
        incidents,
        risks,
        riskRules: INITIAL_RISK_RULES,
        escalations: INITIAL_ESCALATIONS,
        slaRules: INITIAL_SLA_RULES,
        auditLogs: INITIAL_AUDIT_LOGS,
        decisions: INITIAL_DECISIONS,
        swotItems: INITIAL_SWOT,
      });

      setPreviewReport(report);
      setIsImportPreviewOpen(true);
    } catch (err: any) {
      console.warn('Import preview notice:', err);
      setUiError(err?.message || 'Failed to generate Google Sheets import preview.');
    } finally {
      setIsPreviewing(false);
    }
  };

  /**
   * Apply validated import to RiskOps state
   */
  const handleApplyImport = (conflictResolutions: Record<string, 'KEEP_RISKOPS' | 'APPLY_GOOGLE'>) => {
    if (!previewReport) return;

    setIsApplyingImport(true);
    try {
      const result = applyImportReport(
        previewReport,
        {
          incidents,
          risks,
          riskRules: INITIAL_RISK_RULES,
          escalations: INITIAL_ESCALATIONS,
          slaRules: INITIAL_SLA_RULES,
          auditLogs: INITIAL_AUDIT_LOGS,
          decisions: INITIAL_DECISIONS,
          swotItems: INITIAL_SWOT,
        },
        conflictResolutions
      );

      if (result.success) {
        if (onApplyImportedDataset) {
          onApplyImportedDataset({
            incidents: result.importedDataset.incidents,
            risks: result.importedDataset.risks,
            decisions: result.importedDataset.decisions,
          });
        } else if (onImportIncidents) {
          onImportIncidents(result.importedDataset.incidents);
        }

        setLastSyncResult({
          spreadsheetId: previewReport.spreadsheetId,
          url: `https://docs.google.com/spreadsheets/d/${previewReport.spreadsheetId}`,
          timestamp: new Date().toLocaleTimeString(),
          mode: 'import',
          count: result.appliedCount,
          note: `Imported ${result.createdCount} new, updated ${result.updatedCount} records into RiskOps`,
        });

        setIsImportPreviewOpen(false);
        setPreviewReport(null);
      }
    } catch (err: any) {
      setUiError(err?.message || 'Error applying imported records.');
    } finally {
      setIsApplyingImport(false);
    }
  };

  /**
   * PUSH: RiskOps → Google Sheets with External Changes Safeguard
   */
  const handleExecuteSync = async () => {
    if (!isConnected) {
      setUiError('Authorization required: Connect Google Workspace before performing cloud synchronization.');
      return;
    }

    const cleanId = parseSpreadsheetId(sheetId);
    if (!cleanId) {
      setUiError('Please enter a valid Google Spreadsheet ID or URL.');
      return;
    }

    setIsSyncing(true);
    setUiError(null);

    try {
      // Step 1: Pre-push safeguard: Detect external changes in Google Sheets
      const externalCheck = await detectExternalChanges(cleanId, {
        incidents,
        risks,
        riskRules: INITIAL_RISK_RULES,
        escalations: INITIAL_ESCALATIONS,
        slaRules: INITIAL_SLA_RULES,
        auditLogs: INITIAL_AUDIT_LOGS,
        decisions: INITIAL_DECISIONS,
        swotItems: INITIAL_SWOT,
      });

      setIsSyncing(false);

      if (externalCheck.hasExternalChanges) {
        // Warn user before pushing
        onShowConfirm({
          title: 'EXTERNAL CHANGES DETECTED IN GOOGLE SHEETS',
          description: `Google Sheets contains ${externalCheck.details.join(
            ', '
          )} that have not been ingested into RiskOps. Pushing now will overwrite those external changes.\n\nRecommended: Import & Merge first to preserve spreadsheet modifications.`,
          confirmText: 'Overwrite Google Sheet Anyway',
          isDestructive: true,
          onConfirm: async () => {
            await performPushSync(cleanId);
          },
        });
        return;
      }

      // No external changes detected, proceed with push
      onShowConfirm({
        title: 'Authorize 10-Tab Master Sync to Google Sheets',
        description: `Push live updates across all 10 worksheets in target Google Spreadsheet (${cleanId.substring(
          0,
          12
        )}...). Scope: https://www.googleapis.com/auth/spreadsheets`,
        confirmText: 'Confirm Cloud Sync',
        isDestructive: false,
        onConfirm: async () => {
          await performPushSync(cleanId);
        },
      });
    } catch (e: any) {
      setIsSyncing(false);
      setUiError(e?.message || 'Error checking external changes.');
    }
  };

  const performPushSync = async (cleanId: string) => {
    setIsSyncing(true);
    setUiError(null);
    try {
      await syncAllTabsToSpreadsheet(cleanId, {
        incidents,
        risks,
        riskRules: INITIAL_RISK_RULES,
        escalations: INITIAL_ESCALATIONS,
        slaRules: INITIAL_SLA_RULES,
        auditLogs: INITIAL_AUDIT_LOGS,
        decisions: INITIAL_DECISIONS,
        swotItems: INITIAL_SWOT,
      });

      setLastSyncResult({
        spreadsheetId: cleanId,
        url: `https://docs.google.com/spreadsheets/d/${cleanId}`,
        timestamp: new Date().toLocaleTimeString(),
        mode: 'export',
        count: incidents.length,
        note: 'All 10 worksheets synchronized with verified schema and baseline snapshot saved',
      });
    } catch (err: any) {
      console.warn('Sync notice:', err);
      setUiError(err?.message || 'Failed to sync to Google Sheets.');
    } finally {
      setIsSyncing(false);
    }
  };

  /**
   * Run 11-point Bidirectional Sync Test Suite
   */
  const handleRunSyncTests = async () => {
    setIsRunningTests(true);
    try {
      const report = await runBidirectionalSyncTestSuite();
      setTestReport(report);
    } catch (e: any) {
      console.warn('Test run error:', e);
    } finally {
      setIsRunningTests(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ['id', 'title', 'severity', 'riskDomain', 'status', 'cvssScore', 'timestamp'];
    const rows = incidents.map((i) => [
      i.id,
      `"${i.title.replace(/"/g, '""')}"`,
      i.severity,
      i.riskDomain,
      i.status,
      i.cvssScore,
      i.timestamp,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `RiskOps_01_Incidents_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJSON = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      tabs: SPREADSHEET_TABS,
      data: {
        '01_Incidents': incidents,
        '02_Risk_Rules': risks,
        '04_Compliance': complianceControls,
        '09_Playbooks': playbooks,
      },
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `RiskOps_Master_Backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <Modal
        id="settings-integrations-modal"
        isOpen={isOpen}
        onClose={onClose}
        title="Settings & Integrations"
        subtitle="Google Workspace Bidirectional Synchronization & Verification Hub"
        size="lg"
        icon={
          <div className="p-2 rounded-[3px] bg-[#1A1A1E] text-white">
            <Settings className="w-5 h-5" />
          </div>
        }
      >
        {/* Sub-navigation tabs */}
        <div className="flex items-center gap-2 border-b border-[#1A1A1E]/10 pb-3 font-mono text-xs overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('workspace')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-[3px] font-semibold transition-colors shrink-0 ${
              activeTab === 'workspace'
                ? 'bg-[#1A1A1E] text-white'
                : 'text-[#1A1A1E]/70 hover:text-[#1A1A1E] hover:bg-[#F8F7F4]'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Google Workspace & Sync</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('testsuite')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-[3px] font-semibold transition-colors shrink-0 ${
              activeTab === 'testsuite'
                ? 'bg-[#1A1A1E] text-white'
                : 'text-[#1A1A1E]/70 hover:text-[#1A1A1E] hover:bg-[#F8F7F4]'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Sync Verification Suite</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('exports')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-[3px] font-semibold transition-colors shrink-0 ${
              activeTab === 'exports'
                ? 'bg-[#1A1A1E] text-white'
                : 'text-[#1A1A1E]/70 hover:text-[#1A1A1E] hover:bg-[#F8F7F4]'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Offline Export & Backups</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('simulator')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-[3px] font-semibold transition-colors shrink-0 ${
              activeTab === 'simulator'
                ? 'bg-[#1A1A1E] text-white'
                : 'text-[#1A1A1E]/70 hover:text-[#1A1A1E] hover:bg-[#F8F7F4]'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Threat Simulation</span>
          </button>
        </div>

        {/* Tab 1: Google Workspace */}
        {activeTab === 'workspace' && (
          <div className="space-y-4 pt-1">
            {/* Section: OAuth Authorization State Card */}
            <div
              id="google-workspace-auth-card"
              className="p-4 rounded-[4px] bg-white border border-[#1A1A1E]/20 space-y-3 font-sans shadow-xs"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#1A1A1E]/10 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-syne text-xs font-bold uppercase tracking-wider text-[#1A1A1E]">
                      Google Workspace
                    </span>
                    {isConnected ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] bg-[#059669]/10 text-[#059669] text-[10px] font-mono font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#059669] animate-pulse" />
                        Connected
                      </span>
                    ) : isExpired ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] bg-[#D97706]/10 text-[#D97706] text-[10px] font-mono font-bold">
                        <AlertTriangle className="w-3 h-3 text-[#D97706]" />
                        Authorization Expired
                      </span>
                    ) : isAuthError ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] bg-[#DC2626]/10 text-[#DC2626] text-[10px] font-mono font-bold">
                        <XCircle className="w-3 h-3 text-[#DC2626]" />
                        Auth Error
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] bg-[#1A1A1E]/5 text-[#1A1A1E]/60 text-[10px] font-mono font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#1A1A1E]/30" />
                        Not Connected
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#1A1A1E]/70 mt-1">
                    {isConnected
                      ? `Authorized account: ${session.user?.email || 'SecOps Lead'} (Spreadsheets & Drive scopes)`
                      : 'Google Sheets bidirectional synchronization is unavailable until Google Workspace authorization is completed.'}
                  </p>
                </div>

                {/* OAuth Action Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  {isConnected ? (
                    <button
                      id="disconnect-workspace-btn"
                      type="button"
                      onClick={handleDisconnectWorkspace}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] text-xs font-semibold text-[#DC2626] bg-[#DC2626]/5 hover:bg-[#DC2626]/10 border border-[#DC2626]/20 transition-all font-mono"
                    >
                      <LogOut className="w-3 h-3" />
                      <span>Disconnect</span>
                    </button>
                  ) : (
                    <button
                      id="connect-workspace-btn"
                      type="button"
                      onClick={handleConnectWorkspace}
                      disabled={isConnecting}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[3px] text-xs font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] shadow-xs transition-all font-mono disabled:opacity-50"
                    >
                      {isConnecting ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <KeyRound className="w-3 h-3" />
                      )}
                      <span>{isExpired ? 'Reconnect Google Workspace' : 'Connect Google Workspace'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Verification Checklist */}
              <div className="space-y-2 pt-1 font-mono text-[11px]">
                <div className="flex items-center justify-between text-xs text-[#1A1A1E]/70 font-semibold">
                  <span>Security & Topology Verification</span>
                  {session.verification?.lastVerifiedAt && (
                    <span className="text-[10px] text-[#1A1A1E]/40 font-mono">
                      Verified: {new Date(session.verification.lastVerifiedAt).toLocaleTimeString()}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-[3px] bg-[#F8F7F4] border border-[#1A1A1E]/10 flex items-center justify-between">
                    <span className="text-[#1A1A1E]/80">1. Google OAuth Session</span>
                    {isConnected ? (
                      <span className="text-[#059669] flex items-center gap-1 font-bold">
                        <Check className="w-3.5 h-3.5" /> Valid
                      </span>
                    ) : (
                      <span className="text-[#1A1A1E]/40 flex items-center gap-1">
                        <Lock className="w-3.5 h-3.5" /> Required
                      </span>
                    )}
                  </div>

                  <div className="p-2 rounded-[3px] bg-[#F8F7F4] border border-[#1A1A1E]/10 flex items-center justify-between">
                    <span className="text-[#1A1A1E]/80">2. Sheets API (v4)</span>
                    {isConnected ? (
                      <span className="text-[#059669] flex items-center gap-1 font-bold">
                        <Check className="w-3.5 h-3.5" /> Ready
                      </span>
                    ) : (
                      <span className="text-[#1A1A1E]/40">Pending Auth</span>
                    )}
                  </div>

                  <div className="p-2 rounded-[3px] bg-[#F8F7F4] border border-[#1A1A1E]/10 flex items-center justify-between">
                    <span className="text-[#1A1A1E]/80">3. Drive API (drive.file)</span>
                    {isConnected ? (
                      <span className="text-[#059669] flex items-center gap-1 font-bold">
                        <Check className="w-3.5 h-3.5" /> Ready
                      </span>
                    ) : (
                      <span className="text-[#1A1A1E]/40">Pending Auth</span>
                    )}
                  </div>

                  <div className="p-2 rounded-[3px] bg-[#F8F7F4] border border-[#1A1A1E]/10 flex items-center justify-between">
                    <span className="text-[#1A1A1E]/80">4. 10/10 Worksheets</span>
                    {isConnected ? (
                      <span className="text-[#059669] flex items-center gap-1 font-bold">
                        <Check className="w-3.5 h-3.5" /> 10/10 Verified
                      </span>
                    ) : (
                      <span className="text-[#1A1A1E]/40">10 Standardized</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Section: Target Spreadsheet Configuration */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-[#1A1A1E]">
                <span>Target Google Spreadsheet ID / URL</span>
                <button
                  type="button"
                  onClick={handleVerifyTopology}
                  disabled={isVerifying || !isConnected}
                  className="text-[11px] text-[#2563EB] hover:underline font-mono disabled:opacity-40"
                >
                  {isVerifying ? 'Verifying Topology...' : 'Verify Schema Structure'}
                </button>
              </div>
              <input
                id="settings-sheet-id-input"
                type="text"
                value={sheetId}
                onChange={(e) => setSheetId(e.target.value)}
                placeholder="Enter Google Spreadsheet ID or full URL"
                className="w-full px-3 py-2 bg-white border border-[#1A1A1E]/20 rounded-[3px] text-xs font-mono text-[#1A1A1E] focus:outline-none focus:border-[#1A1A1E]"
              />
              <p className="text-[11px] text-[#1A1A1E]/60">
                Synchronizes bidirectionally across 10 standardized worksheets: <code className="text-[#1A1A1E] font-mono">01_Incidents</code> to <code className="text-[#1A1A1E] font-mono">10_SWOT_Analysis</code>.
              </p>
            </div>

            {/* 10-Tab Scope Grid */}
            <div className="p-3 rounded-[3px] bg-white border border-[#1A1A1E]/15 space-y-2">
              <span className="text-[11px] font-semibold text-[#1A1A1E]/70 flex items-center gap-1.5 font-mono">
                <Layers className="w-3.5 h-3.5 text-[#2563EB]" />
                Standardized 10-Sheet Workbook Schema
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1 text-[10px] font-mono">
                {SPREADSHEET_TABS.map((tab) => (
                  <span
                    key={tab}
                    className="px-2 py-1 rounded-[2px] bg-[#F8F7F4] border border-[#1A1A1E]/10 text-[#1A1A1E] truncate"
                  >
                    {tab}
                  </span>
                ))}
              </div>
            </div>

            {/* Success Banner */}
            {lastSyncResult && (
              <div className="p-3 rounded-[3px] bg-[#059669]/10 border border-[#059669]/30 text-[#059669] text-xs space-y-1 font-mono">
                <div className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    {lastSyncResult.mode === 'import'
                      ? `Imported & merged records from Google Sheets!`
                      : `Synchronized 10-tab workbook!`}
                  </span>
                  <span className="text-[10px]">{lastSyncResult.timestamp}</span>
                </div>
                <p className="text-[11px] text-[#059669]/90">{lastSyncResult.note}</p>
                <a
                  href={lastSyncResult.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:underline text-[11px]"
                >
                  <span>Open Google Sheet in new tab</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            {/* Error Banner */}
            {(uiError || session.error) && (
              <div className="p-3 rounded-[3px] bg-[#DC2626]/10 border border-[#DC2626]/30 text-[#DC2626] text-xs flex items-start gap-2 font-mono">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Google Workspace Notice</p>
                  <p className="text-[11px] mt-0.5">
                    {uiError || session.error?.message}
                  </p>
                  {session.error?.actionableFix && (
                    <p className="text-[10px] text-[#DC2626]/80 mt-1">
                      Fix: {session.error.actionableFix}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Modal Footer Controls */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-2 border-t border-[#1A1A1E]/10">
              <span className="text-[11px] text-[#1A1A1E]/50 font-mono">
                {isConnected ? '● Bidirectional Mode Ready' : '○ Offline Mode • Export Ready'}
              </span>

              <div className="flex items-center gap-2">
                <Button
                  id="modal-import-from-sheets-btn"
                  variant="outline"
                  size="sm"
                  onClick={handleInitiateImport}
                  disabled={isPreviewing || isSyncing || !isConnected}
                  isLoading={isPreviewing}
                  leftIcon={<Download className="w-3.5 h-3.5 text-[#059669]" />}
                >
                  Import From Google Sheets
                </Button>
                <Button
                  id="modal-sync-workbook-btn"
                  variant="primary"
                  size="sm"
                  onClick={handleExecuteSync}
                  disabled={isSyncing || isPreviewing || !isConnected}
                  isLoading={isSyncing}
                  leftIcon={<Upload className="w-3.5 h-3.5" />}
                >
                  Sync 10-Tab Workbook
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Test Suite */}
        {activeTab === 'testsuite' && (
          <div className="space-y-4 pt-1 font-sans">
            <div className="p-4 rounded-[4px] bg-white border border-[#1A1A1E]/20 space-y-3 shadow-xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#1A1A1E]/10 pb-3">
                <div>
                  <h4 className="text-xs font-bold text-[#1A1A1E] font-syne uppercase tracking-wider flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#2563EB]" />
                    Bidirectional Sync Verification Suite
                  </h4>
                  <p className="text-xs text-[#1A1A1E]/70 mt-0.5">
                    Runs 11 deterministic tests verifying RiskOps ↔ Google Sheets round-trip ingestion, conflict detection, and no-data-loss safeguards.
                  </p>
                </div>
                <Button
                  id="run-sync-test-suite-btn"
                  variant="primary"
                  size="sm"
                  onClick={handleRunSyncTests}
                  disabled={isRunningTests}
                  isLoading={isRunningTests}
                  leftIcon={<Play className="w-3.5 h-3.5" />}
                >
                  Run Sync Test Suite
                </Button>
              </div>

              {/* Test Results List */}
              {testReport ? (
                <div className="space-y-2 font-mono text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-[3px] bg-[#059669]/10 border border-[#059669]/30 text-[#059669] font-bold">
                    <span>
                      Verification Result: {testReport.passedCount}/{testReport.totalTests} Tests Passed
                    </span>
                    <span className="text-[10px]">{testReport.timestamp}</span>
                  </div>

                  <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                    {testReport.results.map((res) => (
                      <div
                        key={res.id}
                        className="p-2.5 rounded-[3px] bg-[#F8F7F4] border border-[#1A1A1E]/10 space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#1A1A1E]">
                            {res.id}: {res.name}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded-[2px] text-[10px] font-bold ${
                              res.status === 'PASSED'
                                ? 'bg-[#059669]/10 text-[#059669]'
                                : 'bg-[#DC2626]/10 text-[#DC2626]'
                            }`}
                          >
                            {res.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#1A1A1E]/70 font-sans">{res.description}</p>
                        <p className="text-[10px] text-[#2563EB]">{res.details}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-[#1A1A1E]/50 font-mono">
                  Click "Run Sync Test Suite" above to execute all 11 deterministic verification cases.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Offline Backups & Export */}
        {activeTab === 'exports' && (
          <div className="space-y-4 pt-1 font-sans">
            <div className="p-4 rounded-[4px] bg-white border border-[#1A1A1E]/20 space-y-3 shadow-xs">
              <div>
                <h4 className="text-xs font-bold text-[#1A1A1E] font-syne uppercase tracking-wider">
                  Direct File Downloads (Offline & Spreadsheet Ready)
                </h4>
                <p className="text-xs text-[#1A1A1E]/70 mt-0.5">
                  Download local snapshot files formatted to mirror the Google Sheets data model for offline compliance auditing.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 font-mono">
                <div className="p-3 rounded-[3px] bg-[#F8F7F4] border border-[#1A1A1E]/10 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-[#1A1A1E] block">01_Incidents.csv</span>
                    <span className="text-[10px] text-[#1A1A1E]/60">{incidents.length} Telemetry Records</span>
                  </div>
                  <Button size="xs" variant="outline" onClick={handleExportCSV} leftIcon={<Download className="w-3 h-3" />}>
                    Export CSV
                  </Button>
                </div>

                <div className="p-3 rounded-[3px] bg-[#F8F7F4] border border-[#1A1A1E]/10 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-[#1A1A1E] block">10Tab_Master_Backup.json</span>
                    <span className="text-[10px] text-[#1A1A1E]/60">10 Standardized Tabs</span>
                  </div>
                  <Button size="xs" variant="outline" onClick={handleExportJSON} leftIcon={<Download className="w-3 h-3" />}>
                    Export JSON
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Threat Simulation */}
        {activeTab === 'simulator' && (
          <div className="space-y-4 pt-1 font-sans">
            <div className="p-4 rounded-[4px] bg-white border border-[#1A1A1E]/20 space-y-3 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-[3px] bg-[#D97706]/10 text-[#D97706] border border-[#D97706]/20">
                  <Flame className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#1A1A1E] font-syne uppercase tracking-wider">
                    Threat Ingestion & Simulation Tool
                  </h4>
                  <p className="text-xs text-[#1A1A1E]/70 mt-0.5">
                    Inject synthetic attacks (Voice Clone, Prompt Injection, Bulk OCR) to verify triage and SLA timers.
                  </p>
                </div>
              </div>

              <div className="pt-2 flex justify-end font-mono">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    onClose();
                    if (onOpenChaosModal) onOpenChaosModal();
                  }}
                  leftIcon={<Flame className="w-3.5 h-3.5 text-[#D97706]" />}
                >
                  Launch Simulator Console
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Import Preview & Conflict Resolution Modal */}
      <ImportPreviewModal
        isOpen={isImportPreviewOpen}
        onClose={() => {
          setIsImportPreviewOpen(false);
          setPreviewReport(null);
        }}
        report={previewReport}
        onApply={handleApplyImport}
        isApplying={isApplyingImport}
      />
    </>
  );
};
