import { useCallback, useRef, useMemo } from 'react'
import { createRoute } from '@tanstack/react-router'
import { Route as rootRoute } from '../__root'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import { useWorkflowBuilder, type WorkflowNodeType } from '@/hooks/use-workflow-builder'
import { StartNode } from '@/components/cockpit/workflow-builder/start-node'
import { EndNode } from '@/components/cockpit/workflow-builder/end-node'
import { ActionNode } from '@/components/cockpit/workflow-builder/action-node'
import { ApprovalGateNode } from '@/components/cockpit/workflow-builder/approval-gate-node'
import { ConditionNode } from '@/components/cockpit/workflow-builder/condition-node'
import { NotificationNode } from '@/components/cockpit/workflow-builder/notification-node'
import { AgentTaskNode } from '@/components/cockpit/workflow-builder/agent-task-node'
import { AnimatedEdge } from '@/components/cockpit/workflow-builder/animated-edge'
import { StepPalette } from '@/components/cockpit/workflow-builder/step-palette'
import { ConfigPanel } from '@/components/cockpit/workflow-builder/config-panel'
import { ValidationPanel } from '@/components/cockpit/workflow-builder/validation-panel'

const nodeTypes: NodeTypes = {
  start: StartNode,
  end: EndNode,
  action: ActionNode,
  'approval-gate': ApprovalGateNode,
  condition: ConditionNode,
  notification: NotificationNode,
  'agent-task': AgentTaskNode,
}

const edgeTypes: EdgeTypes = {
  animated: AnimatedEdge,
}

function WorkflowBuilderCanvas() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition } = useReactFlow()

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
  } = useWorkflowBuilder()

  const handleAddNode = useCallback(
    (type: WorkflowNodeType, label: string) => {
      addNode(type, label, { x: 300 + Math.random() * 100, y: 200 + Math.random() * 100 })
    },
    [addNode],
  )

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const type = event.dataTransfer.getData('application/workflow-node-type') as WorkflowNodeType
      const label = event.dataTransfer.getData('application/workflow-node-label')
      if (!type) return

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      addNode(type, label || type, position)
    },
    [addNode, screenToFlowPosition],
  )

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: { id: string }) => {
      setSelectedNodeId(node.id)
    },
    [setSelectedNodeId],
  )

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null)
  }, [setSelectedNodeId])

  // Memoize default edge options to avoid unnecessary re-renders
  const defaultEdgeOptions = useMemo(
    () => ({ type: 'animated', animated: true }),
    [],
  )

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
        <div>
          <h1 role="heading" className="text-sm font-semibold">Workflow Builder</h1>
          <p className="text-xs text-muted-foreground">
            Design workflow steps by dragging nodes onto the canvas
          </p>
        </div>
      </div>

      <ResizablePanelGroup orientation="horizontal" className="flex-1">
        <ResizablePanel defaultSize={18} minSize={14} maxSize={28}>
          <div className="h-full bg-muted/30 border-r border-border">
            <StepPalette onAddNode={handleAddNode} />
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={selectedNode ? 58 : 82}>
          <div ref={reactFlowWrapper} className="h-full">
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
        </ResizablePanel>

        {selectedNode && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={24} minSize={18} maxSize={35}>
              <div className="h-full bg-muted/30 border-l border-border">
                <ConfigPanel
                  node={selectedNode}
                  onUpdate={updateNodeData}
                  onClose={() => setSelectedNodeId(null)}
                  onDelete={removeNode}
                />
              </div>
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>

      <ValidationPanel nodes={nodes} edges={edges} />
    </div>
  )
}

function WorkflowBuilderPage() {
  return (
    <div className="h-full">
      <ReactFlowProvider>
        <WorkflowBuilderCanvas />
      </ReactFlowProvider>
    </div>
  )
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/workflows/builder',
  component: WorkflowBuilderPage,
})
