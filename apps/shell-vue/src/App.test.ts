// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, type App as VueApp } from "vue";
import { createRouter, createWebHistory, type Router } from "vue-router";
import App from "./App.vue";
import { loadRuntimeRemoteRoutes } from "./runtime-manifest";

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

vi.mock("@federlet/vue-shell", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@federlet/vue-shell")>();

  return {
    ...actual,
    createRemotePreloader: vi.fn(() => ({
      preload: remotePreloaderMocks.preload,
    })),
    RemoteAppBoundary: defineComponent({
      props: {
        route: {
          required: true,
          type: Object,
        },
      },
      setup(props) {
        return () =>
          h(
            "section",
            `Boundary ${(props.route as { title: string }).title}`,
          );
      },
    }),
  };
});

const mockedLoadRuntimeRemoteRoutes = vi.mocked(loadRuntimeRemoteRoutes);

let app: VueApp<Element> | null = null;
let router: Router | null = null;
let host: HTMLDivElement | null = null;

function flushPromises() {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

async function renderApp(initialPath = "/") {
  host = document.createElement("div");
  document.body.append(host);
  router = createRouter({
    history: createWebHistory("/"),
    routes: [
      {
        component: App,
        path: "/:pathMatch(.*)*",
      },
    ],
  });
  app = createApp({
    render() {
      return h(App);
    },
  });
  app.use(router);
  await router.push(initialPath);
  await router.isReady();
  app.mount(host);
  await nextTick();
}

afterEach(() => {
  app?.unmount();
  app = null;
  router = null;
  host?.remove();
  host = null;
  document.body.innerHTML = "";
  mockedLoadRuntimeRemoteRoutes.mockReset();
  remotePreloaderMocks.preload.mockReset();
});

describe("Vue Shell runtime routes", () => {
  it("does not mount remote routes before runtime registration finishes", async () => {
    let resolveRoutes: (
      routes: Awaited<ReturnType<typeof loadRuntimeRemoteRoutes>>,
    ) => void = () => undefined;
    mockedLoadRuntimeRemoteRoutes.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRoutes = resolve;
        }),
    );

    await renderApp("/vue/");

    expect(document.body.textContent).toContain("Loading remote routes...");
    expect(document.body.textContent).not.toContain("Boundary Vue Remote");

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
    await flushPromises();
    await nextTick();

    expect(document.body.textContent).toContain("Boundary Vue Remote");
  });

  it("renders remote navigation from the runtime manifest", async () => {
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

    await renderApp("/");
    await flushPromises();
    await nextTick();

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

    await renderApp("/");
    await flushPromises();
    await nextTick();

    const ordersLinks = Array.from(document.querySelectorAll("a")).filter(
      (link) => link.textContent?.includes("Orders"),
    );

    ordersLinks[0]?.dispatchEvent(new MouseEvent("mouseenter"));
    ordersLinks[0]?.dispatchEvent(new FocusEvent("focus"));
    await flushPromises();

    expect(remotePreloaderMocks.preload).toHaveBeenCalledTimes(2);
    expect(remotePreloaderMocks.preload).toHaveBeenNthCalledWith(1, ordersRoute);
    expect(remotePreloaderMocks.preload).toHaveBeenNthCalledWith(2, ordersRoute);
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

    await renderApp("/orders");
    await flushPromises();
    await nextTick();

    expect(remotePreloaderMocks.preload).toHaveBeenCalledWith(ordersRoute);
    expect(document.body.textContent).toContain("Loading remote routes...");
    expect(document.body.textContent).not.toContain("Boundary Orders");

    resolvePreload();
    await flushPromises();
    await nextTick();

    expect(document.body.textContent).toContain("Boundary Orders");
  });
});
