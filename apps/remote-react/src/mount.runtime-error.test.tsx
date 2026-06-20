// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { mount } from "./mount";

vi.mock("react-dom/client", () => ({
  createRoot: vi.fn(() => ({
    render: vi.fn(),
    unmount: vi.fn(),
  })),
}));

vi.mock("./App", () => ({
  App() {
    return <article>Mock React remote</article>;
  },
}));

const mockedCreateRoot = vi.mocked(createRoot);

describe("remote-react runtime error forwarding", () => {
  it("forwards React root runtime errors to the shell context", () => {
    const onError = vi.fn();
    const container = document.createElement("div");
    const instance = mount({
      basename: "/react",
      container,
      onError,
    });
    const rootOptions = mockedCreateRoot.mock.calls[0]?.[1] as
      | {
          onCaughtError?: (error: unknown) => void;
          onUncaughtError?: (error: unknown) => void;
        }
      | undefined;
    const uncaughtError = new Error("remote react uncaught render error");
    const caughtError = new Error("remote react caught render error");

    rootOptions?.onUncaughtError?.(uncaughtError);
    rootOptions?.onCaughtError?.(caughtError);

    expect(onError).toHaveBeenCalledWith(uncaughtError);
    expect(onError).toHaveBeenCalledWith(caughtError);

    instance.unmount();
  });
});
