// @vitest-environment jsdom

import { defineComponent } from "vue";
import { describe, expect, it, vi } from "vitest";
import type { MicroEventBus } from "@federlet/shared-types";

vi.mock("./App.vue", () => ({
  default: defineComponent({
    setup() {
      throw new Error("remote-vue render failed");
    },
  }),
}));

const { mount } = await import("./mount");

describe("remote-vue mount failure event bus cleanup", () => {
  it("does not emit mounted and releases subscriptions when mount fails", () => {
    const unsubscribe = vi.fn();
    const eventBus: MicroEventBus = {
      emit: vi.fn(),
      on: vi.fn(() => unsubscribe),
    };
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const container = document.createElement("div");
    document.body.append(container);

    expect(() =>
      mount({
        basename: "/vue",
        container,
        eventBus,
      }),
    ).toThrow("remote-vue render failed");

    expect(eventBus.on).not.toHaveBeenCalled();
    expect(unsubscribe).not.toHaveBeenCalled();
    expect(eventBus.emit).not.toHaveBeenCalledWith(
      "remote.lifecycle.mounted",
      expect.anything(),
      expect.anything(),
    );
  });
});
