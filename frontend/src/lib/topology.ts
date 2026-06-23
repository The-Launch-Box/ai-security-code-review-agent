// The execution graph of the LangGraph security agent, with hand-placed layout
// coordinates so the UI can render a deliberate, schematic topology — including
// the cyclic detect ⇄ deep_audit loop that makes this a *graph*, not a pipeline.

export type NodeStatus = 'idle' | 'active' | 'done';
export type NodeKind = 'terminal' | 'io' | 'llm' | 'agent' | 'loop' | 'output';

export interface GraphNode {
  id: string;
  label: string;
  caption: string;
  idx?: string;
  kind: NodeKind;
  field?: string; // AgentState key this node commits
  x: number; // center
  y: number;
  w: number;
  h: number;
}

export type EdgeStyle = 'straight' | 'loop-out' | 'loop-back';

export interface GraphEdge {
  from: string;
  to: string;
  conditional?: boolean;
  style: EdgeStyle;
  label?: string;
}

export const VIEW_W = 760;
export const VIEW_H = 884;

export const NODES: GraphNode[] = [
  { id: '__start__', label: 'START', caption: '', kind: 'terminal', x: 224, y: 48, w: 118, h: 32 },
  { id: 'fetch_code', label: 'Ingest', caption: 'load source / PR diff', idx: '01', kind: 'io', field: 'code_content', x: 224, y: 150, w: 200, h: 66 },
  { id: 'analyze_project', label: 'Profile', caption: 'fingerprint tech stack', idx: '02', kind: 'llm', field: 'tech_stack', x: 224, y: 288, w: 200, h: 66 },
  { id: 'detect_vulnerabilities', label: 'Detect', caption: 'reason + tool-use', idx: '03', kind: 'agent', field: 'raw_findings', x: 224, y: 452, w: 214, h: 78 },
  { id: 'deep_audit', label: 'Deep Audit', caption: 'expand vulnerable sinks', idx: '03·b', kind: 'loop', field: 'code_content', x: 556, y: 452, w: 174, h: 66 },
  { id: 'filter_vulnerabilities', label: 'Triage', caption: 'kill false positives', idx: '04', kind: 'llm', field: 'confirmed_findings', x: 224, y: 618, w: 200, h: 66 },
  { id: 'generate_report', label: 'Report', caption: 'compose + post to PR', idx: '05', kind: 'output', field: 'final_report', x: 224, y: 752, w: 200, h: 66 },
  { id: '__end__', label: 'END', caption: '', kind: 'terminal', x: 224, y: 852, w: 118, h: 32 },
];

export const EDGES: GraphEdge[] = [
  { from: '__start__', to: 'fetch_code', style: 'straight' },
  { from: 'fetch_code', to: 'analyze_project', style: 'straight' },
  { from: 'analyze_project', to: 'detect_vulnerabilities', style: 'straight' },
  { from: 'detect_vulnerabilities', to: 'deep_audit', conditional: true, style: 'loop-out', label: 'high / critical' },
  { from: 'deep_audit', to: 'detect_vulnerabilities', style: 'loop-back', label: 're-audit' },
  { from: 'detect_vulnerabilities', to: 'filter_vulnerabilities', conditional: true, style: 'straight', label: 'cleared' },
  { from: 'filter_vulnerabilities', to: 'generate_report', style: 'straight' },
  { from: 'generate_report', to: '__end__', style: 'straight' },
];

export const NODE_BY_ID: Record<string, GraphNode> = Object.fromEntries(
  NODES.map((n) => [n.id, n]),
);

export const edgeKey = (from: string, to: string) => `${from}->${to}`;

// The AgentState (TypedDict on the backend) surfaced as an inspectable object.
export interface StateField {
  key: string;
  type: string;
  source: string; // node id that writes it, or 'input'
  desc: string;
}

export const STATE_FIELDS: StateField[] = [
  { key: 'repo_path', type: 'str', source: 'input', desc: 'scan target' },
  { key: 'code_content', type: 'str', source: 'fetch_code', desc: 'source / diff' },
  { key: 'tech_stack', type: 'str', source: 'analyze_project', desc: 'detected stack' },
  { key: 'raw_findings', type: 'str', source: 'detect_vulnerabilities', desc: 'candidate vulns' },
  { key: 'iteration_count', type: 'int', source: 'detect_vulnerabilities', desc: 'audit passes' },
  { key: 'confirmed_findings', type: 'str', source: 'filter_vulnerabilities', desc: 'triaged vulns' },
  { key: 'final_report', type: 'str', source: 'generate_report', desc: 'report markdown' },
];
