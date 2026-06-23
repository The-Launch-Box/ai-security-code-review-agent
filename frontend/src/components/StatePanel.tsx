import { STATE_FIELDS } from '../lib/topology';
import type { OrchState } from '../lib/useOrchestrator';
import { Layers } from './Icons';

export default function StatePanel({ s }: { s: OrchState }) {
  const setCount = STATE_FIELDS.filter((f) => {
    const c = s.cells[f.key];
    return c && !c.writing && c.value !== '';
  }).length;

  return (
    <section className="panel">
      <div className="panel-head">
        <h3>
          <Layers size={15} /> AgentState
        </h3>
        <span className="readout">
          {setCount}/{STATE_FIELDS.length} committed
        </span>
      </div>
      <div className="panel-body" style={{ paddingTop: 6, paddingBottom: 6 }}>
        <div className="state-list">
          {STATE_FIELDS.map((f) => {
            const cell = s.cells[f.key];
            const writing = !!cell?.writing;
            const isSet = !!cell && !writing && cell.value !== '';
            const rowCls = `state-row${writing ? ' is-writing' : ''}${isSet ? ' is-set' : ''}`;

            let stat = 'pending';
            if (writing) stat = '● writing';
            else if (isSet) stat = f.type === 'int' ? `= ${cell.value}` : `${cell.value.length} ch`;

            return (
              <div className={rowCls} key={f.key}>
                <span className="node-rail" />
                <div>
                  <div className="state-key">
                    {f.key}
                    <span className="ty"> : {f.type}</span>
                  </div>
                  <div className="state-val">{cell?.value || f.desc}</div>
                </div>
                <span className="state-stat">{stat}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
