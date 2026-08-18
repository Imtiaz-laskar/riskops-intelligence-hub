# RiskOps Intelligence & Automation Hub

> **Version:** 1.0.0  
> **Status:** Frozen / Release Candidate  
> **Classification:** Governed Operational Risk & Incident Intelligence System

---

## 1. Overview

The **RiskOps Intelligence & Automation Hub** is an enterprise-grade operational risk decision and automation platform. It unites real-time incident triage, threat matrix evaluation, regulatory compliance tracking, automated playbooks, and continuous audit trails with **governed human-in-the-loop authorization** and **true bidirectional Google Workspace synchronization**.

Key operational paradigms:
- **Incident Intelligence**: Real-time telemetry monitoring, CVSS scoring, and root-cause analysis.
- **Enterprise Risk & GRC**: Threat vector mapping, SLA tracking, and audit-ready governance.
- **Governed AI Assistance**: Server-side Gemini AI models that provide strict, non-autonomous advisory recommendations.
- **Human Authority**: Zero autonomous execution of containment, policy escalations, or decision overrides.
- **Bidirectional Google Sheets Sync**: 10-tab master workbook topology with three-way diffing, dry-run previews, and pre-push data loss prevention.

---

## 2. Core Architecture

The platform is constructed on a full-stack, secure, decoupled architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Layer                           │
│  React 19 + TypeScript + Tailwind CSS + Lucide Icons        │
│  State Machine • Three-Way Diff Engine • Conflict Resolver  │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
               ▼ (API Proxy)                   ▼ (OAuth2 Token Client)
┌─────────────────────────────┐  ┌────────────────────────────┐
│      Node / Express         │  │   Google Workspace APIs    │
│  Server-side Gemini Models  │  │  Sheets API v4 • Drive API │
│  Zero Public Secret Leaks   │  │  10-Tab Schema Ingestion   │
└─────────────────────────────┘  └────────────────────────────┘
```

- **Client Single Page Application (SPA)**: Ultra-responsive dashboard built with React 19, Lucide icons, and Tailwind CSS.
- **Express Backend Gateway**: Encapsulates secret API keys and isolates Gemini Generative AI endpoints behind secure `/api/*` routes.
- **Google Workspace Direct Client**: Communicates with Google Sheets v4 and Google Drive APIs using ephemeral in-memory OAuth 2.0 tokens (Google Identity Services).

---

## 3. Six Workspaces

The application organizes enterprise operations into six dedicated workspaces:

1. **Executive Dashboard (`/dashboard`)**: High-level posture analysis, aggregate CVSS distributions, open risk totals, and critical SLA timers.
2. **Threat Matrix (`/threats`)**: Real-time evaluation of emerging threat vectors, adversarial impersonation heuristics, and CVSS severity mapping.
3. **Incident Command (`/incidents`)**: Centralized operational incident triage, logs inspector, affected services topology, and containment gates.
4. **Playbooks & Automation (`/playbooks`)**: Governed execution playbooks, automated mitigation rules, and rollback verifications.
5. **Compliance & Governance (`/compliance`)**: Regulatory framework adherence (SOC 2, ISO 27001, NIST AI RMF), SLA breach alerts, and formal Decision Register.
6. **Analytics & SWOT (`/analytics`)**: Strategic risk assessments, strengths/weaknesses modeling, and chronological audit trail inspection.

---

## 4. AI Governance Model

RiskOps enforces strict algorithmic boundaries for artificial intelligence:

- **Advisory-Only Scope**: The Gemini AI assistant provides threat evaluations, triage summaries, and mitigation proposals.
- **Zero Autonomous Execution**: AI models can **never** trigger playbook actions, escalate incident tiers, alter audit logs, or authorize network isolations.
- **Audit Logging**: Every AI-generated suggestion is permanently recorded with its model version, timestamp, and confidence rating.

---

## 5. Human Authorization Model

Operational authority strictly resides with designated operators and Incident Commanders:

- **Containment Authorization**: Network isolation, token revocations, and IP blacklisting require multi-factor manual approval.
- **Decision Governance**: Decision registers require human review, recorded rationale, and explicit approver signatures.
- **Override Safeguards**: Automated playbooks can be paused, modified, or rolled back by on-call security leads at any stage.

---

## 6. Google Workspace Integration

RiskOps seamlessly bridges web-based incident command with enterprise spreadsheet reporting:

- **OAuth 2.0 Identity**: Utilizes Google Identity Services (GIS) `initTokenClient` with incremental consent.
- **Least-Privilege Scopes**: Strictly requests `https://www.googleapis.com/auth/spreadsheets` and `https://www.googleapis.com/auth/drive.file`.
- **Ephemeral Token Lifecycle**: Tokens reside exclusively in-memory during active sessions. No sensitive credentials or refresh tokens are written to `localStorage`.
- **Target Spreadsheet Persistence**: The active spreadsheet ID is securely remembered per operator workspace.

---

## 7. Bidirectional Sync Architecture

The bidirectional sync pipeline synchronizes records without data loss:

1. **RiskOps → Google Sheets (Push)**: Exports the full 10-tab dataset, applies enterprise styling (frozen headers, severity color-coding), and creates a local baseline snapshot.
2. **Google Sheets → RiskOps (Pull)**: Fetches all 10 tabs, parses raw rows against strict schemas, and generates a dry-run **Import Preview Report**.
3. **Pre-Push Safeguard**: Prior to any outbound push, `detectExternalChanges` checks if unimported changes exist in Google Sheets, blocking accidental overwriting of spreadsheet-authored data.

---

## 8. Three-Way Conflict Resolution

When records are updated independently on both sides, the three-way diff engine activates:

```
           ┌──────────────────────┐
           │  Baseline Snapshot   │
           │  (Last Known Sync)   │
           └──────────┬───────────┘
                      │
           ┌──────────┴──────────┐
           ▼                     ▼
┌─────────────────────┐   ┌─────────────────────┐
│  Live RiskOps State │   │  Live Google Sheet  │
│  "Operator Edited"  │   │  "Spreadsheet Edit" │
└──────────┬──────────┘   └──────────┬──────────┘
           │                         │
           └──────────┬──────────────┘
                      ▼
            [ Three-Way Diff Engine ]
                      ▼
             SYNC_CONFLICT Detected
                      ▼
         [ Human Conflict Resolution ]
     ┌────────────────┬────────────────┐
     ▼                                 ▼
KEEP_RISKOPS                      APPLY_GOOGLE
```

- **Conflict Detection**: Flags records where both `RiskOps !== Baseline` and `Google !== Baseline`.
- **Side-by-Side Differencing**: Surfaces differing fields, previous values, and incoming changes in `ImportPreviewModal`.
- **Authoritative Selection**: The operator chooses whether to retain the RiskOps authoritative state or apply the Google Sheets value.

---

## 9. Security Model

- **Zero Client Secrets**: Third-party API keys and Gemini credentials remain server-side only.
- **Protected Fields**: Sensitive fields (`id`, `logs`, `containedAt`, `affectedServices`) are non-destructively merged and cannot be wiped by incoming spreadsheets.
- **Quarantine & Validation**: Rows with invalid schemas or missing primary keys are rejected and quarantined into validation logs.
- **Immutable Audit Trail**: All sync actions (`GOOGLE_IMPORT_STARTED`, `GOOGLE_RECORD_CREATED`, `GOOGLE_SYNC_CONFLICT`, `GOOGLE_RECORD_UPDATED`) are permanently logged.

---

## 10. 10-Tab Workbook Schema

The synchronized Google Sheets workbook comprises 10 structured worksheets:

| Tab Name | Purpose | Primary Identifier |
|---|---|---|
| `01_Incidents` | Operational security incident records & CVSS telemetry | `Incident_ID` |
| `02_Risk_Rules` | Detection heuristics, thresholds, and automated rules | `Rule_ID` |
| `03_Escalations` | On-call tiers, response targets, and escalation leads | `Escalation_ID` |
| `04_SLA` | MTTA/MTTR targets, uptime rules, and breach penalties | `SLA_ID` |
| `05_Audit_Log` | Chronological immutable system & operator audit events | `Audit_ID` |
| `06_Config` | Workspace operational settings & environment variables | `Config_Key` |
| `07_Dashboard` | Real-time aggregate metric summaries & posture KPIs | `Metric_Key` |
| `08_Decision_Register` | Architectural risk decisions, approvals, and reviews | `Decision_ID` |
| `09_Automation_Log` | Playbook execution histories and rollback verifications | `Execution_ID` |
| `10_SWOT_Analysis` | Strategic operational strengths, weaknesses, and risks | `SWOT_ID` |

---

## 11. Verification & Test Suite

The repository includes an embedded, deterministic verification suite in `src/services/syncVerificationTest.ts`:

- **11 Baseline Tests**: Validates snapshot generation, new record ingestion, modified record ingestion, no-change imports, conflict detection, validation rejection, protected field preservation, error resilience, OAuth gates, audit generation, and pre-push safeguards.
- **10 Acceptance Phases**: Deterministically exercises synthetic isolated fixtures (`CONFLICT-E2E-001`, `CONFLICT-E2E-002`) across multi-step concurrent mutation, silent overwrite prevention, dual resolution pathways, and clean quarantine cleanup.
- **Regression Status**: **22/22 Tests Passed**.

---

## 12. Local Development

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation
```bash
# Clone the repository
git clone https://github.com/your-org/riskops-intelligence-hub.git
cd riskops-intelligence-hub

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
```

### Running the Application
```bash
# Start development server on port 3000
npm run dev

# Run linter & TypeScript type check
npm run lint

# Build production bundle
npm run build

# Start production server
npm start
```

---

## 13. Environment Variables

Configure your `.env` file according to `.env.example`:

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Google Gemini API Key for server-side AI triage and threat analysis |
| `APP_URL` | Base application URL for origin validation and API routing (Default: `http://localhost:3000`) |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth 2.0 Web Client ID for Google Workspace synchronization |

---

## 14. Limitations & Operational Notes

- **Google API Quotas**: Standard Google Sheets API quotas apply (300 requests per minute per project). Large bulk imports are batched.
- **In-Memory Token Lifetime**: Google OAuth tokens expire after 60 minutes. Expired sessions require a one-click re-authorization prompt.
- **Single-User Workspace Context**: The local baseline snapshot is maintained in the operator's browser session.

---

## 15. V1.0.0 Release Status

```
============================================================
RISKOPS INTELLIGENCE & AUTOMATION HUB — V1.0.0
============================================================
VERSION:            1.0.0
RELEASE STATUS:     FROZEN & VERIFIED
BUILD STATUS:       PASS (0 Errors)
TYPECHECK STATUS:   PASS (0 Errors)
REGRESSION SUITE:   22/22 PASSED
GOOGLE WORKSPACE:   10/10 TABS VERIFIED
============================================================
```
