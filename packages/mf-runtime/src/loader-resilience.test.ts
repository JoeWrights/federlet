// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import {
  createCircuitBreakerStore,
  mountRemoteApp,
  preloadRemoteApp,
  RemoteLoadErrorCode,
  RemoteLoadError,
} from "./index";
import type { RemoteRouteConfig } from "@federlet/shared-types";

const route: RemoteRouteConfig = {
  basename: "/demo",
  exposedModule: "./mount",
  id: "demo",
  path: "/demo/*",
  remoteName: "remote_demo",
  title: "Demo",
};

describe("mountRemoteApp resilience", () => {
  it("throws a timeout error when loading exceeds the timeout", async () => {
    vi.useFakeTimers();
    const loader = vi.fn(() => new Promise<never>(() => undefined));
    const promise = mountRemoteApp(
      route,
      {
        basename: route.basename,
        container: document.createElement("div"),
      },
      loader,
      {
        timeoutMs: 100,
        retry: {
          maxAttempts: 1,
        },
      },
    );
    const errorPromise = promise.catch((error: unknown) => error);

    await vi.advanceTimersByTimeAsync(100);

    const error = await errorPromise;
    expect(error).toMatchObject({
      code: RemoteLoadErrorCode.Timeout,
      remoteName: "remote_demo",
    });
    expect(error).toBeInstanceOf(RemoteLoadError);

    vi.useRealTimers();
  });

  it("retries retryable loading failures and eventually mounts", async () => {
    const delay = vi.fn(() => Promise.resolve());
    const unmount = vi.fn();
    const mount = vi.fn(() => ({ unmount }));
    const loader = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary outage"))
      .mockRejectedValueOnce(new Error("temporary outage"))
      .mockResolvedValueOnce({ mount });

    const instance = await mountRemoteApp(
      route,
      {
        basename: route.basename,
        container: document.createElement("div"),
      },
      loader,
      {
        retry: {
          backoffBaseMs: 300,
          delay,
          maxAttempts: 3,
        },
      },
    );

    expect(instance).toEqual({ unmount });
    expect(loader).toHaveBeenCalledTimes(3);
    expect(delay).toHaveBeenNthCalledWith(1, 300);
    expect(delay).toHaveBeenNthCalledWith(2, 600);
  });

  it("retries retryable preload failures and resolves without mounting", async () => {
    const delay = vi.fn(() => Promise.resolve());
    const mount = vi.fn(() => ({ unmount: vi.fn() }));
    const loader = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary outage"))
      .mockResolvedValueOnce({ mount });

    await preloadRemoteApp(route, loader, {
      retry: {
        backoffBaseMs: 300,
        delay,
        maxAttempts: 2,
      },
    });

    expect(loader).toHaveBeenCalledTimes(2);
    expect(delay).toHaveBeenCalledWith(300);
    expect(mount).not.toHaveBeenCalled();
  });

  it("does not retry protocol errors", async () => {
    const delay = vi.fn(() => Promise.resolve());
    const loader = vi.fn().mockResolvedValue({});

    await expect(
      mountRemoteApp(
        route,
        {
          basename: route.basename,
          container: document.createElement("div"),
        },
        loader,
        {
          retry: {
            delay,
            maxAttempts: 3,
          },
        },
      ),
    ).rejects.toMatchObject({
      code: RemoteLoadErrorCode.ProtocolError,
    });

    expect(loader).toHaveBeenCalledTimes(1);
    expect(delay).not.toHaveBeenCalled();
  });

  it("opens the circuit after consecutive failures and skips the loader", async () => {
    const store = createCircuitBreakerStore();
    const loader = vi.fn().mockRejectedValue(new Error("remote down"));
    const options = {
      circuitBreaker: {
        cooldownMs: 30_000,
        failureThreshold: 3,
        store,
      },
      retry: {
        maxAttempts: 1,
      },
    };

    for (let index = 0; index < 3; index += 1) {
      await expect(
        mountRemoteApp(
          route,
          {
            basename: route.basename,
            container: document.createElement("div"),
          },
          loader,
          options,
        ),
      ).rejects.toMatchObject({
        code: RemoteLoadErrorCode.LoadFailed,
      });
    }

    await expect(
      mountRemoteApp(
        route,
        {
          basename: route.basename,
          container: document.createElement("div"),
        },
        loader,
        options,
      ),
    ).rejects.toMatchObject({
      code: RemoteLoadErrorCode.CircuitOpen,
    });

    expect(loader).toHaveBeenCalledTimes(3);
  });

  it("resets the circuit failure count after a successful load", async () => {
    const store = createCircuitBreakerStore();
    const unmount = vi.fn();
    const mount = vi.fn(() => ({ unmount }));
    const loader = vi
      .fn()
      .mockRejectedValueOnce(new Error("remote down"))
      .mockRejectedValueOnce(new Error("remote down"))
      .mockResolvedValueOnce({ mount })
      .mockRejectedValueOnce(new Error("remote down"))
      .mockRejectedValueOnce(new Error("remote down"))
      .mockResolvedValueOnce({ mount });
    const options = {
      circuitBreaker: {
        cooldownMs: 30_000,
        failureThreshold: 3,
        store,
      },
      retry: {
        maxAttempts: 1,
      },
    };

    await expect(
      mountRemoteApp(
        route,
        {
          basename: route.basename,
          container: document.createElement("div"),
        },
        loader,
        options,
      ),
    ).rejects.toMatchObject({ code: RemoteLoadErrorCode.LoadFailed });
    await expect(
      mountRemoteApp(
        route,
        {
          basename: route.basename,
          container: document.createElement("div"),
        },
        loader,
        options,
      ),
    ).rejects.toMatchObject({ code: RemoteLoadErrorCode.LoadFailed });

    await mountRemoteApp(
      route,
      {
        basename: route.basename,
        container: document.createElement("div"),
      },
      loader,
      options,
    );

    await expect(
      mountRemoteApp(
        route,
        {
          basename: route.basename,
          container: document.createElement("div"),
        },
        loader,
        options,
      ),
    ).rejects.toMatchObject({ code: RemoteLoadErrorCode.LoadFailed });
    await expect(
      mountRemoteApp(
        route,
        {
          basename: route.basename,
          container: document.createElement("div"),
        },
        loader,
        options,
      ),
    ).rejects.toMatchObject({ code: RemoteLoadErrorCode.LoadFailed });

    const instance = await mountRemoteApp(
      route,
      {
        basename: route.basename,
        container: document.createElement("div"),
      },
      loader,
      options,
    );

    expect(instance).toEqual({ unmount });
    expect(loader).toHaveBeenCalledTimes(6);
  });
});
