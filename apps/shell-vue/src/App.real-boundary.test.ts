// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createApp,
  defineComponent,
  h,
  nextTick,
  type App as VueApp,
} from "vue";
import {
  createRouter,
  createWebHistory,
  RouterView,
  type Router,
} from "vue-router";
import { mountRemoteApp } from "@federlet/mf-runtime";
import App from "./App.vue";
import { loadRuntimeRemoteRoutes } from "./runtime-manifest";
import type { MicroAppContext } from "@federlet/shared-types";

vi.mock("./runtime-manifest", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./runtime-manifest")>();

  return {
    ...actual,
    loadRuntimeRemoteRoutes: vi.fn(),
  };
});

vi.mock("@federlet/mf-runtime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@federlet/mf-runtime")>();

  return {
    ...actual,
    mountRemoteApp: vi.fn(),
  };
});

const mockedLoadRuntimeRemoteRoutes = vi.mocked(loadRuntimeRemoteRoutes);
const mockedMountRemoteApp = vi.mocked(mountRemoteApp);

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
  await flushPromises();
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
  mockedMountRemoteApp.mockReset();
});

describe("Vue Shell real RemoteAppBoundary integration", () => {
  it("keeps the shell layout when a nested Vue remote installs its own router", async () => {
    mockedLoadRuntimeRemoteRoutes.mockResolvedValue([
      {
        basename: "/vue",
        exposedModule: "./mount",
        id: "vue-analytics",
        path: "/vue/*",
        remoteName: "remote_vue",
        title: "Vue Remote",
      },
    ]);
    mockedMountRemoteApp.mockImplementation(async (_route, context) => {
      const remoteApp = createNestedRouterRemote(context);
      remoteApp.mount(context.container);

      return {
        unmount() {
          remoteApp.unmount();
        },
      };
    });

    await renderApp("/vue/");

    expect(document.querySelector(".shell")).not.toBeNull();
    expect(document.querySelector(".shell__sidebar")).not.toBeNull();
    expect(document.querySelector(".remote-boundary")).not.toBeNull();
    expect(document.querySelector(".remote-boundary__container .vue-remote"))
      .not.toBeNull();
  });
});

function createNestedRouterRemote(context: MicroAppContext) {
  const RemoteApp = defineComponent({
    setup() {
      return () =>
        h("article", { class: "vue-remote" }, [
          h("h1", "Analytics powered by Vue"),
          h(RouterView),
        ]);
    },
  });
  const remoteRouter = createRouter({
    history: createWebHistory(context.basename),
    routes: [
      {
        component: defineComponent({
          setup() {
            return () =>
              h("section", { class: "vue-remote__panel" }, "Nested route");
          },
        }),
        path: "/",
      },
    ],
  });

  return createApp(RemoteApp).use(remoteRouter);
}
