import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react'

export function AnimatedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      markerEnd={markerEnd}
      style={{
        stroke: 'hsl(var(--muted-foreground))',
        strokeWidth: 1.5,
        ...style,
      }}
    />
  )
}
