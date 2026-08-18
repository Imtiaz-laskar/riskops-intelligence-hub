import React, { useState, useMemo } from 'react';
import {
  Table,
  Plus,
  Search,
  Filter,
  Sparkles,
  FileSpreadsheet,
  Download,
  Edit2,
  Trash2,
  Eye,
  CheckCircle2,
  AlertTriangle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  Shield,
  Layers,
  Clock,
  User,
  Grid,
} from 'lucide-react';
import {
  RiskItem,
  RiskCategory,
  RiskStatus,
  IncidentItem,
  ComplianceControl,
  AutomationPlaybook,
} from '../types';
import { RiskPostureHeader, QuickFilterState } from './risk/RiskPostureHeader';
import { RiskMatrix5x5 } from './risk/RiskMatrix5x5';
import { RiskDetailDrawer } from './risk/RiskDetailDrawer';
import { AIThreatModelModal } from './risk/AIThreatModelModal';
import { RiskEditModal } from './risk/RiskEditModal';
import { EmptyState } from './ui/FeedbackStates';

interface RiskRegisterTableProps {
  risks: RiskItem[];
  onAddRisk: (risk: RiskItem) => void;
  onUpdateRisk: (risk: RiskItem) => void;
  onDeleteRisk: (id: string) => void;
  onOpenSheetsModal: () => void;
  activeHeatmapFilter?: { l: number; i: number } | null;
  onClearHeatmapFilter?: () => void;
  incidents?: IncidentItem[];
  complianceControls?: ComplianceControl[];
  playbooks?: AutomationPlaybook[];
  onNavigateTab?: (tab: string) => void;
}

type SortField =
  | 'id'
  | 'title'
  | 'category'
  | 'likelihood'
  | 'impact'
  | 'riskScore'
  | 'residualRisk'
  | 'owner'
  | 'status'
  | 'lastAudited'
  | 'controls';

type SortDirection = 'asc' | 'desc';

export const RiskRegisterTable: React.FC<RiskRegisterTableProps> = ({
  risks,
  onAddRisk,
  onUpdateRisk,
  onDeleteRisk,
  onOpenSheetsModal,
  activeHeatmapFilter,
  onClearHeatmapFilter,
  incidents = [],
  complianceControls = [],
  playbooks = [],
  onNavigateTab,
}) => {
  // Search & Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [selectedOwner, setSelectedOwner] = useState<string>('All');
  const [selectedReviewStatus, setSelectedReviewStatus] = useState<string>('All');
  const [quickFilter, setQuickFilter] = useState<QuickFilterState>({ type: 'none', label: '' });

  // Matrix UI state
  const [isMatrixCollapsed, setIsMatrixCollapsed] = useState(false);
  const [localCellFilter, setLocalCellFilter] = useState<{ l: number; i: number } | null>(
    activeHeatmapFilter || null
  );

  // Sorting state
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Modals & Drawers state
  const [selectedRiskForDetail, setSelectedRiskForDetail] = useState<RiskItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRisk, setEditingRisk] = useState<RiskItem | null>(null);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);

  // Categories list
  const categories: RiskCategory[] = [
    'AI / Deepfake',
    'Platform Abuse',
    'Platform Security',
    'System Integrity',
    'Data Privacy',
    'Cybersecurity',
    'Cloud Infrastructure',
    'Regulatory Compliance',
    'Operational Resilience',
    'Third-Party Vendor',
    'Financial',
  ];

  // Distinct owners for filter dropdown
  const uniqueOwners = useMemo(() => {
    const set = new Set<string>();
    risks.forEach((r) => {
      if (r.owner && r.owner.trim() !== '') set.add(r.owner.trim());
    });
    return Array.from(set).sort();
  }, [risks]);

  // Sync external activeHeatmapFilter if provided
  React.useEffect(() => {
    if (activeHeatmapFilter) {
      setLocalCellFilter(activeHeatmapFilter);
    }
  }, [activeHeatmapFilter]);

  const handleCellSelect = (cell: { l: number; i: number } | null) => {
    setLocalCellFilter(cell);
    if (!cell && onClearHeatmapFilter) {
      onClearHeatmapFilter();
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortField(null);
      }
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const now = new Date('2026-08-16');

  // Filter & Prioritization Pipeline
  const filteredAndSortedRisks = useMemo(() => {
    let result = [...risks];

    // 1. 5x5 Matrix Cell Filter
    if (localCellFilter && localCellFilter.l > 0 && localCellFilter.i > 0) {
      result = result.filter(
        (r) => r.likelihood === localCellFilter.l && r.impact === localCellFilter.i
      );
    }

    // 2. Quick Header Filter
    if (quickFilter.type === 'critical') {
      result = result.filter((r) => r.residualRisk === 'Critical' || r.riskScore >= 18);
    } else if (quickFilter.type === 'high') {
      result = result.filter((r) => r.residualRisk === 'High' || (r.riskScore >= 12 && r.riskScore < 18));
    } else if (quickFilter.type === 'open_treatment') {
      result = result.filter(
        (r) => r.status === 'Identified' || r.status === 'Assessing' || r.status === 'Mitigating'
      );
    } else if (quickFilter.type === 'overdue') {
      result = result.filter((r) => {
        if (r.nextReviewDate) return new Date(r.nextReviewDate) < now;
        if (r.lastAudited) {
          const audited = new Date(r.lastAudited);
          return (now.getTime() - audited.getTime()) / (1000 * 3600 * 24) > 90;
        }
        return false;
      });
    } else if (quickFilter.type === 'control_gaps') {
      result = result.filter((r) => !r.controls || r.controls.length === 0);
    } else if (quickFilter.type === 'unassigned') {
      result = result.filter((r) => {
        const owner = (r.owner || '').trim().toLowerCase();
        return !owner || owner === 'unassigned' || owner === 'none';
      });
    }

    // 3. Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((r) => {
        return (
          r.id.toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q) ||
          (r.threatVector && r.threatVector.toLowerCase().includes(q)) ||
          (r.owner && r.owner.toLowerCase().includes(q)) ||
          (r.mitigationStrategy && r.mitigationStrategy.toLowerCase().includes(q)) ||
          (r.controls && r.controls.some((c) => c.toLowerCase().includes(q)))
        );
      });
    }

    // 4. Category filter
    if (selectedCategory !== 'All') {
      result = result.filter((r) => r.category === selectedCategory);
    }

    // 5. Severity filter
    if (selectedSeverity !== 'All') {
      result = result.filter((r) => r.residualRisk === selectedSeverity);
    }

    // 6. Status filter
    if (selectedStatus !== 'All') {
      result = result.filter((r) => r.status === selectedStatus);
    }

    // 7. Owner filter
    if (selectedOwner !== 'All') {
      if (selectedOwner === 'Unassigned') {
        result = result.filter((r) => !r.owner || r.owner.toLowerCase().includes('unassigned'));
      } else {
        result = result.filter((r) => r.owner === selectedOwner);
      }
    }

    // 8. Review Status filter
    if (selectedReviewStatus !== 'All') {
      result = result.filter((r) => {
        const nextDate = r.nextReviewDate ? new Date(r.nextReviewDate) : null;
        const lastDate = r.lastAudited ? new Date(r.lastAudited) : null;

        const isOverdue =
          (nextDate && nextDate < now) ||
          (lastDate && (now.getTime() - lastDate.getTime()) / (1000 * 3600 * 24) > 90);

        if (selectedReviewStatus === 'Overdue') return isOverdue;
        if (selectedReviewStatus === 'Due Soon') {
          if (nextDate) {
            const diff = (nextDate.getTime() - now.getTime()) / (1000 * 3600 * 24);
            return diff >= 0 && diff <= 14;
          }
          return false;
        }
        if (selectedReviewStatus === 'Current') return !isOverdue;
        return true;
      });
    }

    // 9. Sorting or Default Prioritization
    if (sortField) {
      result.sort((a, b) => {
        let valA: any = a[sortField];
        let valB: any = b[sortField];

        if (sortField === 'controls') {
          valA = a.controls?.length || 0;
          valB = b.controls?.length || 0;
        } else if (sortField === 'residualRisk') {
          const rank = { Critical: 4, High: 3, Medium: 2, Low: 1 };
          valA = rank[a.residualRisk] || 0;
          valB = rank[b.residualRisk] || 0;
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
      // Default prioritization: Critical -> High -> Overdue -> Open Treatment -> Risk Score
      result.sort((a, b) => {
        // Critical / High residual priority
        const rank = { Critical: 4, High: 3, Medium: 2, Low: 1 };
        const rankA = rank[a.residualRisk] || 0;
        const rankB = rank[b.residualRisk] || 0;
        if (rankA !== rankB) return rankB - rankA;

        // Inherent Risk score
        if (b.riskScore !== a.riskScore) return b.riskScore - a.riskScore;

        return a.id.localeCompare(b.id);
      });
    }

    return result;
  }, [
    risks,
    localCellFilter,
    quickFilter,
    searchQuery,
    selectedCategory,
    selectedSeverity,
    selectedStatus,
    selectedOwner,
    selectedReviewStatus,
    sortField,
    sortDirection,
    now,
  ]);

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      'Risk ID',
      'Risk Title',
      'Domain',
      'Threat Vector',
      'Likelihood',
      'Impact',
      'Inherent Score',
      'Residual Risk',
      'Owner',
      'Status',
      'Last Audited',
      'Next Review',
      'Controls',
      'Mitigation Strategy',
    ];

    const rows = filteredAndSortedRisks.map((r) => [
      r.id,
      `"${(r.title || '').replace(/"/g, '""')}"`,
      r.category,
      `"${(r.threatVector || '').replace(/"/g, '""')}"`,
      r.likelihood,
      r.impact,
      r.riskScore,
      r.residualRisk,
      `"${r.owner || ''}"`,
      r.status,
      r.lastAudited || '',
      r.nextReviewDate || '',
      `"${(r.controls || []).join('; ')}"`,
      `"${(r.mitigationStrategy || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Enterprise_Risk_Register_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenEdit = (risk?: RiskItem) => {
    setEditingRisk(risk || null);
    setIsEditModalOpen(true);
  };

  const handleOpenDetail = (risk: RiskItem) => {
    setSelectedRiskForDetail(risk);
  };

  const handleResetAllFilters = () => {
    setSearchQuery('');
    setSelectedCategory('All');
    setSelectedSeverity('All');
    setSelectedStatus('All');
    setSelectedOwner('All');
    setSelectedReviewStatus('All');
    setQuickFilter({ type: 'none', label: '' });
    handleCellSelect(null);
  };

  const hasActiveFilters =
    searchQuery !== '' ||
    selectedCategory !== 'All' ||
    selectedSeverity !== 'All' ||
    selectedStatus !== 'All' ||
    selectedOwner !== 'All' ||
    selectedReviewStatus !== 'All' ||
    quickFilter.type !== 'none' ||
    localCellFilter !== null;

  return (
    <div id="risk-register-view" className="space-y-5">
      {/* 1. Primary Header & Operational Commands */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Table className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-bold text-slate-100">
              Enterprise Risk Register & Vulnerability System of Record
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Deterministic risk quantification, RACI ownership, multi-framework control mapping, and bi-directional Google Sheets synchronization.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            id="ai-threat-modeler-btn"
            onClick={() => setIsAIModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-cyan-200" />
            <span>+ New AI Threat Assessment</span>
          </button>

          <button
            id="add-risk-btn"
            onClick={() => handleOpenEdit()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Custom Risk</span>
          </button>

          <button
            id="export-csv-btn"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-all cursor-pointer"
            title="Export filtered records to CSV"
          >
            <Download className="w-4 h-4 text-slate-400" />
            <span>Export CSV</span>
          </button>

          <button
            id="sync-register-sheets-btn"
            onClick={onOpenSheetsModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-emerald-300 bg-emerald-950/50 hover:bg-emerald-900/50 border border-emerald-500/30 transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Sync to Google Sheets</span>
          </button>
        </div>
      </div>

      {/* 2. Compact State Bar (Risk Posture Header) */}
      <RiskPostureHeader
        risks={risks}
        activeQuickFilter={quickFilter}
        onSelectQuickFilter={setQuickFilter}
      />

      {/* 3. 5x5 Likelihood x Impact Risk Matrix */}
      <RiskMatrix5x5
        risks={risks}
        activeCellFilter={localCellFilter}
        onSelectCell={handleCellSelect}
        isCollapsed={isMatrixCollapsed}
        onToggleCollapse={() => setIsMatrixCollapsed((prev) => !prev)}
      />

      {/* 4. Filter, Search, and Status Toolbar */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3 text-xs">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="risk-search-input"
              type="text"
              placeholder="Search risk ID, title, threat vector, owner, controls..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-slate-200 placeholder:text-slate-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 text-xs"
            />
          </div>

          {/* Counts & Clear Action */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <span className="text-slate-400 font-mono text-[11px]">
              Showing <strong className="text-slate-200">{filteredAndSortedRisks.length}</strong> of {risks.length} material risks
            </span>

            {hasActiveFilters && (
              <button
                id="clear-all-filters-btn"
                onClick={handleResetAllFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        </div>

        {/* Dropdown Filters Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 pt-2 border-t border-slate-800/60">
          {/* Domain Filter */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Risk Domain</label>
            <select
              id="category-filter-select"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            >
              <option value="All">All Domains ({risks.length})</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Severity Filter */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Residual Severity</label>
            <select
              id="severity-filter-select"
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            >
              <option value="All">All Severities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          {/* Lifecycle Status Filter */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Lifecycle Status</label>
            <select
              id="status-filter-select"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            >
              <option value="All">All Statuses</option>
              <option value="Identified">Identified</option>
              <option value="Assessing">Assessing</option>
              <option value="Mitigating">Mitigating</option>
              <option value="Controlled">Controlled</option>
              <option value="Accepted">Accepted</option>
            </select>
          </div>

          {/* Owner Filter */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Risk Owner</label>
            <select
              id="owner-filter-select"
              value={selectedOwner}
              onChange={(e) => setSelectedOwner(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            >
              <option value="All">All Owners</option>
              <option value="Unassigned">Unassigned Only</option>
              {uniqueOwners.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>

          {/* Review Status Filter */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Review Cadence</label>
            <select
              id="review-status-filter-select"
              value={selectedReviewStatus}
              onChange={(e) => setSelectedReviewStatus(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            >
              <option value="All">All Review States</option>
              <option value="Current">Current / In Cadence</option>
              <option value="Due Soon">Due Soon (&le; 14 days)</option>
              <option value="Overdue">Overdue (&gt; 90 days)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 5. Primary Enterprise Risk Register Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table id="risk-register-table" className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                {/* Risk ID */}
                <th
                  onClick={() => handleSort('id')}
                  className="py-3.5 px-4 cursor-pointer hover:text-slate-200 transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    <span>Risk ID</span>
                    {sortField === 'id' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-400" /> : <ArrowDown className="w-3 h-3 text-indigo-400" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>

                {/* Risk Title & Vector */}
                <th
                  onClick={() => handleSort('title')}
                  className="py-3.5 px-4 cursor-pointer hover:text-slate-200 transition-colors min-w-[240px]"
                >
                  <div className="flex items-center gap-1">
                    <span>Risk Title & Threat Mechanism</span>
                    {sortField === 'title' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-400" /> : <ArrowDown className="w-3 h-3 text-indigo-400" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>

                {/* Domain */}
                <th
                  onClick={() => handleSort('category')}
                  className="py-3.5 px-3 cursor-pointer hover:text-slate-200 transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    <span>Domain</span>
                    {sortField === 'category' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-400" /> : <ArrowDown className="w-3 h-3 text-indigo-400" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>

                {/* Likelihood */}
                <th
                  onClick={() => handleSort('likelihood')}
                  className="py-3.5 px-2.5 text-center cursor-pointer hover:text-slate-200 transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>L</span>
                    {sortField === 'likelihood' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-400" /> : <ArrowDown className="w-3 h-3 text-indigo-400" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>

                {/* Impact */}
                <th
                  onClick={() => handleSort('impact')}
                  className="py-3.5 px-2.5 text-center cursor-pointer hover:text-slate-200 transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>I</span>
                    {sortField === 'impact' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-400" /> : <ArrowDown className="w-3 h-3 text-indigo-400" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>

                {/* Inherent Score */}
                <th
                  onClick={() => handleSort('riskScore')}
                  className="py-3.5 px-3 text-center cursor-pointer hover:text-slate-200 transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Inherent</span>
                    {sortField === 'riskScore' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-400" /> : <ArrowDown className="w-3 h-3 text-indigo-400" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>

                {/* Controls */}
                <th
                  onClick={() => handleSort('controls')}
                  className="py-3.5 px-3 cursor-pointer hover:text-slate-200 transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    <span>Controls</span>
                    {sortField === 'controls' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-400" /> : <ArrowDown className="w-3 h-3 text-indigo-400" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>

                {/* Residual Risk */}
                <th
                  onClick={() => handleSort('residualRisk')}
                  className="py-3.5 px-3 text-center cursor-pointer hover:text-slate-200 transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Residual</span>
                    {sortField === 'residualRisk' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-400" /> : <ArrowDown className="w-3 h-3 text-indigo-400" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>

                {/* Owner */}
                <th
                  onClick={() => handleSort('owner')}
                  className="py-3.5 px-3 cursor-pointer hover:text-slate-200 transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    <span>Risk Owner</span>
                    {sortField === 'owner' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-400" /> : <ArrowDown className="w-3 h-3 text-indigo-400" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>

                {/* Treatment / Status */}
                <th
                  onClick={() => handleSort('status')}
                  className="py-3.5 px-3 text-center cursor-pointer hover:text-slate-200 transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Status</span>
                    {sortField === 'status' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-400" /> : <ArrowDown className="w-3 h-3 text-indigo-400" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>

                {/* Review Cadence */}
                <th
                  onClick={() => handleSort('lastAudited')}
                  className="py-3.5 px-3 cursor-pointer hover:text-slate-200 transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    <span>Review Cadence</span>
                    {sortField === 'lastAudited' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-400" /> : <ArrowDown className="w-3 h-3 text-indigo-400" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>

                {/* Actions */}
                <th className="py-3.5 px-4 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/60">
              {filteredAndSortedRisks.length > 0 ? (
                filteredAndSortedRisks.map((risk) => {
                  const isCritical = risk.residualRisk === 'Critical' || risk.riskScore >= 18;
                  const isHigh = risk.residualRisk === 'High' || (risk.riskScore >= 12 && risk.riskScore < 18);
                  const isMedium = risk.residualRisk === 'Medium';

                  const isUnassigned =
                    !risk.owner ||
                    risk.owner.toLowerCase().includes('unassigned') ||
                    risk.owner.trim() === '';

                  const nextDate = risk.nextReviewDate ? new Date(risk.nextReviewDate) : null;
                  const lastDate = risk.lastAudited ? new Date(risk.lastAudited) : null;
                  const isOverdue =
                    (nextDate && nextDate < now) ||
                    (lastDate && (now.getTime() - lastDate.getTime()) / (1000 * 3600 * 24) > 90);

                  return (
                    <tr
                      key={risk.id}
                      id={`risk-row-${risk.id}`}
                      onClick={() => handleOpenDetail(risk)}
                      className="hover:bg-slate-800/50 transition-colors group cursor-pointer"
                    >
                      {/* Risk ID */}
                      <td className="py-3.5 px-4 font-mono font-bold text-indigo-400 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>{risk.id}</span>
                          {risk.source === 'AI-assisted' && (
                            <Sparkles className="w-3 h-3 text-cyan-400" title="AI Generated Assessment" />
                          )}
                        </div>
                      </td>

                      {/* Title & Vector */}
                      <td className="py-3.5 px-4 max-w-sm">
                        <div className="font-semibold text-slate-100 line-clamp-1 group-hover:text-indigo-200 transition-colors">
                          {risk.title}
                        </div>
                        <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                          {risk.threatVector}
                        </div>
                      </td>

                      {/* Domain */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md bg-slate-950 text-slate-300 text-[10px] font-medium border border-slate-800">
                          {risk.category}
                        </span>
                      </td>

                      {/* Likelihood */}
                      <td className="py-3.5 px-2.5 text-center font-mono font-bold text-slate-200">
                        {risk.likelihood}
                        <span className="text-[10px] text-slate-500 font-normal">/5</span>
                      </td>

                      {/* Impact */}
                      <td className="py-3.5 px-2.5 text-center font-mono font-bold text-slate-200">
                        {risk.impact}
                        <span className="text-[10px] text-slate-500 font-normal">/5</span>
                      </td>

                      {/* Inherent Risk Score */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <span
                          className={`font-mono font-black text-xs ${
                            risk.riskScore >= 18
                              ? 'text-rose-400'
                              : risk.riskScore >= 12
                              ? 'text-amber-400'
                              : 'text-blue-400'
                          }`}
                        >
                          {risk.riskScore}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono ml-0.5">/25</span>
                      </td>

                      {/* Controls */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        {risk.controls && risk.controls.length > 0 ? (
                          <div className="flex items-center gap-1">
                            <Shield className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="font-mono text-slate-300 text-[11px]">
                              {risk.controls.length} mapped
                            </span>
                          </div>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-950/60 text-rose-300 border border-rose-800/60">
                            0 Controls (Gap)
                          </span>
                        )}
                      </td>

                      {/* Residual Risk Badge */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isCritical
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : isHigh
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : isMedium
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {risk.residualRisk}
                        </span>
                      </td>

                      {/* Owner */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        {isUnassigned ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-950/60 text-amber-300 border border-amber-800/60">
                            Unassigned
                          </span>
                        ) : (
                          <span className="text-slate-300 font-medium text-[11px] truncate max-w-[140px] block">
                            {risk.owner}
                          </span>
                        )}
                      </td>

                      {/* Lifecycle Status */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                          {risk.status}
                        </span>
                      </td>

                      {/* Review Cadence */}
                      <td className="py-3.5 px-3 whitespace-nowrap text-[11px]">
                        {isOverdue ? (
                          <span className="inline-flex items-center gap-1 text-rose-400 font-semibold">
                            <Clock className="w-3 h-3 text-rose-400" />
                            <span>Overdue</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono">
                            {risk.lastAudited || 'Pending'}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td
                        className="py-3.5 px-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                            id={`inspect-risk-btn-${risk.id}`}
                            onClick={() => handleOpenDetail(risk)}
                            className="p-1.5 text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                            title="Inspect Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            id={`edit-risk-btn-${risk.id}`}
                            onClick={() => handleOpenEdit(risk)}
                            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                            title="Edit Risk"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            id={`delete-risk-btn-${risk.id}`}
                            onClick={() => {
                              if (confirm(`Remove risk ${risk.id} (${risk.title}) from the register?`)) {
                                onDeleteRisk(risk.id);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                            title="Delete Risk"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400">
                    <EmptyState
                      title="No Material Risks Match Current Filters"
                      description="Try adjusting your search criteria, domain selector, or severity filters to inspect registered threats."
                      actionLabel="Clear All Filters"
                      onAction={handleResetAllFilters}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Risk Detail Inspector Drawer */}
      <RiskDetailDrawer
        risk={selectedRiskForDetail}
        isOpen={Boolean(selectedRiskForDetail)}
        onClose={() => setSelectedRiskForDetail(null)}
        onEditRisk={(riskToEdit) => {
          setSelectedRiskForDetail(null);
          handleOpenEdit(riskToEdit);
        }}
        onDeleteRisk={onDeleteRisk}
        onUpdateRisk={(updatedRisk) => {
          onUpdateRisk(updatedRisk);
          setSelectedRiskForDetail(updatedRisk);
        }}
        incidents={incidents}
        complianceControls={complianceControls}
        playbooks={playbooks}
        onNavigateTab={onNavigateTab}
      />

      {/* 7. Edit / Add Risk Modal */}
      <RiskEditModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingRisk(null);
        }}
        initialRisk={editingRisk}
        onSaveRisk={(savedRisk) => {
          const exists = risks.some((r) => r.id === savedRisk.id);
          if (exists) {
            onUpdateRisk(savedRisk);
          } else {
            onAddRisk(savedRisk);
          }
        }}
      />

      {/* 8. AI Threat Assessment Modal */}
      <AIThreatModelModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        onAcceptCandidateRisk={(cand) => {
          onAddRisk(cand);
        }}
      />
    </div>
  );
};
