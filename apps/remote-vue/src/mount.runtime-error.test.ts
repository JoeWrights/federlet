// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { createApp } from "vue";
import { mount } from "./mount";

const vueApp = vi.hoisted(() => ({
  config: {} as {
    errorHandler?: (error: unknown) => void;
  },
  mount: vi.fn(),
  unmount: vi.fn(),
  use: vi.fn(),
}));

vi.mock("vue", () => ({
  createApp: vi.fn(() => vueApp),
}));

vi.mock("vue-router", () => ({
  createRouter: vi.fn(() => ({})),
  createWebHistory: vi.fn(() => ({})),
}));

vi.mock("./App.vue", () => ({
  default: {},
}));

vi.mock("./routes", () => ({
  createVueRemoteRoutes: vi.fn(() => []),
}));

const mockedCreateApp = vi.mocked(createApp);

describe("remote-vue runtime error forwarding", () => {
  it("forwards Vue runtime errors to the shell context", () => {
    const onError = vi.fn();
    const container = document.createElement("div");
    const instance = mount({
      basename: "/vue",
      container,
      onError,
    });
    const app = mockedCreateApp.mock.results[0]?.value;
    const runtimeError = new Error("remote vue render crashed");

    app.config.errorHandler?.(runtimeError);

    expect(onError).toHaveBeenCalledWith(runtimeError);

    instance.unmount();
  });
});
