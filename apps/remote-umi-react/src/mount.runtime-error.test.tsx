// @vitest-environment jsdom

import React from "react";
import ReactDOM from "react-dom";
import { describe, expect, it, vi } from "vitest";
import { mount } from "./mount";

vi.mock("react-dom", () => ({
  default: {
    render: vi.fn(),
    unmountComponentAtNode: vi.fn(),
  },
}));

vi.mock("./RemoteApp", () => ({
  RemoteApp() {
    return <article>Mock Umi remote</article>;
  },
}));

const mockedReactDom = vi.mocked(ReactDOM);

interface RemoteRuntimeBoundaryProps {
  onError: (error: unknown) => void;
  shouldRethrow: () => boolean;
}

type RemoteRuntimeBoundaryInstance =
  React.Component<RemoteRuntimeBoundaryProps> & {
    componentDidCatch(error: unknown): void;
  };

describe("remote-umi-react runtime error forwarding", () => {
  it("forwards React 17 error boundary errors to the shell context", () => {
    const onError = vi.fn();
    const container = document.createElement("div");
    const instance = mount({
      basename: "/umi",
      container,
      onError,
    });
    const renderedElement = mockedReactDom.render.mock.calls[0]?.[0] as unknown as
      | React.ReactElement<{ children: React.ReactNode }>
      | undefined;
    const boundaryElement = React.Children.only(
      renderedElement?.props.children,
    ) as React.ReactElement<RemoteRuntimeBoundaryProps>;
    const Boundary = boundaryElement.type as new (
      props: RemoteRuntimeBoundaryProps,
    ) => RemoteRuntimeBoundaryInstance;
    const boundary = new Boundary(boundaryElement.props);
    const runtimeError = new Error("remote umi render crashed");

    boundary.componentDidCatch(runtimeError);

    expect(onError).toHaveBeenCalledWith(runtimeError);

    instance.unmount();
  });
});
