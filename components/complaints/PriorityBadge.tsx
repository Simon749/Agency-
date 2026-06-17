"use client";

const PRIORITY_STYLES: Record<string, React.CSSProperties> = {
  LOW: { color: "rgba(255,255,255,0.5)", borderColor: "rgba(255,255,255,0.2)" },
  MEDIUM: { color: "rgba(255,200,0,0.9)", borderColor: "rgba(255,200,0,0.3)" },
  HIGH: { color: "#f87171", borderColor: "rgba(248,113,113,0.3)" },
  URGENT: { color: "#ef4444", borderColor: "rgba(239,68,68,0.4)", backgroundColor: "rgba(239,68,68,0.1)" },
};

export function PriorityBadge({ priority }: { priority: string }) {
  const style = PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.MEDIUM;
  return (
    <span
      style={{
        fontSize: "10px",
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        padding: "4px 10px",
        border: `1px solid ${style.borderColor}`,
        color: style.color,
        backgroundColor: style.backgroundColor,
        borderRadius: "2px",
        fontWeight: 500,
      }}
    >
      {priority}
    </span>
  );
}