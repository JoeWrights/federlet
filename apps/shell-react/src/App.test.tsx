// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { loadRuntimeRemoteRoutes } from "./runtime-manifest";
import { App, createRemoteRouteElement } from "./App";

vi.mock("./runtime-manifest", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./runtime-manifest")>();

  return {
    ...actual,
    loadRuntimeRemoteRoutes: vi.fn(),
  };
});

vi.mock("./RemoteAppBoundary", () => ({
  RemoteAppBoundary: ({
    route,
  }: {
    route: { title: string };
  }) => <section>Boundary {route.title}</section>,
}));

const mockedLoadRuntimeRemoteRoutes = vi.mocked(loadRuntimeRemoteRoutes);

let root: Root | null = null;
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  document.body.innerHTML = "";
  mockedLoadRuntimeRemoteRoutes.mockReset();
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
});
