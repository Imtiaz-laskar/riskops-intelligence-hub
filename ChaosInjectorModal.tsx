import React from 'react';
import {
  Skull,
  X,
  Flame,
  Zap,
  ServerCrash,
  Database,
  CloudLightning,
  ShieldAlert,
} from 'lucide-react';
import { IncidentItem } from '../types';

interface ChaosInjectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInjectIncident: (incident: IncidentItem) => void;
}

export const ChaosInjectorModal: React.FC<ChaosInjectorModalProps> = ({
  isOpen,
  onClose,
  onInjectIncident,
}) => {
  if (!isOpen) return null;

  const scenarios = [
    {
      id: 'chaos-1',
      title: 'Volumetric L7 API Flooding (120k req/s)',
      severity: 'P1 - Critical',
      services: ['auth-service', 'k8s-ingress', 'cloud-armor'],
      icon: CloudLightning,
      desc: 'Distributed botnet attacking token validation endpoint causing CPU exhaustion across ingress pods.',
      logs: `[${new Date().toISOString()}] CRITICAL: auth-service replica count maxed at 50/50. CPU 99.8%\n[${new Date().toISOString()}] WARN: Ingress latency p99 spiked to 4820ms. Dropping 42% HTTP 504s\n[${new Date().toISOString()}] ALERT: WAF rate limit threshold exceeded from 14 ASN blocks`,
    },
    {
      id: 'chaos-2',
      title: 'PostgreSQL Primary Lock Contention & Spillover',
      severity: 'P2 - High',
      services: ['postgres-primary', 'payment-gateway'],
      icon: Database,
      desc: 'Long running analytical transactions locked row partitions, causing queue depth to exceed 10,000.',
      logs: `[${new Date().toISOString()}] ERROR: postgres-primary active connections 998/1000\n[${new Date().toISOString()}] FATAL: canceling statement due to statement_timeout (30000ms)\n[${new Date().toISOString()}] WARN: payment-gateway queue depth: 12,490 transactions delayed`,
    },
    {
      id: 'chaos-3',
      title: 'Unauthenticated Cloud KMS Decrypt Anomaly',
      severity: 'P1 - Critical',
      services: ['kms-agent', 'vault-core'],
      icon: ShieldAlert,
      desc: '1,400 unauthorized crypto key decryption calls detected from un-whitelisted compute VPC.',
      logs: `[${new Date().toISOString()}] SECURITY_ALERT: KMS:Decrypt requested by serviceAccount:unknown-compute-worker@project.iam.gserviceaccount.com\n[${new Date().toISOString()}] DENY: Cloud Audit Logs event: PermissionDenied on resource 'projects/prod/locations/global/keyRings/master'\n[${new Date().toISOString()}] CRITICAL: Potential credential leak or compromised service token`,
    },
    {
      id: 'chaos-4',
      title: 'Third-Party Webhook Provider DNS Blackhole',
      severity: 'P3 - Medium',
      services: ['webhook-dispatcher', 'celery-workers'],
      icon: ServerCrash,
      desc: 'Upstream vendor webhook endpoint returning NXDOMAIN causing exponential retry memory leak.',
      logs: `[${new Date().toISOString()}] WARN: DNS resolution failed for 'api.partner-vendor.com'\n[${new Date().toISOString()}] ERROR: Celery worker memory usage 88.4% (dead-letter queue backlog > 45,000)`,
    },
  ];

  const handleInject = (scenario: (typeof scenarios)[0]) => {
    const inc: IncidentItem = {
      id: `INC-${Date.now().toString().slice(-4)}`,
      title: scenario.title,
      severity: scenario.severity as any,
      status: 'Active',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
      affectedServices: scenario.services,
      description: scenario.desc,
      logs: scenario.logs,
    };

    onInjectIncident(inc);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <Skull className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">
                Chaos Engine & Threat Simulator
              </h3>
              <p className="text-xs text-slate-400">
                Inject realistic operational failures to benchmark AI triage and playbooks
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scenarios Grid */}
        <div className="space-y-2.5 text-xs">
          {scenarios.map((s) => {
            const IconComponent = s.icon;
            return (
              <div
                key={s.id}
                id={`scenario-card-${s.id}`}
                onClick={() => handleInject(s)}
                className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-rose-500/50 hover:bg-slate-800/40 transition-all cursor-pointer group flex items-start gap-3"
              >
                <div className="p-2 rounded-lg bg-slate-900 text-slate-300 group-hover:text-rose-400 group-hover:bg-rose-500/10 transition-colors shrink-0">
                  <IconComponent className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-semibold text-slate-100 group-hover:text-rose-200 truncate">
                      {s.title}
                    </h4>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                        s.severity.startsWith('P1')
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : s.severity.startsWith('P2')
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      }`}
                    >
                      {s.severity.split(' - ')[0]}
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px] mt-1 line-clamp-1">{s.desc}</p>
                  <div className="flex items-center gap-1 mt-2">
                    {s.services.map((svc) => (
                      <span
                        key={svc}
                        className="px-1.5 py-0.2 rounded bg-slate-900 text-slate-400 font-mono text-[9px] border border-slate-800"
                      >
                        {svc}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs text-slate-400">
          <span>Safe sandboxed telemetry simulation</span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-slate-400 hover:text-white cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
