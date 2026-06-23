import type { ScanConfig, Phase, Mode } from '../lib/useOrchestrator';
import { Folder, Git, Bolt, Scope, Cube } from './Icons';

interface Props {
  config: ScanConfig;
  update: (patch: Partial<ScanConfig>) => void;
  phase: Phase;
  mode: Mode;
  onLaunch: () => void;
  onStop: () => void;
  onReset: () => void;
}

export default function ControlDeck({ config, update, phase, mode, onLaunch, onStop, onReset }: Props) {
  const running = phase === 'running';
  const target =
    config.scanType === 'local'
      ? config.localPath || '—'
      : config.githubRepo
        ? `${config.githubRepo}#${config.prNumber || '?'}`
        : '—';

  return (
    <section className="panel">
      <div className="panel-head">
        <h3>
          <Scope size={15} /> Control Deck
        </h3>
        <span className="idx">CFG·00</span>
      </div>
      <div className="panel-body">
        <div className="field">
          <label>Scan target</label>
          <div className="segmented">
            <button
              className={config.scanType === 'local' ? 'active' : ''}
              onClick={() => update({ scanType: 'local' })}
            >
              <Folder size={15} /> Local
            </button>
            <button
              className={config.scanType === 'github' ? 'active' : ''}
              onClick={() => update({ scanType: 'github' })}
            >
              <Git size={15} /> Pull Request
            </button>
          </div>
        </div>

        {config.scanType === 'local' ? (
          <div className="field">
            <label>Repository path</label>
            <input
              className="input"
              placeholder="C:\projects\tlb-financial-tools"
              value={config.localPath}
              onChange={(e) => update({ localPath: e.target.value })}
            />
          </div>
        ) : (
          <div className="field">
            <label>Repository · PR number</label>
            <div className="row-2">
              <input
                className="input"
                placeholder="org/repository"
                value={config.githubRepo}
                onChange={(e) => update({ githubRepo: e.target.value })}
              />
              <input
                className="input"
                placeholder="#"
                inputMode="numeric"
                value={config.prNumber}
                onChange={(e) => update({ prNumber: e.target.value })}
              />
            </div>
          </div>
        )}

        <div className="field">
          <label>Human-in-the-loop directive</label>
          <p className="hint">Steer the detection agent toward a specific surface.</p>
          <textarea
            className="textarea"
            placeholder="e.g. Verify JWT handling in the auth service and confirm the MSAL flow can't leak tokens."
            value={config.instructions}
            onChange={(e) => update({ instructions: e.target.value })}
          />
        </div>

        {running ? (
          <button className="launch is-running" onClick={onStop}>
            <span className="stop-dot" /> Abort run
          </button>
        ) : (
          <button className="launch" onClick={onLaunch}>
            <Bolt size={17} /> {phase === 'idle' ? 'Initiate audit' : 'Run again'}
          </button>
        )}

        {phase !== 'idle' && !running && (
          <button
            className="launch"
            style={{
              marginTop: 8,
              background: 'transparent',
              border: '1px solid var(--hair-2)',
              color: 'var(--text-dim)',
              boxShadow: 'none',
            }}
            onClick={onReset}
          >
            Reset graph
          </button>
        )}

        <div className="deck-meta">
          <div className="kv">
            <span>mode</span>
            <span>{mode === 'demo' ? 'simulated' : 'fastapi:8000'}</span>
          </div>
          <div className="kv">
            <span>
              <Cube size={11} style={{ verticalAlign: '-2px', marginRight: 4 }} /> engine
            </span>
            <span>langgraph · 6 nodes</span>
          </div>
          <div className="kv">
            <span>target</span>
            <span style={{ maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {target}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
