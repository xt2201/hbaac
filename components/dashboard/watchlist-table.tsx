"use client"

import { useState } from "react"
import {
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
import { ArrowUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import type { StockAlert } from "@/types"
import { CATEGORY_LABELS } from "@/lib/project-data"
import { cn } from "@/lib/utils"

interface WatchlistTableProps {
  data: StockAlert[]
}

export function WatchlistTable({ data }: WatchlistTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(value)
  }

  const columns: ColumnDef<StockAlert>[] = [
    {
      accessorKey: "severity",
      header: "Mức độ",
      cell: ({ row }) => {
        const severity = row.getValue("severity") as string
        return (
          <Badge
            variant={
              severity === "critical"
                ? "destructive"
                : severity === "warning"
                ? "default"
                : "secondary"
            }
            className="w-20 justify-center"
          >
            {severity === "critical"
              ? "Nghiêm trọng"
              : severity === "warning"
              ? "Cảnh báo"
              : "Thông tin"}
          </Badge>
        )
      },
    },
    {
      accessorKey: "productSku",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4"
        >
          SKU
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.getValue("productSku")}</span>
      ),
    },
    {
      accessorKey: "productName",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4"
        >
          Sản phẩm
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="max-w-[250px]">
          <p className="truncate font-medium">{row.getValue("productName")}</p>
          <p className="text-xs text-muted-foreground">
            {CATEGORY_LABELS[row.original.category]}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "currentStock",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4"
        >
          Tồn kho
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const stock = row.getValue("currentStock") as number
        const severity = row.original.severity
        return (
          <span
            className={cn(
              "font-medium",
              severity === "critical" && "text-red-600",
              severity === "warning" && "text-amber-600"
            )}
          >
            {stock} đơn vị
          </span>
        )
      },
    },
    {
      accessorKey: "projectedDays",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4"
        >
          Ngày tồn kho
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const days = row.getValue("projectedDays") as number
        const type = row.original.type
        return (
          <span
            className={cn(
              "font-medium",
              type === "stockout_risk" && days < 7 && "text-red-600",
              type === "overstock" && "text-blue-600"
            )}
          >
            {days} ngày
          </span>
        )
      },
    },
    {
      accessorKey: "estimatedImpact",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4"
        >
          Ảnh hưởng
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => formatCurrency(row.getValue("estimatedImpact")),
    },
  ]

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      columnFilters,
    },
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  })

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex items-center gap-4">
        <Input
          placeholder="Tìm kiếm theo SKU hoặc tên sản phẩm..."
          value={(table.getColumn("productName")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("productName")?.setFilterValue(event.target.value)
          }
          className="max-w-sm"
        />
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  Không có dữ liệu.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {table.getFilteredRowModel().rows.length} hàng phù hợp.
        </p>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Trước
          </Button>
          <span className="text-sm text-muted-foreground">
            Trang {table.getState().pagination.pageIndex + 1} /{" "}
            {table.getPageCount()}
          </span>
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
