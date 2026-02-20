import { useCallback, useRef, useMemo, useState } from 'react';
import { createRoute } from '@tanstack/react-router';
import { Route as rootRoute } from '../__root';
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
import { useWorkflowBuilder, type WorkflowNodeType } from '@/hooks/use-workflow-builder';
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

function WorkflowBuilderCanvas() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const [paletteOpen, setPaletteOpen] = useState(true);

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
  } = useWorkflowBuilder();

  const handleAddNode = useCallback(
    (type: WorkflowNodeType, label: string) => {
      addNode(type, label, { x: 300 + Math.random() * 100, y: 200 + Math.random() * 100 });
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

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

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

  // Memoize default edge options to avoid unnecessary re-renders
  const defaultEdgeOptions = useMemo(() => ({ type: 'animated', animated: true }), []);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
        <div>
          <h1 role="heading" className="text-sm font-semibold">
            Workflow Builder
          </h1>
          <p className="text-xs text-muted-foreground">
            Design workflow steps by dragging nodes onto the canvas
          </p>
        </div>
      </div>

      {/* Canvas area with overlay sidebars */}
      <div className="flex-1 relative overflow-hidden">
        {/* Full-size canvas — always fills the entire area */}
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

        {/* Left step palette — floating overlay */}
        {paletteOpen && (
          <div className="absolute left-0 top-0 bottom-0 w-64 z-40 bg-card/95 backdrop-blur-sm border-r border-border shadow-lg overflow-y-auto">
            <StepPalette onAddNode={handleAddNode} />
          </div>
        )}

        {/* Palette toggle button */}
        <button
          onClick={() => setPaletteOpen((prev) => !prev)}
          className="absolute top-1/2 -translate-y-1/2 z-50 flex items-center justify-center w-5 h-10 bg-card border border-border rounded-r shadow-sm hover:bg-muted transition-colors"
          style={{ left: paletteOpen ? '16rem' : '0' }}
          aria-label={paletteOpen ? 'Collapse step palette' : 'Expand step palette'}
        >
          {paletteOpen ? (
            <ChevronLeft className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>

        {/* Right config panel — floating overlay, shown when a node is selected */}
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

        {/* Validation panel — floating at bottom */}
        <div className="absolute bottom-0 left-0 right-0 z-40">
          <ValidationPanel nodes={nodes} edges={edges} />
        </div>
      </div>
    </div>
  );
}

function WorkflowBuilderPage() {
  return (
    <div className="h-full">
      <ReactFlowProvider>
        <WorkflowBuilderCanvas />
      </ReactFlowProvider>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/workflows/builder',
  component: WorkflowBuilderPage,
});
