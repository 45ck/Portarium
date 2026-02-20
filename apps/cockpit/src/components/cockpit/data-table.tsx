import React, { useState } from 'react'
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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from '@/components/ui/pagination'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface Column<T> {
  key: string
  header: string
  render?: (row: T) => React.ReactNode
  width?: string
}

interface PaginationConfig {
  pageSize?: number
  pageSizeOptions?: number[]
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  empty?: React.ReactNode
  onRowClick?: (row: T) => void
  getRowKey: (row: T) => string
  pagination?: PaginationConfig
}

const DEFAULT_PAGE_SIZE = 20
const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

function buildPageNumbers(currentPage: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }
  const pages: (number | 'ellipsis')[] = [1]
  if (currentPage > 3) pages.push('ellipsis')
  const start = Math.max(2, currentPage - 1)
  const end = Math.min(totalPages - 1, currentPage + 1)
  for (let i = start; i <= end; i++) pages.push(i)
  if (currentPage < totalPages - 2) pages.push('ellipsis')
  pages.push(totalPages)
  return pages
}

export function DataTable<T>({ columns, data, loading, empty, onRowClick, getRowKey, pagination }: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(pagination?.pageSize ?? DEFAULT_PAGE_SIZE)
  const pageSizeOptions = pagination?.pageSizeOptions ?? DEFAULT_PAGE_SIZE_OPTIONS

  const totalItems = data.length
  const totalPages = pagination ? Math.max(1, Math.ceil(totalItems / pageSize)) : 1
  const safePage = Math.min(currentPage, totalPages)

  const visibleData = pagination
    ? data.slice((safePage - 1) * pageSize, safePage * pageSize)
    : data

  const rangeStart = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1
  const rangeEnd = Math.min(safePage * pageSize, totalItems)

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
    <div className="space-y-3">
      <div className="overflow-x-auto">
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
          {visibleData.map((row) => (
            <TableRow
              key={getRowKey(row)}
              className={cn(onRowClick && 'cursor-pointer hover:bg-muted/50')}
              onClick={() => onRowClick?.(row)}
              {...(onRowClick ? {
                tabIndex: 0,
                role: 'button' as const,
                onKeyDown: (e: React.KeyboardEvent) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onRowClick(row)
                  }
                },
              } : {})}
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
      </div>

      {pagination && totalPages > 0 && (
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              Showing {rangeStart}–{rangeEnd} of {totalItems} results
            </span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => {
                setPageSize(Number(v))
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="h-7 w-[70px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((opt) => (
                  <SelectItem key={opt} value={String(opt)}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span>per page</span>
          </div>

          {totalPages > 1 && (
            <Pagination className="w-auto mx-0 justify-end">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    aria-disabled={safePage <= 1}
                    className={cn(safePage <= 1 && 'pointer-events-none opacity-50')}
                  />
                </PaginationItem>
                {buildPageNumbers(safePage, totalPages).map((page, idx) =>
                  page === 'ellipsis' ? (
                    <PaginationItem key={`ellipsis-${idx}`}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={page}>
                      <PaginationLink
                        isActive={page === safePage}
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  ),
                )}
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    aria-disabled={safePage >= totalPages}
                    className={cn(safePage >= totalPages && 'pointer-events-none opacity-50')}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      )}
    </div>
  )
}

export type { Column, DataTableProps, PaginationConfig }
