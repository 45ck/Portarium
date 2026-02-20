import { useCallback, useState } from 'react';
import {
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type OnConnect,
  type OnNodesChange,
  type OnEdgesChange,
} from '@xyflow/react';

export type WorkflowNodeType =
  | 'start'
  | 'end'
  | 'action'
  | 'approval-gate'
  | 'condition'
  | 'notification'
  | 'agent-task';

export interface WorkflowNodeData {
  label: string;
  description?: string;
  nodeType: WorkflowNodeType;
  timeoutMs?: number;
  retryMaxAttempts?: number;
  executionTier?: 'Auto' | 'Assisted' | 'HumanApprove' | 'ManualOnly';
  portFamily?: string;
  operation?: string;
  [key: string]: unknown;
}

export type WorkflowNode = Node<WorkflowNodeData>;
export type WorkflowEdge = Edge;

function nextNodeId(): string {
  return `node-${crypto.randomUUID().slice(0, 8)}`;
}

const DEFAULT_NODES: WorkflowNode[] = [
  {
    id: 'start-1',
    type: 'start',
    position: { x: 400, y: 40 },
    data: { label: 'Start', nodeType: 'start' },
  },
  {
    id: 'end-1',
    type: 'end',
    position: { x: 400, y: 600 },
    data: { label: 'End', nodeType: 'end' },
  },
];

export function useWorkflowBuilder(initialNodes?: WorkflowNode[], initialEdges?: WorkflowEdge[]) {
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowNode>(
    initialNodes ?? DEFAULT_NODES,
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<WorkflowEdge>(initialEdges ?? []);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const onConnect: OnConnect = useCallback(
    (connection) => {
      setEdges((eds) => addEdge({ ...connection, type: 'animated', animated: true }, eds));
    },
    [setEdges],
  );

  const addNode = useCallback(
    (type: WorkflowNodeType, label: string, position?: { x: number; y: number }) => {
      const id = nextNodeId();
      const newNode: WorkflowNode = {
        id,
        type,
        position: position ?? { x: 300, y: 300 },
        data: { label, nodeType: type },
      };
      setNodes((nds) => [...nds, newNode]);
      return id;
    },
    [setNodes],
  );

  const removeNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      if (selectedNodeId === nodeId) setSelectedNodeId(null);
    },
    [setNodes, setEdges, selectedNodeId],
  );

  const updateNodeData = useCallback(
    (nodeId: string, data: Partial<WorkflowNodeData>) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n)),
      );
    },
    [setNodes],
  );

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;

  return {
    nodes,
    edges,
    onNodesChange: onNodesChange as OnNodesChange,
    onEdgesChange: onEdgesChange as OnEdgesChange,
    onConnect,
    addNode,
    removeNode,
    updateNodeData,
    selectedNodeId,
    setSelectedNodeId,
    selectedNode,
  };
}
