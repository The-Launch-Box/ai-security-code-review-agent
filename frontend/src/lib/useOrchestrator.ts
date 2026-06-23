import { useCallback, useReducer, useRef } from 'react';
import type { LogEntry, LogLevel, OrchestratorEvent } from './events';
import { NODES, STATE_FIELDS, NODE_BY_ID, edgeKey } from './topology';
import type { NodeStatus } from './topology';
import { buildDemoRun } from './demo';

export type Phase = 'idle' | 'running' | 'complete' | 'error';
export type Mode = 'demo' | 'live';

export interface StateCell {
  value: string;
  writing: boolean;
}

export interface ScanConfig {
  scanType: 'local' | 'github';
  localPath: string;
  githubRepo: string;
  prNumber: string;
  instructions: string;
}

export interface OrchState {
  phase: Phase;
  current: string | null;
  lastNode: string | null;
  status: Record<string, NodeStatus>;
  activeEdge: { from: string; to: string } | null;
  doneEdges: string[];
  cells: Record<string, StateCell>;
  iteration: number;
  log: LogEntry[];
  report: string | null;
  error: string | null;
  startedAt: number | null;
}

type Action = OrchestratorEvent | { type: 'reset' };

const idleStatus = (): Record<string, NodeStatus> =>
  Object.fromEntries(NODES.map((n) => [n.id, 'idle'])) as Record<string, NodeStatus>;

const initState = (): OrchState => ({
  phase: 'idle',
  current: null,
  lastNode: null,
  status: idleStatus(),
  activeEdge: null,
  doneEdges: [],
  cells: {},
  iteration: 0,
  log: [],
  report: null,
  error: null,
  startedAt: null,
});

const fmt = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

function pushLog(s: OrchState, level: LogLevel, text: string): LogEntry[] {
  const ms = s.startedAt ? Date.now() - s.startedAt : 0;
  return [...s.log, { ts: fmt(ms), level, text }].slice(-220);
}

function reducer(s: OrchState, action: Action): OrchState {
  switch (action.type) {
    case 'reset':
      return initState();

    case 'run_start': {
      const status = idleStatus();
      status['__start__'] = 'done';
      const cells: Record<string, StateCell> = {};
      if (action.target) cells['repo_path'] = { value: action.target, writing: false };
      return {
        ...initState(),
        phase: 'running',
        status,
        lastNode: '__start__',
        cells,
        startedAt: Date.now(),
        log: [{ ts: '00:00', level: 'info', text: 'run initiated' }],
      };
    }

    case 'node_start': {
      const from = s.lastNode ?? '__start__';
      const status = { ...s.status, [action.node]: 'active' as NodeStatus };
      const iteration =
        action.node === 'detect_vulnerabilities' ? s.iteration + 1 : s.iteration;
      const cells = { ...s.cells };
      for (const f of STATE_FIELDS) {
        if (f.source === action.node) {
          cells[f.key] = { value: cells[f.key]?.value ?? '', writing: true };
        }
      }
      const label = NODE_BY_ID[action.node]?.label ?? action.node;
      return {
        ...s,
        status,
        current: action.node,
        activeEdge: { from, to: action.node },
        iteration,
        cells,
        log: pushLog(s, 'node', `▶ ${label}`),
      };
    }

    case 'node_end': {
      const status = { ...s.status, [action.node]: 'done' as NodeStatus };
      const doneEdges = s.activeEdge
        ? [...s.doneEdges, edgeKey(s.activeEdge.from, s.activeEdge.to)]
        : s.doneEdges;
      const cells = { ...s.cells };
      if (action.field && action.preview !== undefined) {
        cells[action.field] = { value: action.preview, writing: false };
      }
      if (action.iteration_count !== undefined) {
        cells['iteration_count'] = { value: String(action.iteration_count), writing: false };
      }
      for (const f of STATE_FIELDS) {
        if (f.source === action.node && cells[f.key]) {
          cells[f.key] = { ...cells[f.key], writing: false };
        }
      }
      return { ...s, status, lastNode: action.node, activeEdge: null, doneEdges, cells };
    }

    case 'log':
      return { ...s, log: pushLog(s, action.level, action.text) };

    case 'report':
      return { ...s, report: action.markdown };

    case 'run_complete': {
      const status = { ...s.status, __end__: 'done' as NodeStatus };
      return {
        ...s,
        phase: 'complete',
        status,
        current: null,
        activeEdge: null,
        lastNode: '__end__',
        doneEdges: [...s.doneEdges, edgeKey('generate_report', '__end__')],
        log: pushLog(s, 'done', '✓ run complete'),
      };
    }

    case 'error':
      return {
        ...s,
        phase: 'error',
        current: null,
        activeEdge: null,
        error: action.message,
        log: pushLog(s, 'error', `✗ ${action.message}`),
      };

    default:
      return s;
  }
}

function parseSSE(chunk: string): OrchestratorEvent[] | null {
  let event = 'message';
  let data = '';
  for (const line of chunk.split(/\r?\n/)) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) data += line.slice(5).trim();
  }
  if (!data) return null;
  let p: Record<string, unknown>;
  try {
    p = JSON.parse(data);
  } catch {
    return null;
  }
  switch (event) {
    case 'run_start':
      return [{ type: 'run_start', target: p.target as string }];
    case 'node_start':
      return [{ type: 'node_start', node: p.node as string }];
    case 'node_end': {
      const out: OrchestratorEvent[] = [
        {
          type: 'node_end',
          node: p.node as string,
          field: p.field as string | undefined,
          preview: p.preview as string | undefined,
          iteration_count: p.iteration_count as number | undefined,
        },
      ];
      if (p.final_report) out.push({ type: 'report', markdown: p.final_report as string });
      return out;
    }
    case 'log':
      return [{ type: 'log', level: (p.level as LogLevel) ?? 'info', text: p.text as string }];
    case 'run_complete':
      return [{ type: 'run_complete' }];
    case 'error':
      return [{ type: 'error', message: (p.message as string) ?? 'error' }];
    default:
      return null;
  }
}

export function useOrchestrator() {
  const [state, dispatch] = useReducer(reducer, undefined, initState);
  const timers = useRef<number[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const clearTimers = () => {
    timers.current.forEach((id) => clearTimeout(id));
    timers.current = [];
  };

  const stop = useCallback(() => {
    clearTimers();
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const reset = useCallback(() => {
    stop();
    dispatch({ type: 'reset' });
  }, [stop]);

  const runDemo = useCallback(
    (config: ScanConfig) => {
      stop();
      const target =
        config.scanType === 'local'
          ? config.localPath
          : `${config.githubRepo}#${config.prNumber || '—'}`;
      const steps = buildDemoRun(target);
      let acc = 0;
      for (const step of steps) {
        acc += step.delay;
        const id = window.setTimeout(() => dispatch(step.event), acc);
        timers.current.push(id);
      }
    },
    [stop],
  );

  const runLive = useCallback(
    async (config: ScanConfig) => {
      stop();
      const target =
        config.scanType === 'local' ? config.localPath : config.githubRepo;
      dispatch({ type: 'run_start', target });
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const res = await fetch('http://localhost:8000/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: ac.signal,
          body: JSON.stringify({
            is_github: config.scanType === 'github',
            repo_path: config.scanType === 'local' ? config.localPath : config.githubRepo,
            pr_number: config.scanType === 'github' ? parseInt(config.prNumber, 10) : null,
            custom_instructions: config.instructions || null,
          }),
        });
        const reader = res.body?.getReader();
        if (!reader) throw new Error('no response stream');
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split(/\r?\n\r?\n/);
          buffer = chunks.pop() ?? '';
          for (const chunk of chunks) {
            const events = parseSSE(chunk);
            if (events) events.forEach((e) => dispatch(e));
          }
        }
        // The backend emits its own `run_complete`; nothing to do once the
        // stream closes cleanly.
      } catch (err) {
        const e = err as Error;
        if (e.name !== 'AbortError') {
          dispatch({ type: 'error', message: e.message || 'connection failed' });
        }
      }
    },
    [stop],
  );

  return { state, runDemo, runLive, stop, reset };
}
