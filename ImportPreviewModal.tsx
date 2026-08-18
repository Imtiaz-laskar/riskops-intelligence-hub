import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  ArrowRight,
  Shield,
  Layers,
  Check,
  RefreshCw,
  Info,
  XCircle,
} from 'lucide-react';
import {
  ImportPreviewReport,
  ImportPreviewItem,
  SyncConflictDetail,
} from '../types';

interface ImportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: ImportPreviewReport | null;
  onApply: (conflictResolutions: Record<string, 'KEEP_RISKOPS' | 'APPLY_GOOGLE'>) => void;
  isApplying?: boolean;
}

export const ImportPreviewModal: React.FC<ImportPreviewModalProps> = ({
  isOpen,
  onClose,
  report,
  onApply,
  isApplying = false,
}) => {
  const [filter, setFilter] = useState<'all' | 'new' | 'updated' | 'conflicts' | 'rejected'>('all');
  const [conflictResolutions, setConflictResolutions] = useState<Record<string, 'KEEP_RISKOPS' | 'APPLY_GOOGLE'>>({});

  if (!isOpen || !report) return null;

  const handleSetResolution = (recordId: string, choice: 'KEEP_RISKOPS' | 'APPLY_GOOGLE') => {
    setConflictResolutions((prev) => ({
      ...prev,
      [recordId]: choice,
    }));
  };

  const filteredItems = report.items.filter((item) => {
    if (filter === 'new') return item.classification === 'NEW_FROM_GOOGLE';
    if (filter === 'updated') return item.classification === 'UPDATED_FROM_GOOGLE';
    if (filter === 'conflicts') return item.classification === 'SYNC_CONFLICT';
    if (filter === 'rejected') return item.classification === 'REJECTED';
    return true;
  });

  const totalActionable = report.newCount + report.updatedCount + report.conflictCount;

  return (
    <div
      id="import-preview-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A1A1E]/80 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        id="import-preview-modal-dialog"
        className="bg-[#F8F7F4] border-2 border-[#1A1A1E] rounded-[4px] w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] font-sans"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#1A1A1E]/20 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-[3px] bg-[#2563EB] text-white">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-syne text-sm font-bold uppercase tracking-tight text-[#1A1A1E] flex items-center gap-2">
                Google Sheets → RiskOps Ingestion Preview
              </h2>
              <p className="text-xs text-[#1A1A1E]/70 font-mono">
                Target Workbook: {report.spreadsheetId ? `${report.spreadsheetId.substring(0, 16)}...` : 'Connected Sheets'}
              </p>
            </div>
          </div>
          <button
            id="close-import-preview-btn"
            onClick={onClose}
            className="p-1.5 rounded text-[#1A1A1E]/60 hover:text-[#1A1A1E] hover:bg-[#F8F7F4] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Statistics Bar */}
        <div className="p-4 border-b border-[#1A1A1E]/15 bg-white flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded-[2px] bg-[#059669]/10 border border-[#059669]/30 text-[#059669] font-bold">
              +{report.newCount} New Records
            </span>
            <span className="px-2.5 py-1 rounded-[2px] bg-[#2563EB]/10 border border-[#2563EB]/30 text-[#2563EB] font-bold">
              ~{report.updatedCount} Modified
            </span>
            <span className="px-2.5 py-1 rounded-[2px] bg-[#1A1A1E]/5 border border-[#1A1A1E]/15 text-[#1A1A1E]/70">
              ={report.unchangedCount} Unchanged
            </span>
            {report.conflictCount > 0 && (
              <span className="px-2.5 py-1 rounded-[2px] bg-[#D97706]/10 border border-[#D97706]/30 text-[#D97706] font-bold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                {report.conflictCount} Conflicts
              </span>
            )}
            {report.rejectedCount > 0 && (
              <span className="px-2.5 py-1 rounded-[2px] bg-[#DC2626]/10 border border-[#DC2626]/30 text-[#DC2626] font-bold">
                !{report.rejectedCount} Rejected
              </span>
            )}
          </div>
          <div className="text-[11px] text-[#1A1A1E]/60">
            Parsed: {report.totalParsed} records
          </div>
        </div>

        {/* Conflict Resolution Section (if any conflicts) */}
        {report.conflicts.length > 0 && (
          <div className="p-4 bg-[#D97706]/5 border-b border-[#D97706]/20 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-[#D97706] font-mono">
              <AlertTriangle className="w-4 h-4" />
              <span>ACTION REQUIRED: Resolve {report.conflicts.length} Concurrent Conflict(s)</span>
            </div>
            <p className="text-xs text-[#1A1A1E]/80">
              Both RiskOps and Google Sheets have independent modifications since the last known sync. Select the authoritative version for each record below:
            </p>

            <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
              {report.conflicts.map((c) => {
                const choice = conflictResolutions[c.recordId] || 'KEEP_RISKOPS';
                return (
                  <div
                    key={c.recordId}
                    className="p-3 bg-white border border-[#D97706]/30 rounded-[3px] space-y-2 text-xs font-mono"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#1A1A1E]">
                        {c.worksheet} → {c.recordId}
                      </span>
                      <span className="text-[10px] text-[#D97706] bg-[#D97706]/10 px-1.5 py-0.5 rounded">
                        Fields: {c.conflictFields.join(', ')}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 p-2 bg-[#F8F7F4] rounded-[2px] text-[11px]">
                      <div>
                        <div className="font-bold text-[#1A1A1E] mb-1 flex items-center gap-1">
                          <Shield className="w-3 h-3 text-[#2563EB]" />
                          RiskOps Current Value:
                        </div>
                        <div className="text-[#1A1A1E]/80 space-y-0.5">
                          {Object.entries(c.riskopsValue).map(([k, v]) => (
                            <div key={k} className="truncate">
                              <span className="text-[#1A1A1E]/50">{k}:</span> {String(v)}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="font-bold text-[#1A1A1E] mb-1 flex items-center gap-1">
                          <FileSpreadsheet className="w-3 h-3 text-[#059669]" />
                          Google Sheets Value:
                        </div>
                        <div className="text-[#1A1A1E]/80 space-y-0.5">
                          {Object.entries(c.googleSheetsValue).map(([k, v]) => (
                            <div key={k} className="truncate">
                              <span className="text-[#1A1A1E]/50">{k}:</span> {String(v)}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleSetResolution(c.recordId, 'KEEP_RISKOPS')}
                        className={`px-2.5 py-1 rounded-[2px] text-[11px] font-bold transition-all ${
                          choice === 'KEEP_RISKOPS'
                            ? 'bg-[#1A1A1E] text-white'
                            : 'bg-white text-[#1A1A1E] border border-[#1A1A1E]/20 hover:bg-[#F8F7F4]'
                        }`}
                      >
                        Keep RiskOps (Authoritative)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetResolution(c.recordId, 'APPLY_GOOGLE')}
                        className={`px-2.5 py-1 rounded-[1px] text-[11px] font-bold transition-all ${
                          choice === 'APPLY_GOOGLE'
                            ? 'bg-[#2563EB] text-white'
                            : 'bg-white text-[#2563EB] border border-[#2563EB]/30 hover:bg-[#2563EB]/5'
                        }`}
                      >
                        Apply Google Sheets Version
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab Filters */}
        <div className="px-5 pt-3 pb-2 flex items-center gap-2 border-b border-[#1A1A1E]/10 font-mono text-xs">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-2.5 py-1 rounded-[2px] transition-colors ${
              filter === 'all' ? 'bg-[#1A1A1E] text-white font-bold' : 'text-[#1A1A1E]/60 hover:text-[#1A1A1E]'
            }`}
          >
            All Items ({report.items.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('new')}
            className={`px-2.5 py-1 rounded-[2px] transition-colors ${
              filter === 'new' ? 'bg-[#059669] text-white font-bold' : 'text-[#1A1A1E]/60 hover:text-[#1A1A1E]'
            }`}
          >
            New ({report.newCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter('updated')}
            className={`px-2.5 py-1 rounded-[2px] transition-colors ${
              filter === 'updated' ? 'bg-[#2563EB] text-white font-bold' : 'text-[#1A1A1E]/60 hover:text-[#1A1A1E]'
            }`}
          >
            Modified ({report.updatedCount})
          </button>
          {report.conflictCount > 0 && (
            <button
              type="button"
              onClick={() => setFilter('conflicts')}
              className={`px-2.5 py-1 rounded-[2px] transition-colors ${
                filter === 'conflicts' ? 'bg-[#D97706] text-white font-bold' : 'text-[#1A1A1E]/60 hover:text-[#1A1A1E]'
              }`}
            >
              Conflicts ({report.conflictCount})
            </button>
          )}
          {report.rejectedCount > 0 && (
            <button
              type="button"
              onClick={() => setFilter('rejected')}
              className={`px-2.5 py-1 rounded-[2px] transition-colors ${
                filter === 'rejected' ? 'bg-[#DC2626] text-white font-bold' : 'text-[#1A1A1E]/60 hover:text-[#1A1A1E]'
              }`}
            >
              Rejected ({report.rejectedCount})
            </button>
          )}
        </div>

        {/* Records Table / List */}
        <div className="p-5 overflow-y-auto flex-1 space-y-2">
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#1A1A1E]/50 font-mono">
              No records matching the selected filter.
            </div>
          ) : (
            filteredItems.map((item, idx) => (
              <div
                key={`${item.worksheet}-${item.recordId}-${idx}`}
                className="p-3 rounded-[3px] bg-white border border-[#1A1A1E]/15 flex items-start justify-between gap-3 text-xs font-mono"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#1A1A1E]">{item.worksheet}</span>
                    <span className="text-[#1A1A1E]/40">•</span>
                    <span className="text-[#1A1A1E]/70">{item.recordId}</span>
                    <ClassificationBadge classification={item.classification} />
                  </div>
                  <p className="text-[11px] text-[#1A1A1E]/80 font-sans">{item.titleOrSummary}</p>
                  {item.changedFields && item.changedFields.length > 0 && (
                    <p className="text-[10px] text-[#2563EB]">
                      Modified fields: {item.changedFields.join(', ')}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-4 border-t border-[#1A1A1E]/20 bg-white font-mono">
          <button
            id="cancel-import-preview-btn"
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-[3px] text-xs font-semibold text-[#1A1A1E]/70 hover:text-[#1A1A1E] transition-colors"
          >
            Cancel
          </button>

          <div className="flex items-center gap-3">
            <span className="text-xs text-[#1A1A1E]/60 hidden sm:inline">
              {totalActionable} changes staged for ingestion
            </span>
            <button
              id="confirm-apply-import-btn"
              type="button"
              onClick={() => onApply(conflictResolutions)}
              disabled={isApplying || totalActionable === 0}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-[3px] text-xs font-semibold text-white bg-[#059669] hover:bg-[#047857] shadow-xs transition-all disabled:opacity-40"
            >
              {isApplying ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>Apply Ingestion to RiskOps</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

function ClassificationBadge({ classification }: { classification: string }) {
  if (classification === 'NEW_FROM_GOOGLE') {
    return (
      <span className="px-2 py-0.5 rounded-[2px] bg-[#059669]/10 text-[#059669] font-bold text-[10px]">
        NEW_FROM_GOOGLE
      </span>
    );
  }
  if (classification === 'UPDATED_FROM_GOOGLE') {
    return (
      <span className="px-2 py-0.5 rounded-[2px] bg-[#2563EB]/10 text-[#2563EB] font-bold text-[10px]">
        UPDATED_FROM_GOOGLE
      </span>
    );
  }
  if (classification === 'SYNC_CONFLICT') {
    return (
      <span className="px-2 py-0.5 rounded-[2px] bg-[#D97706]/10 text-[#D97706] font-bold text-[10px]">
        SYNC_CONFLICT
      </span>
    );
  }
  if (classification === 'REJECTED') {
    return (
      <span className="px-2 py-0.5 rounded-[2px] bg-[#DC2626]/10 text-[#DC2626] font-bold text-[10px]">
        REJECTED
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded-[2px] bg-[#1A1A1E]/5 text-[#1A1A1E]/60 text-[10px]">
      UNCHANGED
    </span>
  );
}
