"use client"

import { useState, useMemo } from "react"
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
import {
  ArrowUpDown,
  Eye,
  ShoppingCart,
  Tag,
} from "lucide-react"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { StockAlert } from "@/types"
import {
  CATEGORY_LABELS,
  getInventoryByProduct,
  getInventoryPoliciesBySku,
  getInventoryPolicyByProduct,
  getForecastsByProduct,
} from "@/lib/project-data"
import type { InventoryOptimizationPolicy } from "@/lib/project-data"
import { cn } from "@/lib/utils"

type WatchlistAction = "order" | "watch" | "clearance" | null

interface WatchlistTableProps {
  data: StockAlert[]
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value)
}

function getForecastTotal(productId: string, days: number): number {
  return Math.round(
    getForecastsByProduct(productId, days).reduce((sum, f) => sum + f.forecastQty, 0)
  )
}

type EnrichedAlert = StockAlert & {
  forecast28: number
  forecast56: number
  availableQty: number
  purchaseQty: number
  inventoryPolicy: InventoryOptimizationPolicy | null
  inventoryPolicies: InventoryOptimizationPolicy[]
  actionType: WatchlistAction
}

export function WatchlistTable({ data }: WatchlistTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "estimatedImpact", desc: true },
  ])
  const [globalFilter, setGlobalFilter] = useState("")
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [actions, setActions] = useState<Record<string, WatchlistAction>>({})
  const [confirmAction, setConfirmAction] = useState<{
    alert: StockAlert
    action: "order" | "watch" | "clearance"
  } | null>(null)

  const enrichedData = useMemo<EnrichedAlert[]>(() => {
    return data.map((alert) => {
      const inventoryPolicy = getInventoryPolicyByProduct(alert.productId, 1)
      const inventoryPolicies = inventoryPolicy ? getInventoryPoliciesBySku(inventoryPolicy.sku) : []
      const inventoryLevel = getInventoryByProduct(alert.productId)
      const availableQty = inventoryLevel?.availableQty ?? alert.currentStock
      const purchaseQty = inventoryPolicy
        ? Math.max(0, Math.ceil(inventoryPolicy.recommendedOrderTarget - availableQty))
        : 0

      return {
        ...alert,
        forecast28: getForecastTotal(alert.productId, 28),
        forecast56: getForecastTotal(alert.productId, 56),
        availableQty,
        purchaseQty,
        inventoryPolicy,
        inventoryPolicies,
        actionType: actions[alert.id] ?? null,
      }
    })
  }, [data, actions])

  const handleAction = (alert: StockAlert, action: "order" | "watch" | "clearance") => {
    setConfirmAction({ alert, action })
  }

  const confirmActionExecute = () => {
    if (!confirmAction) return
    setActions((prev) => ({
      ...prev,
      [confirmAction.alert.id]: confirmAction.action,
    }))
    setConfirmAction(null)
  }

  const actionLabels: Record<string, string> = {
    order: "Đã tạo đề xuất đặt hàng",
    watch: "Đã đánh dấu theo dõi",
    clearance: "Đã chuyển sang xả hàng",
  }

  const columns: ColumnDef<EnrichedAlert>[] = [
    {
      accessorKey: "severity",
      header: "Mức độ",
      size: 100,
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
        <div className="max-w-[200px]">
          <p className="truncate font-medium">{row.getValue("productName")}</p>
          <p className="text-xs text-muted-foreground">
            {CATEGORY_LABELS[row.original.category]}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "type",
      header: "Loại rủi ro",
      size: 140,
      cell: ({ row }) => {
        const type = row.getValue("type") as string

        switch (type) {
          case "stockout_risk":
            return (
              <div>
                <Badge variant="destructive" className="text-xs">Nhu cầu cao</Badge>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Mất LN ~{formatCurrency(row.original.estimatedImpact)}
                </p>
              </div>
            )
          case "overstock":
            return (
              <div>
                <Badge variant="default" className="bg-blue-100 text-blue-700 text-xs">Chi phí lưu kho</Badge>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Khóa vốn ~{formatCurrency(row.original.estimatedImpact)}
                </p>
              </div>
            )
          case "slow_moving":
            return (
              <div>
                <Badge variant="secondary" className="text-xs">Bán chậm</Badge>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  CP lưu kho ~{formatCurrency(row.original.estimatedImpact)}
                </p>
              </div>
            )
          default:
            return null
        }
      },
    },
    {
      accessorKey: "currentStock",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4"
        >
          Lượng mua
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      size: 90,
      cell: ({ row }) => {
        const stock = row.original.purchaseQty
        const severity = row.original.severity
        return (
          <span
            className={cn(
              "font-medium",
              severity === "critical" && "text-red-600",
              severity === "warning" && "text-amber-600"
            )}
          >
            {stock}
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
          Chu kỳ mua
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      size: 100,
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
            {days > 0 ? `${days} ngày` : "Chưa ước tính"}
          </span>
        )
      },
    },
    {
      id: "forecast28",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4"
        >
          FC 28d
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      size: 90,
      accessorKey: "forecast28",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.forecast28}</span>
      ),
    },
    {
      id: "forecast56",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4"
        >
          FC 56d
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      size: 90,
      accessorKey: "forecast56",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.forecast56}</span>
      ),
    },
    {
      id: "inventoryPolicy",
      header: "Kế hoạch mua",
      size: 180,
      cell: ({ row }) => {
        const alert = row.original
        const policy = alert.inventoryPolicy

        if (!policy) {
          return <Badge variant="outline" className="text-xs">Ước tính vận hành</Badge>
        }

        return (
          <div className="space-y-1 text-xs">
            <Badge variant="outline" className="text-[10px]">Kỳ {policy.month}</Badge>
            <div className="font-medium">
              Mua {alert.purchaseQty.toLocaleString("vi-VN")} · Mục tiêu {Math.round(policy.recommendedOrderTarget).toLocaleString("vi-VN")}
            </div>
            <div className="text-muted-foreground">
              Điểm đặt hàng {Math.round(policy.reorderPoint).toLocaleString("vi-VN")} · Tồn an toàn {Math.round(policy.safetyStock).toLocaleString("vi-VN")}
            </div>
          </div>
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
          Tác động TC
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      size: 130,
      cell: ({ row }) => (
        <span className="font-semibold text-red-600">
          {formatCurrency(row.getValue("estimatedImpact"))}
        </span>
      ),
    },
    {
      id: "dataSource",
      header: "Cơ sở khuyến nghị",
      size: 160,
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline" className="text-xs">
            Dữ liệu bán hàng
          </Badge>
          <Badge variant="outline" className="text-xs">
            Danh mục sản phẩm
          </Badge>
          {row.original.inventoryPolicy && (
            <Badge variant="outline" className="text-xs">
              Kế hoạch mua
            </Badge>
          )}
        </div>
      ),
    },
    {
      id: "actions",
      header: "Hành động",
      size: 160,
      cell: ({ row }) => {
        const alert = row.original
        const action = alert.actionType

        if (action) {
          return (
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-xs">
              {actionLabels[action]}
            </Badge>
          )
        }

        return (
          <div className="flex items-center gap-1">
            {alert.type === "stockout_risk" && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={() => handleAction(alert, "order")}
              >
                <ShoppingCart className="mr-1 h-3 w-3" />
                Đặt hàng
              </Button>
            )}
            {(alert.type === "overstock" || alert.type === "slow_moving") && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={() => handleAction(alert, "watch")}
              >
                <Tag className="mr-1 h-3 w-3" />
                Theo dõi
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs"
              onClick={() => handleAction(alert, "watch")}
            >
              <Eye className="mr-1 h-3 w-3" />
              Theo dõi
            </Button>
          </div>
        )
      },
    },
  ]

  const table = useReactTable({
    data: enrichedData,
    columns,
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    globalFilterFn: (row, _columnId, filterValue) => {
      const query = String(filterValue ?? "").trim().toLowerCase()
      if (!query) return true

      return (
        row.original.productSku.toLowerCase().includes(query) ||
        row.original.productName.toLowerCase().includes(query) ||
        CATEGORY_LABELS[row.original.category].toLowerCase().includes(query)
      )
    },
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      globalFilter,
      columnFilters,
    },
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  })
  const confirmEnrichedAlert = confirmAction
    ? enrichedData.find((alert) => alert.id === confirmAction.alert.id)
    : null

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex items-center gap-4">
        <Input
          placeholder="Tìm kiếm theo SKU, tên sản phẩm hoặc danh mục..."
          value={globalFilter}
          onChange={(event) => setGlobalFilter(event.target.value)}
          className="max-w-sm"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} className="whitespace-nowrap">
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
                    <TableCell key={cell.id} className="whitespace-nowrap">
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
          {table.getFilteredRowModel().rows.length} sản phẩm.
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

      {/* Confirm Action Dialog */}
      <Dialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xác nhận hành động</DialogTitle>
            <DialogDescription>
              Hành động này sẽ đánh dấu mã hàng là đã xử lý trong phiên làm việc hiện tại.
            </DialogDescription>
          </DialogHeader>
          {confirmAction && (
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">SKU</span>
                <span className="font-mono font-medium">{confirmAction.alert.productSku}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Sản phẩm</span>
                <span className="font-medium">{confirmAction.alert.productName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Hành động</span>
                <Badge>
                  {confirmAction.action === "order"
                    ? "Tạo đề xuất đặt hàng"
                    : "Đánh dấu theo dõi"}
                </Badge>
              </div>
              {confirmEnrichedAlert?.inventoryPolicy && (
                <div className="rounded-md border bg-muted/30 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-medium">Kế hoạch tồn kho</p>
                    <Badge variant="outline" className="text-xs">Dự báo nhu cầu</Badge>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {confirmEnrichedAlert.inventoryPolicies.map((policy) => (
                      <div key={`${policy.sku}-${policy.month}`} className="rounded-md bg-background p-2 text-xs">
                        <div className="mb-1 font-medium">Kỳ {policy.month}</div>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                          <span className="text-muted-foreground">Nhu cầu 28 ngày</span>
                          <span className="text-right">{Math.round(policy.demand28).toLocaleString("vi-VN")}</span>
                          <span className="text-muted-foreground">Lô mua tối ưu</span>
                          <span className="text-right">{Math.round(policy.economicOrderQty).toLocaleString("vi-VN")}</span>
                          <span className="text-muted-foreground">Mục tiêu</span>
                          <span className="text-right">{Math.round(policy.recommendedOrderTarget).toLocaleString("vi-VN")}</span>
                          <span className="text-muted-foreground">Điểm đặt hàng / Tồn an toàn</span>
                          <span className="text-right">
                            {Math.round(policy.reorderPoint).toLocaleString("vi-VN")} / {Math.round(policy.safetyStock).toLocaleString("vi-VN")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Lượng mua đề xuất là mức ưu tiên vận hành theo kế hoạch nhu cầu hiện tại.
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>
              Hủy
            </Button>
            <Button onClick={confirmActionExecute}>
              Xác nhận
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
