/**
 * Circuit breaker for Daraja API.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Too many failures, requests are rejected immediately
 * - HALF_OPEN: After cooldown, allows one test request
 */

type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

interface CircuitRecord {
  state: CircuitState;
  failures: number;
  successCount: number;
  lastFailureTime: number;
  nextAttempt: number;
}

const circuits = new Map<string, CircuitRecord>();

const DEFAULT_FAILURE_THRESHOLD = 5;
const DEFAULT_COOLDOWN_MS = 30000; // 30 seconds
const DEFAULT_SUCCESS_THRESHOLD = 2;

export function getCircuitState(key: string): CircuitRecord {
  return (
    circuits.get(key) ?? {
      state: "CLOSED",
      failures: 0,
      successCount: 0,
      lastFailureTime: 0,
      nextAttempt: 0,
    }
  );
}

export function canExecute(key: string): boolean {
  const record = getCircuitState(key);
  const now = Date.now();

  if (record.state === "CLOSED") return true;

  if (record.state === "OPEN") {
    if (now >= record.nextAttempt) {
      record.state = "HALF_OPEN";
      record.successCount = 0;
      circuits.set(key, record);
      return true;
    }
    return false;
  }

  // HALF_OPEN
  return true;
}

export function recordSuccess(key: string): void {
  const record = getCircuitState(key);
  record.failures = 0;

  if (record.state === "HALF_OPEN") {
    record.successCount++;
    if (record.successCount >= DEFAULT_SUCCESS_THRESHOLD) {
      record.state = "CLOSED";
      record.successCount = 0;
    }
  }

  circuits.set(key, record);
}

export function recordFailure(key: string): void {
  const record = getCircuitState(key);
  const now = Date.now();

  record.failures++;
  record.lastFailureTime = now;

  if (
    record.state === "HALF_OPEN" ||
    record.failures >= DEFAULT_FAILURE_THRESHOLD
  ) {
    record.state = "OPEN";
    record.nextAttempt = now + DEFAULT_COOLDOWN_MS;
    record.successCount = 0;
  }

  circuits.set(key, record);
}

export function getCircuitBreakerStatus(): Record<
  string,
  { state: CircuitState; failures: number }
> {
  const status: Record<string, { state: CircuitState; failures: number }> = {};
  for (const [key, record] of circuits) {
    status[key] = { state: record.state, failures: record.failures };
  }
  return status;
}