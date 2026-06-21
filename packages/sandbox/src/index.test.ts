// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createFederletSandbox,
  createSandboxedRemoteMount,
} from "./index";
import type { MicroAppContext, RemoteRouteConfig } from "@federlet/shared-types";

interface SandboxTestWindow extends Window {
  __FEDERATION__?: Record<string, unknown>;
  __FEDERLET_EXISTING_GLOBAL__?: string;
  __FEDERLET_NEW_GLOBAL__?: string;
  __REMOTE_GLOBAL__?: string;
  webpackChunkremote_umi_react?: unknown[];
}

const route: RemoteRouteConfig = {
  basename: "/react",
  exposedModule: "./mount",
  id: "react-dashboard",
  path: "/react/*",
  remoteName: "remote_react",
  title: "React Remote",
};

function createContext(container = document.createElement("div")): MicroAppContext {
  return {
    basename: route.basename,
    container,
  };
}

describe("createFederletSandbox", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete (window as SandboxTestWindow).__FEDERLET_EXISTING_GLOBAL__;
    delete (window as SandboxTestWindow).__FEDERLET_NEW_GLOBAL__;
    delete (window as SandboxTestWindow).__FEDERATION__;
    delete (window as SandboxTestWindow).__REMOTE_GLOBAL__;
    delete (window as SandboxTestWindow).webpackChunkremote_umi_react;
  });

  it("isolates remote window writes and reports global mutation diagnostics", () => {
    const sandbox = createFederletSandbox({
      container: document.createElement("div"),
      remoteName: "remote_react",
    });

    sandbox.activate();
    sandbox.globalThis.__REMOTE_GLOBAL__ = "from remote";

    expect(
      (window as Window & { __REMOTE_GLOBAL__?: string }).__REMOTE_GLOBAL__,
    ).toBeUndefined();
    expect(sandbox.globalThis.__REMOTE_GLOBAL__).toBe("from remote");
    expect(sandbox.getDiagnostics()).toMatchObject({
      globalMutations: [
        {
          key: "__REMOTE_GLOBAL__",
          remoteName: "remote_react",
          type: "set",
        },
      ],
      remoteName: "remote_react",
    });

    sandbox.deactivate();

    expect(
      (window as Window & { __REMOTE_GLOBAL__?: string }).__REMOTE_GLOBAL__,
    ).toBeUndefined();
    expect(sandbox.globalThis.__REMOTE_GLOBAL__).toBeUndefined();
  });

  it("restores direct window property additions and mutations on deactivate", () => {
    Object.defineProperty(window, "__FEDERLET_EXISTING_GLOBAL__", {
      configurable: true,
      enumerable: true,
      value: "before mount",
      writable: true,
    });
    const sandbox = createFederletSandbox({
      container: document.createElement("div"),
      remoteName: "remote_react",
    });

    sandbox.activate();
    (window as SandboxTestWindow).__FEDERLET_EXISTING_GLOBAL__ = "during mount";
    (window as SandboxTestWindow).__FEDERLET_NEW_GLOBAL__ = "created by remote";

    expect((window as SandboxTestWindow).__FEDERLET_EXISTING_GLOBAL__).toBe(
      "during mount",
    );
    expect((window as SandboxTestWindow).__FEDERLET_NEW_GLOBAL__).toBe(
      "created by remote",
    );

    sandbox.deactivate();

    expect((window as SandboxTestWindow).__FEDERLET_EXISTING_GLOBAL__).toBe(
      "before mount",
    );
    expect(
      Object.prototype.hasOwnProperty.call(window, "__FEDERLET_NEW_GLOBAL__"),
    ).toBe(false);
  });

  it("does not remove platform runtime globals created while sandbox is active", () => {
    const sandbox = createFederletSandbox({
      container: document.createElement("div"),
      remoteName: "remote_react",
    });

    sandbox.activate();
    (window as SandboxTestWindow).__FEDERLET_NEW_GLOBAL__ = "created by remote";
    (window as SandboxTestWindow).__FEDERATION__ = {
      remotes: ["remote_umi_react"],
    };
    (window as SandboxTestWindow).webpackChunkremote_umi_react = [];

    sandbox.deactivate();

    expect(
      Object.prototype.hasOwnProperty.call(window, "__FEDERLET_NEW_GLOBAL__"),
    ).toBe(false);
    expect((window as SandboxTestWindow).__FEDERATION__).toEqual({
      remotes: ["remote_umi_react"],
    });
    expect((window as SandboxTestWindow).webpackChunkremote_umi_react).toEqual([]);
  });

  it("cleans timers, raf callbacks, listeners, and global handlers on deactivate", () => {
    vi.useFakeTimers();
    const listener = vi.fn();
    const onerror = vi.fn();
    const sandbox = createFederletSandbox({
      container: document.createElement("div"),
      remoteName: "remote_react",
    });

    sandbox.activate();
    sandbox.globalThis.setTimeout(() => undefined, 1000);
    sandbox.globalThis.setInterval(() => undefined, 1000);
    sandbox.globalThis.requestAnimationFrame(() => undefined);
    sandbox.globalThis.addEventListener("click", listener);
    sandbox.globalThis.onerror = onerror;

    expect(sandbox.getDiagnostics()).toMatchObject({
      eventListeners: [{ type: "click" }],
      rafCount: 1,
      timeoutCount: 1,
      intervalCount: 1,
      globalHandlers: ["onerror"],
    });

    sandbox.deactivate();
    window.dispatchEvent(new MouseEvent("click"));
    vi.runOnlyPendingTimers();

    expect(listener).not.toHaveBeenCalled();
    expect(window.onerror).toBeNull();
    expect(sandbox.getDiagnostics()).toMatchObject({
      eventListeners: [],
      rafCount: 0,
      timeoutCount: 0,
      intervalCount: 0,
      globalHandlers: [],
    });
  });

  it("keeps global patches active until all concurrent sandboxes deactivate", () => {
    vi.useFakeTimers();
    const listener = vi.fn();
    const firstSandbox = createFederletSandbox({
      container: document.createElement("div"),
      remoteName: "remote_react",
    });
    const secondSandbox = createFederletSandbox({
      container: document.createElement("div"),
      remoteName: "remote_vue",
    });

    firstSandbox.activate();
    secondSandbox.activate();
    firstSandbox.deactivate();

    window.addEventListener("click", listener);
    window.setInterval(() => undefined, 1000);

    expect(secondSandbox.getDiagnostics()).toMatchObject({
      eventListeners: [{ type: "click" }],
      intervalCount: 1,
    });

    secondSandbox.deactivate();
    window.dispatchEvent(new MouseEvent("click"));
    vi.runOnlyPendingTimers();

    expect(listener).not.toHaveBeenCalled();
    expect(secondSandbox.getDiagnostics()).toMatchObject({
      eventListeners: [],
      intervalCount: 0,
    });
  });
});

describe("createSandboxedRemoteMount", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("deactivates the sandbox after remote unmount and keeps diagnostics available", async () => {
    vi.useFakeTimers();
    const listener = vi.fn();
    const remoteUnmount = vi.fn();
    const mountRemote = vi.fn(async (_context: MicroAppContext) => {
      window.addEventListener("click", listener);
      window.setInterval(() => undefined, 1000);

      return {
        unmount: remoteUnmount,
      };
    });
    const mount = createSandboxedRemoteMount({ mountRemote, route });
    const instance = await mount(createContext());

    await instance.unmount();
    window.dispatchEvent(new MouseEvent("click"));
    vi.runOnlyPendingTimers();

    expect(remoteUnmount).toHaveBeenCalledTimes(1);
    expect(listener).not.toHaveBeenCalled();
    expect(instance.sandbox.getDiagnostics()).toMatchObject({
      intervalCount: 0,
      remoteName: "remote_react",
    });
  });

  it("deactivates the sandbox when remote mount fails", async () => {
    const mountError = new Error("remote crashed during mount");
    const mountRemote = vi.fn(async () => {
      window.setTimeout(() => undefined, 1000);
      throw mountError;
    });
    const mount = createSandboxedRemoteMount({ mountRemote, route });

    await expect(mount(createContext())).rejects.toBe(mountError);

    const sandbox = mount.getLastSandbox();
    expect(sandbox?.getDiagnostics()).toMatchObject({
      remoteName: "remote_react",
      timeoutCount: 0,
    });
  });
});
