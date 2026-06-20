// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

function flushPromises() {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

describe("Vue Shell bootstrap", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unmock("./App.vue");
    vi.unmock("./config/runtime-env");
    vi.unmock("vue");
    vi.unmock("vue-router");
  });

  it("waits for the router to resolve the current location before mounting", async () => {
    let resolveRouterReady: () => void = () => undefined;
    const mount = vi.fn();
    const app = {
      mount,
      use: vi.fn(),
    };
    const router = {
      isReady: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveRouterReady = resolve;
          }),
      ),
    };

    vi.doMock("vue", () => ({
      createApp: vi.fn(() => app),
    }));
    vi.doMock("vue-router", () => ({
      createRouter: vi.fn(() => router),
      createWebHistory: vi.fn(() => ({})),
    }));
    vi.doMock("./App.vue", () => ({
      default: {},
    }));
    vi.doMock("./config/runtime-env", () => ({
      setupShellRuntimeEnvironment: vi.fn(),
    }));

    let importError: unknown;
    const bootstrap = import("./bootstrap").catch((error: unknown) => {
      importError = error;
    });
    await vi.waitFor(() => {
      expect(router.isReady).toHaveBeenCalledTimes(1);
    });

    expect(importError).toBeUndefined();
    expect(mount).not.toHaveBeenCalled();

    resolveRouterReady();
    await bootstrap;
    await flushPromises();

    expect(mount).toHaveBeenCalledWith("#root");
  });
});
