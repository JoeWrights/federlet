// @vitest-environment jsdom

import { setTimeout as waitForNodeTimer } from "node:timers/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, createCommentVNode, defineComponent, h, nextTick } from "vue";
import {
  mountRemoteApp,
  preloadRemoteApp,
  RemoteLoadError,
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
  return waitForNodeTimer(0).then(() => undefined);
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
        "shell-core:remote.dom.escape Remote created DOM outside its container",
      ),
      expect.objectContaining({
        context: expect.objectContaining({
          issue: expect.objectContaining({
            node,
            phase: "mount",
            reason: "node-outside-remote-container",
            remoteName: "remote_vue",
          }),
        }),
        event: "remote.dom.escape",
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
    vi.useRealTimers();
  });

  async function renderBoundary(props = {}) {
    host = document.createElement("div");
    document.body.append(host);
    app = createApp(
      defineComponent({
        render() {
          return h(RemoteAppBoundary, {
            route,
            sandbox: false,
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
    const eventBus = {
      emit: vi.fn(),
      on: vi.fn(),
    };
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
          eventBus,
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
        eventBus,
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

    await renderBoundary({
      sandbox: undefined,
    });
    await nextTick();
    await flushPromises();
    await nextTick();

    expect(mockedMountRemoteApp).toHaveBeenCalledTimes(1);
  });

  it("shows the fallback and unmounts when a mounted remote reports a runtime error", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const remoteRuntimeError = new Error("remote vue render crashed");
    const onError = vi.fn();
    const unmount = vi.fn();
    let reportRuntimeError: ((error: unknown) => void) | undefined;

    mockedMountRemoteApp.mockImplementation(async (_route, context) => {
      reportRuntimeError = context.onError;

      return {
        unmount,
      };
    });

    await renderBoundary({
      onError,
    });
    vi.useFakeTimers();

    expect(document.querySelector(".remote-boundary__header")?.textContent)
      .toContain("ready");
    expect(reportRuntimeError).toEqual(expect.any(Function));

    reportRuntimeError?.(remoteRuntimeError);
    await nextTick();

    expect(document.querySelector(".remote-boundary__header")?.textContent)
      .toContain("error");
    expect(document.querySelector("[role='alert']")?.textContent).toContain(
      "Remote app is unavailable.",
    );
    expect(onError).toHaveBeenCalledWith(remoteRuntimeError, route);
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining(
        "vue-shell:remote.runtime.error Remote reported a runtime error",
      ),
      expect.objectContaining({
        error: remoteRuntimeError,
        event: "remote.runtime.error",
        remoteName: "remote_vue",
        routeId: "vue-analytics",
      }),
    );

    vi.advanceTimersByTime(0);

    expect(unmount).toHaveBeenCalledOnce();
  });

  it("cleans remote global side effects after unmount", async () => {
    const listener = vi.fn();
    const unmount = vi.fn();

    mockedMountRemoteApp.mockImplementation(async () => {
      window.addEventListener("click", listener);
      window.setInterval(() => undefined, 1000);

      return {
        unmount,
      };
    });

    await renderBoundary({
      sandbox: undefined,
    });

    app?.unmount();
    await waitForNodeTimer(0);
    await Promise.resolve();
    window.dispatchEvent(new MouseEvent("click"));

    expect(unmount).toHaveBeenCalledOnce();
    expect(listener).not.toHaveBeenCalled();
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

  it("renders technical details with the wrapped error cause chain", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const cause = new ReferenceError("b is not defined");
    mockedMountRemoteApp.mockRejectedValue(
      new RemoteLoadError({
        cause,
        code: RemoteLoadErrorCode.MountFailed,
        message: "Remote remote_vue/mount failed during mount.",
        remoteName: "remote_vue",
      }),
    );

    await renderBoundary();

    const details = document.querySelector("details");
    const technicalDetails = document.querySelector("pre")?.textContent;

    expect(details?.textContent).toContain("Technical details");
    expect(technicalDetails).toContain(
      "RemoteLoadError: Remote remote_vue/mount failed during mount.",
    );
    expect(technicalDetails).toContain("Code: remote-mount-failed");
    expect(technicalDetails).toContain("Remote: remote_vue");
    expect(technicalDetails).toContain("Caused by:");
    expect(technicalDetails).toContain("ReferenceError: b is not defined");
  });
});
