// @vitest-environment jsdom

import { act } from "react-dom/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MicroAppInstance, MicroEventBus } from "@federlet/shared-types";
import { mount } from "./mount";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

let instance: MicroAppInstance | null = null;

afterEach(() => {
  act(() => {
    instance?.unmount();
  });
  instance = null;
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("remote-umi-react event bus lifecycle", () => {
  it("emits lifecycle events and releases subscriptions on unmount", () => {
    const unsubscribe = vi.fn();
    const eventBus: MicroEventBus = {
      emit: vi.fn(),
      on: vi.fn(() => unsubscribe),
    };
    window.history.pushState(null, "", "/umi");
    const container = document.createElement("div");
    document.body.append(container);
    const consoleInfo = vi
      .spyOn(console, "info")
      .mockImplementation(() => undefined);

    act(() => {
      instance = mount({
        basename: "/umi",
        container,
        eventBus,
      });
    });

    expect(eventBus.emit).toHaveBeenCalledWith(
      "remote.lifecycle.mounted",
      {
        basename: "/umi",
        remoteName: "remote_umi_react",
      },
      {
        source: "remote_umi_react",
      },
    );
    expect(eventBus.on).toHaveBeenCalledWith(
      "auth.session.updated",
      expect.any(Function),
    );

    const listener = vi.mocked(eventBus.on).mock.calls[0]?.[1];
    listener?.(
      {
        isAuthenticated: true,
        roles: ["legacy"],
        userId: "u_umi",
      },
      {
        source: "shell-react",
      },
    );
    expect(consoleInfo).toHaveBeenCalledWith(
      "remote_umi_react received auth.session.updated",
      {
        isAuthenticated: true,
        roles: ["legacy"],
        userId: "u_umi",
      },
      {
        source: "shell-react",
      },
    );

    act(() => {
      instance?.unmount();
    });
    instance = null;

    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(eventBus.emit).toHaveBeenCalledWith(
      "remote.lifecycle.unmounted",
      {
        basename: "/umi",
        remoteName: "remote_umi_react",
      },
      {
        source: "remote_umi_react",
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
    window.history.pushState(null, "", "/umi");
    const container = document.createElement("div");
    document.body.append(container);

    expect(() => {
      act(() => {
        mount({
          basename: "/umi",
          container,
          eventBus,
        });
      });
    }).toThrow("mounted listener failed");

    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
