// lib/monitoring.ts
// PHASE 6: Structured logging + metrics collection for production observability.
// Replaces console.log/error with structured, queryable logs.
// Usage: import { log, metric, alert } from "@/lib/monitoring";

export type LogLevel = "debug" | "info" | "warn" | "error" | "critical";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  agencyId?: string;
  tenantId?: string;
  userId?: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface MetricEntry {
  timestamp: string;
  name: string;
  value: number;
  unit: string;
  tags?: Record<string, string>;
}

const SERVICE_NAME = "propflow";

/**
 * Emit a structured log entry. In production, this feeds into Vercel Logs
 * or a log drain (Datadog, Logtail, etc.).
 */
export function log(
  level: LogLevel,
  message: string,
  options?: {
    service?: string;
    agencyId?: string;
    tenantId?: string;
    userId?: string;
    error?: Error;
    metadata?: Record<string, unknown>;
  }
): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    service: options?.service ?? SERVICE_NAME,
    agencyId: options?.agencyId,
    tenantId: options?.tenantId,
    userId: options?.userId,
    metadata: options?.metadata,
  };

  if (options?.error) {
    entry.error = {
      name: options.error.name,
      message: options.error.message,
      stack: options.error.stack,
      code: (options.error as any).code,
    };
  }

  // In Vercel, JSON logs are parsed automatically
  const logFn = level === "critical" || level === "error"
    ? console.error
    : level === "warn"
    ? console.warn
    : console.log;

  logFn(JSON.stringify(entry));
}

/**
 * Emit a metric. Use for: DB latency, payment success rate, SMS delivery rate.
 * In production, pipe to Vercel Analytics or an external metrics provider.
 */
export function metric(
  name: string,
  value: number,
  unit: string,
  tags?: Record<string, string>
): void {
  const entry: MetricEntry = {
    timestamp: new Date().toISOString(),
    name,
    value,
    unit,
    tags,
  };

  // Vercel Analytics custom events or external drain
  console.log(`[METRIC] ${JSON.stringify(entry)}`);
}

/**
 * Emit an alert-level log. Use for: duplicate payment detected, webhook flood,
 * agency kill switch triggered, ledger discrepancy found.
 */
export function alert(
  alertType: string,
  message: string,
  options?: {
    agencyId?: string;
    tenantId?: string;
    userId?: string;
    metadata?: Record<string, unknown>;
  }
): void {
  log("critical", message, {
    ...options,
    metadata: {
      alertType,
      ...options?.metadata,
    },
  });
}

// ── Convenience wrappers ──────────────────────────────────────────────────

export const info = (msg: string, opts?: Omit<Parameters<typeof log>[2], "service">) => log("info", msg, opts);
export const warn = (msg: string, opts?: Omit<Parameters<typeof log>[2], "service">) => log("warn", msg, opts);
export const error = (msg: string, opts?: Omit<Parameters<typeof log>[2], "service">) => log("error", msg, opts);
export const debug = (msg: string, opts?: Omit<Parameters<typeof log>[2], "service">) => log("debug", msg, opts);
