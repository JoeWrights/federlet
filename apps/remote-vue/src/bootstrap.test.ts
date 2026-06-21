// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRemoteScopeClass } from "@federlet/style-isolation/scope";
import { mount, REMOTE_NAME } from "./mount";

vi.mock("./mount", () => ({
  REMOTE_NAME: "remote_vue",
  mount: vi.fn(),
}));

const mountMock = vi.mocked(mount);

beforeEach(() => {
  vi.resetModules();
  mountMock.mockClear();
  document.body.innerHTML = '<div id="root"></div>';
});

describe("remote-vue standalone bootstrap", () => {
  it("adds the remote scope class to the standalone root before mounting", async () => {
    await import("./bootstrap");

    const rootElement = document.getElementById("root");

    expect(
      rootElement?.classList.contains(createRemoteScopeClass(REMOTE_NAME)),
    ).toBe(true);
    expect(mountMock).toHaveBeenCalledWith({
      basename: "/",
      container: rootElement,
    });
  });
});
