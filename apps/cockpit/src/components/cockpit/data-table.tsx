import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/cockpit/empty-state'
import { cn } from '@/lib/utils'

interface Column<T> {
  key: string
  header: string
  render?: (row: T) => React.ReactNode
  width?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  empty?: React.ReactNode
  onRowClick?: (row: T) => void
  getRowKey: (row: T) => string
}

export function DataTable<T>({ columns, data, loading, empty, onRowClick, getRowKey }: DataTableProps<T>) {
  if (loading) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col.key} className="text-xs" style={{ width: col.width }}>
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              {columns.map((col) => (
                <TableCell key={col.key}>
                  <Skeleton className="h-4 w-full" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }

  if (data.length === 0) {
    return (
      <>
        {empty ?? <EmptyState title="No data" description="No items to display." />}
      </>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((col) => (
            <TableHead key={col.key} className="text-xs" style={{ width: col.width }}>
              {col.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => (
          <TableRow
            key={getRowKey(row)}
            className={cn(onRowClick && 'cursor-pointer hover:bg-muted/50')}
            onClick={() => onRowClick?.(row)}
          >
            {columns.map((col) => (
              <TableCell key={col.key} className="text-xs">
                {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '')}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export type { Column, DataTableProps }
