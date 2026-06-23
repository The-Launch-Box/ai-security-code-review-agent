// Unified event vocabulary shared by the live (SSE) backend and the local demo
// engine. The orchestrator hook consumes these regardless of source.

export type LogLevel = 'info' | 'tool' | 'node' | 'done' | 'warn' | 'error';

export interface LogEntry {
  ts: string;
  level: LogLevel;
  text: string;
}

export type OrchestratorEvent =
  | { type: 'run_start'; target?: string }
  | { type: 'node_start'; node: string }
  | {
      type: 'node_end';
      node: string;
      field?: string;
      preview?: string;
      iteration_count?: number;
    }
  | { type: 'log'; level: LogLevel; text: string }
  | { type: 'report'; markdown: string }
  | { type: 'run_complete' }
  | { type: 'error'; message: string };
