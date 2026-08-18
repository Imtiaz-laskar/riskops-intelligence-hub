import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Lazy initialize Gemini API client
function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is missing');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'RiskOps Intelligence & Automation Hub' });
});

// Endpoint: AI Incident Deep Triage & Root Cause Analysis
app.post('/api/ai/triage', async (req, res) => {
  try {
    const { incidentTitle, description, severity, affectedServices, logs } = req.body;
    const ai = getGenAI();

    const prompt = `You are a Principal Security & Operations Risk Engineer and Incident Commander.
Analyze the following operational or cybersecurity incident and provide an in-depth, structured triage analysis.

Incident Details:
- Title: ${incidentTitle || 'Operational Risk Anomaly'}
- Current Severity: ${severity || 'P2'}
- Affected Services: ${Array.isArray(affectedServices) ? affectedServices.join(', ') : affectedServices || 'Core Infrastructure'}
- Description: ${description || 'Unidentified latency and anomalous authentication attempts detected'}
- System Logs/Telemetry: ${logs || 'N/A'}

Provide your assessment in valid JSON format only (do not include Markdown code fences or extra text, just raw JSON) matching this schema:
{
  "summary": "Concise 2-sentence executive summary of the incident",
  "calculatedSeverity": "P1 - Critical" | "P2 - High" | "P3 - Medium" | "P4 - Low",
  "cvssScore": number (0.0 to 10.0),
  "threatVector": "string (e.g. Distributed Credential Stuffing, Database Replication Starvation, BGP Route Leak)",
  "rootCauseHypothesis": "Detailed explanation of likely technical breakdown or exploit path",
  "strideCategory": "Spoofing" | "Tampering" | "Repudiation" | "Information Disclosure" | "Denial of Service" | "Elevation of Privilege" | "Operational Resilience",
  "blastRadius": "Detailed list of impacted downstream systems and business capabilities",
  "immediateContainmentActions": [
    {
      "step": 1,
      "title": "Action title",
      "command": "CLI/Shell/Terraform/API command to execute",
      "automated": boolean,
      "estimatedDuration": "e.g. 30s, 2m"
    }
  ],
  "remediationPlan": [
    "Short-term fix step",
    "Medium-term architectural hardening step",
    "Long-term policy/control enhancement"
  ],
  "stakeholderBriefing": "Formal 3-sentence update for CISO / VP of Engineering"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    const text = response.text || '{}';
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      // Fallback extraction if model wraps in markdown
      const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      data = JSON.parse(cleaned);
    }

    return res.json({ success: true, data });
  } catch (error: any) {
    console.error('Error in /api/ai/triage:', error);
    return res.status(500).json({ success: false, error: error?.message || 'Failed to triage incident' });
  }
});

// Endpoint: AI Threat Modeling & Risk Matrix Generator
app.post('/api/ai/threat-model', async (req, res) => {
  try {
    const { systemDescription, industry, cloudEnvironment } = req.body;
    const ai = getGenAI();

    const prompt = `You are a Senior Enterprise Risk Management (ERM) and SecOps Architect.
Analyze the following enterprise system architecture / operational process and generate 4-6 realistic, high-fidelity operational and cyber risks for an Enterprise Risk Register.

System Context:
- Description: ${systemDescription || 'Cloud-native microservices processing international payments and customer PII'}
- Industry: ${industry || 'FinTech / SaaS'}
- Infrastructure: ${cloudEnvironment || 'GCP GKE, Cloud SQL, Redis, Pub/Sub'}

Return a valid JSON object matching this schema:
{
  "systemRiskScore": number (1-100),
  "postureSummary": "Executive posture assessment",
  "risks": [
    {
      "title": "Clear concise risk statement (e.g. Database Master Node Failover Delay)",
      "category": "Cybersecurity" | "Cloud Infrastructure" | "Regulatory Compliance" | "Operational Resilience" | "Third-Party Vendor" | "Financial",
      "threatVector": "Technical vector or failure mode",
      "likelihood": number (1 to 5),
      "impact": number (1 to 5),
      "mitigationStrategy": "Concrete engineering control and operational runbook",
      "owner": "Role responsible (e.g., Lead SRE, AppSec Lead, Head of Compliance)",
      "controls": ["Control ID 1", "Control ID 2"],
      "residualRisk": "Low" | "Medium" | "High" | "Critical"
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.3,
      },
    });

    const text = response.text || '{}';
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      data = JSON.parse(cleaned);
    }

    return res.json({ success: true, data });
  } catch (error: any) {
    console.error('Error in /api/ai/threat-model:', error);
    return res.status(500).json({ success: false, error: error?.message || 'Failed to model risks' });
  }
});

// Endpoint: AI Regulatory Compliance & Control Gap Analyzer
app.post('/api/ai/compliance-audit', async (req, res) => {
  try {
    const { framework, currentControls, architectureDetails } = req.body;
    const ai = getGenAI();

    const prompt = `You are a Lead GRC (Governance, Risk & Compliance) Auditor.
Evaluate the organization against the specified compliance framework: ${framework || 'SOC 2 Type II'}.

Current Controls & Architecture:
${architectureDetails || 'Kubernetes workload with IAM role-based access, automatic TLS certificates, automated audit log streaming to BigQuery, multi-region database backups.'}
Existing declared controls: ${JSON.stringify(currentControls || [])}

Provide an audit evaluation in raw JSON:
{
  "framework": "${framework || 'SOC 2 Type II'}",
  "readinessScore": number (1-100),
  "auditStatus": "Compliant" | "Minor Gaps" | "Needs Remediation",
  "evaluatedControls": [
    {
      "controlId": "string (e.g. CC6.1, A.12.1.2, PR.AC-1)",
      "name": "Control title",
      "domain": "Access Control / Cryptography / Incident Response / Business Continuity",
      "status": "Pass" | "Gap" | "Warning",
      "findings": "Audit finding details",
      "requiredEvidence": "Log export, policy document, penetration test report, etc.",
      "remediationAction": "Exact steps to satisfy requirement"
    }
  ],
  "topPriorityActions": [
    "Immediate action 1",
    "Immediate action 2"
  ]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    const text = response.text || '{}';
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      data = JSON.parse(cleaned);
    }

    return res.json({ success: true, data });
  } catch (error: any) {
    console.error('Error in /api/ai/compliance-audit:', error);
    return res.status(500).json({ success: false, error: error?.message || 'Failed to analyze compliance' });
  }
});

// Endpoint: AI Automated Mitigation Playbook Builder
app.post('/api/ai/mitigation-playbook', async (req, res) => {
  try {
    const { threatTitle, context } = req.body;
    const ai = getGenAI();

    const prompt = `You are an automated DevSecOps and SRE Playbook engineer.
Design an executable, automated incident response and risk mitigation playbook for:
Threat / Incident: ${threatTitle || 'Distributed API Credential Abuse'}
Context: ${context || 'High velocity 401s and token replay attempts across public API ingress'}

Return raw JSON:
{
  "playbookId": "PB-AUTO-01",
  "name": "Automated Remediation Playbook",
  "triggerCondition": "Condition that fires this automated runbook",
  "estimatedExecutionTime": "45 seconds",
  "riskLevel": "Low Risk of False Positive",
  "steps": [
    {
      "order": 1,
      "actionName": "Step title",
      "system": "Cloud Armor / IAM / K8s / Database / PagerDuty",
      "automationType": "Automated Execution" | "Human Approval Required" | "Notification Only",
      "scriptSnippet": "Command or script executed",
      "rollbackAction": "How to revert if needed",
      "successCriteria": "Metric or log indicating success"
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    const text = response.text || '{}';
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      data = JSON.parse(cleaned);
    }

    return res.json({ success: true, data });
  } catch (error: any) {
    console.error('Error in /api/ai/mitigation-playbook:', error);
    return res.status(500).json({ success: false, error: error?.message || 'Failed to generate playbook' });
  }
});

// Integrate Vite middleware in development or serve static in production
async function setupViteOrStatic() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`RiskOps Server running on http://localhost:${PORT}`);
  });
}

setupViteOrStatic();
