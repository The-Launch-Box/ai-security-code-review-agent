// A scripted, realistic execution that walks the live graph end-to-end without
// needing the Python backend, API keys, or Ollama running. It demonstrates the
// cyclic deep-audit loop by surfacing a CRITICAL on the first detection pass.

import type { OrchestratorEvent } from './events';

export interface DemoStep {
  delay: number; // ms to wait before firing, relative to previous step
  event: OrchestratorEvent;
}

const TECH_STACK =
  'React 19 + Vite (TypeScript) frontend · FastAPI (Python) backend · LangGraph orchestration · GitHub PR integration. Primary attack surface: arbitrary local file read via the scan endpoint, SSRF in the diff fetcher, permissive CORS, and ReDoS in the codebase-search tool.';

const RAW_PASS_1 = `Candidate findings (pass 1):
1. [CRITICAL] /api/scan accepts an arbitrary repo_path and the read_file tool reads any path → unauthenticated local file read (LFI).
2. [HIGH] CORS: allow_origins=["*"] together with allow_credentials=True.
3. [MED] search_codebase compiles a user-supplied regex → potential ReDoS.
4. [LOW] Report markdown rendered client-side — checking sink.`;

const RAW_PASS_2 = `Refined findings (pass 2, post deep-audit):
1. [CRITICAL] read_file(filepath) in tools.py has no path allow-listing; reachable from the scan flow → full filesystem read.
2. [HIGH] fetch_pr_diff() requests pr.diff_url server-side with the GITHUB_TOKEN attached → SSRF + token exfil to attacker-controlled redirects.
3. [HIGH] Wildcard CORS + credentials lets any origin call the agent API.
4. [MED] ReDoS in search_codebase confirmed but low impact (local DoS).`;

const CONFIRMED = `**Confirmed, actionable findings:**

1. **[CRITICAL] Unauthenticated Local File Read** — \`server.py:/api/scan\` → \`tools.read_file\`. No path validation; an attacker can read \`.env\`, keys, \`/etc/passwd\`.
2. **[HIGH] SSRF + Token Exfiltration** — \`github_integration.fetch_pr_diff\` follows \`diff_url\` with the token attached.
3. **[HIGH] Permissive CORS with Credentials** — \`allow_origins=["*"]\` + \`allow_credentials=True\`.

_Filtered out: ReDoS (DoS, out of scope) and the markdown XSS (react-markdown escapes by default)._`;

const FINAL_REPORT = `# Security Review Report

## Tech Stack
React 19 + Vite (TS) frontend, FastAPI backend, LangGraph orchestration, GitHub PR integration.

## Confirmed Findings

### CRITICAL — Unauthenticated Local File Read
\`POST /api/scan\` accepts an arbitrary \`repo_path\`, and the \`read_file\` tool (\`tools.py\`) reads any path with no allow-listing. Any client can exfiltrate \`.env\`, private keys, or system files.

\`\`\`python
# tools.py — no path containment
def read_file(filepath: str) -> str:
    with open(filepath, 'r', encoding='utf-8') as f:
        return f.read()
\`\`\`

**Fix:** resolve and confine paths to an allow-listed workspace root; require auth on \`/api/scan\`.

### HIGH — SSRF + Token Exfiltration
\`fetch_pr_diff()\` issues a server-side request to \`pr.diff_url\` with \`GITHUB_TOKEN\` attached. A crafted/redirected URL can leak the token or reach internal services.

**Fix:** validate the host against \`api.github.com\`; disable redirects; scope the token.

### HIGH — Permissive CORS with Credentials
\`allow_origins=["*"]\` combined with \`allow_credentials=True\` allows any origin to invoke the API with credentials.

**Fix:** pin \`allow_origins\` to trusted hosts.

> Triage dropped 2 low-signal items (ReDoS / DoS, theoretical markdown XSS) to keep this report actionable.`;

export function buildDemoRun(target: string): DemoStep[] {
  const t = target || 'C:\\projects\\security_agent';
  return [
    { delay: 0, event: { type: 'run_start', target: t } },
    { delay: 220, event: { type: 'log', level: 'info', text: `boot orchestrator · target=${t}` } },

    // 01 — ingest
    { delay: 360, event: { type: 'node_start', node: 'fetch_code' } },
    { delay: 220, event: { type: 'log', level: 'info', text: 'reading working tree · package.json · requirements.txt' } },
    { delay: 900, event: { type: 'node_end', node: 'fetch_code', field: 'code_content', preview: 'Local repo · 11 files · FastAPI + React + LangGraph. Use search tools to explore.' } },

    // 02 — profile
    { delay: 260, event: { type: 'node_start', node: 'analyze_project' } },
    { delay: 1100, event: { type: 'log', level: 'info', text: 'llm · tech-stack fingerprint' } },
    { delay: 500, event: { type: 'node_end', node: 'analyze_project', field: 'tech_stack', preview: TECH_STACK } },

    // 03 — detect (pass 1) → uses tools → finds CRITICAL
    { delay: 280, event: { type: 'node_start', node: 'detect_vulnerabilities' } },
    { delay: 650, event: { type: 'log', level: 'tool', text: 'search_codebase(pattern="open\\\\(|read_file|subprocess")' } },
    { delay: 700, event: { type: 'log', level: 'tool', text: 'read_file("server.py")' } },
    { delay: 650, event: { type: 'log', level: 'tool', text: 'read_file("tools.py")' } },
    { delay: 700, event: { type: 'node_end', node: 'detect_vulnerabilities', field: 'raw_findings', preview: RAW_PASS_1, iteration_count: 1 } },
    { delay: 250, event: { type: 'log', level: 'warn', text: 'router · CRITICAL present → conditional edge ⟶ deep_audit' } },

    // 03·b — deep audit (the cycle)
    { delay: 360, event: { type: 'node_start', node: 'deep_audit' } },
    { delay: 800, event: { type: 'log', level: 'info', text: 'expanding context around suspected sinks' } },
    { delay: 400, event: { type: 'node_end', node: 'deep_audit', field: 'code_content', preview: 'Local repo · 11 files … [deep audit: expanded context around suspected vulnerable sinks]' } },

    // 03 — detect (pass 2, loop back)
    { delay: 320, event: { type: 'node_start', node: 'detect_vulnerabilities' } },
    { delay: 700, event: { type: 'log', level: 'tool', text: 'read_file("github_integration.py")' } },
    { delay: 750, event: { type: 'log', level: 'tool', text: 'search_codebase(pattern="allow_origins|diff_url")' } },
    { delay: 800, event: { type: 'node_end', node: 'detect_vulnerabilities', field: 'raw_findings', preview: RAW_PASS_2, iteration_count: 2 } },
    { delay: 250, event: { type: 'log', level: 'info', text: 'router · max passes reached ⟶ triage' } },

    // 04 — triage
    { delay: 360, event: { type: 'node_start', node: 'filter_vulnerabilities' } },
    { delay: 900, event: { type: 'log', level: 'info', text: 'llm · dropping DoS / theoretical / low-signal' } },
    { delay: 500, event: { type: 'node_end', node: 'filter_vulnerabilities', field: 'confirmed_findings', preview: CONFIRMED } },

    // 05 — report
    { delay: 320, event: { type: 'node_start', node: 'generate_report' } },
    { delay: 600, event: { type: 'log', level: 'info', text: 'composing report · markdown' } },
    { delay: 500, event: { type: 'node_end', node: 'generate_report', field: 'final_report', preview: 'Security Review Report · 3 confirmed (1 critical, 2 high)' } },
    { delay: 120, event: { type: 'report', markdown: FINAL_REPORT } },
    { delay: 300, event: { type: 'log', level: 'done', text: 'run complete · 3 confirmed findings' } },
    { delay: 200, event: { type: 'run_complete' } },
  ];
}
