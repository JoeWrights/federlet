import { afterEach, describe, expect, it, vi } from "vitest";
import { createFederletLogger } from "./logger";

const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  vi.restoreAllMocks();
});

describe("createFederletLogger", () => {
  it("prints a structured federlet log event with a stable prefix", () => {
    process.env.NODE_ENV = "development";
    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => {});
    const logger = createFederletLogger(() => "2026-06-21T13:50:00.000Z");

    logger.info({
      context: {
        entry: "http://localhost:3001/remoteEntry.js",
      },
      event: "remote.preload.failed",
      message: "Failed to preload remote",
      remoteName: "remote_react",
      routeId: "react-dashboard",
      scope: "shell-react",
    });

    expect(consoleInfo).toHaveBeenCalledWith(
      "[federlet] shell-react:remote.preload.failed Failed to preload remote",
      {
        context: {
          entry: "http://localhost:3001/remoteEntry.js",
        },
        event: "remote.preload.failed",
        level: "info",
        message: "Failed to preload remote",
        remoteName: "remote_react",
        routeId: "react-dashboard",
        scope: "shell-react",
        timestamp: "2026-06-21T13:50:00.000Z",
      },
    );
  });

  it("suppresses debug and info logs in production", () => {
    process.env.NODE_ENV = "production";
    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => {});
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const logger = createFederletLogger(() => "2026-06-21T13:50:00.000Z");

    logger.info({
      event: "remote.lifecycle.mounted",
      message: "Remote mounted",
      scope: "shell-react",
    });
    logger.warn({
      event: "event-bus.invalid-event",
      message: "Rejected federlet event",
      scope: "mf-runtime",
    });

    expect(consoleInfo).not.toHaveBeenCalled();
    expect(consoleWarn).toHaveBeenCalledTimes(1);
  });
}
);
