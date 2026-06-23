import { useCallback, useEffect, useState } from 'react';
import './index.css';
import { useOrchestrator } from './lib/useOrchestrator';
import type { ScanConfig, Mode } from './lib/useOrchestrator';
import GraphCanvas from './components/GraphCanvas';
import ControlDeck from './components/ControlDeck';
import StatePanel from './components/StatePanel';
import Console from './components/Console';
import Report from './components/Report';
import { Mark } from './components/Icons';

const PHASE_LABEL: Record<string, string> = {
  idle: 'standby',
  running: 'executing',
  complete: 'complete',
  error: 'fault',
};

function Clock() {
  const [t, setT] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setT(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const hh = String(t.getHours()).padStart(2, '0');
  const mm = String(t.getMinutes()).padStart(2, '0');
  const ss = String(t.getSeconds()).padStart(2, '0');
  return (
    <div className="clock">
      {hh}:{mm}:{ss}
      <small>session clock</small>
    </div>
  );
}

export default function App() {
  const { state, runDemo, runLive, stop, reset } = useOrchestrator();
  const [mode, setMode] = useState<Mode>('demo');
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [config, setConfig] = useState<ScanConfig>({
    scanType: 'local',
    localPath: 'C:\\Users\\Nikola\\projects\\Alpha\\security_agent',
    githubRepo: '',
    prNumber: '',
    instructions: '',
  });

  const update = useCallback((patch: Partial<ScanConfig>) => {
    setConfig((c) => ({ ...c, ...patch }));
  }, []);

  // Lightweight backend probe (used only to annotate the mode toggle).
  useEffect(() => {
    let alive = true;
    fetch('http://localhost:8000/api/graph')
      .then((r) => r.ok)
      .then((ok) => alive && setBackendOnline(ok))
      .catch(() => alive && setBackendOnline(false));
    return () => {
      alive = false;
    };
  }, []);

  const onLaunch = useCallback(() => {
    if (mode === 'live') {
      if (config.scanType === 'local' && !config.localPath.trim()) return;
      if (config.scanType === 'github' && (!config.githubRepo.trim() || !config.prNumber.trim()))
        return;
      runLive(config);
    } else {
      runDemo(config);
    }
  }, [mode, config, runLive, runDemo]);

  const switchMode = (m: Mode) => {
    stop();
    setMode(m);
  };

  return (
    <div className="app">
      <header className="masthead">
        <div className="brand">
          <span className="mark">
            <Mark size={24} />
          </span>
          <div className="wordmark">
            <h1>
              SENT<b>I</b>NEL
            </h1>
            <p>LangGraph Security Orchestrator</p>
          </div>
        </div>

        <div className="masthead-right">
          <span className={`chip is-${state.phase}`}>
            <span className="led" />
            {PHASE_LABEL[state.phase]}
          </span>

          <div className="mode-toggle" role="tablist" aria-label="execution mode">
            <button
              className={mode === 'demo' ? 'active' : ''}
              onClick={() => switchMode('demo')}
            >
              Demo
            </button>
            <button
              className={mode === 'live' ? 'active' : ''}
              onClick={() => switchMode('live')}
              title={
                backendOnline === false
                  ? 'backend offline — start server.py on :8000'
                  : 'stream from FastAPI backend'
              }
            >
              Live{backendOnline === false ? ' ·offline' : ''}
            </button>
          </div>

          <Clock />
        </div>
      </header>

      <div className="deck">
        <div className="col col-left">
          <ControlDeck
            config={config}
            update={update}
            phase={state.phase}
            mode={mode}
            onLaunch={onLaunch}
            onStop={stop}
            onReset={reset}
          />
        </div>

        <div className="col col-graph">
          <GraphCanvas s={state} />
        </div>

        <div className="col col-right">
          <StatePanel s={state} />
          <Console s={state} />
        </div>
      </div>

      {state.error && (
        <section className="panel report-wrap fade-in" style={{ padding: '16px 20px' }}>
          <span className="chip is-error" style={{ marginRight: 10 }}>
            <span className="led" /> fault
          </span>
          <span className="mono" style={{ color: 'var(--crit)', fontSize: 12 }}>
            {state.error}
          </span>
        </section>
      )}

      {state.report && <Report markdown={state.report} />}
    </div>
  );
}
