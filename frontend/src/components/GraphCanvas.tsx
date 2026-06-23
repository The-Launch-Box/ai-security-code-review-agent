import { useEffect, useState } from 'react';
import {
  NODES,
  EDGES,
  NODE_BY_ID,
  VIEW_W,
  VIEW_H,
  edgeKey,
} from '../lib/topology';
import type { GraphEdge, GraphNode } from '../lib/topology';
import type { OrchState } from '../lib/useOrchestrator';

interface EdgeGeom {
  d: string;
  ax: number;
  ay: number;
  angle: number;
  labelX: number;
  labelY: number;
}

function edgeGeom(edge: GraphEdge): EdgeGeom {
  const a = NODE_BY_ID[edge.from];
  const b = NODE_BY_ID[edge.to];

  if (edge.style === 'loop-out') {
    const sx = a.x + a.w / 2;
    const sy = a.y - 10;
    const ex = b.x - b.w / 2;
    const ey = b.y - 10;
    return {
      d: `M ${sx} ${sy} C ${sx + 34} ${sy - 48}, ${ex - 34} ${ey - 48}, ${ex - 1} ${ey}`,
      ax: ex,
      ay: ey,
      angle: 0,
      labelX: (sx + ex) / 2,
      labelY: sy - 40,
    };
  }

  if (edge.style === 'loop-back') {
    const sx = a.x - a.w / 2;
    const sy = a.y + 10;
    const ex = b.x + b.w / 2;
    const ey = b.y + 10;
    return {
      d: `M ${sx} ${sy} C ${sx - 30} ${sy + 48}, ${ex + 30} ${ey + 48}, ${ex + 1} ${ey}`,
      ax: ex,
      ay: ey,
      angle: 180,
      labelX: (sx + ex) / 2,
      labelY: sy + 44,
    };
  }

  // straight vertical
  const sx = a.x;
  const sy = a.y + a.h / 2;
  const tx = b.x;
  const ty = b.y - b.h / 2;
  return {
    d: `M ${sx} ${sy} L ${tx} ${ty - 1}`,
    ax: tx,
    ay: ty,
    angle: 90,
    labelX: tx + 12,
    labelY: (sy + ty) / 2 + 3,
  };
}

function Elapsed({ startedAt, running }: { startedAt: number | null; running: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [running]);
  const ms = startedAt ? Math.max(0, now - startedAt) : 0;
  const s = Math.floor(ms / 1000);
  return (
    <>
      {String(Math.floor(s / 60)).padStart(2, '0')}:{String(s % 60).padStart(2, '0')}
    </>
  );
}

function TerminalNode({ node, status }: { node: GraphNode; status: string }) {
  const left = node.x - node.w / 2;
  const top = node.y - node.h / 2;
  return (
    <g className="gnode gterm-node" data-status={status}>
      <rect
        className="gterm-box"
        x={left}
        y={top}
        width={node.w}
        height={node.h}
        rx={node.h / 2}
      />
      <text className="gterm" x={node.x} y={node.y + 3.5} textAnchor="middle">
        {node.label}
      </text>
    </g>
  );
}

function ProcessNode({ node, status }: { node: GraphNode; status: string }) {
  const left = node.x - node.w / 2;
  const top = node.y - node.h / 2;
  const right = node.x + node.w / 2;
  return (
    <g className="gnode" data-status={status}>
      {/* pulse ring (active only, via CSS) */}
      <rect
        className="gnode-ring"
        x={left - 4}
        y={top - 4}
        width={node.w + 8}
        height={node.h + 8}
        rx={9}
      />
      {/* halo */}
      <g className="gnode-halo">
        <rect x={left - 2.5} y={top - 2.5} width={node.w + 5} height={node.h + 5} rx={8} strokeWidth={1} />
      </g>
      {/* card */}
      <rect className="gnode-box" x={left} y={top} width={node.w} height={node.h} rx={7} />
      {/* left status rail */}
      <rect className="gnode-rail" x={left + 6} y={top + 11} width={3.5} height={node.h - 22} rx={2} />
      {/* top row: index (left) + output-field tag (right) */}
      {node.idx && (
        <text className="gnode-idx" x={left + 18} y={top + 19}>
          {node.idx}
        </text>
      )}
      {node.field && (
        <text className="gnode-cap" x={right - 14} y={top + 19} textAnchor="end">
          ↳ {node.field}
        </text>
      )}
      {/* label */}
      <text className="gnode-label" x={left + 18} y={node.y + 5}>
        {node.label}
      </text>
      {/* caption */}
      <text className="gnode-cap" x={left + 18} y={node.y + 20}>
        {node.caption}
      </text>
    </g>
  );
}

export default function GraphCanvas({ s }: { s: OrchState }) {
  const running = s.phase === 'running';
  const currentLabel = s.current ? NODE_BY_ID[s.current]?.label ?? s.current : '—';
  const passes = Math.min(s.iteration, 2);

  return (
    <section className="panel graph-panel col-graph">
      <div className="panel-head">
        <h3>
          <span className="idx">◇</span> Execution Graph
        </h3>
        <span className="readout">stateful · cyclic · langgraph</span>
      </div>

      <div className="graph-stage">
        <div className="graph-hud">
          <div className="hud-card">
            runtime <b><Elapsed startedAt={s.startedAt} running={running} /></b>
          </div>
          <div className="hud-card">
            node <b>{currentLabel}</b>
          </div>
          <div className="hud-card">
            detect pass
            <span className="pass-dots">
              <i className={passes >= 1 ? 'on' : ''} />
              <i className={passes >= 2 ? 'on' : ''} />
            </span>
          </div>
        </div>

        <svg
          className="graph-svg"
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          role="img"
          aria-label="LangGraph execution topology"
        >
          {/* edges */}
          {EDGES.map((edge) => {
            const g = edgeGeom(edge);
            const key = edgeKey(edge.from, edge.to);
            const isLive =
              !!s.activeEdge && s.activeEdge.from === edge.from && s.activeEdge.to === edge.to;
            const isDone = s.doneEdges.includes(key);
            const flowCls = `gedge-flow${isLive ? ' is-live' : ''}${!isLive && isDone ? ' is-done' : ''}`;
            const arrowCls = `garrow${isLive ? ' is-live' : ''}${!isLive && isDone ? ' is-done' : ''}`;
            return (
              <g key={key}>
                <path className={`gedge-track${edge.conditional ? ' cond' : ''}`} d={g.d} />
                <path className={flowCls} d={g.d} />
                <polygon
                  className={arrowCls}
                  points="0,0 -10,-4.6 -10,4.6"
                  transform={`translate(${g.ax} ${g.ay}) rotate(${g.angle})`}
                />
                {edge.label && (
                  <text
                    className={edge.conditional ? 'loop-badge' : 'gnode-cap'}
                    x={g.labelX}
                    y={g.labelY}
                    textAnchor={edge.style === 'straight' ? 'start' : 'middle'}
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* cycle annotation */}
          <text className="loop-badge" x={390} y={418} textAnchor="middle">
            ⟲ cycle
          </text>

          {/* nodes */}
          {NODES.map((node) =>
            node.kind === 'terminal' ? (
              <TerminalNode key={node.id} node={node} status={s.status[node.id] ?? 'idle'} />
            ) : (
              <ProcessNode key={node.id} node={node} status={s.status[node.id] ?? 'idle'} />
            ),
          )}
        </svg>
      </div>

      <div className="graph-legend">
        <span className="legend-item">
          <span className="legend-swatch" style={{ background: 'var(--amber)' }} /> live current
        </span>
        <span className="legend-item">
          <span className="legend-swatch" style={{ background: 'var(--cyan)' }} /> traversed
        </span>
        <span className="legend-item">
          <span className="legend-swatch dot" style={{ background: 'var(--ok)' }} /> committed
        </span>
        <span className="legend-item">
          <span
            className="legend-swatch"
            style={{ background: 'transparent', borderTop: '1.5px dashed var(--hair-3)' }}
          />{' '}
          conditional edge
        </span>
      </div>
    </section>
  );
}
