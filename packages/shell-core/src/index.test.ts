// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  preloadRemoteApp,
  RemoteLoadError,
  RemoteLoadErrorCode,
} from "@federlet/mf-runtime";
import {
  createRemoteContainerClassName,
  createRemoteErrorDetails,
  createRemoteErrorMessage,
  createRemotePreloader,
  DEFAULT_REMOTE_LOAD_OPTIONS,
  formatRemoteErrorDetails,
  mergeRemoteLoadOptions,
  reportRemoteDomEscapes,
  scheduleRemoteUnmount,
} from "./index";
import type { RemoteRouteConfig } from "@federlet/shared-types";

vi.mock("@federlet/mf-runtime", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@federlet/mf-runtime")>();

  return {
    ...actual,
    preloadRemoteApp: vi.fn(),
  };
});

const mockedPreloadRemoteApp = vi.mocked(preloadRemoteApp);
const route: RemoteRouteConfig = {
  basename: "/react",
  exposedModule: "./mount",
  id: "react-dashboard",
  path: "/react/*",
  remoteName: "remote_react",
  title: "React Remote",
};

afterEach(() => {
  mockedPreloadRemoteApp.mockReset();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("mergeRemoteLoadOptions", () => {
  it("deep merges retry and circuit breaker options with defaults", () => {
    expect(
      mergeRemoteLoadOptions({
        circuitBreaker: {
          failureThreshold: 5,
        },
        retry: {
          maxAttempts: 1,
        },
      }),
    ).toEqual({
      circuitBreaker: {
        cooldownMs: 30_000,
        failureThreshold: 5,
      },
      retry: {
        backoffBaseMs: 300,
        maxAttempts: 1,
      },
      timeoutMs: 8000,
    });
  });

  it("preserves explicit false options", () => {
    expect(
      mergeRemoteLoadOptions({
        circuitBreaker: false,
        retry: false,
        timeoutMs: 1000,
      }),
    ).toEqual({
      ...DEFAULT_REMOTE_LOAD_OPTIONS,
      circuitBreaker: false,
      retry: false,
      timeoutMs: 1000,
    });
  });
});

describe("remote error helpers", () => {
  it("maps known remote load error codes to user-facing messages", () => {
    expect(
      createRemoteErrorMessage({
        code: RemoteLoadErrorCode.MountFailed,
      }),
    ).toBe("Remote app failed during mount.");
  });

  it("creates and formats wrapped error cause chains", () => {
    const details = createRemoteErrorDetails(
      new RemoteLoadError({
        cause: new ReferenceError("a is not defined"),
        code: RemoteLoadErrorCode.MountFailed,
        message: "Remote remote_react/mount failed during mount.",
        remoteName: "remote_react",
      }),
    );
    const formatted = formatRemoteErrorDetails(details);

    expect(details).toMatchObject({
      cause: {
        message: "a is not defined",
        name: "ReferenceError",
      },
      code: "remote-mount-failed",
      message: "Remote remote_react/mount failed during mount.",
      name: "RemoteLoadError",
      remoteName: "remote_react",
    });
    expect(formatted).toContain(
      "RemoteLoadError: Remote remote_react/mount failed during mount.",
    );
    expect(formatted).toContain("Code: remote-mount-failed");
    expect(formatted).toContain("Remote: remote_react");
    expect(formatted).toContain("Caused by:");
    expect(formatted).toContain("ReferenceError: a is not defined");
  });
});

describe("createRemoteContainerClassName", () => {
  it("adds a stable style isolation scope class for the remote container", () => {
    expect(createRemoteContainerClassName("remote_react")).toBe(
      "remote-boundary__container federlet-scope-remote-react",
    );
  });
});

describe("scheduleRemoteUnmount", () => {
  it("defers remote unmount until the current render has finished", () => {
    vi.useFakeTimers();
    const unmount = vi.fn();

    scheduleRemoteUnmount({ unmount });

    expect(unmount).not.toHaveBeenCalled();

    vi.runOnlyPendingTimers();

    expect(unmount).toHaveBeenCalledOnce();
  });
});

describe("reportRemoteDomEscapes", () => {
  it("logs DOM escapes without throwing", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const node = document.createElement("div");

    expect(() =>
      reportRemoteDomEscapes([
        {
          node,
          phase: "mount",
          reason: "node-outside-remote-container",
          remoteName: "remote_react",
        },
      ]),
    ).not.toThrow();

    expect(consoleError).toHaveBeenCalledWith(
      "Remote remote_react created DOM outside its container during mount",
      expect.objectContaining({
        node,
        phase: "mount",
        reason: "node-outside-remote-container",
        remoteName: "remote_react",
      }),
    );
  });
});

describe("createRemotePreloader", () => {
  it("deduplicates concurrent preloads for the same remote module", async () => {
    let resolvePreload: () => void = () => undefined;
    mockedPreloadRemoteApp.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolvePreload = resolve;
        }),
    );
    const preloader = createRemotePreloader();

    const first = preloader.preload(route);
    const second = preloader.preload(route);
    resolvePreload();
    await Promise.all([first, second]);

    expect(mockedPreloadRemoteApp).toHaveBeenCalledTimes(1);
    expect(mockedPreloadRemoteApp).toHaveBeenCalledWith(
      route,
      undefined,
      undefined,
    );
  });

  it("clears failed preload entries so later intent can retry", async () => {
    mockedPreloadRemoteApp
      .mockRejectedValueOnce(new Error("temporary outage"))
      .mockResolvedValueOnce(undefined);
    const preloader = createRemotePreloader();

    await expect(preloader.preload(route)).rejects.toThrow("temporary outage");
    await preloader.preload(route);

    expect(mockedPreloadRemoteApp).toHaveBeenCalledTimes(2);
  });
});
