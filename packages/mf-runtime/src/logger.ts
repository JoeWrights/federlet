export type FederletLogLevel = "debug" | "info" | "warn" | "error";

export interface FederletLogEvent {
  context?: Record<string, unknown>;
  error?: unknown;
  event: string;
  level?: FederletLogLevel;
  message: string;
  remoteName?: string;
  routeId?: string;
  scope: string;
  timestamp?: string;
}

export interface FederletLogger {
  debug(event: Omit<FederletLogEvent, "level" | "timestamp">): void;
  error(event: Omit<FederletLogEvent, "level" | "timestamp">): void;
  info(event: Omit<FederletLogEvent, "level" | "timestamp">): void;
  log(event: FederletLogEvent): void;
  warn(event: Omit<FederletLogEvent, "level" | "timestamp">): void;
}

function shouldLog(level: FederletLogLevel) {
  if (process.env.NODE_ENV === "production") {
    return level === "warn" || level === "error";
  }

  return true;
}

function formatPrefix(event: FederletLogEvent) {
  return `[federlet] ${event.scope}:${event.event} ${event.message}`;
}

export function createFederletLogger(
  now: () => string = () => new Date().toISOString(),
): FederletLogger {
  function log(event: FederletLogEvent) {
    const level = event.level ?? "info";

    if (!shouldLog(level)) {
      return;
    }

    const payload: FederletLogEvent = {
      ...event,
      level,
      timestamp: event.timestamp ?? now(),
    };

    console[level](formatPrefix(payload), payload);
  }

  return {
    debug(event) {
      log({ ...event, level: "debug" });
    },
    error(event) {
      log({ ...event, level: "error" });
    },
    info(event) {
      log({ ...event, level: "info" });
    },
    log,
    warn(event) {
      log({ ...event, level: "warn" });
    },
  };
}

export const federletLogger = createFederletLogger();
