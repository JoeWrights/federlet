// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { loadRuntimeRemoteRoutes } from "./runtime-manifest";
import { App, createRemoteRouteElement, readSandboxRiskSnapshot } from "./App";

interface SandboxRiskTestWindow extends Window {
  __FEDERLET_SANDBOX_RISK__?: {
    clickCount?: number;
    intervalId?: number;
    rafFired?: boolean;
    seckillRemainingSeconds?: number;
    source?: string;
    timeoutFired?: boolean;
    ticks?: number;
  };
  __FEDERLET_UNSANDBOXED_WINDOW_WRITE__?: string;
}

const remotePreloaderMocks = vi.hoisted(() => ({
  preload: vi.fn(),
}));

vi.mock("./runtime-manifest", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./runtime-manifest")>();

  return {
    ...actual,
    loadRuntimeRemoteRoutes: vi.fn(),
  };
});

vi.mock("@federlet/react-shell", () => ({
  createRemotePreloader: vi.fn(() => ({
    preload: remotePreloaderMocks.preload,
  })),
  RemoteAppBoundary: ({
    route,
    sandbox,
  }: {
    route: { title: string };
    sandbox?: false;
  }) => (
    <section>
      Boundary {route.title} sandbox {sandbox === false ? "off" : "on"}
    </section>
  ),
}));

const mockedLoadRuntimeRemoteRoutes = vi.mocked(loadRuntimeRemoteRoutes);

let root: Root | null = null;
(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  document.body.innerHTML = "";
  mockedLoadRuntimeRemoteRoutes.mockReset();
  remotePreloaderMocks.preload.mockReset();
});

describe("createRemoteRouteElement", () => {
  it("keys each remote boundary by route id so containers are not reused across remotes", () => {
    const element = createRemoteRouteElement({
      id: "vue-analytics",
      path: "/vue/*",
      title: "Vue Remote",
      remoteName: "remote_vue",
      exposedModule: "./mount",
      basename: "/vue",
    });

    expect(element.key).toBe("vue-analytics");
  });

  it("injects the shared event bus into the remote mount context", () => {
    const eventBus = {
      emit: vi.fn(),
      on: vi.fn(),
    };
    const route = {
      id: "vue-analytics",
      path: "/vue/*",
      title: "Vue Remote",
      remoteName: "remote_vue",
      exposedModule: "./mount",
      basename: "/vue",
    };
    const element = createRemoteRouteElement(route, undefined, eventBus);
    const container = document.createElement("div");

    const context = element.props.createMountContext({
      container,
      route,
    });

    expect(context).toEqual({
      basename: "/vue",
      container,
      eventBus,
      onError: expect.any(Function),
      props: {
        mountedAt: expect.any(String),
      },
    });
  });

  it("turns off sandbox for the no-sandbox comparison route", () => {
    const element = createRemoteRouteElement({
      basename: "/react-nosandbox",
      exposedModule: "./mount",
      id: "react-dashboard-nosandbox",
      path: "/react-nosandbox/*",
      remoteName: "remote_react",
      title: "React Remote No Sandbox",
    });

    expect(element.props.sandbox).toBe(false);
  });

  it("turns off sandbox for the Umi no-sandbox comparison route", () => {
    const element = createRemoteRouteElement({
      basename: "/umi-nosandbox",
      exposedModule: "./mount",
      id: "umi-react-nosandbox",
      path: "/umi-nosandbox/*",
      remoteName: "remote_umi_react",
      title: "Umi React Remote No Sandbox",
    });

    expect(element.props.sandbox).toBe(false);
  });
});

describe("App runtime routes", () => {
  it("does not mount fallback remote routes before runtime registration finishes", async () => {
    let resolveRoutes: (
      routes: Awaited<ReturnType<typeof loadRuntimeRemoteRoutes>>,
    ) => void = () => undefined;
    mockedLoadRuntimeRemoteRoutes.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRoutes = resolve;
        }),
    );
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);

    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={["/vue/"]}>
          <App />
        </MemoryRouter>,
      );
    });

    expect(document.body.textContent).toContain("Loading remote routes...");
    expect(document.body.textContent).not.toContain("Boundary Vue Remote");

    await act(async () => {
      resolveRoutes([
        {
          basename: "/vue",
          exposedModule: "./mount",
          id: "vue-analytics",
          path: "/vue/*",
          remoteName: "remote_vue",
          title: "Vue Remote",
        },
      ]);
    });

    expect(document.body.textContent).toContain("Boundary Vue Remote");
  });

  it("renders remote navigation from the runtime manifest when it is available", async () => {
    mockedLoadRuntimeRemoteRoutes.mockResolvedValue([
      {
        basename: "/orders",
        exposedModule: "./mount",
        id: "orders",
        path: "/orders/*",
        remoteName: "remote_orders",
        title: "Orders",
      },
    ]);
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);

    await act(async () => {
      root?.render(
        <MemoryRouter>
          <App />
        </MemoryRouter>,
      );
    });

    expect(document.body.textContent).toContain("Orders");
    expect(document.body.textContent).toContain("remote_orders");
  });

  it("preloads a remote when navigation links receive pointer or focus intent", async () => {
    const ordersRoute = {
      basename: "/orders",
      exposedModule: "./mount",
      id: "orders",
      path: "/orders/*",
      remoteName: "remote_orders",
      title: "Orders",
    };
    mockedLoadRuntimeRemoteRoutes.mockResolvedValue([ordersRoute]);
    remotePreloaderMocks.preload.mockResolvedValue(undefined);
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);

    await act(async () => {
      root?.render(
        <MemoryRouter>
          <App />
        </MemoryRouter>,
      );
    });

    const ordersLinks = Array.from(document.querySelectorAll("a")).filter(
      (link) => link.textContent?.includes("Orders"),
    );

    await act(async () => {
      ordersLinks[0]?.dispatchEvent(
        new MouseEvent("mouseover", { bubbles: true }),
      );
      ordersLinks[0]?.dispatchEvent(
        new FocusEvent("focusin", { bubbles: true }),
      );
    });

    expect(remotePreloaderMocks.preload).toHaveBeenCalledTimes(2);
    expect(remotePreloaderMocks.preload).toHaveBeenNthCalledWith(
      1,
      ordersRoute,
    );
    expect(remotePreloaderMocks.preload).toHaveBeenNthCalledWith(
      2,
      ordersRoute,
    );
  });

  it("waits for runtime routes before redirecting unknown dynamic paths", async () => {
    mockedLoadRuntimeRemoteRoutes.mockResolvedValue([
      {
        basename: "/orders",
        exposedModule: "./mount",
        id: "orders",
        path: "/orders/*",
        remoteName: "remote_orders",
        title: "Orders",
      },
    ]);
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);

    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={["/orders"]}>
          <App />
        </MemoryRouter>,
      );
    });

    expect(document.body.textContent).toContain("Boundary Orders");
  });

  it("preloads the target remote before mounting it on direct navigation", async () => {
    let resolvePreload: () => void = () => undefined;
    const ordersRoute = {
      basename: "/orders",
      exposedModule: "./mount",
      id: "orders",
      path: "/orders/*",
      remoteName: "remote_orders",
      title: "Orders",
    };
    mockedLoadRuntimeRemoteRoutes.mockResolvedValue([ordersRoute]);
    remotePreloaderMocks.preload.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolvePreload = resolve;
        }),
    );
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);

    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={["/orders"]}>
          <App />
        </MemoryRouter>,
      );
    });

    expect(remotePreloaderMocks.preload).toHaveBeenCalledWith(ordersRoute);
    expect(document.body.textContent).toContain("Loading remote routes...");
    expect(document.body.textContent).not.toContain("Boundary Orders");

    await act(async () => {
      resolvePreload();
    });

    expect(document.body.textContent).toContain("Boundary Orders");
  });
});

describe("readSandboxRiskSnapshot", () => {
  it("reports side effects left on shared browser globals", () => {
    (window as SandboxRiskTestWindow).__FEDERLET_SANDBOX_RISK__ = {
      clickCount: 2,
      intervalId: 1,
      rafFired: true,
      seckillRemainingSeconds: 4,
      source: "remote-react/settings",
      timeoutFired: true,
      ticks: 3,
    };
    (window as SandboxRiskTestWindow).__FEDERLET_UNSANDBOXED_WINDOW_WRITE__ =
      "remote-react/settings";
    document.body.append(document.createElement("div"));
    document.body.lastElementChild?.setAttribute(
      "data-federlet-sandbox-risk",
      "body-node",
    );
    const style = document.createElement("style");
    style.dataset.federletSandboxRisk = "head-style";
    document.head.append(style);
    const link = document.createElement("link");
    link.dataset.federletSandboxRisk = "head-link";
    document.head.append(link);
    const script = document.createElement("script");
    script.dataset.federletSandboxRisk = "head-script";
    document.head.append(script);
    localStorage.setItem("federlet:sandbox-risk", "remote-react/settings");
    sessionStorage.setItem("federlet:sandbox-risk", "remote-react/settings");
    document.cookie = "federlet_sandbox_risk=remote-react; path=/";
    (Array.prototype as { __federletSandboxRisk__?: string })
      .__federletSandboxRisk__ = "remote-react/settings";

    expect(readSandboxRiskSnapshot()).toEqual({
      bodyNodeLeak: true,
      clickListenerCount: 2,
      cookiePollution: true,
      directWindowWrite: true,
      dynamicLinkLeak: true,
      dynamicScriptLeak: true,
      globalPollution: true,
      leakingTimer: true,
      prototypePollution: true,
      rafFired: true,
      runtimeStyleLeak: true,
      seckillRemainingSeconds: 4,
      source: "remote-react/settings",
      storagePollution: true,
      timeoutFired: true,
      ticks: 3,
    });

    delete (window as SandboxRiskTestWindow).__FEDERLET_SANDBOX_RISK__;
    delete (window as SandboxRiskTestWindow).__FEDERLET_UNSANDBOXED_WINDOW_WRITE__;
    delete (Array.prototype as { __federletSandboxRisk__?: string })
      .__federletSandboxRisk__;
    localStorage.removeItem("federlet:sandbox-risk");
    sessionStorage.removeItem("federlet:sandbox-risk");
    document.cookie = "federlet_sandbox_risk=; Max-Age=0; path=/";
    document.body.replaceChildren();
    style.remove();
    link.remove();
    script.remove();
  });
});
