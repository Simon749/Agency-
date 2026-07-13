"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MoreHorizontalIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

// ── Types ────────────────────────────────────────────────────────────────

interface PaginationProps {
  totalPages: number
  currentPage: number
  pageSize: number
  totalItems: number
  showPageSizeSelector?: boolean
  pageSizeOptions?: number[]
  className?: string
}

// ── Main Component ───────────────────────────────────────────────────────

export function Pagination({
  totalPages,
  currentPage,
  pageSize,
  totalItems,
  showPageSizeSelector = false,
  pageSizeOptions = [10, 25, 50, 100],
  className,
}: PaginationProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Build page URL preserving other search params
  const createPageURL = (pageNum: number) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "")
    if (pageNum === 1) {
      params.delete("page")
    } else {
      params.set("page", String(pageNum))
    }
    const qs = params.toString()
    return qs ? `${pathname}?${qs}` : pathname
  }

  const createPageSizeURL = (newSize: number) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "")
    params.set("pageSize", String(newSize))
    params.delete("page") // Reset to page 1 when changing page size
    const qs = params.toString()
    return qs ? `${pathname}?${qs}` : pathname
  }

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, totalItems)

  // Generate visible page numbers (max 5 visible + ellipsis)
  const getVisiblePages = () => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }

    if (currentPage <= 3) {
      return [1, 2, 3, 4, "ellipsis", totalPages]
    }

    if (currentPage >= totalPages - 2) {
      return [1, "ellipsis", totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
    }

    return [
      1,
      "ellipsis",
      currentPage - 1,
      currentPage,
      currentPage + 1,
      "ellipsis",
      totalPages,
    ]
  }

  const visiblePages = getVisiblePages()

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      {/* Page size selector + item count */}
      <div className="flex items-center justify-between w-full max-w-md gap-4 text-sm text-white/40">
        <span>
          {startItem}–{endItem} of {totalItems}
        </span>

        {showPageSizeSelector && (
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider">Per page</span>
            <select
              value={pageSize}
              onChange={(e) => {
                const url = createPageSizeURL(Number(e.target.value))
                window.location.href = url
              }}
              className="bg-transparent border border-white/20 text-white/60 text-sm px-2 py-1 outline-none focus:border-white/40 cursor-pointer"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt} className="bg-[#0b0b0b] text-white">
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Page navigation */}
      <nav
        role="navigation"
        aria-label="pagination"
        className="mx-auto flex w-full justify-center"
      >
        <ul className="flex flex-row items-center gap-1">
          {/* First page */}
          <PaginationItem>
            <PaginationLink
              href={createPageURL(1)}
              aria-label="Go to first page"
              isDisabled={currentPage <= 1}
            >
              <ChevronsLeftIcon className="size-4" />
            </PaginationLink>
          </PaginationItem>

          {/* Previous */}
          <PaginationItem>
            <PaginationLink
              href={createPageURL(currentPage - 1)}
              aria-label="Go to previous page"
              isDisabled={currentPage <= 1}
            >
              <ChevronLeftIcon className="size-4" />
            </PaginationLink>
          </PaginationItem>

          {/* Page numbers */}
          {visiblePages.map((page, idx) => (
            <PaginationItem key={`${page}-${idx}`}>
              {page === "ellipsis" ? (
                <span
                  aria-hidden
                  className="flex size-9 items-center justify-center text-white/30"
                >
                  <MoreHorizontalIcon className="size-4" />
                </span>
              ) : (
                <PaginationLink
                  href={createPageURL(page as number)}
                  isActive={currentPage === page}
                  aria-label={`Go to page ${page}`}
                  aria-current={currentPage === page ? "page" : undefined}
                >
                  {page}
                </PaginationLink>
              )}
            </PaginationItem>
          ))}

          {/* Next */}
          <PaginationItem>
            <PaginationLink
              href={createPageURL(currentPage + 1)}
              aria-label="Go to next page"
              isDisabled={currentPage >= totalPages}
            >
              <ChevronRightIcon className="size-4" />
            </PaginationLink>
          </PaginationItem>

          {/* Last page */}
          <PaginationItem>
            <PaginationLink
              href={createPageURL(totalPages)}
              aria-label="Go to last page"
              isDisabled={currentPage >= totalPages}
            >
              <ChevronsRightIcon className="size-4" />
            </PaginationLink>
          </PaginationItem>
        </ul>
      </nav>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function PaginationItem({ children }: { children: React.ReactNode }) {
  return <li>{children}</li>
}

interface PaginationLinkProps {
  href: string
  isActive?: boolean
  isDisabled?: boolean
  children: React.ReactNode
  "aria-label"?: string
  "aria-current"?: "page" | undefined
}

function PaginationLink({
  href,
  isActive,
  isDisabled,
  children,
  ...props
}: PaginationLinkProps) {
  const baseClasses = cn(
    "flex items-center justify-center text-sm transition-colors",
    "min-w-[36px] h-9 px-2.5 border",
    "uppercase tracking-wider text-[11px] font-medium",
    isDisabled && "pointer-events-none opacity-30",
    isActive
      ? "bg-white/10 border-white/30 text-white"
      : "bg-transparent border-white/15 text-white/60 hover:bg-white/5 hover:text-white/80 hover:border-white/25"
  )

  if (isDisabled) {
    return (
      <span className={baseClasses} {...props}>
        {children}
      </span>
    )
  }

  return (
    <Link href={href} className={baseClasses} {...props}>
      {children}
    </Link>
  )
}