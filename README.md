<div align="center">

<br/>

<h1>RiskOps Intelligence & Automation Hub</h1>

<p>Governed operational risk intelligence, incident command, compliance, decision governance, and controlled automation — connected through a human-authorized operating model.</p>

<br/>

[![Version](https://img.shields.io/badge/Version-1.0.0-0057B8?style=flat-square)](#)
[![Status](https://img.shields.io/badge/Status-Frozen%20%2F%20Verified-1a7f37?style=flat-square)](#)
[![Regression](https://img.shields.io/badge/Regression-22%2F22%20Passed-1a7f37?style=flat-square)](#)
[![Build](https://img.shields.io/badge/Build-PASS-1a7f37?style=flat-square)](#)
[![AI](https://img.shields.io/badge/AI-Advisory%20Only-e67e00?style=flat-square)](#)
[![Google Workspace](https://img.shields.io/badge/Google%20Workspace-10%2F10%20Tabs%20Verified-4285F4?style=flat-square&logo=google&logoColor=white)](#)

<br/>

```
AI recommends. Humans authorize. Systems execute. Verification confirms. Audit remembers.
```

</div>

---

## Core Operating Model

```
┌─────────────────────┐
│     AI ANALYSIS     │  ← Recommends only. Never authorizes.
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│   HUMAN DECISION    │  ← Operator reviews, approves, authorizes.
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│  CONTROLLED RUNBOOK │  ← Executes only after human gate.
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│     VERIFICATION    │  ← Independent confirmation of outcome.
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│     AUDIT LEDGER    │  ← Immutable. Append-only. Always records.
└─────────────────────┘
```

---

## Platform Screenshots

### 01 — Operational Command Center
> Consolidated view of incidents, risks, compliance posture, automation activity, and operational signals.

![Operational Command Center](docs/screenshots/01-command-center.png)

---

### 02 — Incident Command Center
> Structures investigations around evidence, AI hypotheses, risk assessment, human authorization, controlled containment, verification, and auditability.

![Incident Command Center](docs/screenshots/02-incident-command.png)

---

### 03 — Enterprise Risk Register
> Centralized risk posture management — likelihood-impact assessment, treatment ownership, control relationships, review cadence, and residual-risk tracking.

![Enterprise Risk Register](docs/screenshots/03-risk-register.png)

---

### 04 — Compliance & GRC Control Center
> Connects controls, evidence, gaps, enterprise risks, remediation actions, and audit history across SOC 2, ISO 27001, NIST CSF, HIPAA, and GDPR.

![Compliance & GRC](docs/screenshots/04-compliance-grc.png)

---

### 05 — Controlled Response & Automation Center
> Governs playbook execution through authorization gates, sequential execution, verification requirements, rollback controls, and audit logging.

![Automation Center](docs/screenshots/05-automation.png)

---

### 06 — Decisions & Governance
> System of record for consequential decisions, ADRs, approvals, trade-offs, AI reasoning provenance, and governance lifecycle events.

![Decisions & Governance](docs/screenshots/06-decisions.png)

---

### 07 — Google Workspace Integration
> Governed bidirectional synchronization across a standardized 10-tab Google Sheets workbook — with conflict detection, import previews, and data-loss safeguards.

![Google Workspace Integration](docs/screenshots/07-google-workspace.png)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                         │
│   React 19 · TypeScript · Tailwind CSS · Lucide Icons       │
│   State Machine · Three-Way Diff Engine · Conflict Resolver │
└──────────────┬───────────────────────────┬──────────────────┘
               │                           │
               ▼  API Proxy                ▼  OAuth2 Token Client
┌──────────────────────────┐  ┌────────────────────────────────┐
│    Node.js / Express     │  │     Google Workspace APIs      │
│  Server-side Gemini AI   │  │  Sheets API v4 · Drive API     │
│  Zero Public Key Leaks   │  │  10-Tab Schema · Bidirectional │
└──────────────────────────┘  └────────────────────────────────┘
```

---

## Six Workspaces

| Workspace | Purpose |
|:---|:---|
| **Executive Dashboard** | Enterprise posture, aggregate CVSS distributions, open risk totals, critical SLA timers |
| **Threat Matrix** | Threat-vector evaluation, severity analysis, adversarial risk assessment |
| **Incident Command** | Evidence-grounded investigation, triage, containment, verification, incident audit |
| **Playbooks & Automation** | Governed response automation, authorization gates, execution tracking, rollback |
| **Compliance & Governance** | Controls, evidence, gaps, remediation, risks, and governance records |
| **Analytics & SWOT** | Strategic risk analysis, operational analytics, SWOT assessment |

---

## Incident Mental Model

```
COMMAND  →  EVIDENCE & TELEMETRY  →  RISK & BLAST RADIUS
                                              ↓
                               AI THREAT ASSESSMENT
                                              ↓
                               HUMAN DECISION GATE          ← critical boundary
                                              ↓
                               CONTROLLED CONTAINMENT
                                              ↓
                          VERIFICATION  →  RESIDUAL RISK  →  AUDIT LEDGER
```

**Three-way separation enforced throughout:**

```
SYSTEM FACTS      confirmed telemetry
AI INFERENCES     probabilistic hypotheses only
UNKNOWNS          unconfirmed — never treated as fact
```

---

## AI Governance

<table>
<tr>
<td width="50%" valign="top">

**AI Can**
- Analyze threat context
- Generate hypotheses
- Assist STRIDE threat modeling
- Suggest root-cause hypotheses
- Generate executive summaries
- Recommend mitigation approaches
- Assist compliance architecture analysis
- Generate candidate playbooks

</td>
<td width="50%" valign="top">

**AI Cannot**
- Authorize containment
- Execute production playbooks autonomously
- Override human decisions
- Change authoritative governance records
- Resolve sync conflicts automatically
- Treat inference as confirmed system fact

</td>
</tr>
</table>

---

## Bidirectional Sync Architecture

```
             ┌─────────────────────┐
             │       RISKOPS       │
             └──────────┬──────────┘
                        ↕  bidirectional
             ┌──────────┴──────────┐
             │   THREE-WAY DIFF    │
             │       ENGINE        │
             └──────────┬──────────┘
                        ↕
             ┌─────────────────────┐
             │    GOOGLE SHEETS    │
             └─────────────────────┘
```

**Conflict resolution — no silent overwrites:**

```
LOCAL RISKOPS STATE
        │
        ├──────────────────┐
        ↓                  ↓
   BASELINE           GOOGLE STATE
        │                  │
        └────────┬──────────┘
                 ↓
         THREE-WAY DIFF
                 ↓
          SYNC_CONFLICT
                 ↓
        HUMAN RESOLUTION
           ↙           ↘
  KEEP_RISKOPS     APPLY_GOOGLE
```

---

## 10-Tab Workbook Schema

| Tab | Purpose | Key |
|:---|:---|:---|
| `01_Incidents` | Operational incident records & CVSS telemetry | Incident_ID |
| `02_Risk_Rules` | Detection rules, thresholds, risk logic | Rule_ID |
| `03_Escalations` | Escalation tiers and response targets | Escalation_ID |
| `04_SLA` | MTTA/MTTR targets, breach tracking | SLA_ID |
| `05_Audit_Log` | Chronological immutable audit events | Audit_ID |
| `06_Config` | Workspace configuration | Config_Key |
| `07_Dashboard` | Aggregate operational metrics | Metric_Key |
| `08_Decision_Register` | Decisions, approvals, governance records | Decision_ID |
| `09_Automation_Log` | Playbook execution and rollback history | Execution_ID |
| `10_SWOT_Analysis` | Strategic operational analysis | SWOT_ID |

---

## V1.0.0 Release Status

```
╔══════════════════════════════════════════════════════════════╗
║         RISKOPS INTELLIGENCE & AUTOMATION HUB — V1.0.0      ║
╠══════════════════════════════════════════════════════════════╣
║  VERSION              1.0.0                                  ║
║  STATUS               FROZEN / VERIFIED                      ║
║  TYPECHECK            PASS                                   ║
║  PRODUCTION BUILD     PASS                                   ║
║  REGRESSION           22 / 22 PASSED                        ║
║  GOOGLE WORKSPACE     10 / 10 TABS VERIFIED                 ║
║  BIDIRECTIONAL SYNC   VERIFIED                               ║
║  CONFLICT HANDLING    VERIFIED                               ║
║  SAFETY GATES         VERIFIED                               ║
║  AI GOVERNANCE        ADVISORY ONLY                          ║
╚══════════════════════════════════════════════════════════════╝
```

---

## Tech Stack

```
┌──────────────────────────────────────────────────────────────┐
│                  RISKOPS TECH STACK                          │
├──────────────────────┬───────────────────────────────────────┤
│  Frontend            │  React 19, TypeScript, Tailwind CSS   │
│  Backend             │  Node.js, Express                     │
│  AI                  │  Google Gemini (server-side only)     │
│  Cloud Integration   │  Google Identity Services             │
│                      │  Google Sheets API v4, Drive API      │
│  Runtime             │  Bun / Node.js 18+                    │
│  Verification        │  Deterministic E2E Suite (22 tests)   │
└──────────────────────┴───────────────────────────────────────┘
```

---

## Local Development

```bash
# Clone
git clone https://github.com/Imtiaz-laskar/riskops-intelligence-hub.git
cd riskops-intelligence-hub

# Install
npm install

# Configure — never commit real credentials
cp .env.example .env

# Develop
npm run dev

# Type check
npm run lint

# Build
npm run build
```

**Environment variables:**

| Variable | Description |
|:---|:---|
| `GEMINI_API_KEY` | Google Gemini API key — server-side only |
| `APP_URL` | Base application URL (default: `http://localhost:3000`) |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth 2.0 Web Client ID |

---

## Design Philosophy

> *Automation should increase operational capability without removing human accountability.*

```
INTELLIGENCE  →  EVIDENCE  →  RISK  →  DECISION
                                           ↓
                              AUTHORIZATION  →  EXECUTION
                                                    ↓
                                          VERIFICATION  →  AUDIT
```

The goal is not to make security operations autonomous.
The goal is to make them **observable, explainable, governable, and accountable.**

---

<div align="center">

<br/>

*RiskOps Intelligence & Automation Hub — v1.0.0 verified baseline.*

<br/>

`© 2026 Imtiaz Hussain Laskar. All Rights Reserved.`

</div>
