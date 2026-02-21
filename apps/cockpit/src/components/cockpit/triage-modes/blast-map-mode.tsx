import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { DomainEntityType } from '@/assets/types';
import type { TriageModeProps } from './index';
import type { PlanEffect, EvidenceEntry } from '@portarium/cockpit-types';
import { SOR_PALETTE, resolveSorPalette } from './lib/sor-palette';

const OP_STROKE: Record<string, string> = {
  Create: '#10b981',
  Update: '#3b82f6',
  Delete: '#ef4444',
  Upsert: '#eab308',
};

const OP_BG: Record<string, string> = {
  Create: '#10b9811a',
  Update: '#3b82f61a',
  Delete: '#ef44441a',
  Upsert: '#eab3081a',
};

const NODE_COLORS: Record<string, { fill: string; stroke: string }> = {
  workflow: { fill: '#8b5cf61a', stroke: '#8b5cf6' },
  run: { fill: '#3b82f61a', stroke: '#3b82f6' },
  'work-item': { fill: '#0ea5e91a', stroke: '#0ea5e9' },
  approval: { fill: '#f59e0b1a', stroke: '#f59e0b' },
  evidence: { fill: '#22c55e1a', stroke: '#22c55e' },
};

type NodeKind = 'workflow' | 'run' | 'work-item' | 'approval' | 'sor' | 'effect' | 'evidence';

interface GraphNode {
  id: string;
  x: number;
  y: number;
  kind: NodeKind;
  label: string;
  sublabel?: string;
  color: string;
  bg: string;
  width: number;
  height: number;
  detail?: Record<string, string>;
}

interface GraphEdge {
  id: string;
  from: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
}

const LAYER_X = [40, 180, 320, 460, 620, 780];
const ROW_HEIGHT = 56;
const NODE_W = 120;
const NODE_H = 48;

function buildGraph(props: TriageModeProps) {
  const { approval, plannedEffects, evidenceEntries = [], run, workflow } = props;
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  let nextY = 30;
  const layerYStart: Record<number, number> = {};

  // Layer 0: Workflow
  const wfY = nextY;
  layerYStart[0] = wfY;
  if (workflow) {
    nodes.push({
      id: 'workflow',
      x: LAYER_X[0]!,
      y: wfY,
      kind: 'workflow',
      label: workflow.name,
      sublabel: `v${workflow.version}`,
      color: NODE_COLORS.workflow!.stroke,
      bg: NODE_COLORS.workflow!.fill,
      width: NODE_W,
      height: NODE_H,
      detail: {
        'Workflow ID': workflow.workflowId,
        Trigger: workflow.triggerKind ?? 'Unknown',
        'Execution Tier': workflow.executionTier,
        Version: `${workflow.version}`,
        Actions: `${workflow.actions.length}`,
      },
    });
  }

  // Layer 1: Run
  const runY = wfY;
  layerYStart[1] = runY;
  if (run) {
    const agentCount = run.agentIds?.length ?? 0;
    const robotCount = run.robotIds?.length ?? 0;
    const participants = [];
    if (agentCount > 0) participants.push(`${agentCount}A`);
    if (robotCount > 0) participants.push(`${robotCount}R`);

    nodes.push({
      id: 'run',
      x: LAYER_X[1]!,
      y: runY,
      kind: 'run',
      label: run.status,
      sublabel: participants.length > 0 ? participants.join(' ') : run.runId.slice(0, 12),
      color: NODE_COLORS.run!.stroke,
      bg: NODE_COLORS.run!.fill,
      width: NODE_W,
      height: NODE_H,
      detail: {
        'Run ID': run.runId,
        Status: run.status,
        'Execution Tier': run.executionTier,
        'Initiated By': run.initiatedByUserId,
        ...(agentCount > 0 ? { Agents: run.agentIds!.join(', ') } : {}),
        ...(robotCount > 0 ? { Robots: run.robotIds!.join(', ') } : {}),
      },
    });

    if (workflow) {
      edges.push({
        id: 'e-wf-run',
        from: 'workflow',
        x1: LAYER_X[0]! + NODE_W / 2,
        y1: wfY + NODE_H / 2,
        x2: LAYER_X[1]!,
        y2: runY + NODE_H / 2,
        color: NODE_COLORS.workflow!.stroke,
      });
    }
  }

  // Layer 2: Work Item (optional)
  if (approval.workItemId) {
    nodes.push({
      id: 'work-item',
      x: LAYER_X[2]!,
      y: runY,
      kind: 'work-item',
      label: 'Work Item',
      sublabel: approval.workItemId.slice(0, 12),
      color: NODE_COLORS['work-item']!.stroke,
      bg: NODE_COLORS['work-item']!.fill,
      width: NODE_W,
      height: NODE_H,
      detail: {
        'Work Item ID': approval.workItemId,
      },
    });

    if (run) {
      edges.push({
        id: 'e-run-wi',
        from: 'run',
        x1: LAYER_X[1]! + NODE_W / 2,
        y1: runY + NODE_H / 2,
        x2: LAYER_X[2]!,
        y2: runY + NODE_H / 2,
        color: NODE_COLORS.run!.stroke,
      });
    }
  }

  // Layer 3: Approval Gate (highlighted)
  const approvalX = LAYER_X[3]!;
  const approvalY = runY;
  nodes.push({
    id: 'approval',
    x: approvalX,
    y: approvalY,
    kind: 'approval',
    label: 'APPROVAL',
    sublabel: approval.status,
    color: NODE_COLORS.approval!.stroke,
    bg: NODE_COLORS.approval!.fill,
    width: NODE_W,
    height: NODE_H,
    detail: {
      'Approval ID': approval.approvalId,
      Status: approval.status,
      'Requested By': approval.requestedByUserId,
      ...(approval.assigneeUserId ? { 'Assigned To': approval.assigneeUserId } : {}),
      ...(approval.sodEvaluation ? { 'SoD State': approval.sodEvaluation.state } : {}),
      ...(approval.policyRule ? { Policy: approval.policyRule.ruleId } : {}),
    },
  });

  // Edge from previous layer to approval
  const prevLayer = approval.workItemId ? 'work-item' : 'run';
  const prevX = approval.workItemId ? LAYER_X[2]! : LAYER_X[1]!;
  if (nodes.some((n) => n.id === prevLayer)) {
    edges.push({
      id: `e-${prevLayer}-approval`,
      from: prevLayer,
      x1: prevX + NODE_W / 2,
      y1: runY + NODE_H / 2,
      x2: approvalX,
      y2: approvalY + NODE_H / 2,
      color: NODE_COLORS[prevLayer]?.stroke ?? '#6b7280',
    });
  }

  // Layer 4: SOR group nodes
  const bySor = new Map<string, PlanEffect[]>();
  for (const effect of plannedEffects) {
    const list = bySor.get(effect.target.sorName) ?? [];
    list.push(effect);
    bySor.set(effect.target.sorName, list);
  }

  const sorNames = Array.from(bySor.keys());
  const sorStartY = approvalY - ((sorNames.length - 1) * ROW_HEIGHT) / 2;

  sorNames.forEach((sorName, si) => {
    const sy = sorStartY + si * ROW_HEIGHT;
    const sorPalette = resolveSorPalette(sorName);
    const sorColor = sorPalette.fill;
    const sorBg = sorPalette.fillBg;
    const effects = bySor.get(sorName)!;

    nodes.push({
      id: `sor-${sorName}`,
      x: LAYER_X[4]!,
      y: sy,
      kind: 'sor',
      label: sorName,
      sublabel: `${effects.length} ops`,
      color: sorColor,
      bg: sorBg,
      width: NODE_W - 20,
      height: NODE_H - 4,
      detail: {
        System: sorName,
        Operations: `${effects.length}`,
        Types: Array.from(new Set(effects.map((e) => e.operation))).join(', '),
      },
    });

    edges.push({
      id: `e-approval-${sorName}`,
      from: 'approval',
      x1: approvalX + NODE_W / 2,
      y1: approvalY + NODE_H / 2,
      x2: LAYER_X[4]!,
      y2: sy + (NODE_H - 4) / 2,
      color: NODE_COLORS.approval!.stroke,
    });

    // Layer 5: Effect leaf nodes
    effects.forEach((effect, ei) => {
      const ey = sy + (ei - (effects.length - 1) / 2) * 28;
      const opColor = OP_STROKE[effect.operation] ?? '#6b7280';
      const opBg = OP_BG[effect.operation] ?? '#f9fafb';

      nodes.push({
        id: `effect-${effect.effectId}`,
        x: LAYER_X[5]!,
        y: ey,
        kind: 'effect',
        label: effect.operation,
        sublabel:
          effect.target.externalType.length > 14
            ? effect.target.externalType.slice(0, 13) + '…'
            : effect.target.externalType,
        color: opColor,
        bg: opBg,
        width: NODE_W - 20,
        height: NODE_H - 8,
        detail: {
          'Effect ID': effect.effectId,
          Operation: effect.operation,
          'External Type': effect.target.externalType,
          'External ID': effect.target.externalId,
          Summary: effect.summary,
          ...(effect.target.displayLabel ? { Label: effect.target.displayLabel } : {}),
        },
      });

      edges.push({
        id: `e-${sorName}-${effect.effectId}`,
        from: `sor-${sorName}`,
        x1: LAYER_X[4]! + (NODE_W - 20) / 2,
        y1: sy + (NODE_H - 4) / 2,
        x2: LAYER_X[5]!,
        y2: ey + (NODE_H - 8) / 2,
        color: sorColor,
      });
    });
  });

  // Evidence entry nodes (below approval)
  const maxEvidenceShown = Math.min(evidenceEntries.length, 6);
  const evidenceStartY = approvalY + NODE_H + 16;
  for (let i = 0; i < maxEvidenceShown; i++) {
    const ev = evidenceEntries[i]!;
    const ey = evidenceStartY + i * 22;
    nodes.push({
      id: `ev-${ev.evidenceId}`,
      x: approvalX + 10,
      y: ey,
      kind: 'evidence',
      label: ev.category,
      sublabel: ev.summary.slice(0, 20),
      color: NODE_COLORS.evidence!.stroke,
      bg: NODE_COLORS.evidence!.fill,
      width: 18,
      height: 18,
      detail: {
        'Evidence ID': ev.evidenceId,
        Category: ev.category,
        Summary: ev.summary,
        Hash: ev.hashSha256.slice(0, 16) + '…',
      },
    });
  }

  // "+N more" overflow indicator for evidence
  const overflow = evidenceEntries.length - maxEvidenceShown;
  if (overflow > 0) {
    const overflowY = evidenceStartY + maxEvidenceShown * 22;
    nodes.push({
      id: 'ev-overflow',
      x: approvalX + 10,
      y: overflowY,
      kind: 'evidence',
      label: `+${overflow}`,
      sublabel: `${overflow} more`,
      color: NODE_COLORS.evidence!.stroke,
      bg: NODE_COLORS.evidence!.fill,
      width: 18,
      height: 18,
    });
  }

  // Compute viewBox
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const node of nodes) {
    minX = Math.min(minX, node.x - 10);
    minY = Math.min(minY, node.y - 10);
    maxX = Math.max(maxX, node.x + node.width + 10);
    maxY = Math.max(maxY, node.y + node.height + 10);
  }
  const pad = 20;
  // Enforce minimum viewBox height so the graph doesn't look squashed with few SOR rows
  const rawH = maxY - minY + pad * 2;
  const vbH = Math.max(rawH, 160);
  const vbYOffset = rawH < 160 ? (160 - rawH) / 2 : 0;
  const viewBox = `${minX - pad} ${minY - pad - vbYOffset} ${maxX - minX + pad * 2} ${vbH}`;

  return { nodes, edges, viewBox };
}

function cubicPath(x1: number, y1: number, x2: number, y2: number): string {
  const midX = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
}

function DetailPopover({
  node,
  svgRect,
  viewBox,
  onClose,
}: {
  node: GraphNode;
  svgRect: DOMRect;
  viewBox: string;
  onClose: () => void;
}) {
  if (!node.detail) return null;

  // Compute scale factor from rendered size vs viewBox coordinate space
  const vbParts = viewBox.split(' ').map(Number);
  const vbX = vbParts[0] ?? 0;
  const vbY = vbParts[1] ?? 0;
  const vbW = vbParts[2] ?? svgRect.width;
  const vbH = vbParts[3] ?? svgRect.height;
  const scaleX = svgRect.width / vbW;
  const scaleY = svgRect.height / vbH;

  // Position relative to SVG container, converting SVG coords to CSS pixels
  const style: React.CSSProperties = {
    position: 'absolute',
    left: Math.min((node.x - vbX + node.width + 8) * scaleX, svgRect.width - 200),
    top: Math.max((node.y - vbY - 10) * scaleY, 0),
    zIndex: 50,
  };

  return (
    <div
      className="rounded-lg border border-border bg-card shadow-lg p-3 w-[200px] animate-graph-node-in"
      style={style}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold" style={{ color: node.color }}>
          {node.label}
        </span>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground text-xs"
          onClick={onClose}
          aria-label="Close detail popover"
        >
          x
        </button>
      </div>
      <div className="space-y-1">
        {Object.entries(node.detail).map(([key, value]) => (
          <div key={key} className="text-[10px]">
            <span className="text-muted-foreground">{key}: </span>
            <span className="text-foreground font-mono break-all">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BlastMapMode(props: TriageModeProps) {
  const { approval, plannedEffects, evidenceEntries, run, workflow } = props;
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const { nodes, edges, viewBox } = useMemo(
    () => buildGraph(props),
    [approval, plannedEffects, evidenceEntries, run, workflow],
  );
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleNodeClick = useCallback((id: string) => {
    setSelectedNodeId((prev) => (prev === id ? null : id));
  }, []);

  const handleBgClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  // P2-10: Click-outside handler to close popover
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSelectedNodeId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedNode = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : null;

  if (plannedEffects.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted/10 px-4 py-8 text-center text-xs text-muted-foreground">
        No planned effects to visualize
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="rounded-lg border border-border overflow-hidden w-full relative"
      onClick={handleBgClick}
    >
      <svg
        ref={svgRef}
        viewBox={viewBox}
        className="w-full h-auto min-h-[180px] sm:min-h-[220px] max-h-[360px] sm:max-h-[420px]"
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label={`Entity relationship graph centered on approval ${approval.approvalId} showing ${plannedEffects.length} planned effects`}
      >
        {/* Arrow marker defs */}
        <defs>
          {Object.entries({
            ...Object.fromEntries(Object.entries(SOR_PALETTE).map(([k, v]) => [k, v.fill])),
            ...OP_STROKE,
            ...Object.fromEntries(Object.entries(NODE_COLORS).map(([k, v]) => [k, v.stroke])),
          }).map(([key, color]) => (
            <marker
              key={key}
              id={`arrow-${key.replace(/[^a-zA-Z0-9]/g, '')}`}
              viewBox="0 0 10 10"
              refX="10"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill={color} fillOpacity={0.6} />
            </marker>
          ))}
        </defs>

        {/* Edges — curved paths */}
        {edges.map((edge) => (
          <path
            key={edge.id}
            d={cubicPath(edge.x1, edge.y1, edge.x2, edge.y2)}
            stroke={edge.color}
            strokeWidth={1.5}
            strokeOpacity={0.4}
            fill="none"
            markerEnd={`url(#arrow-${edge.color.replace(/[^a-zA-Z0-9]/g, '')})`}
          />
        ))}

        {/* Nodes */}
        {nodes.map((node, i) => {
          if (node.kind === 'evidence') {
            // Small notch circles for evidence
            return (
              <g
                key={node.id}
                className="cursor-pointer animate-graph-node-in"
                style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
                tabIndex={0}
                role="button"
                aria-label={`${node.label} ${node.kind}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleNodeClick(node.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleNodeClick(node.id);
                  }
                }}
              >
                <circle
                  cx={node.x + 9}
                  cy={node.y + 9}
                  r={8}
                  fill={node.bg}
                  stroke={node.color}
                  strokeWidth={1.5}
                  className="transition-transform duration-150 hover:scale-110"
                  style={{ transformOrigin: `${node.x + 9}px ${node.y + 9}px` }}
                />
                <text
                  x={node.x + 9}
                  y={node.y + 10}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={node.color}
                  fontSize={9}
                  fontWeight={700}
                >
                  {node.label[0]}
                </text>
              </g>
            );
          }

          const isApproval = node.kind === 'approval';
          const isSelected = node.id === selectedNodeId;

          return (
            <g
              key={node.id}
              className="cursor-pointer animate-graph-node-in"
              style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
              tabIndex={0}
              role="button"
              aria-label={`${node.label} ${node.kind}`}
              onClick={(e) => {
                e.stopPropagation();
                handleNodeClick(node.id);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleNodeClick(node.id);
                }
              }}
            >
              {/* Pulsing ring for approval */}
              {isApproval && (
                <rect
                  x={node.x - 4}
                  y={node.y - 4}
                  width={node.width + 8}
                  height={node.height + 8}
                  rx={12}
                  fill="none"
                  stroke={node.color}
                  strokeWidth={2}
                  strokeOpacity={0.4}
                  className="animate-pulse"
                />
              )}

              <rect
                x={node.x}
                y={node.y}
                width={node.width}
                height={node.height}
                rx={node.kind === 'approval' ? 10 : 6}
                fill={node.bg}
                stroke={isSelected ? 'hsl(var(--primary))' : node.color}
                strokeWidth={isSelected ? 2.5 : node.kind === 'approval' ? 2 : 1.5}
                className="transition-transform duration-150 hover:scale-105"
                style={{
                  transformOrigin: `${node.x + node.width / 2}px ${node.y + node.height / 2}px`,
                }}
              />

              <text
                x={node.x + node.width / 2}
                y={node.y + (node.sublabel ? node.height / 2 - 6 : node.height / 2)}
                textAnchor="middle"
                dominantBaseline="central"
                fill={node.color}
                fontSize={node.kind === 'effect' ? 11 : 13}
                fontWeight={700}
              >
                {node.label}
              </text>

              {node.sublabel && (
                <text
                  x={node.x + node.width / 2}
                  y={node.y + node.height / 2 + 8}
                  textAnchor="middle"
                  dominantBaseline="central"
                  style={{ fill: 'hsl(var(--muted-foreground))' }}
                  fontSize={node.kind === 'effect' ? 9 : 10}
                >
                  {node.sublabel}
                </text>
              )}

              {/* "AWAITING DECISION" label for approval — only when Pending */}
              {isApproval && approval.status === 'Pending' && (
                <text
                  x={node.x + node.width / 2}
                  y={node.y - 10}
                  textAnchor="middle"
                  dominantBaseline="auto"
                  fill={node.color}
                  fontSize={9}
                  fontWeight={700}
                  className="animate-pulse"
                >
                  AWAITING DECISION
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Detail popover (HTML overlay, not foreignObject) */}
      {selectedNode && selectedNode.detail && (
        <DetailPopover
          node={selectedNode}
          svgRect={
            svgRef.current?.getBoundingClientRect() ?? ({ width: 900, height: 400 } as DOMRect)
          }
          viewBox={viewBox}
          onClose={() => setSelectedNodeId(null)}
        />
      )}
    </div>
  );
}
