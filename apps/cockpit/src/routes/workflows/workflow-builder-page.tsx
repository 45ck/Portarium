import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  useWorkflowBuilder,
  type WorkflowEdge,
  type WorkflowNode,
  type WorkflowNodeData,
  type WorkflowNodeType,
} from '@/hooks/use-workflow-builder';
import { useUIStore } from '@/stores/ui-store';
import { useUpdateWorkflow, useWorkflow } from '@/hooks/queries/use-workflows';
import { StartNode } from '@/components/cockpit/workflow-builder/start-node';
import { EndNode } from '@/components/cockpit/workflow-builder/end-node';
import { ActionNode } from '@/components/cockpit/workflow-builder/action-node';
import { ApprovalGateNode } from '@/components/cockpit/workflow-builder/approval-gate-node';
import { ConditionNode } from '@/components/cockpit/workflow-builder/condition-node';
import { NotificationNode } from '@/components/cockpit/workflow-builder/notification-node';
import { AgentTaskNode } from '@/components/cockpit/workflow-builder/agent-task-node';
import { AnimatedEdge } from '@/components/cockpit/workflow-builder/animated-edge';
import { StepPalette } from '@/components/cockpit/workflow-builder/step-palette';
import { ConfigPanel } from '@/components/cockpit/workflow-builder/config-panel';
import { ValidationPanel } from '@/components/cockpit/workflow-builder/validation-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { UpdateWorkflowRequest, WorkflowDetail } from '@portarium/cockpit-types';

export interface WorkflowBuilderPageProps {
  mode: 'create' | 'edit';
  workflowId?: string;
}

interface WorkflowDraftState {
  name: string;
  description: string;
  executionTier: NonNullable<WorkflowNodeData['executionTier']>;
  active: boolean;
  triggerKind: NonNullable<WorkflowDetail['triggerKind']>;
  timeoutMs: number;
  retryMaxAttempts: number;
}

interface HydratedBuilderState {
  draft: WorkflowDraftState;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

const START_NODE_ID = 'start-1';
const END_NODE_ID = 'end-1';

const nodeTypes: NodeTypes = {
  start: StartNode,
  end: EndNode,
  action: ActionNode,
  'approval-gate': ApprovalGateNode,
  condition: ConditionNode,
  notification: NotificationNode,
  'agent-task': AgentTaskNode,
};

const edgeTypes: EdgeTypes = {
  animated: AnimatedEdge,
};

const TIER_OPTIONS: Array<WorkflowDraftState['executionTier']> = [
  'Auto',
  'Assisted',
  'HumanApprove',
  'ManualOnly',
];

const TRIGGER_OPTIONS: Array<WorkflowDraftState['triggerKind']> = [
  'Manual',
  'Cron',
  'Webhook',
  'DomainEvent',
];

function defaultDraft(): WorkflowDraftState {
  return {
    name: 'Untitled workflow',
    description: '',
    executionTier: 'Auto',
    active: true,
    triggerKind: 'Manual',
    timeoutMs: 300_000,
    retryMaxAttempts: 3,
  };
}

function startNode(): WorkflowNode {
  return {
    id: START_NODE_ID,
    type: 'start',
    position: { x: 420, y: 40 },
    data: { label: 'Start', nodeType: 'start' },
  };
}

function endNode(y: number): WorkflowNode {
  return {
    id: END_NODE_ID,
    type: 'end',
    position: { x: 420, y },
    data: { label: 'End', nodeType: 'end' },
  };
}

export function hydrateWorkflowBuilderState(workflow: WorkflowDetail): HydratedBuilderState {
  const sortedActions = [...workflow.actions].sort((a, b) => a.order - b.order);
  const actionNodes: WorkflowNode[] = sortedActions.map((action, index) => ({
    id: `action-${action.actionId}`,
    type: inferNodeType(action.operation),
    position: { x: 420, y: 180 + index * 140 },
    data: {
      actionId: action.actionId,
      label: deriveActionLabel(action.operation, index + 1),
      description: `${action.portFamily}`,
      nodeType: inferNodeType(action.operation),
      operation: action.operation,
      portFamily: action.portFamily,
      executionTier: action.executionTierOverride ?? workflow.executionTier,
      timeoutMs: workflow.timeoutMs ?? 300_000,
      retryMaxAttempts: workflow.retryPolicy?.maxAttempts ?? 3,
    },
  }));

  const nodes: WorkflowNode[] = [startNode(), ...actionNodes, endNode(180 + actionNodes.length * 140)];
  const edges = linearizeNodes(nodes);

  return {
    draft: {
      name: workflow.name,
      description: workflow.description ?? '',
      executionTier: workflow.executionTier,
      active: workflow.active,
      triggerKind: workflow.triggerKind ?? 'Manual',
      timeoutMs: workflow.timeoutMs ?? 300_000,
      retryMaxAttempts: workflow.retryPolicy?.maxAttempts ?? 3,
    },
    nodes,
    edges,
  };
}

function linearizeNodes(nodes: readonly WorkflowNode[]): WorkflowEdge[] {
  const flow = nodes
    .filter((node) => node.type === 'start' || node.type === 'end' || isActionNode(node))
    .sort((a, b) => a.position.y - b.position.y);
  const edges: WorkflowEdge[] = [];
  for (let index = 0; index < flow.length - 1; index += 1) {
    const source = flow[index];
    const target = flow[index + 1];
    if (!source || !target) continue;
    edges.push({
      id: `edge-${source.id}-${target.id}`,
      source: source.id,
      target: target.id,
      type: 'animated',
      animated: true,
    });
  }
  return edges;
}

function isActionNode(node: WorkflowNode): boolean {
  return node.type !== 'start' && node.type !== 'end';
}

function inferNodeType(operation: string): WorkflowNodeType {
  const normalized = operation.toLowerCase();
  if (normalized.startsWith('agent:')) return 'agent-task';
  if (normalized.includes('approval') || normalized.includes('approve')) return 'approval-gate';
  if (normalized.includes('notify') || normalized.startsWith('notification:')) return 'notification';
  if (normalized.includes('condition') || normalized.includes('branch')) return 'condition';
  return 'action';
}

function deriveActionLabel(operation: string, fallbackOrder: number): string {
  const [, detail] = operation.split(':');
  if (detail && detail.length > 0) {
    return detail
      .split(/[-_]/g)
      .map((part) => (part.length > 0 ? part[0]!.toUpperCase() + part.slice(1) : part))
      .join(' ');
  }
  return `Action ${fallbackOrder}`;
}

function deriveOperation(node: WorkflowNode, order: number): string {
  if (node.data.operation && node.data.operation.length > 0) return node.data.operation;

  switch (node.type) {
    case 'agent-task':
      return 'agent:task';
    case 'approval-gate':
      return 'approval:gate';
    case 'condition':
      return 'workflow:condition';
    case 'notification':
      return 'notification:send';
    default:
      return `workflow:step-${order}`;
  }
}

function derivePortFamily(node: WorkflowNode): string {
  if (node.data.portFamily && node.data.portFamily.length > 0) return node.data.portFamily;

  switch (node.type) {
    case 'agent-task':
      return 'MachineInvoker';
    case 'notification':
      return 'CommsCollaboration';
    case 'approval-gate':
      return 'Governance';
    case 'condition':
      return 'Workflow';
    default:
      return 'ItsmItOps';
  }
}

function orderedActionNodes(nodes: readonly WorkflowNode[], edges: readonly WorkflowEdge[]): WorkflowNode[] {
  const actionNodes = nodes.filter((node) => isActionNode(node));
  if (actionNodes.length <= 1) return actionNodes;

  const nodeById = new Map(nodes.map((node) => [node.id, node] as const));
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    const current = outgoing.get(edge.source) ?? [];
    current.push(edge.target);
    outgoing.set(edge.source, current);
  }

  const orderedIds: string[] = [];
  const visited = new Set<string>();
  let cursor = START_NODE_ID;
  while (true) {
    const nextCandidates = (outgoing.get(cursor) ?? [])
      .map((id) => nodeById.get(id))
      .filter((node): node is WorkflowNode => Boolean(node) && node.type !== 'end')
      .sort((a, b) => a.position.y - b.position.y);
    const next = nextCandidates[0];
    if (!next || visited.has(next.id)) break;
    visited.add(next.id);
    orderedIds.push(next.id);
    cursor = next.id;
  }

  const ordered = orderedIds
    .map((id) => nodeById.get(id))
    .filter((node): node is WorkflowNode => Boolean(node) && isActionNode(node));
  const remaining = actionNodes
    .filter((node) => !orderedIds.includes(node.id))
    .sort((a, b) => a.position.y - b.position.y);
  return [...ordered, ...remaining];
}

export function buildUpdateWorkflowRequest(
  draft: WorkflowDraftState,
  nodes: readonly WorkflowNode[],
  edges: readonly WorkflowEdge[],
): UpdateWorkflowRequest {
  const actions = orderedActionNodes(nodes, edges).map((node, index) => {
    const order = index + 1;
    const executionTierOverride =
      node.data.executionTier && node.data.executionTier !== draft.executionTier
        ? node.data.executionTier
        : undefined;
    return {
      actionId: node.data.actionId ?? `${node.id}-${order}`,
      order,
      portFamily: derivePortFamily(node),
      operation: deriveOperation(node, order),
      ...(executionTierOverride ? { executionTierOverride } : {}),
    };
  });

  return {
    name: draft.name.trim() || 'Untitled workflow',
    description: draft.description.trim() || undefined,
    executionTier: draft.executionTier,
    active: draft.active,
    actions,
  };
}

function buildSignature(
  draft: WorkflowDraftState,
  nodes: readonly WorkflowNode[],
  edges: readonly WorkflowEdge[],
): string {
  const normalizedNodes = nodes
    .map((node) => ({
      id: node.id,
      type: node.type,
      x: Math.round(node.position.x),
      y: Math.round(node.position.y),
      data: {
        actionId: node.data.actionId ?? null,
        label: node.data.label,
        description: node.data.description ?? null,
        nodeType: node.data.nodeType,
        timeoutMs: node.data.timeoutMs ?? null,
        retryMaxAttempts: node.data.retryMaxAttempts ?? null,
        executionTier: node.data.executionTier ?? null,
        portFamily: node.data.portFamily ?? null,
        operation: node.data.operation ?? null,
      },
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const normalizedEdges = edges
    .map((edge) => ({ source: edge.source, target: edge.target }))
    .sort((a, b) => `${a.source}-${a.target}`.localeCompare(`${b.source}-${b.target}`));

  return JSON.stringify({ draft, nodes: normalizedNodes, edges: normalizedEdges });
}

function WorkflowBuilderCanvas({ mode, workflowId }: WorkflowBuilderPageProps) {
  const navigate = useNavigate();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const { activeWorkspaceId: wsId } = useUIStore();
  const [paletteOpen, setPaletteOpen] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedSignature, setSavedSignature] = useState<string | null>(null);
  const [draft, setDraft] = useState<WorkflowDraftState>(defaultDraft);
  const hydratedWorkflowIdRef = useRef<string | null>(null);

  const workflowQuery = useWorkflow(wsId, mode === 'edit' ? (workflowId ?? '') : '');
  const updateWorkflow = useUpdateWorkflow(wsId, workflowId ?? '');

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    removeNode,
    updateNodeData,
    selectedNodeId,
    setSelectedNodeId,
    selectedNode,
    replaceGraph,
  } = useWorkflowBuilder();

  useEffect(() => {
    if (mode !== 'edit') return;
    if (!workflowQuery.data) return;
    if (hydratedWorkflowIdRef.current === workflowQuery.data.workflowId) return;

    const hydrated = hydrateWorkflowBuilderState(workflowQuery.data);
    replaceGraph(hydrated.nodes, hydrated.edges);
    setDraft(hydrated.draft);
    setSavedSignature(buildSignature(hydrated.draft, hydrated.nodes, hydrated.edges));
    hydratedWorkflowIdRef.current = workflowQuery.data.workflowId;
    setSaveError(null);
  }, [mode, replaceGraph, workflowQuery.data]);

  useEffect(() => {
    if (mode !== 'create' || savedSignature !== null) return;
    setSavedSignature(buildSignature(defaultDraft(), nodes, edges));
  }, [edges, mode, nodes, savedSignature]);

  const currentSignature = useMemo(() => buildSignature(draft, nodes, edges), [draft, edges, nodes]);
  const actionNodeCount = useMemo(
    () => nodes.filter((node) => isActionNode(node)).length,
    [nodes],
  );
  const isDirty = savedSignature !== null && savedSignature !== currentSignature;

  const statusText = useMemo(() => {
    if (mode !== 'edit') return 'Create mode (save wiring pending)';
    if (updateWorkflow.isPending) return 'Saving workflow...';
    if (saveError) return saveError;
    if (isDirty) return 'Unsaved changes';
    return 'No pending changes';
  }, [isDirty, mode, saveError, updateWorkflow.isPending]);

  const handleAddNode = useCallback(
    (type: WorkflowNodeType, label: string) => {
      addNode(type, label, { x: 320 + Math.random() * 140, y: 220 + Math.random() * 120 });
    },
    [addNode],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/workflow-node-type') as WorkflowNodeType;
      const label = event.dataTransfer.getData('application/workflow-node-label');
      if (!type) return;

      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      addNode(type, label || type, position);
    },
    [addNode, screenToFlowPosition],
  );

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: { id: string }) => {
      setSelectedNodeId(node.id);
    },
    [setSelectedNodeId],
  );

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, [setSelectedNodeId]);

  const defaultEdgeOptions = useMemo(() => ({ type: 'animated', animated: true }), []);
  const canSave =
    mode === 'edit' &&
    Boolean(workflowId) &&
    actionNodeCount > 0 &&
    !workflowQuery.isLoading &&
    !updateWorkflow.isPending &&
    isDirty;

  const handleSave = useCallback(async () => {
    if (mode !== 'edit' || !workflowId) return;
    if (!canSave) return;

    setSaveError(null);
    const payload = buildUpdateWorkflowRequest(draft, nodes, edges);
    if (!payload.actions || payload.actions.length === 0) {
      setSaveError('Add at least one action node before saving.');
      return;
    }

    try {
      await updateWorkflow.mutateAsync(payload);
      setSavedSignature(buildSignature(draft, nodes, edges));
      navigate({
        to: '/workflows/$workflowId' as string,
        params: { workflowId },
      });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save workflow');
    }
  }, [canSave, draft, edges, mode, navigate, nodes, updateWorkflow, workflowId]);

  const handleBackToDetail = useCallback(() => {
    if (!workflowId) return;
    navigate({
      to: '/workflows/$workflowId' as string,
      params: { workflowId },
    });
  }, [navigate, workflowId]);

  if (mode === 'edit' && workflowQuery.isLoading) {
    return (
      <div className="h-full p-6 space-y-4">
        <h1 className="text-lg font-semibold">Edit Workflow</h1>
        <p className="text-sm text-muted-foreground">Loading workflow definition...</p>
      </div>
    );
  }

  if (mode === 'edit' && !workflowQuery.data) {
    return (
      <div className="h-full p-6 space-y-4">
        <h1 className="text-lg font-semibold">Edit Workflow</h1>
        <p role="alert" className="text-sm text-destructive">
          Workflow not found.
        </p>
        <Button asChild variant="outline">
          <Link to="/workflows">Back to workflows</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border bg-card space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 role="heading" className="text-sm font-semibold">
              {mode === 'edit' ? `Edit Workflow${workflowId ? `: ${workflowId}` : ''}` : 'Workflow Builder'}
            </h1>
            <p className="text-xs text-muted-foreground">
              {mode === 'edit'
                ? 'Load, modify, and save existing workflow definitions.'
                : 'Design workflow steps by dragging nodes onto the canvas.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/workflows">Back to Workflows</Link>
            </Button>
            {mode === 'edit' && workflowId && (
              <Button onClick={handleBackToDetail} variant="outline" size="sm">
                Back to Detail
              </Button>
            )}
            <Button onClick={handleSave} size="sm" disabled={!canSave}>
              Save Workflow
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">
              Name
            </label>
            <Input
              value={draft.name}
              onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Workflow name"
            />
          </div>
          <div className="lg:col-span-2">
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">
              Description
            </label>
            <Input
              value={draft.description}
              onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Workflow description"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">
              Tier
            </label>
            <select
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value={draft.executionTier}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  executionTier: event.target.value as WorkflowDraftState['executionTier'],
                }))
              }
            >
              {TIER_OPTIONS.map((tier) => (
                <option key={tier} value={tier}>
                  {tier}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">
                Trigger
              </label>
              <select
                className="h-9 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm"
                value={draft.triggerKind}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    triggerKind: event.target.value as WorkflowDraftState['triggerKind'],
                  }))
                }
              >
                {TRIGGER_OPTIONS.map((trigger) => (
                  <option key={trigger} value={trigger}>
                    {trigger}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">
                Active
              </label>
              <button
                type="button"
                onClick={() => setDraft((prev) => ({ ...prev, active: !prev.active }))}
                className="flex h-9 w-full items-center justify-center rounded-md border border-input px-2 text-sm hover:bg-accent"
              >
                {draft.active ? 'Yes' : 'No'}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Badge variant={isDirty ? 'secondary' : 'outline'}>{isDirty ? 'Dirty' : 'Synced'}</Badge>
            <Badge variant="outline">{actionNodeCount} action nodes</Badge>
            <Badge variant="outline">
              timeout {draft.timeoutMs} ms · retries {draft.retryMaxAttempts}
            </Badge>
          </div>
          <p className={saveError ? 'text-destructive' : 'text-muted-foreground'} role={saveError ? 'alert' : undefined}>
            {statusText}
          </p>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden">
        <div ref={reactFlowWrapper} className="absolute inset-0">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={handleNodeClick}
            onPaneClick={handlePaneClick}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={16} size={1} />
            <Controls position="bottom-left" />
            <MiniMap
              position="bottom-right"
              className="!bg-muted/50"
              maskColor="hsl(var(--muted) / 0.7)"
              nodeStrokeWidth={2}
            />
          </ReactFlow>
        </div>

        {paletteOpen && (
          <div className="absolute left-0 top-0 bottom-0 w-64 z-40 bg-card/95 backdrop-blur-sm border-r border-border shadow-lg overflow-y-auto">
            <StepPalette onAddNode={handleAddNode} />
          </div>
        )}

        <button
          onClick={() => setPaletteOpen((prev) => !prev)}
          className="absolute top-1/2 -translate-y-1/2 z-50 flex items-center justify-center w-5 h-10 bg-card border border-border rounded-r shadow-sm hover:bg-muted transition-colors"
          style={{ left: paletteOpen ? '16rem' : '0' }}
          aria-label={paletteOpen ? 'Collapse step palette' : 'Expand step palette'}
        >
          {paletteOpen ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>

        {selectedNode && (
          <div className="absolute right-0 top-0 bottom-0 w-80 z-40 bg-card/95 backdrop-blur-sm border-l border-border shadow-lg overflow-y-auto">
            <ConfigPanel
              node={selectedNode}
              onUpdate={updateNodeData}
              onClose={() => setSelectedNodeId(null)}
              onDelete={removeNode}
            />
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 z-40">
          <ValidationPanel nodes={nodes} edges={edges} />
        </div>
      </div>
    </div>
  );
}

export function WorkflowBuilderPage(props: WorkflowBuilderPageProps) {
  return (
    <div className="h-full">
      <ReactFlowProvider>
        <WorkflowBuilderCanvas {...props} />
      </ReactFlowProvider>
    </div>
  );
}
