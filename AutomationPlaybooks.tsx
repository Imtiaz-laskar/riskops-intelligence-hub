import React, { useState } from 'react';
import {
  Zap,
  Play,
  CheckCircle2,
  AlertCircle,
  Terminal,
  Sparkles,
  RefreshCw,
  Clock,
  Shield,
  X,
  Code2,
} from 'lucide-react';
import { AutomationPlaybook } from '../types';
import { runAIMitigationPlaybook } from '../services/aiService';

interface AutomationPlaybooksProps {
  playbooks: AutomationPlaybook[];
  onUpdatePlaybook: (playbook: AutomationPlaybook) => void;
  onAddPlaybook: (playbook: AutomationPlaybook) => void;
}

export const AutomationPlaybooks: React.FC<AutomationPlaybooksProps> = ({
  playbooks,
  onUpdatePlaybook,
  onAddPlaybook,
}) => {
  const [selectedPlaybookId, setSelectedPlaybookId] = useState<string>(
    playbooks[0]?.id || ''
  );
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(-1);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const [isSynthModalOpen, setIsSynthModalOpen] = useState<boolean>(false);
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);
  const [synthPrompt, setSynthPrompt] = useState<string>('');
  const [synthService, setSynthService] = useState<string>('k8s-ingress / cloud-armor');

  const selectedPlaybook =
    playbooks.find((p) => p.id === selectedPlaybookId) || playbooks[0];

  const handleTestRun = () => {
    if (!selectedPlaybook || isRunning) return;
    setIsRunning(true);
    setActiveStepIndex(0);
    setConsoleLogs([
      `[${new Date().toISOString()}] Initiating playbook '${selectedPlaybook.title}' (${selectedPlaybook.id})...`,
    ]);

    let step = 0;
    const interval = setInterval(() => {
      if (step < selectedPlaybook.steps.length) {
        const currentStep = selectedPlaybook.steps[step];
        const stepName = currentStep.name || currentStep.actionName || `Step ${step + 1}`;
        const stepCommand = currentStep.command || currentStep.scriptSnippet || 'system:execute';
        const stepAction = currentStep.action || currentStep.automationType || 'Automated Execution';
        setConsoleLogs((prev) => [
          ...prev,
          `[${new Date().toISOString()}] Executing step ${step + 1}: ${stepName}`,
          `$ ${stepCommand}`,
          `-> Exit 0: Success (${stepAction})`,
        ]);
        setActiveStepIndex(step);
        step++;
      } else {
        clearInterval(interval);
        setConsoleLogs((prev) => [
          ...prev,
          `[${new Date().toISOString()}] Playbook run completed successfully. Service telemetry nominal.`,
        ]);
        setIsRunning(false);
        setActiveStepIndex(-1);

        const updated: AutomationPlaybook = {
          ...selectedPlaybook,
          lastExecuted: 'Just now',
          executionCount: selectedPlaybook.executionCount + 1,
        };
        onUpdatePlaybook(updated);
      }
    }, 1000);
  };

  const handleSynthesizePlaybook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!synthPrompt.trim()) return;

    setIsSynthesizing(true);
    try {
      const generated = await runAIMitigationPlaybook(synthPrompt, synthService);

      if (generated) {
        const newPlaybook: AutomationPlaybook = {
          id: `PB-AI-${Math.floor(100 + Math.random() * 900)}`,
          name: generated.name || generated.title || 'AI Synthesized Remediation Runbook',
          title: generated.title || generated.name || 'AI Synthesized Remediation Runbook',
          description: generated.description || synthPrompt,
          trigger: generated.trigger || generated.triggerCondition || 'Metric anomaly detection',
          targetService: generated.targetService || synthService,
          enabled: true,
          executionMode: 'Manual Approval',
          successRate: 98.5,
          lastExecuted: 'Never',
          executionCount: 0,
          steps: generated.steps || [
            {
              order: 1,
              name: 'Verify anomaly',
              action: 'Check logs and metrics',
              command: 'gcloud logging read "severity>=WARNING" --limit=20',
            },
          ],
        };

        onAddPlaybook(newPlaybook);
        setSelectedPlaybookId(newPlaybook.id);
        setIsSynthModalOpen(false);
        setSynthPrompt('');
      }
    } catch (err: any) {
      console.error('Playbook synthesis failed:', err);
      alert(`AI Playbook Error: ${err.message}`);
    } finally {
      setIsSynthesizing(false);
    }
  };

  return (
    <div id="automation-playbooks-view" className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Zap className="w-5 h-5 text-cyan-400" />
            Automated Remediation & Self-Healing Playbooks
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Deterministic runbook execution, auto-scaling containment, and instant threat isolation powered by Gemini 3.7 Flash.
          </p>
        </div>

        <button
          id="synth-playbook-btn"
          onClick={() => setIsSynthModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 shadow-md shadow-cyan-600/20 transition-all cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-cyan-200" />
          <span>Synthesize AI Playbook</span>
        </button>
      </div>

      {/* Main Split Layout: Playbooks List (4 cols) & Execution Sandbox (8 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Playbook Library (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Playbook Catalog ({playbooks.length})
            </span>
            <span className="text-[11px] font-mono text-cyan-400">
              {playbooks.filter((p) => p.enabled).length} Enabled
            </span>
          </div>

          <div className="space-y-2.5 max-h-[750px] overflow-y-auto pr-1">
            {playbooks.map((pb) => {
              const isSelected = selectedPlaybook?.id === pb.id;

              return (
                <div
                  key={pb.id}
                  id={`playbook-card-${pb.id}`}
                  onClick={() => setSelectedPlaybookId(pb.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer text-left ${
                    isSelected
                      ? 'bg-slate-800/90 border-cyan-500 shadow-md shadow-cyan-500/10'
                      : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-800/50 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono font-bold text-cyan-400">
                      {pb.id}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        pb.executionMode === 'Fully Automated'
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                          : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                      }`}
                    >
                      {pb.executionMode}
                    </span>
                  </div>

                  <h4 className="mt-1.5 text-sm font-semibold text-slate-100 line-clamp-1">
                    {pb.title}
                  </h4>

                  <p className="mt-1 text-xs text-slate-400 line-clamp-2">
                    {pb.description}
                  </p>

                  <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-mono text-[10px] text-slate-400">
                      Target: {pb.targetService}
                    </span>
                    <span className="text-emerald-400 font-mono font-semibold">
                      {pb.successRate}% Success
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Playbook Runner & Sandbox Terminal (8 cols) */}
        {selectedPlaybook ? (
          <div
            id="playbook-execution-sandbox"
            className="lg:col-span-8 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-6"
          >
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/20">
                    {selectedPlaybook.id}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    Target: {selectedPlaybook.targetService}
                  </span>
                  <span className="text-xs text-emerald-400 font-mono">
                    {selectedPlaybook.successRate}% MTTR 30s
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-100 mt-2">
                  {selectedPlaybook.title}
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  Trigger: <span className="font-mono text-cyan-300">{selectedPlaybook.trigger}</span>
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  id="run-playbook-test-btn"
                  onClick={handleTestRun}
                  disabled={isRunning}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 shadow-md shadow-cyan-600/30 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isRunning ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 fill-current" />
                  )}
                  <span>{isRunning ? 'Executing Runbook...' : 'Execute Playbook Dry-Run'}</span>
                </button>
              </div>
            </div>

            {/* Runbook Steps Sequence */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Code2 className="w-4 h-4 text-cyan-400" />
                Execution Sequence ({selectedPlaybook.steps.length} Steps)
              </h4>

              <div className="space-y-2.5">
                {selectedPlaybook.steps.map((step, idx) => {
                  const isCurrent = activeStepIndex === idx;
                  const isCompleted = activeStepIndex > idx || (activeStepIndex === -1 && consoleLogs.length > 3);

                  return (
                    <div
                      key={step.order}
                      id={`pb-step-${idx}`}
                      className={`p-3.5 rounded-xl border text-xs transition-all ${
                        isCurrent
                          ? 'bg-slate-800 border-cyan-500 ring-1 ring-cyan-500/50'
                          : isCompleted
                          ? 'bg-slate-950/80 border-emerald-500/40'
                          : 'bg-slate-950/60 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-slate-800 font-mono text-[10px] font-bold flex items-center justify-center text-slate-300">
                            {step.order}
                          </span>
                          <span className="font-semibold text-slate-100">
                            {step.name || step.actionName || `Action Step ${step.order}`}
                          </span>
                        </div>

                        {isCurrent ? (
                          <span className="flex items-center gap-1 text-[11px] text-cyan-400 font-mono animate-pulse">
                            <RefreshCw className="w-3 h-3 animate-spin" /> Running
                          </span>
                        ) : isCompleted ? (
                          <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-mono">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Enforced
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-mono">Standby</span>
                        )}
                      </div>

                      <p className="text-slate-400 text-[11px] mb-2">
                        {step.action || step.automationType || 'Automated Action'}
                      </p>

                      <pre className="p-2 rounded bg-slate-950 text-cyan-300 font-mono text-[11px] border border-slate-800/80 overflow-x-auto">
                        {step.command || step.scriptSnippet || 'system:execute'}
                      </pre>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sandbox Execution Terminal */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-slate-300">
                    Live Runner Sandbox Output
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-500">
                  PTY /dev/pts/1 • Zero-Latency Stream
                </span>
              </div>

              <div className="font-mono text-[11px] text-emerald-400/90 max-h-40 overflow-y-auto space-y-1 pt-1">
                {consoleLogs.length > 0 ? (
                  consoleLogs.map((log, idx) => <p key={idx}>{log}</p>)
                ) : (
                  <p className="text-slate-600 italic">
                    Ready. Click 'Execute Playbook Dry-Run' to simulate safe execution.
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* AI Playbook Synthesis Modal */}
      {isSynthModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                Synthesize AI Remediation Playbook
              </h3>
              <button
                onClick={() => setIsSynthModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Describe the incident symptom, operational failure, or security trigger. Gemini 3.7 Flash will formulate a multi-step deterministic script with verification checks.
            </p>

            <form onSubmit={handleSynthesizePlaybook} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Target Service / Component
                </label>
                <input
                  type="text"
                  required
                  value={synthService}
                  onChange={(e) => setSynthService(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Operational Breakdown / Trigger Condition
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="e.g. Sudden spike in HTTP 504 Gateway Timeouts caused by database connection pool starvation under flash traffic..."
                  value={synthPrompt}
                  onChange={(e) => setSynthPrompt(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 placeholder:text-slate-600 focus:outline-hidden focus:ring-1 focus:ring-cyan-500 leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsSynthModalOpen(false)}
                  className="px-3 py-2 text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="submit-synth-playbook-btn"
                  type="submit"
                  disabled={isSynthesizing || !synthPrompt.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-semibold rounded-lg shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isSynthesizing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Synthesizing Steps...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-cyan-200" />
                      <span>Generate Playbook with Gemini</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
