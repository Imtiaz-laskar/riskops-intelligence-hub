import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  X,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  Download,
  Upload,
  Layers,
  FileDown,
  KeyRound,
  LogOut,
  Lock,
  Check,
  XCircle,
} from 'lucide-react';
import {
  RiskItem,
  IncidentItem,
  ComplianceControl,
  AutomationPlaybook,
  GoogleWorkspaceAuthSession,
  ImportPreviewReport,
  DecisionRecord,
} from '../types';
import {
  syncIncidentsToSheet,
  syncAllTabsToSpreadsheet,
  readIncidentsFromSheet,
  generateImportPreview,
  applyImportReport,
  detectExternalChanges,
  parseSpreadsheetId,
  generateCsv,
  downloadCsvFile,
  downloadWorkbookJson,
  SPREADSHEET_TABS,
} from '../services/googleSheets';
import {
  getWorkspaceSession,
  subscribeWorkspaceSession,
  connectGoogleWorkspace,
  disconnectGoogleWorkspace,
} from '../services/auth';
import { ImportPreviewModal } from './ImportPreviewModal';
import {
  INITIAL_RISK_RULES,
  INITIAL_ESCALATIONS,
  INITIAL_SLA_RULES,
  INITIAL_AUDIT_LOGS,
  INITIAL_DECISIONS,
  INITIAL_SWOT,
} from '../data/mockData';

interface GoogleSheetsModalProps {
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
  onShowConfirm: (options: {
    title: string;
    description: string;
    confirmText: string;
    isDestructive?: boolean;
    onConfirm: () => Promise<void> | void;
  }) => void;
}

export const GoogleSheetsModal: React.FC<GoogleSheetsModalProps> = ({
  isOpen,
  onClose,
  risks,
  incidents,
  complianceControls,
  playbooks,
  onImportIncidents,
  onApplyImportedDataset,
  onShowConfirm,
}) => {
  const [syncType, setSyncType] = useState<'all' | 'incidents'>('all');
  const [existingSheetId, setExistingSheetId] = useState<string>(
    'https://docs.google.com/spreadsheets/d/1okKTfVHFwElUfKbKBx80OmAn4VRiBeD9yxIruHAimxU/edit?gid=0#gid=0'
  );
  const [session, setSession] = useState<GoogleWorkspaceAuthSession>(getWorkspaceSession());
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isPreviewing, setIsPreviewing] = useState<boolean>(false);
  const [isApplyingImport, setIsApplyingImport] = useState<boolean>(false);
  const [previewReport, setPreviewReport] = useState<ImportPreviewReport | null>(null);
  const [isImportPreviewOpen, setIsImportPreviewOpen] = useState<boolean>(false);

  const [lastSyncResult, setLastSyncResult] = useState<{
    spreadsheetId: string;
    url: string;
    timestamp: string;
    mode?: 'export' | 'import';
    count?: number;
    note?: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeWorkspaceSession((s) => {
      setSession(s);
    });
    return () => unsubscribe();
  }, []);

  if (!isOpen) return null;

  const authState = session.state;
  const isConnected = authState === 'CONNECTED' || authState === 'SYNCED' || authState === 'SYNCING';
  const isConnecting = authState === 'CONNECTING' || authState === 'AUTHENTICATING';

  const handleConnectWorkspace = async () => {
    setErrorMessage(null);
    try {
      await connectGoogleWorkspace(existingSheetId);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to connect Google Workspace.');
    }
  };

  const handleDisconnectWorkspace = async () => {
    onShowConfirm({
      title: 'Disconnect Google Workspace Session',
      description: 'This will revoke active in-memory authorization credentials.',
      confirmText: 'Disconnect',
      isDestructive: true,
      onConfirm: async () => {
        await disconnectGoogleWorkspace();
        setLastSyncResult(null);
      },
    });
  };

  const handleDownloadCsv = () => {
    const headers = [
      'Incident_ID',
      'Created_At',
      'Title',
      'Risk_Domain',
      'Risk_Type',
      'Description',
      'Source',
      'Region',
      'Severity',
      'Status',
      'CVSS_Score',
    ];
    const rows = incidents.map((inc) => [
      inc.id,
      inc.createdAt || inc.timestamp?.split(' ')[0] || '2026-08-12',
      inc.title,
      inc.riskDomain || 'AI / Deepfake',
      inc.riskType || 'Impersonation',
      inc.description,
      inc.source || 'LLM Monitoring Gateway',
      inc.region || 'Global Operations',
      inc.severity,
      inc.status,
      inc.cvssScore ?? 8.5,
    ]);
    const csvContent = generateCsv([headers, ...rows]);
    downloadCsvFile(`01_Incidents_RiskOps_${new Date().toISOString().split('T')[0]}.csv`, csvContent);
  };

  const handleDownloadJsonBackup = () => {
    const fullBackup = {
      timestamp: new Date().toISOString(),
      incidents,
      risks,
      riskRules: INITIAL_RISK_RULES,
      escalations: INITIAL_ESCALATIONS,
      slaRules: INITIAL_SLA_RULES,
      auditLogs: INITIAL_AUDIT_LOGS,
      decisions: INITIAL_DECISIONS,
      swotItems: INITIAL_SWOT,
    };
    downloadWorkbookJson(`RiskOps_10Tab_Master_Workbook_${new Date().toISOString().split('T')[0]}.json`, fullBackup);
  };

  /**
   * PUSH with Pre-Push External Changes Safeguard
   */
  const handleExecuteSync = async () => {
    if (!isConnected) {
      setErrorMessage('Authorization required: Please connect Google Workspace before syncing.');
      return;
    }

    const rawInput = existingSheetId.trim();
    const sheetId = parseSpreadsheetId(rawInput);

    if (!sheetId) {
      setErrorMessage('Please provide a valid Google Spreadsheet ID or URL.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      // Pre-push external check
      const externalCheck = await detectExternalChanges(sheetId, {
        incidents,
        risks,
        riskRules: INITIAL_RISK_RULES,
        escalations: INITIAL_ESCALATIONS,
        slaRules: INITIAL_SLA_RULES,
        auditLogs: INITIAL_AUDIT_LOGS,
        decisions: INITIAL_DECISIONS,
        swotItems: INITIAL_SWOT,
      });

      setIsProcessing(false);

      if (externalCheck.hasExternalChanges) {
        onShowConfirm({
          title: 'EXTERNAL CHANGES DETECTED IN GOOGLE SHEETS',
          description: `Google Sheets contains ${externalCheck.details.join(
            ', '
          )} that have not been ingested into RiskOps. Pushing now will overwrite those external changes.\n\nRecommended: Use "Import From Google Sheets" first to preserve spreadsheet modifications.`,
          confirmText: 'Overwrite Google Sheet Anyway',
          isDestructive: true,
          onConfirm: async () => {
            await performPush(sheetId);
          },
        });
        return;
      }

      onShowConfirm({
        title: 'Authorize Google Sheets 10-Tab Export',
        description: `You are about to export ${
          syncType === 'all'
            ? `all 10 workbook tabs including ${incidents.length} incidents, risk rules, escalations, SLAs, and SWOT analysis`
            : `${incidents.length} incidents to tab 01_Incidents`
        } into Google Sheet (${sheetId.substring(0, 12)}...).`,
        confirmText: 'Confirm Google Sheets Sync',
        isDestructive: false,
        onConfirm: async () => {
          await performPush(sheetId);
        },
      });
    } catch (e: any) {
      setIsProcessing(false);
      setErrorMessage(e?.message || 'Error checking external changes.');
    }
  };

  const performPush = async (sheetId: string) => {
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      if (syncType === 'all') {
        await syncAllTabsToSpreadsheet(sheetId, {
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
          spreadsheetId: sheetId,
          url: `https://docs.google.com/spreadsheets/d/${sheetId}`,
          timestamp: new Date().toLocaleTimeString(),
          mode: 'export',
          count: incidents.length,
          note: 'Synchronized with verified 10-tab schema and baseline saved',
        });
      } else {
        await syncIncidentsToSheet(sheetId, incidents);
        setLastSyncResult({
          spreadsheetId: sheetId,
          url: `https://docs.google.com/spreadsheets/d/${sheetId}`,
          timestamp: new Date().toLocaleTimeString(),
          mode: 'export',
          count: incidents.length,
          note: '01_Incidents synced with verified column mapping',
        });
      }
    } catch (err: any) {
      console.warn('Sheets Sync Note:', err);
      setErrorMessage(err?.message || 'Sync encountered an error.');
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * PULL: Dry-run preview from Google Sheets
   */
  const handleInitiateImport = async () => {
    if (!isConnected) {
      setErrorMessage('Authorization required: Please connect Google Workspace before importing.');
      return;
    }

    const rawInput = existingSheetId.trim();
    const sheetId = parseSpreadsheetId(rawInput);

    if (!sheetId) {
      setErrorMessage('Please provide a valid Google Spreadsheet ID or URL to import from.');
      return;
    }

    setIsPreviewing(true);
    setErrorMessage(null);

    try {
      const report = await generateImportPreview(sheetId, {
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
      console.warn('Sheets Import Note:', err);
      setErrorMessage(err?.message || 'Could not connect to live sheet for import preview.');
    } finally {
      setIsPreviewing(false);
    }
  };

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
      setErrorMessage(err?.message || 'Error applying imported records.');
    } finally {
      setIsApplyingImport(false);
    }
  };

  return (
    <>
      <div
        id="sheets-sync-modal-backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A1A1E]/80 backdrop-blur-xs animate-in fade-in duration-200"
      >
        <div
          id="sheets-sync-modal-dialog"
          className="bg-[#F8F7F4] border-2 border-[#1A1A1E] rounded-[4px] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] font-sans"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[#1A1A1E]/20 bg-white">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-[3px] bg-[#1A1A1E] text-white">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-syne text-sm font-bold uppercase tracking-tight text-[#1A1A1E] flex items-center gap-2">
                  Google Workspace & Sheets Topology
                </h2>
                <p className="text-xs text-[#1A1A1E]/70">
                  Bidirectional Synchronization with 10-tab Master Workbook
                </p>
              </div>
            </div>
            <button
              id="close-sheets-modal-btn"
              onClick={onClose}
              className="p-1.5 rounded text-[#1A1A1E]/60 hover:text-[#1A1A1E] hover:bg-[#F8F7F4] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 overflow-y-auto space-y-4">
            {/* OAuth Status Card */}
            <div className="p-3.5 rounded-[3px] bg-white border border-[#1A1A1E]/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-mono text-xs">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#1A1A1E]">GOOGLE WORKSPACE</span>
                  {isConnected ? (
                    <span className="text-[#059669] font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#059669] animate-pulse" />
                      CONNECTED
                    </span>
                  ) : (
                    <span className="text-[#1A1A1E]/50 font-bold">
                      NOT CONNECTED
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#1A1A1E]/70 font-sans mt-0.5">
                  {isConnected
                    ? `Authorized as ${session.user?.email || 'SecOps Lead'} (Sheets & Drive)`
                    : 'Google Sheets and Drive synchronization is unavailable until authorization is completed.'}
                </p>
              </div>

              {isConnected ? (
                <button
                  type="button"
                  onClick={handleDisconnectWorkspace}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] text-xs font-semibold text-[#DC2626] bg-[#DC2626]/5 hover:bg-[#DC2626]/10 border border-[#DC2626]/20 transition-all font-mono"
                >
                  <LogOut className="w-3 h-3" />
                  <span>Disconnect</span>
                </button>
              ) : (
                <button
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
                  <span>Connect Google Workspace</span>
                </button>
              )}
            </div>

            {/* Target Spreadsheet Input */}
            <div className="space-y-1.5 font-sans">
              <label className="text-xs font-semibold text-[#1A1A1E] flex items-center justify-between">
                <span>Google Spreadsheet Link or ID</span>
                <span className="text-[10px] text-[#059669] font-mono font-bold">10-Tab Master Workbook</span>
              </label>
              <input
                id="existing-sheet-id-input"
                type="text"
                value={existingSheetId}
                onChange={(e) => setExistingSheetId(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/... or spreadsheet ID"
                className="w-full px-3 py-2 bg-white border border-[#1A1A1E]/20 rounded-[3px] text-xs text-[#1A1A1E] font-mono focus:outline-none focus:border-[#1A1A1E]"
              />
              <p className="text-[11px] text-[#1A1A1E]/60">
                Target workbook contains 10 standardized tabs: <code className="text-[#1A1A1E] font-mono">01_Incidents</code> to <code className="text-[#1A1A1E] font-mono">10_SWOT_Analysis</code>.
              </p>
            </div>

            {/* 10-Tab Scope Preview */}
            <div className="p-3 rounded-[3px] bg-white border border-[#1A1A1E]/15 font-mono">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-[#1A1A1E] flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#2563EB]" />
                  10-Sheet Workbook Schema Structure
                </span>
                <span className="text-[10px] text-[#1A1A1E]/60 font-mono">10 Worksheets</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-[10px]">
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

            {/* Sync Type Selector */}
            <div className="space-y-1.5 font-sans">
              <label className="text-xs font-semibold text-[#1A1A1E]">Sync Scope</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSyncType('all')}
                  className={`p-3 rounded-[3px] border text-left transition-all ${
                    syncType === 'all'
                      ? 'bg-white border-[#1A1A1E] text-[#1A1A1E] shadow-xs'
                      : 'bg-[#F8F7F4] border-[#1A1A1E]/15 text-[#1A1A1E]/70 hover:border-[#1A1A1E]/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold">Full 10-Tab Workbook</span>
                    <CheckCircle2
                      className={`w-4 h-4 ${
                        syncType === 'all' ? 'text-[#2563EB]' : 'text-[#1A1A1E]/30'
                      }`}
                    />
                  </div>
                  <p className="text-[11px] text-[#1A1A1E]/60">
                    Bidirectional sync across all 10 worksheets (Incidents, Rules, Escalations, SLAs, Audit, ADRs, SWOT)
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setSyncType('incidents')}
                  className={`p-3 rounded-[3px] border text-left transition-all ${
                    syncType === 'incidents'
                      ? 'bg-white border-[#1A1A1E] text-[#1A1A1E] shadow-xs'
                      : 'bg-[#F8F7F4] border-[#1A1A1E]/15 text-[#1A1A1E]/70 hover:border-[#1A1A1E]/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold">01_Incidents Only</span>
                    <CheckCircle2
                      className={`w-4 h-4 ${
                        syncType === 'incidents' ? 'text-[#2563EB]' : 'text-[#1A1A1E]/30'
                      }`}
                    />
                  </div>
                  <p className="text-[11px] text-[#1A1A1E]/60">
                    Export or import active telemetry incidents to 01_Incidents
                  </p>
                </button>
              </div>
            </div>

            {/* Quick Export Tools */}
            <div className="p-3 rounded-[3px] bg-white border border-[#1A1A1E]/15 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-sans">
              <div>
                <span className="text-xs font-bold text-[#1A1A1E] flex items-center gap-1.5 font-syne uppercase tracking-tight">
                  <FileDown className="w-3.5 h-3.5 text-[#2563EB]" />
                  Direct File Downloads (Offline & Export Ready)
                </span>
                <p className="text-[11px] text-[#1A1A1E]/60 mt-0.5">
                  Export standalone CSV for 01_Incidents or comprehensive JSON workbook backup
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 font-mono">
                <button
                  type="button"
                  onClick={handleDownloadCsv}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] text-xs font-semibold text-[#1A1A1E] bg-[#F8F7F4] hover:bg-white border border-[#1A1A1E]/20 transition-all"
                >
                  <Download className="w-3 h-3" />
                  <span>01_Incidents.csv</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadJsonBackup}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] text-xs font-semibold text-[#1A1A1E] bg-[#F8F7F4] hover:bg-white border border-[#1A1A1E]/20 transition-all"
                >
                  <Download className="w-3 h-3" />
                  <span>10-Tab.json</span>
                </button>
              </div>
            </div>

            {/* Success Banner */}
            {lastSyncResult && (
              <div className="p-3 rounded-[3px] bg-[#059669]/10 border border-[#059669]/30 text-[#059669] text-xs space-y-1 font-mono">
                <div className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    {lastSyncResult.mode === 'import'
                      ? `Successfully synchronized ${lastSyncResult.count} records!`
                      : `Successfully synchronized 10-tab workbook!`}
                  </span>
                  <span className="text-[10px] font-mono">{lastSyncResult.timestamp}</span>
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
            {errorMessage && (
              <div className="p-3 rounded-[3px] bg-[#DC2626]/10 border border-[#DC2626]/30 text-[#DC2626] text-xs flex items-start gap-2 font-mono">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Notice</p>
                  <p className="text-[11px] mt-0.5">{errorMessage}</p>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between p-4 border-t border-[#1A1A1E]/20 bg-white font-mono">
            <button
              id="import-from-sheet-btn"
              type="button"
              onClick={handleInitiateImport}
              disabled={isPreviewing || isProcessing || !isConnected}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-[3px] text-xs font-semibold text-[#1A1A1E] hover:bg-[#F8F7F4] border border-[#1A1A1E]/30 transition-all disabled:opacity-40"
            >
              {isPreviewing ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5 text-[#059669]" />
              )}
              <span>Import From Google Sheets</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                id="cancel-sheets-modal-btn"
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-[3px] text-xs font-semibold text-[#1A1A1E]/70 hover:text-[#1A1A1E] transition-colors"
              >
                Close
              </button>
              <button
                id="confirm-sheets-sync-btn"
                type="button"
                onClick={handleExecuteSync}
                disabled={isProcessing || isPreviewing || !isConnected}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-[3px] text-xs font-semibold text-white bg-[#059669] hover:bg-[#047857] shadow-xs transition-all disabled:opacity-40"
              >
                {isProcessing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                <span>Sync All to Google Sheet</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Import Preview Modal */}
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
