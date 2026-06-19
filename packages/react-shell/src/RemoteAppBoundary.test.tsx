// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  mountRemoteApp,
  preloadRemoteApp,
  RemoteLoadErrorCode,
} from "@federlet/mf-runtime";
import { createRemoteScopeClass } from "@federlet/style-isolation";
import {
  createRemoteContainerClassName,
  createRemotePreloader,
  RemoteAppBoundary,
  reportRemoteDomEscapes,
  scheduleRemoteUnmount,
} from "./index";
import type { RemoteModuleLoader } from "@federlet/mf-runtime";
import type { RemoteRouteConfig } from "@federlet/shared-types";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@federlet/mf-runtime", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@federlet/mf-runtime")>();

  return {
    ...actual,
    mountRemoteApp: vi.fn(),
    preloadRemoteApp: vi.fn(),
  };
});

const mockedMountRemoteApp = vi.mocked(mountRemoteApp);
const mockedPreloadRemoteApp = vi.mocked(preloadRemoteApp);
const route: RemoteRouteConfig = {
  basename: "/react",
  exposedModule: "./mount",
  id: "react-dashboard",
  path: "/react/*",
  remoteName: "remote_react",
  title: "React Remote",
};

describe("createRemoteContainerClassName", () => {
  it("adds a stable style isolation scope class for the remote container", () => {
    expect(createRemoteContainerClassName("remote_react")).toBe(
      "remote-boundary__container federlet-scope-remote-react",
    );
    expect(createRemoteContainerClassName("remote_react")).toContain(
      createRemoteScopeClass("remote_react"),
    );
  });
});

describe("scheduleRemoteUnmount", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("defers remote unmount until the current React commit has finished", () => {
    vi.useFakeTimers();
    const unmount = vi.fn();

    scheduleRemoteUnmount({ unmount });

    expect(unmount).not.toHaveBeenCalled();

    vi.runOnlyPendingTimers();

    expect(unmount).toHaveBeenCalledTimes(1);
  });
});

describe("reportRemoteDomEscapes", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

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
      expect.stringContaining(
        "Remote remote_react created DOM outside its container during mount",
      ),
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
  afterEach(() => {
    mockedPreloadRemoteApp.mockReset();
  });

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

describe("RemoteAppBoundary", () => {
  let root: Root | null = null;

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    document.body.innerHTML = "";
    mockedMountRemoteApp.mockReset();
    mockedPreloadRemoteApp.mockReset();
    vi.restoreAllMocks();
  });

  async function renderRemoteBoundary(
    props: Partial<Parameters<typeof RemoteAppBoundary>[0]> = {},
  ) {
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);

    await act(async () => {
      root?.render(<RemoteAppBoundary route={route} {...props} />);
    });
  }

  it("reports remote DOM escapes without blocking the remote render", async () => {
    const leakedNode = document.createElement("div");
    leakedNode.className = "remote-toast";
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    mockedMountRemoteApp.mockImplementation(async (_route, context) => {
      context.container.append(document.createElement("p"));
      document.body.append(leakedNode);

      return {
        unmount() {
          leakedNode.remove();
        },
      };
    });

    await renderRemoteBoundary();

    expect(document.body.contains(leakedNode)).toBe(true);
    expect(document.querySelector(".remote-boundary__header span")?.textContent)
      .toBe("ready");
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining(
        "Remote remote_react created DOM outside its container during mount",
      ),
      expect.objectContaining({
        node: leakedNode,
        phase: "mount",
        reason: "node-outside-remote-container",
        remoteName: "remote_react",
      }),
    );
  });

  it("passes custom loader, load options, and mount context", async () => {
    const loader: RemoteModuleLoader = vi.fn();
    const loadOptions = {
      retry: {
        maxAttempts: 1,
      },
      timeoutMs: 1000,
    };
    mockedMountRemoteApp.mockResolvedValue({ unmount: vi.fn() });

    await renderRemoteBoundary({
      createMountContext({ container, route }) {
        return {
          basename: route.basename,
          container,
          props: {
            featureFlag: "custom",
          },
        };
      },
      loader,
      loadOptions,
    });

    expect(mockedMountRemoteApp).toHaveBeenCalledWith(
      route,
      expect.objectContaining({
        basename: "/react",
        props: {
          featureFlag: "custom",
        },
      }),
      loader,
      expect.objectContaining({
        timeoutMs: 1000,
      }),
    );
  });

  it("shows a timeout-specific error message and retry button", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockedMountRemoteApp.mockRejectedValue({
      code: RemoteLoadErrorCode.Timeout,
    });

    await renderRemoteBoundary();

    expect(document.querySelector("[role='alert']")?.textContent).toContain(
      "Remote app loading timed out.",
    );
    expect(document.querySelector("button")?.textContent).toBe("Retry");
    expect(mockedMountRemoteApp).toHaveBeenCalledWith(
      route,
      expect.objectContaining({
        basename: "/react",
      }),
      undefined,
      expect.objectContaining({
        timeoutMs: 8000,
      }),
    );
  });

  it("shows a retry-exhausted message for load failures", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockedMountRemoteApp.mockRejectedValue({
      code: RemoteLoadErrorCode.LoadFailed,
    });

    await renderRemoteBoundary();

    expect(document.querySelector("[role='alert']")?.textContent).toContain(
      "Remote app failed to load after retries.",
    );
    expect(document.querySelector("button")?.textContent).toBe("Retry");
  });

  it("shows a degraded message when the remote circuit is open", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockedMountRemoteApp.mockRejectedValue({
      code: RemoteLoadErrorCode.CircuitOpen,
    });

    await renderRemoteBoundary();

    expect(document.querySelector("[role='alert']")?.textContent).toContain(
      "Remote app is temporarily degraded.",
    );
    expect(document.querySelector("button")?.textContent).toBe("Retry");
  });
});
