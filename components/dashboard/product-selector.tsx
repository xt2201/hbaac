"use client"

import { useState } from "react"
import { Check, ChevronsUpDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { Product, ProductCategory } from "@/types"
import { CATEGORY_LABELS } from "@/lib/mock-data"

interface ProductSelectorProps {
  products: Product[]
  selectedProduct: Product | null
  onSelect: (product: Product) => void
}

export function ProductSelector({
  products,
  selectedProduct,
  onSelect,
}: ProductSelectorProps) {
  const [open, setOpen] = useState(false)

  // Group products by category
  const groupedProducts = products.reduce((acc, product) => {
    if (!acc[product.category]) {
      acc[product.category] = []
    }
    acc[product.category].push(product)
    return acc
  }, {} as Record<ProductCategory, Product[]>)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between md:w-[400px]"
        >
          {selectedProduct ? (
            <span className="truncate">
              {selectedProduct.sku} - {selectedProduct.name}
            </span>
          ) : (
            <span className="text-muted-foreground">Chọn sản phẩm...</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Tìm theo SKU hoặc tên sản phẩm..." />
          <CommandList>
            <CommandEmpty>Không tìm thấy sản phẩm.</CommandEmpty>
            {Object.entries(groupedProducts).map(([category, categoryProducts]) => (
              <CommandGroup key={category} heading={CATEGORY_LABELS[category as ProductCategory]}>
                {categoryProducts.slice(0, 10).map((product) => (
                  <CommandItem
                    key={product.id}
                    value={`${product.sku} ${product.name}`}
                    onSelect={() => {
                      onSelect(product)
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedProduct?.id === product.id
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col">
                      <span className="font-medium">{product.sku}</span>
                      <span className="text-xs text-muted-foreground truncate">
                        {product.name}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
