// @vitest-environment jsdom

import { act } from "react-dom/test-utils";
import { describe, expect, it, vi } from "vitest";
import type { MicroEventBus } from "@federlet/shared-types";

vi.mock("./RemoteApp", () => ({
  RemoteApp() {
    throw new Error("remote-umi-react render failed");
  },
}));

const { mount } = await import("./mount");

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

describe("remote-umi-react mount failure event bus cleanup", () => {
  it("does not emit mounted and releases subscriptions when render fails", () => {
    const unsubscribe = vi.fn();
    const eventBus: MicroEventBus = {
      emit: vi.fn(),
      on: vi.fn(() => unsubscribe),
    };
    vi.spyOn(console, "error").mockImplementation(() => undefined);
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
    }).toThrow("remote-umi-react render failed");

    expect(eventBus.on).not.toHaveBeenCalled();
    expect(unsubscribe).not.toHaveBeenCalled();
    expect(eventBus.emit).not.toHaveBeenCalledWith(
      "remote.lifecycle.mounted",
      expect.anything(),
      expect.anything(),
    );
  });
});
