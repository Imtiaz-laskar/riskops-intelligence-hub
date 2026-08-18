import React from 'react';
import {
  ShieldAlert,
  Flame,
  CheckCircle2,
  Clock,
  Zap,
  TrendingDown,
} from 'lucide-react';
import { RiskItem, IncidentItem, ComplianceControl } from '../types';

interface StatsBannerProps {
  risks: RiskItem[];
  incidents: IncidentItem[];
  complianceControls: ComplianceControl[];
}

export const StatsBanner: React.FC<StatsBannerProps> = ({
  risks,
  incidents,
  complianceControls,
}) => {
  // Composite Risk Calculation (weighted average normalized to 100)
  const totalRiskScore = risks.reduce((acc, r) => acc + r.likelihood * r.impact, 0);
  const maxPossible = Math.max(1, risks.length * 25);
  const compositeRiskIndex = Math.min(100, Math.round((totalRiskScore / maxPossible) * 100));

  const criticalRisksCount = risks.filter((r) => r.residualRisk === 'Critical' || r.riskScore >= 18).length;
  const highRisksCount = risks.filter((r) => r.residualRisk === 'High' || (r.riskScore >= 12 && r.riskScore < 18)).length;

  const activeIncidents = incidents.filter((i) => i.status === 'Active' || i.status === 'Investigating');
  const criticalIncidents = activeIncidents.filter((i) => i.severity.startsWith('P1') || i.severity.startsWith('P2')).length;

  const passedControls = complianceControls.filter((c) => c.status === 'Pass').length;
  const complianceRate = complianceControls.length > 0
    ? Math.round((passedControls / complianceControls.length) * 100)
    : 92;

  return (
    <div id="riskops-stats-banner" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
      {/* Metric 1: Composite Risk Index */}
      <div
        id="stat-composite-risk"
        className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 shadow-sm hover:border-slate-700 transition-all flex flex-col justify-between"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400">Risk Index</span>
          <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
            <ShieldAlert className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-black text-slate-100">{compositeRiskIndex}</span>
          <span className="text-xs font-medium text-slate-400">/100</span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ml-auto ${
            compositeRiskIndex > 65
              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              : compositeRiskIndex > 40
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
          }`}>
            {compositeRiskIndex > 65 ? 'Elevated' : compositeRiskIndex > 40 ? 'Moderate' : 'Guarded'}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-1 text-[11px] text-emerald-400">
          <TrendingDown className="w-3 h-3" />
          <span>-4.2% vs last audit cycle</span>
        </div>
      </div>

      {/* Metric 2: Critical / High Exposures */}
      <div
        id="stat-critical-exposures"
        className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 shadow-sm hover:border-slate-700 transition-all flex flex-col justify-between"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400">Critical Risks</span>
          <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400">
            <ShieldAlert className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="text-2xl font-black text-rose-400">{criticalRisksCount}</span>
          <span className="text-xs text-slate-400">critical</span>
          <span className="text-xs text-slate-500 font-mono">+{highRisksCount} high</span>
        </div>
        <p className="mt-2 text-[11px] text-slate-400 truncate">
          {risks.length} total mapped risks
        </p>
      </div>

      {/* Metric 3: Active Threat Velocity */}
      <div
        id="stat-active-incidents"
        className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 shadow-sm hover:border-slate-700 transition-all flex flex-col justify-between"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400">Active Incidents</span>
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
            <Flame className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-black text-amber-400">{activeIncidents.length}</span>
          <span className="text-xs text-slate-400">in flight</span>
          {criticalIncidents > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30 ml-auto animate-pulse">
              {criticalIncidents} P1/P2
            </span>
          )}
        </div>
        <p className="mt-2 text-[11px] text-slate-400 truncate">
          Automated triage active
        </p>
      </div>

      {/* Metric 4: Auto-Remediation Rate */}
      <div
        id="stat-auto-remediation"
        className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 shadow-sm hover:border-slate-700 transition-all flex flex-col justify-between"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400">Auto-Remediated</span>
          <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
            <Zap className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-2xl font-black text-cyan-400">88.4%</span>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          Playbooks executed &lt; 30s
        </p>
      </div>

      {/* Metric 5: Mean Time to Remediate (MTTR) */}
      <div
        id="stat-mttr"
        className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 shadow-sm hover:border-slate-700 transition-all flex flex-col justify-between"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400">Avg MTTR</span>
          <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
            <Clock className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-2xl font-black text-slate-100">4.2</span>
          <span className="text-xs text-slate-400">minutes</span>
        </div>
        <p className="mt-2 text-[11px] text-emerald-400">
          -68% vs manual playbook
        </p>
      </div>

      {/* Metric 6: Compliance Health Score */}
      <div
        id="stat-compliance-health"
        className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 shadow-sm hover:border-slate-700 transition-all flex flex-col justify-between"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400">GRC Compliance</span>
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-2xl font-black text-emerald-400">{complianceRate}%</span>
        </div>
        <p className="mt-2 text-[11px] text-slate-400 truncate">
          SOC 2 • ISO 27001 • NIST
        </p>
      </div>
    </div>
  );
};
