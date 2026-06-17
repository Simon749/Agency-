"use client";

const STATUS_STYLES: Record<string, React.CSSProperties> = {
  OPEN: { color: "rgba(255,200,0,0.9)", borderColor: "rgba(255,200,0,0.3)" },
  IN_PROGRESS: { color: "#60a5fa", borderColor: "rgba(96,165,250,0.3)" },
  RESOLVED: { color: "#4ade80", borderColor: "rgba(74,222,128,0.3)" },
  CLOSED: { color: "rgba(255,255,255,0.35)", borderColor: "rgba(255,255,255,0.15)" },
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.OPEN;
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
      {status.replace("_", " ")}
    </span>
  );
}