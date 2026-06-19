// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, createCommentVNode, defineComponent, h, nextTick } from "vue";
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
import type { App as VueApp } from "vue";
import type { RemoteModuleLoader } from "@federlet/mf-runtime";
import type { RemoteRouteConfig } from "@federlet/shared-types";

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
  basename: "/vue",
  exposedModule: "./mount",
  id: "vue-analytics",
  path: "/vue/*",
  remoteName: "remote_vue",
  title: "Vue Remote",
};

function flushPromises() {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

describe("createRemoteContainerClassName", () => {
  it("adds a stable style isolation scope class for the remote container", () => {
    expect(createRemoteContainerClassName("remote_vue")).toBe(
      "remote-boundary__container federlet-scope-remote-vue",
    );
    expect(createRemoteContainerClassName("remote_vue")).toContain(
      createRemoteScopeClass("remote_vue"),
    );
  });
});

describe("scheduleRemoteUnmount", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("defers remote unmount until the current Vue render has finished", () => {
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
          remoteName: "remote_vue",
        },
      ]),
    ).not.toThrow();

    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining(
        "Remote remote_vue created DOM outside its container during mount",
      ),
      expect.objectContaining({
        node,
        phase: "mount",
        reason: "node-outside-remote-container",
        remoteName: "remote_vue",
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
  let app: VueApp<Element> | null = null;
  let host: HTMLDivElement | null = null;

  afterEach(() => {
    app?.unmount();
    app = null;
    host?.remove();
    host = null;
    document.body.innerHTML = "";
    mockedMountRemoteApp.mockReset();
    mockedPreloadRemoteApp.mockReset();
    vi.restoreAllMocks();
  });

  async function renderBoundary(props = {}) {
    host = document.createElement("div");
    document.body.append(host);
    app = createApp(
      defineComponent({
        render() {
          return h(RemoteAppBoundary, {
            route,
            ...props,
          });
        },
      }),
    );
    app.mount(host);
    await nextTick();
    await flushPromises();
    await nextTick();
  }

  it("passes custom loader, load options, and mount context", async () => {
    const loader: RemoteModuleLoader = vi.fn();
    const loadOptions = {
      retry: {
        maxAttempts: 1,
      },
      timeoutMs: 1000,
    };
    mockedMountRemoteApp.mockResolvedValue({ unmount: vi.fn() });

    await renderBoundary({
      createMountContext({
        container,
        route,
      }: {
        container: HTMLElement;
        route: RemoteRouteConfig;
      }) {
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
        basename: "/vue",
        container: expect.objectContaining({
          className: expect.stringContaining("remote-boundary__container"),
        }),
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

  it("keeps the shell boundary wrapper after a successful nested Vue remote mount", async () => {
    mockedMountRemoteApp.mockImplementation(async (_route, context) => {
      const remoteApp = createApp(
        defineComponent({
          render() {
            return [
              createCommentVNode("Vue remote root comment"),
              h("article", { class: "remote-vue" }, "Nested Vue remote"),
            ];
          },
        }),
      );

      remoteApp.mount(context.container);

      return {
        unmount() {
          remoteApp.unmount();
        },
      };
    });

    await renderBoundary();

    expect(document.querySelector(".remote-boundary")).not.toBeNull();
    expect(document.querySelector(".remote-boundary__header")?.textContent)
      .toContain("ready");
    expect(document.querySelector(".remote-boundary__container article"))
      .not.toBeNull();
  });

  it("does not mount the same remote twice after the boundary becomes ready", async () => {
    mockedMountRemoteApp.mockResolvedValue({ unmount: vi.fn() });

    await renderBoundary();
    await nextTick();
    await flushPromises();
    await nextTick();

    expect(mockedMountRemoteApp).toHaveBeenCalledTimes(1);
  });

  it("shows timeout, retry, and circuit messages with a retry button", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockedMountRemoteApp.mockRejectedValue({
      code: RemoteLoadErrorCode.Timeout,
    });

    await renderBoundary();

    expect(document.querySelector("[role='alert']")?.textContent).toContain(
      "Remote app loading timed out.",
    );
    expect(document.querySelector("button")?.textContent).toBe("Retry");
    expect(mockedMountRemoteApp).toHaveBeenCalledWith(
      route,
      expect.objectContaining({
        basename: "/vue",
      }),
      undefined,
      expect.objectContaining({
        timeoutMs: 8000,
      }),
    );
  });
});
