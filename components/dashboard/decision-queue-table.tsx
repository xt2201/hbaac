"use client"

import { useState } from "react"
import {
  Column,
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { ArrowUpDown, CheckCircle2, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { DecisionActionType, DecisionPriority, DecisionQueueItem } from "@/types"

interface DecisionQueueTableProps {
  data: DecisionQueueItem[]
  onApprove: (id: string) => void
  onBulkApprove: (ids: string[]) => void
  onViewDetails: (item: DecisionQueueItem) => void
}

const actionLabels: Record<DecisionActionType, string> = {
  order: "Đặt hàng",
  reduce: "Giảm mua",
  clearance: "Xả hàng",
  watch: "Theo dõi",
}

const priorityLabels: Record<DecisionPriority, string> = {
  urgent: "Khẩn cấp",
  high: "Cao",
  medium: "Trung bình",
  low: "Thấp",
}

function formatCurrency(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B VND`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M VND`
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
  }).format(date)
}

function priorityVariant(priority: DecisionPriority) {
  if (priority === "urgent") return "destructive" as const
  if (priority === "high") return "default" as const
  return "secondary" as const
}

function sortableHeader(label: string) {
  return ({ column }: { column: Column<DecisionQueueItem, unknown> }) => (
    <Button
      variant="ghost"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      className="-ml-4"
    >
      {label}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  )
}

export function DecisionQueueTable({ data, onApprove, onBulkApprove, onViewDetails }: DecisionQueueTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "estimatedFinancialImpact", desc: true },
  ])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [rowSelection, setRowSelection] = useState({})

  const columns: ColumnDef<DecisionQueueItem>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Chọn tất cả"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Chọn dòng"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "priority",
      header: "Ưu tiên",
      cell: ({ row }) => (
        <Badge variant={priorityVariant(row.original.priority)} className="w-24 justify-center">
          {priorityLabels[row.original.priority]}
        </Badge>
      ),
    },
    {
      accessorKey: "actionType",
      header: "Khuyến nghị",
      cell: ({ row }) => <Badge variant="outline">{actionLabels[row.original.actionType]}</Badge>,
    },
    {
      accessorKey: "productName",
      header: sortableHeader("Mã hàng"),
      cell: ({ row }) => (
        <div className="max-w-[280px]">
          <p className="font-mono text-sm">{row.original.productSku}</p>
          <p className="truncate font-medium">{row.original.productName}</p>
          <p className="text-xs text-muted-foreground">Dự báo · chính sách tồn kho · tài chính</p>
        </div>
      ),
    },
    {
      accessorKey: "supplierName",
      header: sortableHeader("Cơ sở"),
      cell: () => <span className="text-sm">Theo kế hoạch</span>,
    },
    {
      accessorKey: "deadline",
      header: sortableHeader("Ngày dữ liệu"),
      cell: ({ row }) => <span className="text-sm font-medium">{formatDate(row.original.deadline)}</span>,
    },
    {
      accessorKey: "estimatedFinancialImpact",
      header: sortableHeader("Tác động"),
      cell: ({ row }) => <span className="font-semibold">{formatCurrency(row.original.estimatedFinancialImpact)}</span>,
    },
    {
      accessorKey: "confidence",
      header: sortableHeader("Điểm ưu tiên"),
      cell: ({ row }) => <span>{row.original.confidence}%</span>,
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Mở menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onViewDetails(row.original)}>
              Xem giải thích
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onApprove(row.original.id)}>
              Duyệt hành động
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      columnFilters,
      rowSelection,
    },
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  })

  const selectedIds = table.getFilteredSelectedRowModel().rows.map((row) => row.original.id)

  const handleBulkApprove = () => {
    onBulkApprove(selectedIds)
    setRowSelection({})
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Tìm kiếm theo mã hàng hoặc tên sản phẩm..."
          value={(table.getColumn("productName")?.getFilterValue() as string) ?? ""}
          onChange={(event) => table.getColumn("productName")?.setFilterValue(event.target.value)}
          className="max-w-sm"
        />
        {selectedIds.length > 0 && (
          <Button onClick={handleBulkApprove}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Duyệt đã chọn ({selectedIds.length})
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-md border">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    Không có hành động nào phù hợp.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div>
          {selectedIds.length} / {table.getFilteredRowModel().rows.length} dòng được chọn
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Trước
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Sau
          </Button>
        </div>
      </div>
    </div>
  )
}
