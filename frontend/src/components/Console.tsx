import { useEffect, useRef } from 'react';
import type { OrchState } from '../lib/useOrchestrator';
import { Pulse } from './Icons';

export default function Console({ s }: { s: OrchState }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [s.log.length]);

  const running = s.phase === 'running';

  return (
    <section className="panel">
      <div className="panel-head">
        <h3>
          <Pulse size={15} /> Telemetry
        </h3>
        <span className="readout">{s.log.length} events</span>
      </div>
      <div className="panel-body" style={{ padding: 12 }}>
        <div className="console">
          {s.log.length === 0 && (
            <span className="console-empty">// awaiting run · graph idle</span>
          )}
          {s.log.map((l, i) => (
            <div className={`cline ${l.level}`} key={i}>
              <span className="t">{l.ts}</span>
              <span className="b">{l.text}</span>
            </div>
          ))}
          {running && (
            <div className="cline info">
              <span className="t">··</span>
              <span className="b">
                <span className="caret">▌</span>
              </span>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>
    </section>
  );
}
