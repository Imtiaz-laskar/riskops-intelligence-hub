import React from 'react';
import {
  ShieldAlert,
  LayoutDashboard,
  Flame,
  Table,
  CheckCircle2,
  Sparkles,
  Scale,
  Settings,
  LogOut,
  User as UserIcon,
} from 'lucide-react';
import { SyncStatus } from './ui/SyncStatus';
import { Button } from './ui/Button';

export interface NavbarProps {
  activeTab: string;
  setActiveTab?: (tab: string) => void;
  onTabChange?: (tab: string) => void;
  user: any;
  onOpenSettingsModal: () => void;
  onOpenSheetsModal?: () => void;
  onOpenChaosModal?: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  isSigningIn?: boolean;
  unresolvedIncidentCount?: number;
  activeIncidentsCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onTabChange,
  user,
  onOpenSettingsModal,
  onOpenSheetsModal,
  onOpenChaosModal,
  onSignIn,
  onSignOut,
  isSigningIn = false,
  unresolvedIncidentCount,
  activeIncidentsCount,
}) => {
  const handleTabClick = (tabId: string) => {
    if (onTabChange) onTabChange(tabId);
    else if (setActiveTab) setActiveTab(tabId);
  };

  const incidentBadgeCount = activeIncidentsCount ?? unresolvedIncidentCount ?? 0;

  // Normalized primary tabs
  const navTabs = [
    {
      id: 'overview',
      alias: 'radar',
      label: 'Overview',
      icon: LayoutDashboard,
    },
    {
      id: 'incidents',
      alias: 'incidents',
      label: 'Incidents',
      icon: Flame,
      badge: incidentBadgeCount > 0 ? incidentBadgeCount : undefined,
    },
    {
      id: 'risks',
      alias: 'register',
      label: 'Risks',
      icon: Table,
    },
    {
      id: 'compliance',
      alias: 'compliance',
      label: 'Compliance',
      icon: CheckCircle2,
    },
    {
      id: 'playbooks',
      alias: 'playbooks',
      label: 'Playbooks',
      icon: Sparkles,
    },
    {
      id: 'decisions',
      alias: 'decisions',
      label: 'Decisions',
      icon: Scale,
    },
  ];

  const isTabActive = (tab: { id: string; alias?: string }) => {
    return activeTab === tab.id || activeTab === tab.alias;
  };

  return (
    <header
      id="riskops-enterprise-navbar"
      className="sticky top-0 z-40 bg-[#F8F7F4] border-b-2 border-[#1A1A1E] text-[#1A1A1E] transition-all font-sans"
    >
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & Operational Status */}
          <div className="flex items-center gap-3 shrink-0">
            <div
              id="brand-logo-badge"
              className="w-8 h-8 rounded-[4px] bg-[#1A1A1E] text-white flex items-center justify-center shadow-xs"
            >
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h2 id="brand-title" className="font-syne text-sm font-bold text-[#1A1A1E] uppercase tracking-tight leading-none">
                RiskOps Hub
              </h2>
              <div className="label text-[10px] text-[#059669] mt-0.5 font-bold">
                [ Operational ]
              </div>
            </div>
          </div>

          {/* Primary Navigation Tabs */}
          <nav
            id="primary-nav-group"
            className="flex items-center gap-1 overflow-x-auto py-1"
            aria-label="Main Navigation"
          >
            {navTabs.map((tab) => {
              const Icon = tab.icon;
              const active = isTabActive(tab);
              return (
                <button
                  key={tab.id}
                  id={`nav-tab-${tab.id}`}
                  type="button"
                  onClick={() => handleTabClick(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] text-xs font-semibold uppercase tracking-wider font-mono transition-all whitespace-nowrap focus:outline-none ${
                    active
                      ? 'border border-[#1A1A1E] bg-white text-[#1A1A1E] shadow-xs'
                      : 'border border-transparent text-[#1A1A1E]/70 hover:text-[#1A1A1E] hover:bg-white/60'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${active ? 'text-[#1A1A1E]' : 'text-[#1A1A1E]/60'}`} />
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && (
                    <span
                      id={`nav-badge-${tab.id}`}
                      className="ml-0.5 px-1.5 py-0.2 rounded-[2px] text-[10px] font-bold bg-[#DC2626] text-white font-mono"
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Action Utilities */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Global Sync Status */}
            <SyncStatus
              onOpenSyncModal={onOpenSettingsModal || onOpenSheetsModal || (() => {})}
            />

            {/* Settings Trigger */}
            <button
              id="global-settings-btn"
              type="button"
              onClick={onOpenSettingsModal}
              title="Settings & Integrations"
              className="btn-sm flex items-center gap-1"
            >
              <Settings className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Settings</span>
            </button>

            {/* User Profile / Auth */}
            {user ? (
              <div className="flex items-center gap-2 pl-2 border-l border-[#1A1A1E]/20">
                <div
                  className="w-7 h-7 rounded-[4px] bg-[#1A1A1E] text-white flex items-center justify-center text-xs font-mono font-bold"
                  title={user.email || user.displayName || 'SecOps Lead'}
                >
                  {user.displayName ? user.displayName.charAt(0).toUpperCase() : 'S'}
                </div>
                <button
                  id="user-signout-btn"
                  type="button"
                  onClick={onSignOut}
                  title="Sign out"
                  className="text-[#1A1A1E]/60 hover:text-[#DC2626] transition-colors p-1"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onSignIn}
                disabled={isSigningIn}
                className="btn-sm btn-primary"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
