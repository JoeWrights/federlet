// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { mountRemoteApp } from "@federlet/mf-runtime";
import {
  createRemoteScopeClass,
  detectRuntimeStylePollution,
} from "@federlet/style-isolation";
import {
  createRemoteContainerClassName,
  RemoteAppBoundary,
  reportRemoteDomEscapes,
  scheduleRemoteUnmount,
} from "./RemoteAppBoundary";

vi.mock("@federlet/mf-runtime", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@federlet/mf-runtime")>();

  return {
    ...actual,
    mountRemoteApp: vi.fn(),
  };
});

const mockedMountRemoteApp = vi.mocked(mountRemoteApp);
const route = {
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

describe("detectRuntimeStylePollution", () => {
  afterEach(() => {
    document.head.innerHTML = "";
    document.body.innerHTML = "";
  });

  it("reports dynamic style tags that contain unscoped selectors", () => {
    const style = document.createElement("style");
    style.textContent = `
.leaked-toast {
  color: red;
}
`;
    document.head.append(style);

    const issues = detectRuntimeStylePollution({
      root: document,
      scopeClass: createRemoteScopeClass("remote_react"),
    });

    expect(issues).toEqual([
      expect.objectContaining({
        severity: "error",
        selector: ".leaked-toast",
        reason: "unscoped-selector",
      }),
    ]);
  });

  it("allows dynamic style tags that stay scoped to the remote container", () => {
    const style = document.createElement("style");
    style.dataset.federletRemote = "remote_react";
    style.textContent = `
.federlet-scope-remote-react .remote-toast {
  color: blue;
}
`;
    document.head.append(style);

    expect(
      detectRuntimeStylePollution({
        root: document,
        remoteName: "remote_react",
        scopeClass: createRemoteScopeClass("remote_react"),
      }),
    ).toEqual([]);
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
      expect.stringContaining("Remote remote_react created DOM outside its container during mount"),
      expect.objectContaining({
        node,
        phase: "mount",
        reason: "node-outside-remote-container",
        remoteName: "remote_react",
      }),
    );
  });
});

describe("RemoteAppBoundary DOM escape diagnostics", () => {
  let root: Root | null = null;

  afterEach(() => {
    root?.unmount();
    root = null;
    document.body.innerHTML = "";
    mockedMountRemoteApp.mockReset();
    vi.restoreAllMocks();
  });

  it("reports remote DOM escapes without blocking the remote render", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
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

    await act(async () => {
      root?.render(
        <RemoteAppBoundary
          route={{
            basename: "/react",
            exposedModule: "./mount",
            id: "react-dashboard",
            path: "/react/*",
            remoteName: "remote_react",
            title: "React Remote",
          }}
        />,
      );
    });

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
});

describe("RemoteAppBoundary remote resilience UI", () => {
  let root: Root | null = null;

  afterEach(() => {
    root?.unmount();
    root = null;
    document.body.innerHTML = "";
    mockedMountRemoteApp.mockReset();
    vi.restoreAllMocks();
  });

  async function renderRemoteBoundary() {
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);

    await act(async () => {
      root?.render(<RemoteAppBoundary route={route} />);
    });
  }

  it("shows a timeout-specific error message and retry button", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockedMountRemoteApp.mockRejectedValue({
      code: "remote-load-timeout",
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
      code: "remote-load-failed",
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
      code: "remote-circuit-open",
    });

    await renderRemoteBoundary();

    expect(document.querySelector("[role='alert']")?.textContent).toContain(
      "Remote app is temporarily degraded.",
    );
    expect(document.querySelector("button")?.textContent).toBe("Retry");
  });
});
