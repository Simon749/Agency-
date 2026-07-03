// components/ui/VirtualizedTable.tsx
// PHASE 5: Virtualized table using @tanstack/react-virtual
// Only renders visible rows — handles 10K+ rows without DOM bloat.

"use client";

import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

interface Column<T> {
  key: string;
  header: string;
  width?: number;
  render: (row: T) => React.ReactNode;
}

interface Props<T> {
  data: T[];
  columns: Column<T>[];
  rowHeight?: number;
  maxHeight?: number;
  getRowId: (row: T) => string;
}

export function VirtualizedTable<T>({
  data,
  columns,
  rowHeight = 48,
  maxHeight = 600,
  getRowId,
}: Props<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 5,
  });

  const virtualRows = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      style={{
        height: `${Math.min(data.length * rowHeight, maxHeight)}px`,
        overflow: "auto",
        border: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: columns.map((c) => c.width ? `${c.width}px` : "1fr").join(" "),
          position: "sticky",
          top: 0,
          backgroundColor: "rgba(255,255,255,0.05)",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          zIndex: 1,
        }}
      >
        {columns.map((col) => (
          <div
            key={col.key}
            style={{
              padding: "12px 16px",
              fontSize: "10px",
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.35)",
              textTransform: "uppercase",
              fontWeight: 400,
            }}
          >
            {col.header}
          </div>
        ))}
      </div>

      {/* Virtualized rows */}
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: "relative",
        }}
      >
        {virtualRows.map((virtualRow) => {
          const row = data[virtualRow.index];
          return (
            <div
              key={getRowId(row)}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
                display: "grid",
                gridTemplateColumns: columns.map((c) => c.width ? `${c.width}px` : "1fr").join(" "),
                alignItems: "center",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                backgroundColor:
                  virtualRow.index % 2 === 0
                    ? "rgba(255,255,255,0.02)"
                    : "transparent",
              }}
            >
              {columns.map((col) => (
                <div key={col.key} style={{ padding: "0 16px" }}>
                  {col.render(row)}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}