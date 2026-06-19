// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import type { MicroAppInstance, MicroEventBus } from "@federlet/shared-types";
import { mount } from "./mount";

let instance: MicroAppInstance | null = null;

afterEach(() => {
  instance?.unmount();
  instance = null;
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("remote-vue event bus lifecycle", () => {
  it("emits lifecycle events and releases subscriptions on unmount", () => {
    const unsubscribe = vi.fn();
    const eventBus: MicroEventBus = {
      emit: vi.fn(),
      on: vi.fn(() => unsubscribe),
    };
    const container = document.createElement("div");
    document.body.append(container);
    const consoleInfo = vi
      .spyOn(console, "info")
      .mockImplementation(() => undefined);

    instance = mount({
      basename: "/vue",
      container,
      eventBus,
    });

    expect(eventBus.emit).toHaveBeenCalledWith(
      "remote.lifecycle.mounted",
      {
        basename: "/vue",
        remoteName: "remote_vue",
      },
      {
        source: "remote_vue",
      },
    );
    expect(eventBus.on).toHaveBeenCalledWith(
      "auth.session.updated",
      expect.any(Function),
    );

    const listener = vi.mocked(eventBus.on).mock.calls[0]?.[1];
    listener?.(
      {
        isAuthenticated: false,
        userId: null,
      },
      {
        source: "shell-vue",
      },
    );
    expect(consoleInfo).toHaveBeenCalledWith(
      "remote_vue received auth.session.updated",
      {
        isAuthenticated: false,
        userId: null,
      },
      {
        source: "shell-vue",
      },
    );

    instance.unmount();
    instance = null;

    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(eventBus.emit).toHaveBeenCalledWith(
      "remote.lifecycle.unmounted",
      {
        basename: "/vue",
        remoteName: "remote_vue",
      },
      {
        source: "remote_vue",
      },
    );
  });

  it("releases subscriptions when mounted lifecycle emit fails", () => {
    const unsubscribe = vi.fn();
    const eventBus: MicroEventBus = {
      emit: vi.fn((eventName) => {
        if (eventName === "remote.lifecycle.mounted") {
          throw new Error("mounted listener failed");
        }
      }),
      on: vi.fn(() => unsubscribe),
    };
    const container = document.createElement("div");
    document.body.append(container);

    expect(() =>
      mount({
        basename: "/vue",
        container,
        eventBus,
      }),
    ).toThrow("mounted listener failed");

    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
