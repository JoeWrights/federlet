// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import {
  createEventBus,
  mountRemoteApp,
  normalizeExposedModule,
  preloadRemoteApp,
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

  it("preloads a remote app module without mounting it", async () => {
    const mount = vi.fn(() => ({ unmount: vi.fn() }));
    const loader = vi.fn(
      async (_moduleName: string): Promise<RemoteMountModule> => ({ mount }),
    );

    await preloadRemoteApp(route, loader);

    expect(loader).toHaveBeenCalledWith("remote_demo/mount");
    expect(mount).not.toHaveBeenCalled();
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

  it("throws a descriptive error when preloading a remote without mount", async () => {
    const loader = vi.fn().mockResolvedValue({});

    await expect(preloadRemoteApp(route, loader)).rejects.toThrow(
      "Remote remote_demo/mount does not expose a mount function.",
    );
  });

  it("emits events to subscribers and returns an unsubscribe function", () => {
    const eventBus = createEventBus();
    const listener = vi.fn();
    const unsubscribe = eventBus.on("user.profile.changed", listener);

    eventBus.emit("user.profile.changed", { id: "u_1" });
    unsubscribe();
    eventBus.emit("user.profile.changed", { id: "u_2" });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      { id: "u_1" },
      expect.objectContaining({
        timestamp: expect.any(Number),
      }),
    );
  });

  it("emits governed events with metadata and audit records", () => {
    const audit = vi.fn();
    const eventBus = createEventBus({
      now: () => 1234,
      onAuditEvent: audit,
    });
    const listener = vi.fn();

    eventBus.on("remote.lifecycle.mounted", listener);
    eventBus.emit(
      "remote.lifecycle.mounted",
      {
        basename: "/react",
        remoteName: "remote_react",
      },
      {
        source: "shell-react",
        traceId: "trace-1",
      },
    );

    expect(listener).toHaveBeenCalledWith(
      {
        basename: "/react",
        remoteName: "remote_react",
      },
      {
        source: "shell-react",
        timestamp: 1234,
        traceId: "trace-1",
      },
    );
    expect(audit).toHaveBeenCalledWith({
      eventName: "remote.lifecycle.mounted",
      meta: {
        source: "shell-react",
        timestamp: 1234,
        traceId: "trace-1",
      },
      payload: {
        basename: "/react",
        remoteName: "remote_react",
      },
    });
  });

  it("rejects invalid event names before dispatching", () => {
    const invalidEvent = vi.fn();
    const listener = vi.fn();
    const eventBus = createEventBus({
      onInvalidEvent: invalidEvent,
    });
    eventBus.on("remote.lifecycle.mounted", listener);

    expect(() =>
      eventBus.emit("remote:mounted", { remoteName: "remote_react" }),
    ).toThrow("Invalid event name remote:mounted");

    expect(listener).not.toHaveBeenCalled();
    expect(invalidEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "remote:mounted",
        reason: "invalid-event-name",
      }),
    );
  });

  it("rejects event names that do not use exactly three segments", () => {
    const eventBus = createEventBus();

    expect(() =>
      eventBus.emit("remote.lifecycle.mounted.extra", {
        basename: "/react",
        remoteName: "remote_react",
      }),
    ).toThrow("Invalid event name remote.lifecycle.mounted.extra");
  });

  it("rejects payloads that fail the configured validator", () => {
    const invalidEvent = vi.fn();
    const listener = vi.fn();
    const eventBus = createEventBus({
      onInvalidEvent: invalidEvent,
      validatePayload(eventName, payload) {
        if (eventName !== "auth.session.updated") {
          return true;
        }

        return (
          typeof payload === "object" &&
          payload !== null &&
          "userId" in payload &&
          typeof payload.userId === "string"
        );
      },
    });
    eventBus.on("auth.session.updated", listener);
    const eventNameFromRuntimeConfig: string = "auth.session.updated";

    expect(() =>
      eventBus.emit(eventNameFromRuntimeConfig, { userId: 42 }),
    ).toThrow("Invalid payload for event auth.session.updated");

    expect(listener).not.toHaveBeenCalled();
    expect(invalidEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "auth.session.updated",
        reason: "invalid-payload",
      }),
    );
  });
});
