// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import {
  createEventBus,
  mountRemoteApp,
  normalizeExposedModule,
} from "../src/index";
import type {
  RemoteMountModule,
  RemoteRouteConfig,
} from "@federlet/shared-types";

const route: RemoteRouteConfig = {
  id: "demo",
  path: "/demo/*",
  title: "Demo",
  remoteName: "remote_demo",
  exposedModule: "./mount",
  basename: "/demo",
};

describe("mf-runtime", () => {
  it("normalizes exposed module names for module federation runtime", () => {
    expect(normalizeExposedModule("./mount")).toBe("mount");
    expect(normalizeExposedModule("mount")).toBe("mount");
  });

  it("mounts a remote app through an injected loader", async () => {
    const unmount = vi.fn();
    const mount = vi.fn(() => ({ unmount }));
    const loader = vi.fn(
      async (_moduleName: string): Promise<RemoteMountModule> => ({ mount }),
    );
    const container = document.createElement("div");

    const instance = await mountRemoteApp(
      route,
      {
        basename: route.basename,
        container,
      },
      loader,
    );

    expect(loader).toHaveBeenCalledWith("remote_demo/mount");
    expect(mount).toHaveBeenCalledWith({
      basename: "/demo",
      container,
    });

    instance.unmount();
    expect(unmount).toHaveBeenCalledOnce();
  });

  it("throws a descriptive error when the remote does not expose mount", async () => {
    const loader = vi.fn().mockResolvedValue({});

    await expect(
      mountRemoteApp(
        route,
        {
          basename: route.basename,
          container: document.createElement("div"),
        },
        loader,
      ),
    ).rejects.toThrow("Remote remote_demo/mount does not expose a mount function.");
  });

  it("emits events to subscribers and returns an unsubscribe function", () => {
    const eventBus = createEventBus();
    const listener = vi.fn();
    const unsubscribe = eventBus.on<{ id: string }>("user:changed", listener);

    eventBus.emit("user:changed", { id: "u_1" });
    unsubscribe();
    eventBus.emit("user:changed", { id: "u_2" });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ id: "u_1" });
  });
});
